import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShoppingCart, Plus, Minus, Trash2, Search, Clock, ChevronLeft, Home, FileText, Share2, X, Check, Zap, Bike, Store, Utensils, ShoppingBag } from "lucide-react";
import { formatCurrency, checkStoreStatus } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface SelectedVariation { group: string; selected: { name: string; price: number }[]; }
interface CartItem { product: any; quantity: number; notes: string; variations: SelectedVariation[]; variationsPrice: number; }

const PublicStoreAnotaAI = ({ store, categories, products, productVariations, deliveryZones }: {
  store: any; categories: any[]; products: any[]; productVariations: Record<string, any[]>; deliveryZones: any[];
}) => {
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeOrders, setActiveOrders] = useState<{ id: string; status: string; order_number?: string }[]>([]);
  const [tableSession, setTableSession] = useState<any>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [variationModalOpen, setVariationModalOpen] = useState(false);
  const [variationProduct, setVariationProduct] = useState<any>(null);
  const [variationSelections, setVariationSelections] = useState<Record<string, { name: string; price: number }[]>>({});
  const [session, setSession] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [itemNotes, setItemNotes] = useState("");
  const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'cart'>('home');
  const [detailQty, setDetailQty] = useState(1);
  const [flavorSearch, setFlavorSearch] = useState("");
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [form, setForm] = useState({
    email: "", password: "", customer_name: "", customer_phone: "",
    customer_address: "", neighborhood: "", delivery_type: "delivery",
    payment_method: "", notes: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      supabase.from("profiles").select("*").eq("id", session.user.id).single().then(({ data }) => {
        if (data) {
          setForm(prev => ({ ...prev, customer_name: (data as any).full_name || prev.customer_name, customer_phone: (data as any).phone || prev.customer_phone, customer_address: (data as any).address || prev.customer_address, neighborhood: (data as any).neighborhood || prev.neighborhood }));
        }
      });
    }
  }, [session]);

  useEffect(() => {
    if (store) {
      const storedTable = localStorage.getItem(`frfood_table_${store.id}`);
      if (storedTable) {
        try {
          const parsed = JSON.parse(storedTable);
          if (new Date().getTime() - parsed.timestamp < 4 * 60 * 60 * 1000) setTableSession(parsed);
          else localStorage.removeItem(`frfood_table_${store.id}`);
        } catch (e) {}
      }
    }
  }, [store]);

  useEffect(() => {
    if (!store) return;
    const getActiveOrders = async () => {
      const stored = localStorage.getItem(`active_orders_${store.id}`);
      const oldId = localStorage.getItem(`latest_order_${store.id}`);
      let ids: string[] = [];
      if (stored) { try { ids = JSON.parse(stored); } catch (e) {} }
      if (oldId && !ids.includes(oldId)) { ids.push(oldId); localStorage.setItem(`active_orders_${store.id}`, JSON.stringify(ids)); localStorage.removeItem(`latest_order_${store.id}`); }
      if (ids.length > 0) {
        const { data } = await supabase.from("orders").select("id, status, order_number").in("id", ids);
        if (data) {
          const stillActive = data.filter(o => !["delivered", "picked_up", "cancelled"].includes(o.status));
          setActiveOrders(stillActive);
          localStorage.setItem(`active_orders_${store.id}`, JSON.stringify(stillActive.map(o => o.id)));
        }
      }
    };
    getActiveOrders();
  }, [store?.id]);

  useEffect(() => {
    const handleScroll = () => setShowStickyHeader(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const storeOpen = checkStoreStatus(store);
  const getTodayHours = () => {
    if (!store?.opening_hours || !Array.isArray(store.opening_hours)) return null;
    const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const today = dayNames[new Date().getDay()];
    const todayConfig = (store.opening_hours as any[]).find((d: any) => d.day === today);
    if (!todayConfig?.enabled || !todayConfig.periods?.length) return null;
    return `${todayConfig.periods[0].open} às ${todayConfig.periods[0].close}`;
  };
  const todayHours = getTodayHours();

  // Cart logic
  const handleAddToCart = (product: any) => {
    if (!storeOpen) { toast.error("Loja fechada no momento"); return; }
    if (product.is_sold_out || (product.manage_stock && product.stock_quantity <= 0)) { toast.error("Este produto está esgotado"); return; }
    const vars = productVariations[product.id];
    if (vars && vars.length > 0) { setVariationProduct(product); setVariationSelections({}); setItemNotes(""); setDetailQty(1); setFlavorSearch(""); setVariationModalOpen(true); }
    else { addToCartDirect(product, [], 0); }
  };

  const addToCartDirect = (product: any, selectedVariations: SelectedVariation[], variationsPrice: number, notes: string = "", qty: number = 1) => {
    setCart((prev) => {
      if (selectedVariations.length > 0 || notes) return [...prev, { product, quantity: qty, notes, variations: selectedVariations, variationsPrice }];
      const existing = prev.find((i) => i.product.id === product.id && i.variations.length === 0 && !i.notes);
      if (existing) return prev.map((i) => i.product.id === product.id && i.variations.length === 0 && !i.notes ? { ...i, quantity: i.quantity + qty } : i);
      return [...prev, { product, quantity: qty, notes, variations: [], variationsPrice: 0 }];
    });
    toast.success(`${product.name} adicionado!`);
  };

  const confirmVariationSelection = () => {
    if (!variationProduct) return;
    const vars = productVariations[variationProduct.id] || [];
    for (const v of vars) { if (v.required) { const selected = variationSelections[v.id] || []; if (selected.length === 0) { toast.error(`Selecione uma opção para "${v.name}"`); return; } } }
    const selectedVariations: SelectedVariation[] = [];
    let totalVarPrice = 0;
    for (const v of vars) {
      const selected = variationSelections[v.id] || [];
      if (selected.length > 0) {
        selectedVariations.push({ group: v.name, selected });
        if ((v as any).is_half_half) totalVarPrice += Math.max(...selected.map(s => s.price));
        else totalVarPrice += selected.reduce((sum, s) => sum + s.price, 0);
      }
    }
    addToCartDirect(variationProduct, selectedVariations, totalVarPrice, itemNotes, detailQty);
    setVariationModalOpen(false); setVariationProduct(null); setItemNotes(""); setDetailQty(1); setFlavorSearch("");
  };

  const toggleVariationOption = (variationId: string, option: { name: string; price: number }, maxSelections: number) => {
    setVariationSelections(prev => {
      const current = prev[variationId] || [];
      const exists = current.find(o => o.name === option.name);
      if (exists) return { ...prev, [variationId]: current.filter(o => o.name !== option.name) };
      if (maxSelections === 1) return { ...prev, [variationId]: [option] };
      if (current.length >= maxSelections) { toast.error(`Máximo de ${maxSelections} opções`); return prev; }
      return { ...prev, [variationId]: [...current, option] };
    });
  };

  const updateQuantity = (index: number, delta: number) => { setCart((prev) => prev.map((item, i) => i === index ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter((i) => i.quantity > 0)); };
  const removeFromCart = (index: number) => { setCart((prev) => prev.filter((_, i) => i !== index)); };
  const getItemPrice = (item: CartItem) => { const basePrice = item.product.promotional_price > 0 ? Number(item.product.promotional_price) : Number(item.product.price); return basePrice + item.variationsPrice; };
  const subtotal = cart.reduce((s, i) => s + getItemPrice(i) * i.quantity, 0);

  const applyCoupon = async () => {
    if (!store || !couponCode.trim()) return;
    const { data } = await supabase.from("coupons").select("*").eq("store_id", store.id).eq("code", couponCode.toUpperCase()).eq("is_active", true).maybeSingle();
    if (!data) { toast.error("Cupom inválido"); return; }
    if (data.min_order_value && subtotal < data.min_order_value) { toast.error(`Pedido mínimo R$ ${data.min_order_value.toFixed(2)}`); return; }
    if (data.max_uses && data.current_uses >= data.max_uses) { toast.error("Cupom esgotado"); return; }
    setAppliedCoupon(data); toast.success("Cupom aplicado!");
  };

  const selectedZone = deliveryZones.find((z) => z.neighborhood === form.neighborhood);
  const deliveryFee = form.delivery_type === "delivery" ? Number(selectedZone?.fee || 0) : 0;
  let discount = 0;
  if (appliedCoupon) { discount = appliedCoupon.discount_type === "percentage" ? subtotal * (appliedCoupon.discount_value / 100) : appliedCoupon.discount_value; }
  const total = Number(subtotal) - Number(discount) + deliveryFee;

  const handleCheckout = async () => {
    if (!store || cart.length === 0) return;
    setIsProcessing(true);
    let finalDeliveryType = form.delivery_type;
    let origin = "delivery";
    let comandaId = null;
    if (tableSession) {
      finalDeliveryType = "table"; origin = "qr_code";
      const { data: openComanda } = await supabase.from("comandas").select("id").eq("store_id", store.id).eq("table_id", tableSession.table_id).eq("status", "open").maybeSingle();
      if (openComanda) { comandaId = openComanda.id; }
      else {
        const { data: newComanda, error: newComandaError } = await supabase.from("comandas").insert({ store_id: store.id, table_id: tableSession.table_id, status: "open", subtotal: 0, discount: 0, total: 0 }).select().single();
        if (newComandaError) { toast.error("Erro ao iniciar comanda"); setIsProcessing(false); return; }
        if (newComanda) { comandaId = (newComanda as any).id; await supabase.from("tables").update({ status: 'occupied', current_comanda_id: comandaId }).eq("id", tableSession.table_id); }
      }
    }
    if (!tableSession) {
      if (!form.customer_name || !form.customer_phone) { toast.error("Preencha o nome e telefone"); setIsProcessing(false); return; }
      if (form.delivery_type === "delivery" && !form.customer_address.trim()) { toast.error("Preencha o endereço"); setIsProcessing(false); return; }
      if (!form.payment_method) { toast.error("Selecione a forma de pagamento"); setIsProcessing(false); return; }
    }
    const orderId = crypto.randomUUID();
    const { error } = await supabase.from("orders").insert({
      id: orderId, store_id: store.id, customer_name: form.customer_name || (tableSession ? `Mesa ${tableSession.table_name}` : ""),
      customer_phone: form.customer_phone || "00000000000", customer_address: form.customer_address, neighborhood: form.neighborhood,
      delivery_type: finalDeliveryType, delivery_fee: tableSession ? 0 : deliveryFee, subtotal: Number(subtotal),
      discount: Number(discount), total: tableSession ? (Number(subtotal) - Number(discount)) : total,
      coupon_code: appliedCoupon?.code || "", notes: form.notes, payment_method: tableSession ? "comanda" : form.payment_method,
      origin: origin, comanda_id: comandaId, table_id: tableSession ? tableSession.table_id : null
    });
    if (error) { toast.error("Erro ao criar pedido"); setIsProcessing(false); return; }
    await supabase.from("order_items").insert(cart.map((i) => ({
      order_id: orderId, product_id: i.product.id, product_name: i.product.name, quantity: i.quantity,
      unit_price: getItemPrice(i), subtotal: getItemPrice(i) * i.quantity, notes: i.notes,
      variations: (i.variations.length > 0 ? i.variations : []) as any,
    })));
    if (appliedCoupon) { await supabase.from("coupons").update({ current_uses: appliedCoupon.current_uses + 1 }).eq("id", appliedCoupon.id); }
    const stored = localStorage.getItem(`active_orders_${store.id}`);
    let activeIds: string[] = [];
    if (stored) { try { activeIds = JSON.parse(stored); } catch (e) {} }
    if (!activeIds.includes(orderId)) { activeIds.push(orderId); localStorage.setItem(`active_orders_${store.id}`, JSON.stringify(activeIds)); }
    setCart([]); setCheckoutOpen(false); setCartOpen(false); setAppliedCoupon(null); setCouponCode(""); setIsProcessing(false);
    toast.success("Pedido enviado!"); navigate(`/pedido/${orderId}`);
  };

  const filteredProducts = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.description || "").toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  }).sort((a, b) => {
    if (a.is_sold_out && !b.is_sold_out) return 1;
    if (!a.is_sold_out && b.is_sold_out) return -1;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  const productsByCategory = categories.map((cat) => ({ ...cat, products: filteredProducts.filter((p) => p.category_id === cat.id) }));
  const uncategorized = filteredProducts.filter((p) => !p.category_id);
  const storeColor = store?.primary_color || "#f37021";

  // "Os mais pedidos" - top 6 products with images
  const popularProducts = products.filter(p => p.image_url && !p.is_sold_out).slice(0, 8);

  return (
    <div className="anotaai-layout" style={{ "--store-accent": storeColor } as React.CSSProperties}>
      {/* Active Orders Banner */}
      {activeOrders.length > 0 && (
        <div className="anotaai-active-orders">
          {activeOrders.map((order) => (
            <div key={order.id} className="anotaai-active-order-item">
              <div className="anotaai-active-order-left"><Zap className="w-4 h-4 animate-pulse" /><span>Pedido em andamento!</span></div>
              <Link to={`/pedido/${order.id}`} className="anotaai-active-order-link">Ver Status</Link>
            </div>
          ))}
        </div>
      )}

      {/* Table Session Banner */}
      {tableSession && (
        <div className="anotaai-table-banner">
          <Utensils className="w-4 h-4" />
          <span>Você está na <strong>{tableSession.table_name}</strong></span>
        </div>
      )}

      {/* Sticky Header */}
      {showStickyHeader && (
        <div className="anotaai-sticky-header">
          <span className="anotaai-sticky-name">{store.name}</span>
          <button onClick={() => setSearchOpen(!searchOpen)} className="anotaai-icon-btn"><Search className="w-5 h-5" /></button>
        </div>
      )}

      {/* Main Content */}
      <div className="anotaai-container">
        {/* Banner */}
        <div className="anotaai-banner">
          <img src={store.banner_url || store.banner_mobile_url || ""} alt="" className="anotaai-banner-img" />
        </div>

        {/* Store Info Bar */}
        <div className="anotaai-store-info">
          <h1 className="anotaai-store-name">{((store as any).display_name_type === 'razao_social' && (store as any).razao_social) ? (store as any).razao_social : store.name}</h1>
          <div className="anotaai-store-actions">
            <button onClick={() => setSearchOpen(!searchOpen)} className="anotaai-icon-btn"><Search className="w-5 h-5" /></button>
            <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copiado!"); }} className="anotaai-icon-btn"><Share2 className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Status Line */}
        <div className="anotaai-status-line">
          <span className="anotaai-status-text">
            {storeOpen ? (todayHours ? `Aberto • Fecha às ${todayHours.split("às ")[1]}` : "Aberto agora") : (todayHours ? `Abre hoje às ${todayHours.split(" às ")[0]?.replace("às ", "")}` : "Fechado")}
          </span>
          <span className="anotaai-status-dot">•</span>
          <span className="anotaai-status-text">Pedido mín. {formatCurrency(Number(store.min_order_value || 0))}</span>
          <button onClick={() => setInfoDialogOpen(true)} className="anotaai-profile-link">Perfil da loja</button>
        </div>

        {/* Closed Alert */}
        {!storeOpen && (
          <div className="anotaai-closed-alert">
            Loja fechada{todayHours ? `, abre hoje às ${todayHours.split(" às ")[0]?.replace("às ", "")}` : ""}
          </div>
        )}

        {/* Search Bar (expandable) */}
        {searchOpen && (
          <div className="anotaai-search-bar">
            <Search className="w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Buscar no cardápio..." value={search} onChange={(e) => setSearch(e.target.value)} className="anotaai-search-input" autoFocus />
            <button onClick={() => { setSearch(""); setSearchOpen(false); }} className="anotaai-icon-btn-sm"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* "Os mais pedidos" Carousel */}
        {popularProducts.length > 0 && !search && (
          <div className="anotaai-popular-section">
            <h2 className="anotaai-section-title">Os mais pedidos</h2>
            <div className="anotaai-popular-scroll">
              {popularProducts.map(p => (
                <button key={p.id} onClick={() => handleAddToCart(p)} className="anotaai-popular-item">
                  <div className="anotaai-popular-img-wrap">
                    <img src={p.image_url} alt={p.name} className="anotaai-popular-img" />
                  </div>
                  <span className="anotaai-popular-name">{p.name}</span>
                  {p.promotional_price > 0 ? (
                    <span className="anotaai-popular-price">A partir de <strong>{formatCurrency(p.promotional_price)}</strong></span>
                  ) : (
                    <span className="anotaai-popular-price">A partir de <strong>{formatCurrency(p.price)}</strong></span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Categories & Products */}
        <div className="anotaai-menu">
          {productsByCategory.map(cat => cat.products.length > 0 && (
            <div key={cat.id} id={`cat-${cat.id}`} className="anotaai-category-section">
              <h2 className="anotaai-category-title">{cat.name}</h2>
              <div className="anotaai-products-grid">
                {cat.products.map(p => (
                  <AnotaAIProductCard key={p.id} product={p} onAdd={() => handleAddToCart(p)} />
                ))}
              </div>
            </div>
          ))}
          {uncategorized.length > 0 && (
            <div className="anotaai-category-section">
              <h2 className="anotaai-category-title">Outros</h2>
              <div className="anotaai-products-grid">
                {uncategorized.map(p => (
                  <AnotaAIProductCard key={p.id} product={p} onAdd={() => handleAddToCart(p)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full-Page Product Detail (Anota AI Style) */}
      {variationModalOpen && variationProduct && (
        <div className="anotaai-detail-overlay">
          {/* Header */}
          <div className="anotaai-detail-header">
            <button onClick={() => { setVariationModalOpen(false); setFlavorSearch(""); }} className="anotaai-back-btn"><ChevronLeft className="w-5 h-5" /></button>
            <span className="anotaai-modal-title">Detalhes do produto</span>
            <div className="anotaai-store-actions">
              <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copiado!"); }} className="anotaai-icon-btn"><Search className="w-5 h-5" /></button>
              <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copiado!"); }} className="anotaai-icon-btn"><Share2 className="w-5 h-5" /></button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="anotaai-detail-body">
            {/* Product Info */}
            <div className="anotaai-detail-product-info">
              {variationProduct.image_url ? (
                <img src={variationProduct.image_url} className="anotaai-detail-product-img" alt={variationProduct.name} />
              ) : (
                <div className="anotaai-detail-product-img anotaai-detail-product-placeholder"><Utensils className="w-10 h-10 text-gray-300" /></div>
              )}
              <div className="anotaai-detail-product-text">
                <h2 className="anotaai-detail-product-name">{variationProduct.name}</h2>
                {variationProduct.description && <p className="anotaai-detail-product-desc">{variationProduct.description}</p>}
              </div>
            </div>

            {/* Search within flavors */}
            <div className="anotaai-detail-search">
              <Search className="w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Pesquise pelo nome" value={flavorSearch} onChange={(e) => setFlavorSearch(e.target.value)} className="anotaai-search-input" />
            </div>

            {/* Sabores mais pedidos Carousel */}
            {(() => {
              const vars = productVariations[variationProduct.id] || [];
              const firstFlavorGroup = vars.find((v: any) => v.options?.some((o: any) => o.image_url));
              const popularFlavors = firstFlavorGroup ? (firstFlavorGroup.options || []).filter((o: any) => o.image_url).slice(0, 8) : [];
              if (popularFlavors.length === 0) return null;
              return (
                <div className="anotaai-popular-section">
                  <h2 className="anotaai-section-title">Sabores mais pedidos</h2>
                  <div className="anotaai-popular-scroll">
                    {popularFlavors.map((opt: any, i: number) => (
                      <button key={i} onClick={() => firstFlavorGroup && toggleVariationOption(firstFlavorGroup.id, opt, firstFlavorGroup.max_selections)} className="anotaai-popular-item">
                        <div className="anotaai-popular-img-wrap">
                          <img src={opt.image_url} alt={opt.name} className="anotaai-popular-img" />
                        </div>
                        <span className="anotaai-popular-name">{opt.name}</span>
                        <span className="anotaai-popular-price"><strong>{formatCurrency(opt.price)}</strong></span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Variation Groups */}
            {(productVariations[variationProduct.id] || []).map((v: any) => {
              const filteredOptions = flavorSearch
                ? (v.options || []).filter((opt: any) => opt.name.toLowerCase().includes(flavorSearch.toLowerCase()))
                : (v.options || []);
              return (
                <div key={v.id} className="anotaai-variation-group">
                  <div className="anotaai-variation-header">
                    <div>
                      <h3 className="anotaai-variation-title">{v.name}</h3>
                      <p className="anotaai-variation-subtitle">
                        {v.max_selections === 1 ? "Escolha 1 opção" : `Escolha entre 1 a ${v.max_selections} opções`}
                      </p>
                    </div>
                    {v.required && <span className="anotaai-badge-required">Obrigatório</span>}
                  </div>
                  <div className="anotaai-variation-options">
                    {filteredOptions.map((opt: any, oi: number) => {
                      const isSelected = (variationSelections[v.id] || []).some((s: any) => s.name === opt.name);
                      return (
                        <button key={oi} onClick={() => toggleVariationOption(v.id, opt, v.max_selections)} className={`anotaai-detail-option ${isSelected ? "selected" : ""}`}>
                          {opt.image_url ? (
                            <img src={opt.image_url} alt={opt.name} className="anotaai-detail-option-thumb" />
                          ) : (
                            <div className="anotaai-detail-option-thumb anotaai-detail-option-placeholder" />
                          )}
                          <div className="anotaai-detail-option-info">
                            <span className="anotaai-option-name">{opt.name}</span>
                            {opt.description && <span className="anotaai-option-desc">{opt.description}</span>}
                            {opt.price > 0 && <span className="anotaai-option-price">{formatCurrency(opt.price)}</span>}
                          </div>
                          <div className={`anotaai-checkbox ${isSelected ? "checked" : ""}`}>
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Observações */}
            <div className="anotaai-variation-group">
              <div className="anotaai-variation-header"><h3 className="anotaai-variation-title">Observações</h3></div>
              <div className="p-4">
                <Textarea placeholder="Ex.: Tirar cebola, ovo, etc." className="anotaai-textarea" value={itemNotes} onChange={(e) => setItemNotes(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="anotaai-detail-footer">
            <div className="anotaai-qty-controls">
              <button onClick={() => setDetailQty(Math.max(1, detailQty - 1))} className="anotaai-qty-btn"><Minus className="w-4 h-4" /></button>
              <span className="anotaai-qty-value">{detailQty}</span>
              <button onClick={() => setDetailQty(detailQty + 1)} className="anotaai-qty-btn accent"><Plus className="w-4 h-4" /></button>
            </div>
            {(() => {
              const vars = productVariations[variationProduct.id] || [];
              const hasRequired = vars.some((v: any) => v.required);
              const allRequiredMet = vars.every((v: any) => !v.required || (variationSelections[v.id] || []).length > 0);
              const basePrice = variationProduct.promotional_price > 0 ? variationProduct.promotional_price : variationProduct.price;
              const varPrice = Object.entries(variationSelections).reduce((sum, [vid, opts]) => {
                const v = vars.find((vv: any) => vv.id === vid);
                if (v && (v as any).is_half_half) return sum + Math.max(...opts.map(o => o.price), 0);
                return sum + opts.reduce((s, o) => s + o.price, 0);
              }, 0);
              const totalPrice = (basePrice + varPrice) * detailQty;

              if (hasRequired && !allRequiredMet) {
                return <button className="anotaai-add-btn disabled" disabled>Escolha sabor</button>;
              }
              return (
                <button onClick={confirmVariationSelection} className="anotaai-add-btn">
                  <span>Adicionar</span>
                  <span>{formatCurrency(totalPrice)}</span>
                </button>
              );
            })()}
          </div>
        </div>
      )}


      {/* Cart Dialog */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="anotaai-modal">
          <div className="anotaai-modal-header">
            <button onClick={() => setCartOpen(false)} className="anotaai-back-btn"><ChevronLeft className="w-5 h-5" /></button>
            <span className="anotaai-modal-title">Carrinho</span>
            <div className="w-8" />
          </div>
          <div className="anotaai-modal-body">
            {cart.length === 0 ? (
              <div className="anotaai-cart-empty">
                <p>Seu carrinho está vazio</p>
                <button onClick={() => setCartOpen(false)} className="anotaai-add-btn" style={{maxWidth: "300px", margin: "16px auto"}}>Ver cardápio</button>
              </div>
            ) : (
              <div className="anotaai-cart-items">
                {cart.map((item, idx) => (
                  <div key={idx} className="anotaai-cart-item">
                    <div className="anotaai-cart-item-info">
                      <p className="anotaai-cart-item-name">{item.product.name}</p>
                      {item.variations.length > 0 && (
                        <div className="anotaai-cart-item-vars">
                          {item.variations.map((v, vi) => <span key={vi}>{v.group}: {v.selected.map(s => s.name).join(", ")}</span>)}
                        </div>
                      )}
                      {item.notes && <p className="anotaai-cart-item-note">Obs: {item.notes}</p>}
                      <p className="anotaai-cart-item-price">{formatCurrency(getItemPrice(item) * item.quantity)}</p>
                    </div>
                    <div className="anotaai-cart-item-actions">
                      <div className="anotaai-qty-controls small">
                        <button onClick={() => updateQuantity(idx, -1)} className="anotaai-qty-btn"><Minus className="w-3 h-3" /></button>
                        <span className="anotaai-qty-value">{item.quantity}</span>
                        <button onClick={() => updateQuantity(idx, 1)} className="anotaai-qty-btn accent"><Plus className="w-3 h-3" /></button>
                      </div>
                      <button onClick={() => removeFromCart(idx)} className="anotaai-remove-btn"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
                <div className="p-4">
                  <div className="flex gap-2">
                    <Input placeholder="Tem um cupom?" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
                    <Button onClick={applyCoupon} variant="outline">Aplicar</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          {cart.length > 0 && (
            <div className="anotaai-modal-footer">
              <button onClick={() => { setCartOpen(false); setCheckoutOpen(true); }} className="anotaai-add-btn full">
                <span>Finalizar Pedido</span>
                <span>{formatCurrency(subtotal - discount)}</span>
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="anotaai-modal">
          <div className="anotaai-modal-header">
            <button onClick={() => setCheckoutOpen(false)} className="anotaai-back-btn"><ChevronLeft className="w-5 h-5" /></button>
            <span className="anotaai-modal-title">Finalizar</span>
            <div className="w-8" />
          </div>
          <div className="anotaai-modal-body p-5 space-y-4">
            {tableSession ? (
              <div className="anotaai-table-checkout"><ShoppingBag className="w-5 h-5" /><p>Mesa {tableSession.table_name}</p></div>
            ) : (
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} /></div>
                <div><Label>Tipo</Label>
                  <Select value={form.delivery_type} onValueChange={(v) => setForm({ ...form, delivery_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {store.delivery_enabled && <SelectItem value="delivery">Entrega</SelectItem>}
                      {store.pickup_enabled && <SelectItem value="pickup">Retirada</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                {form.delivery_type === "delivery" && (
                  <div className="space-y-3">
                    <div><Label>Seu Bairro</Label>
                      <Select value={form.neighborhood} onValueChange={(v) => setForm({ ...form, neighborhood: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione seu bairro" /></SelectTrigger>
                        <SelectContent>{deliveryZones.map(zone => <SelectItem key={zone.id} value={zone.neighborhood}>{zone.neighborhood} ({formatCurrency(zone.fee)})</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Endereço</Label><Input value={form.customer_address} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} /></div>
                  </div>
                )}
                <div><Label>Pagamento</Label>
                  <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="anotaai-summary">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Desconto</span><span>-{formatCurrency(discount)}</span></div>}
              {form.delivery_type === "delivery" && <div className="flex justify-between text-sm"><span>Taxa de Entrega</span><span>{formatCurrency(deliveryFee)}</span></div>}
              <Separator />
              <div className="flex justify-between font-bold text-lg"><span>Total</span><span style={{color: "var(--store-accent)"}}>{formatCurrency(total)}</span></div>
            </div>
          </div>
          <div className="anotaai-modal-footer">
            <button onClick={handleCheckout} className="anotaai-add-btn full" disabled={isProcessing}>
              {isProcessing ? "Enviando..." : "Confirmar Pedido"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Store Info Dialog */}
      <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
        <DialogContent className="anotaai-modal">
          <div className="anotaai-modal-header">
            <button onClick={() => setInfoDialogOpen(false)} className="anotaai-back-btn"><ChevronLeft className="w-5 h-5" /></button>
            <span className="anotaai-modal-title">Perfil da loja</span>
            <div className="w-8" />
          </div>
          <div className="anotaai-modal-body p-5 space-y-6">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full mx-auto overflow-hidden border-2 border-gray-200"><img src={store.logo_url || ""} className="w-full h-full object-cover" /></div>
              <h2 className="font-bold text-xl mt-3">{store.name}</h2>
              <div className={`inline-flex px-3 py-1 rounded-full text-xs font-bold mt-2 ${storeOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{storeOpen ? "Aberto" : "Fechado"}</div>
            </div>
            <div>
              <h3 className="font-bold text-sm mb-2 flex items-center gap-2"><Clock className="w-4 h-4" /> Horários</h3>
              {(store.opening_hours || []).map((day: any, i: number) => (
                <div key={i} className="flex justify-between text-xs text-gray-600 py-1">
                  <span>{day.day?.substring(0, 3)}</span>
                  <span>{day.enabled ? (day.periods?.[0] ? `${day.periods[0].open} às ${day.periods[0].close}` : "Fechado") : "Fechado"}</span>
                </div>
              ))}
            </div>
            <div>
              <h3 className="font-bold text-sm mb-2">Formas de Pagamento</h3>
              <div className="flex flex-wrap gap-2 text-xs"><span className="px-3 py-1.5 bg-gray-100 rounded">Pix</span><span className="px-3 py-1.5 bg-gray-100 rounded">Dinheiro</span><span className="px-3 py-1.5 bg-gray-100 rounded">Cartão</span></div>
            </div>
            {store.cnpj && <p className="text-xs text-gray-400 text-center">CNPJ: {store.cnpj}</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <div className="anotaai-bottom-nav">
        <button onClick={() => { setActiveTab('home'); setCartOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`anotaai-nav-item ${activeTab === 'home' ? 'active' : ''}`}>
          <Home className="w-5 h-5" />
          <span>Início</span>
        </button>
        <button onClick={() => { if (activeOrders.length > 0) navigate(`/pedido/${activeOrders[0].id}`); else toast.info("Nenhum pedido em andamento"); }} className={`anotaai-nav-item ${activeTab === 'orders' ? 'active' : ''}`}>
          <FileText className="w-5 h-5" />
          <span>Pedidos</span>
          {activeOrders.length > 0 && <span className="anotaai-nav-badge">{activeOrders.length}</span>}
        </button>
        <button onClick={() => { setActiveTab('cart'); setCartOpen(true); }} className={`anotaai-nav-item ${activeTab === 'cart' ? 'active' : ''}`}>
          <ShoppingCart className="w-5 h-5" />
          <span>Carrinho</span>
          {cart.length > 0 && <span className="anotaai-nav-badge">{cart.reduce((s, i) => s + i.quantity, 0)}</span>}
        </button>
      </div>
    </div>
  );
};

/* Product Card - Anota AI Style */
const AnotaAIProductCard = ({ product, onAdd }: { product: any; onAdd: () => void }) => {
  const isSoldOut = product.is_sold_out;
  const price = product.promotional_price > 0 ? product.promotional_price : product.price;

  return (
    <button onClick={onAdd} className={`anotaai-product-card ${isSoldOut ? "sold-out" : ""}`} disabled={isSoldOut}>
      <div className="anotaai-product-info">
        <h3 className="anotaai-product-name">{product.name}</h3>
        {product.description && <p className="anotaai-product-desc">{product.description}</p>}
        <div className="anotaai-product-pricing">
          {product.promotional_price > 0 && <span className="anotaai-price-old">{formatCurrency(product.price)}</span>}
          <span className="anotaai-price-label">A partir de</span>
          <span className="anotaai-price-current">{formatCurrency(price)}</span>
        </div>
        {isSoldOut && <span className="anotaai-sold-out-badge">Esgotado</span>}
      </div>
      {product.image_url && (
        <div className="anotaai-product-img-wrap">
          <img src={product.image_url} alt={product.name} className="anotaai-product-img" />
        </div>
      )}
    </button>
  );
};

export default PublicStoreAnotaAI;
