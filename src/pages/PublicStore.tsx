import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShoppingBag, Plus, Minus, Trash2, X, Send, MapPin, Search, Star, Clock, Phone, Mail, Lock, Check, AlertTriangle, Zap, Bike, Store, Utensils, ChevronLeft } from "lucide-react";
import { formatCurrency, checkStoreStatus } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import PublicStoreAnotaAI from "./PublicStoreAnotaAI";
import "@/styles/anotaai.css";

interface SelectedVariation {
  group: string;
  selected: { name: string; price: number }[];
}

interface CartItem {
  product: any;
  quantity: number;
  notes: string;
  variations: SelectedVariation[];
  variationsPrice: number;
}

const PublicStore = ({ explicitSlug }: { explicitSlug?: string }) => {
  const params = useParams();
  const slug = explicitSlug || params.slug;
  const navigate = useNavigate();
  const [store, setStore] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [productVariations, setProductVariations] = useState<Record<string, any[]>>({});
  const [deliveryZones, setDeliveryZones] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [activeOrders, setActiveOrders] = useState<{ id: string; status: string; order_number?: string }[]>([]);
  const [tableSession, setTableSession] = useState<any>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [variationModalOpen, setVariationModalOpen] = useState(false);
  const [variationProduct, setVariationProduct] = useState<any>(null);
  const [variationSelections, setVariationSelections] = useState<Record<string, { name: string; price: number }[]>>({});
  const [session, setSession] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [itemNotes, setItemNotes] = useState("");
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
          setForm(prev => ({
            ...prev,
            customer_name: (data as any).full_name || prev.customer_name,
            customer_phone: (data as any).phone || prev.customer_phone,
            customer_address: (data as any).address || prev.customer_address,
            neighborhood: (data as any).neighborhood || prev.neighborhood,
          }));
        }
      });
    }
  }, [session]);

  const fetchData = useCallback(async () => {
    const { data: s } = await supabase.from("stores").select("*").eq("slug", slug).single();
    if (!s) { setLoading(false); return; }
    setStore(s);
    const storedTable = localStorage.getItem(`frfood_table_${s.id}`);
    if (storedTable) {
      try {
        const parsed = JSON.parse(storedTable);
        if (new Date().getTime() - parsed.timestamp < 4 * 60 * 60 * 1000) { setTableSession(parsed); }
        else { localStorage.removeItem(`frfood_table_${s.id}`); }
      } catch (e) { }
    }
    const [cats, prods, zones] = await Promise.all([
      supabase.from("categories").select("*").eq("store_id", s.id).eq("is_active", true).order("sort_order"),
      supabase.from("products").select("*").eq("store_id", s.id).eq("is_active", true).order("sort_order"),
      supabase.from("delivery_zones").select("*").eq("store_id", s.id).eq("is_active", true).order("neighborhood"),
    ]);
    setCategories(cats.data || []);
    setProducts(prods.data || []);
    setDeliveryZones(zones.data || []);
    const productIds = (prods.data || []).map((p: any) => p.id);
    if (productIds.length > 0) {
      const { data: vars } = await supabase.from("product_variations").select("*").in("product_id", productIds).order("sort_order");
      const varMap: Record<string, any[]> = {};
      (vars || []).forEach((v: any) => {
        if (!varMap[v.product_id]) varMap[v.product_id] = [];
        varMap[v.product_id].push(v);
      });
      setProductVariations(varMap);
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (store) {
      const getActiveOrders = async () => {
        const stored = localStorage.getItem(`active_orders_${store.id}`);
        // Migration from old single-order key
        const oldId = localStorage.getItem(`latest_order_${store.id}`);
        let ids: string[] = [];
        if (stored) {
          try { ids = JSON.parse(stored); } catch (e) { }
        }
        if (oldId && !ids.includes(oldId)) {
          ids.push(oldId);
          localStorage.setItem(`active_orders_${store.id}`, JSON.stringify(ids));
          localStorage.removeItem(`latest_order_${store.id}`);
        }

        if (ids.length > 0) {
          const { data } = await supabase
            .from("orders")
            .select("id, status, order_number")
            .in("id", ids);

          if (data) {
            // Filter out final states and update localStorage
            const stillActive = data.filter(o => !["delivered", "picked_up", "cancelled"].includes(o.status));
            setActiveOrders(stillActive);
            localStorage.setItem(`active_orders_${store.id}`, JSON.stringify(stillActive.map(o => o.id)));

            // Listen for status changes for ALL active orders
            stillActive.forEach(order => {
              supabase.channel(`active-order-${order.id}`)
                .on(
                  "postgres_changes",
                  { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` },
                  (payload) => {
                    setActiveOrders(prev => {
                      const updated = prev.map(o => o.id === order.id ? { ...o, status: payload.new.status } : o);
                      // If finished, remove it
                      if (["delivered", "picked_up", "cancelled"].includes(payload.new.status)) {
                        const remaining = updated.filter(o => o.id !== order.id);
                        localStorage.setItem(`active_orders_${store.id}`, JSON.stringify(remaining.map(r => r.id)));
                        return remaining;
                      }
                      return updated;
                    });
                  }
                )
                .subscribe();
            });
          }
        }
      };

      getActiveOrders();
    }
  }, [store?.name, store?.id, slug]);

  useEffect(() => {
    const handleScroll = () => {
      setShowStickyHeader(window.scrollY > 280);

      // ScrollSpy logic
      const sections = categories.map(cat => document.getElementById(`cat-${cat.id}`));
      const scrollPosition = window.scrollY + 200;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section && scrollPosition >= section.offsetTop) {
          setActiveSection(categories[i].id);
          break;
        }
      }
      if (scrollPosition < (sections[0]?.offsetTop || 0)) {
        setActiveSection(null);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [categories]);

  const getTodayHours = () => {
    if (!store?.opening_hours || !Array.isArray(store.opening_hours)) return null;
    const now = new Date();
    const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const today = dayNames[now.getDay()];
    const todayConfig = (store.opening_hours as any[]).find((d: any) => d.day === today);
    if (!todayConfig?.enabled || !todayConfig.periods?.length) return null;
    return `${todayConfig.periods[0].open} às ${todayConfig.periods[0].close}`;
  };

  const storeOpen = checkStoreStatus(store);
  const todayHours = getTodayHours();

  const handleAddToCart = (product: any) => {
    if (!storeOpen) { toast.error("Loja fechada no momento"); return; }
    if (product.is_sold_out || (product.manage_stock && product.stock_quantity <= 0)) { toast.error("Este produto está esgotado"); return; }
    const vars = productVariations[product.id];
    if (vars && vars.length > 0) { setVariationProduct(product); setVariationSelections({}); setVariationModalOpen(true); }
    else { addToCartDirect(product, [], 0); }
  };

  const addToCartDirect = (product: any, selectedVariations: SelectedVariation[], variationsPrice: number, notes: string = "") => {
    setCart((prev) => {
      if (selectedVariations.length > 0 || notes) { return [...prev, { product, quantity: 1, notes, variations: selectedVariations, variationsPrice }]; }
      const existing = prev.find((i) => i.product.id === product.id && i.variations.length === 0 && !i.notes);
      if (existing) return prev.map((i) => i.product.id === product.id && i.variations.length === 0 && !i.notes ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1, notes, variations: [], variationsPrice: 0 }];
    });
    toast.success(`${product.name} adicionado!`);
  };

  const confirmVariationSelection = () => {
    if (!variationProduct) return;
    const vars = productVariations[variationProduct.id] || [];
    for (const v of vars) {
      if (v.required) {
        const selected = variationSelections[v.id] || [];
        if (selected.length === 0) { toast.error(`Selecione uma opção para "${v.name}"`); return; }
      }
    }
    const selectedVariations: SelectedVariation[] = [];
    let totalVarPrice = 0;
    for (const v of vars) {
      const selected = variationSelections[v.id] || [];
      if (selected.length > 0) {
        selectedVariations.push({ group: v.name, selected });
        if ((v as any).is_half_half) {
          totalVarPrice += Math.max(...selected.map(s => s.price));
        } else {
          totalVarPrice += selected.reduce((sum, s) => sum + s.price, 0);
        }
      }
    }
    addToCartDirect(variationProduct, selectedVariations, totalVarPrice, itemNotes);
    setVariationModalOpen(false);
    setVariationProduct(null);
    setItemNotes("");
  };

  const toggleVariationOption = (variationId: string, option: { name: string; price: number }, maxSelections: number) => {
    setVariationSelections(prev => {
      const current = prev[variationId] || [];
      const exists = current.find(o => o.name === option.name);
      if (exists) { return { ...prev, [variationId]: current.filter(o => o.name !== option.name) }; }
      if (maxSelections === 1) { return { ...prev, [variationId]: [option] }; }
      if (current.length >= maxSelections) { toast.error(`Máximo de ${maxSelections} opções`); return prev; }
      return { ...prev, [variationId]: [...current, option] };
    });
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => prev.map((item, i) => i === index ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter((i) => i.quantity > 0));
  };

  const removeFromCart = (index: number) => { setCart((prev) => prev.filter((_, i) => i !== index)); };
  const getItemPrice = (item: CartItem) => {
    const basePrice = item.product.promotional_price > 0 ? Number(item.product.promotional_price) : Number(item.product.price);
    return basePrice + item.variationsPrice;
  };
  const subtotal = cart.reduce((s, i) => s + getItemPrice(i) * i.quantity, 0);

  const applyCoupon = async () => {
    if (!store || !couponCode.trim()) return;
    const { data } = await supabase.from("coupons").select("*").eq("store_id", store.id).eq("code", couponCode.toUpperCase()).eq("is_active", true).maybeSingle();
    if (!data) { toast.error("Cupom inválido"); return; }
    if (data.min_order_value && subtotal < data.min_order_value) { toast.error(`Pedido mínimo R$ ${data.min_order_value.toFixed(2)}`); return; }
    if (data.max_uses && data.current_uses >= data.max_uses) { toast.error("Cupom esgotado"); return; }
    setAppliedCoupon(data);
    toast.success("Cupom aplicado!");
  };

  const selectedZone = deliveryZones.find((z) => z.neighborhood === form.neighborhood);
  const deliveryFee = form.delivery_type === "delivery" ? Number(selectedZone?.fee || 0) : 0;
  let discount = 0;
  if (appliedCoupon) {
    discount = appliedCoupon.discount_type === "percentage" ? subtotal * (appliedCoupon.discount_value / 100) : appliedCoupon.discount_value;
  }
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
      if (openComanda) {
        comandaId = openComanda.id;
      } else {
        const { data: newComanda, error: newComandaError } = await supabase.from("comandas").insert({
          store_id: store.id,
          table_id: tableSession.table_id,
          status: "open",
          subtotal: 0,
          discount: 0,
          total: 0
        }).select().single();

        if (newComandaError) {
          console.error("Comanda Error:", newComandaError);
          toast.error("Erro ao iniciar comanda");
          setIsProcessing(false);
          return;
        }

        if (newComanda) {
          comandaId = (newComanda as any).id;
          // Sincroniza o status da mesa para ocupada
          await supabase.from("tables").update({
            status: 'occupied',
            current_comanda_id: comandaId
          }).eq("id", tableSession.table_id);
        }
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

    if (error) { console.error("Order Error:", error); toast.error("Erro ao criar pedido"); setIsProcessing(false); return; }

    await supabase.from("order_items").insert(cart.map((i) => ({
      order_id: orderId, product_id: i.product.id, product_name: i.product.name, quantity: i.quantity,
      unit_price: getItemPrice(i), subtotal: getItemPrice(i) * i.quantity, notes: i.notes,
      variations: (i.variations.length > 0 ? i.variations : []) as any,
    })));

    if (appliedCoupon) { await supabase.from("coupons").update({ current_uses: appliedCoupon.current_uses + 1 }).eq("id", appliedCoupon.id); }

    const stored = localStorage.getItem(`active_orders_${store.id}`);
    let activeIds: string[] = [];
    if (stored) { try { activeIds = JSON.parse(stored); } catch (e) { } }
    if (!activeIds.includes(orderId)) {
      activeIds.push(orderId);
      localStorage.setItem(`active_orders_${store.id}`, JSON.stringify(activeIds));
    }

    setCart([]); setCheckoutOpen(false); setCartOpen(false); setAppliedCoupon(null); setCouponCode(""); setIsProcessing(false);
    toast.success("Pedido enviado!"); navigate(`/pedido/${orderId}`);
  };

  const filteredProducts = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.description || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = !activeCategory || p.category_id === activeCategory;
    return matchSearch && matchCat;
  }).sort((a, b) => {
    if (a.is_sold_out && !b.is_sold_out) return 1;
    if (!a.is_sold_out && b.is_sold_out) return -1;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  const productsByCategory = categories.map((cat) => ({ ...cat, products: filteredProducts.filter((p) => p.category_id === cat.id) }));
  const uncategorized = filteredProducts.filter((p) => !p.category_id);

  if (loading) { return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>; }
  if (!store && !loading) { return <div className="min-h-screen flex items-center justify-center p-4"><div className="text-center bg-card p-10 rounded-2xl shadow-card border border-border/50"><h1 className="text-2xl font-extrabold mb-2">Loja não encontrada</h1><Button onClick={() => window.location.href = "https://frfood.com.br"}>Conhecer FRFood</Button></div></div>; }

  // Render Anota AI layout if store has that layout configured
  if (store?.store_layout === 'anotaai') {
    return <PublicStoreAnotaAI store={store} categories={categories} products={products} productVariations={productVariations} deliveryZones={deliveryZones} />;
  }

  const storeColor = store?.primary_color || "#ea580c";
  const hexToHSL = (hex: string) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) { r = parseInt(hex[1] + hex[1], 16); g = parseInt(hex[2] + hex[2], 16); b = parseInt(hex[3] + hex[3], 16); }
    else if (hex.length === 7) { r = parseInt(hex.slice(1, 3), 16); g = parseInt(hex.slice(3, 5), 16); b = parseInt(hex.slice(5, 7), 16); }
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) { case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break; case g: h = ((b - r) / d + 2) / 6; break; case b: h = ((r - g) / d + 4) / 6; break; }
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };
  const primaryHSL = hexToHSL(storeColor);

  return (
    <div className="min-h-screen bg-muted/50 pb-24" style={{ "--primary": primaryHSL, "--store-color": storeColor } as React.CSSProperties}>
      {activeOrders.length > 0 && (
        <div className="bg-primary text-primary-foreground shadow-md z-50 relative divide-y divide-white/10">
          {activeOrders.map((order, idx) => (
            <div key={order.id} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-white animate-pulse" />
                <p className="text-sm font-bold">
                  {activeOrders.length > 1 ? `Pedido #${order.order_number || '...'}` : "Pedido em andamento!"}
                </p>
              </div>
              <Link to={`/pedido/${order.id}`} className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold transition-colors hover:bg-white/30">
                Ver Status
              </Link>
            </div>
          ))}
        </div>
      )}

      {tableSession && (
        <div className="bg-primary/95 text-primary-foreground px-4 py-3 flex items-center justify-center gap-3 shadow-hero z-40 relative">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <Utensils className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 leading-none">Você está na</p>
            <p className="text-sm font-black uppercase tracking-tight">{tableSession.table_name}</p>
          </div>
        </div>
      )}

      {showStickyHeader && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-card border-b border-border shadow-md animate-in slide-in-from-top duration-300">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
            <div className="flex-shrink-0">
              <img src={store.logo_url || ""} className="w-10 h-10 rounded-full object-cover border border-border" />
            </div>
            <div className="flex-1 overflow-x-auto scrollbar-hide flex gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${activeSection === cat.id ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            <button onClick={() => { setSearch(""); window.scrollTo({ top: 300, behavior: 'smooth' }); }} className="p-2 text-muted-foreground">
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-[1210px] mx-auto px-4 pt-4 md:pt-6">
        <div className="relative h-48 md:h-[250px] rounded-2xl md:rounded-[24px] shadow-sm bg-primary/10">
          <img src={store.banner_url || store.banner_mobile_url || ""} className="w-full h-full object-cover rounded-2xl md:rounded-[24px]" />
          <div className="absolute inset-0 bg-black/20 rounded-2xl md:rounded-[24px]" />
          <div className="absolute -bottom-8 md:-bottom-12 left-1/2 -translate-x-1/2 w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white bg-white shadow-hero z-10 transition-all flex items-center justify-center overflow-visible">
            <div className="w-full h-full rounded-full overflow-hidden border border-border/10">
              <img src={store.logo_url || ""} className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform" onClick={() => setInfoDialogOpen(true)} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 space-y-4 pt-12 text-center">
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
          {((store as any).display_name_type === 'razao_social' && (store as any).razao_social) ? (store as any).razao_social : store.name}
        </h1>
        <div className="flex items-center justify-center gap-4 text-sm font-medium">
          <button onClick={() => setInfoDialogOpen(true)} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"><Plus className="w-4 h-4" /> Ver mais</button>
          <div className={`flex items-center gap-1.5 ${storeOpen ? "text-green-600" : "text-destructive"}`}><Plus className="w-4 h-4" /> {storeOpen ? "Aberto" : "Fechado"}</div>
          {todayHours && <div className="flex items-center gap-1.5 text-muted-foreground"><Plus className="w-4 h-4 opacity-70" /> {todayHours}</div>}
        </div>
        <div className="relative mt-6"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input type="text" placeholder="Buscar no cardápio..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-11 pl-10 rounded-xl border border-border bg-card shadow-sm focus:ring-2 focus:ring-primary/20" /></div>
        <div className="flex gap-2 overflow-x-auto pb-4 pt-2 scrollbar-hide">
          <button onClick={() => setActiveCategory(null)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${!activeCategory ? "bg-primary text-white" : "bg-card border"}`}>Todos</button>
          {categories.map(cat => <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${activeCategory === cat.id ? "bg-primary text-white" : "bg-card border"}`}>{cat.name}</button>)}
        </div>
        <div className="space-y-12 text-left mt-8">
          {productsByCategory.map(cat => cat.products.length > 0 && (
            <div key={cat.id} id={`cat-${cat.id}`} className="space-y-6 scroll-mt-24">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-foreground whitespace-nowrap">{cat.name}</h2>
                <div className="h-px bg-border flex-1" />
              </div>
              <div className={`grid gap-4 ${cat.products.length === 1 ? "grid-cols-1 max-w-sm" :
                cat.products.length === 2 ? "grid-cols-1 sm:grid-cols-2" :
                  cat.products.length === 3 ? "grid-cols-1 sm:grid-cols-3" :
                    "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                }`}>
                {cat.products.map(p => <ProductCard key={p.id} product={p} onAdd={() => handleAddToCart(p)} hasVariations={!!productVariations[p.id]?.length} />)}
              </div>
            </div>
          ))}
          {uncategorized.length > 0 && (
            <div className="space-y-6 scroll-mt-24">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-foreground whitespace-nowrap">Outros</h2>
                <div className="h-px bg-border flex-1" />
              </div>
              <div className={`grid gap-4 ${uncategorized.length === 1
                ? "grid-cols-1 max-w-sm"
                : uncategorized.length === 2
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                }`}>
                {uncategorized.map(p => <ProductCard key={p.id} product={p} onAdd={() => handleAddToCart(p)} hasVariations={!!productVariations[p.id]?.length} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {variationModalOpen && variationProduct && (
        <Dialog open={variationModalOpen} onOpenChange={setVariationModalOpen}>
          <DialogContent className="max-w-[450px] p-0 overflow-hidden bg-muted/30 border-none shadow-hero max-h-[92vh] flex flex-col sm:rounded-2xl">
            <div className="bg-card flex-1 overflow-y-auto scrollbar-hide">
              {/* Header Image */}
              <div className="relative h-48 md:h-56 bg-muted">
                {variationProduct.image_url ? (
                  <img src={variationProduct.image_url} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/5">
                    <ShoppingBag className="w-12 h-12 text-primary/20" />
                  </div>
                )}
                <button 
                  onClick={() => setVariationModalOpen(false)}
                  className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              </div>

              {/* Product Info */}
              <div className="p-6 space-y-2 bg-card">
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">{variationProduct.name}</h2>
                <div className="flex items-center gap-3">
                  <span className="text-primary font-black text-lg">
                    R$ {(variationProduct.promotional_price > 0 ? variationProduct.promotional_price : variationProduct.price).toFixed(2)}
                  </span>
                  {variationProduct.promotional_price > 0 && (
                    <span className="text-sm text-muted-foreground line-through">
                      R$ {variationProduct.price.toFixed(2)}
                    </span>
                  )}
                </div>
                {variationProduct.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{variationProduct.description}</p>
                )}
              </div>

              {/* Variation Groups */}
              <div className="pb-6">
                {(productVariations[variationProduct.id] || []).map((v) => (
                  <div key={v.id} className="mt-4">
                    {/* Group Header */}
                    <div className="bg-muted px-6 py-3 flex flex-col gap-0.5">
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground">{v.name}</h3>
                        {v.required && (
                          <span className="text-[10px] font-bold text-white bg-red-600 px-2 py-0.5 rounded-full uppercase">Obrigatório</span>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-muted-foreground/70 uppercase">
                        {v.max_selections === 1 ? "Escolha 1 opção" : `Escolha até ${v.max_selections} opções`}
                      </p>
                    </div>

                    {/* Options List */}
                    <div className="bg-card divide-y divide-border/50">
                      {(v.options || []).map((opt: any, oi: number) => {
                        const isSelected = (variationSelections[v.id] || []).some(s => s.name === opt.name);
                        return (
                          <button
                            key={oi}
                            onClick={() => toggleVariationOption(v.id, opt, v.max_selections)}
                            className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/30 transition-colors group"
                          >
                            <div className="flex-1 pr-4">
                              <p className="font-bold text-sm flex items-center gap-2">
                                {opt.name}
                                {isSelected && <Check className="w-4 h-4 text-primary" />}
                              </p>
                              {opt.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{opt.description}</p>
                              )}
                              {opt.price > 0 && (
                                <p className="text-xs font-black text-primary mt-2">+ R$ {opt.price.toFixed(2)}</p>
                              )}
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                              {isSelected && <div className="w-2 h-2 rounded-full bg-white animate-in zoom-in-50 duration-200" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Observations Field */}
                <div className="mt-4">
                  <div className="bg-muted px-6 py-3">
                    <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Observações</h3>
                  </div>
                  <div className="p-6">
                    <Textarea 
                      placeholder="Alguma observação? (Ex: sem cebola, ponto da carne...)"
                      className="resize-none h-24 rounded-xl border-border bg-card"
                      value={itemNotes}
                      onChange={(e) => setItemNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="p-6 bg-card border-t border-border shadow-modal-footer flex items-center gap-4">
              <div className="flex-shrink-0 text-center bg-muted px-4 py-2 rounded-xl hidden sm:block">
                <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1">Total</p>
                <p className="text-lg font-black text-primary leading-none">
                  R$ {((variationProduct.promotional_price > 0 ? variationProduct.promotional_price : variationProduct.price) + Object.values(variationSelections).flat().reduce((sum, s) => sum + s.price, 0)).toFixed(2)}
                </p>
              </div>
              <Button
                variant="hero"
                className="flex-1 h-14 text-sm font-black uppercase tracking-widest shadow-hero scale-100 hover:scale-[1.02] active:scale-[0.98] transition-all"
                onClick={confirmVariationSelection}
              >
                <span className="sm:hidden mr-2">Adicionar • R$ {((variationProduct.promotional_price > 0 ? variationProduct.promotional_price : variationProduct.price) + Object.values(variationSelections).flat().reduce((sum, s) => sum + s.price, 0)).toFixed(2)}</span>
                <span className="hidden sm:inline">Adicionar ao Carrinho</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {cart.length > 0 && <div className="fixed bottom-6 left-4 right-4 z-40 max-w-3xl mx-auto"><button onClick={() => setCartOpen(true)} className="w-full gradient-hero h-14 rounded-2xl text-white font-bold flex justify-between items-center px-6 shadow-hero"><span>{cart.reduce((s, i) => s + i.quantity, 0)} itens</span><span>Ver Sacola • R$ {subtotal.toFixed(2)}</span></button></div>}

      <Dialog open={cartOpen} onOpenChange={setCartOpen}><DialogContent className="max-w-md p-0 rounded-t-2xl sm:rounded-2xl overflow-hidden"><div className="p-6 flex flex-col h-full max-h-[85vh]">
        <h2 className="text-xl font-bold mb-4">Sua Sacola</h2>
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">{cart.map((item, idx) => (
          <div key={idx} className="flex justify-between items-start border-b border-border/50 pb-4">
            <div className="flex-1 space-y-1">
              <p className="font-bold text-sm">{item.product.name}</p>
              {item.variations.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.variations.map((v: any, vi: number) => (
                    <span key={vi} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-medium">
                      {v.group}: {v.selected.map((s: any) => s.name).join(", ")}
                    </span>
                  ))}
                </div>
              )}
              {item.notes && (
                <p className="text-[10px] text-primary font-bold italic">Nota: {item.notes}</p>
              )}
              <p className="text-sm font-black mt-1">R$ {(getItemPrice(item) * item.quantity).toFixed(2)}</p>
              <div className="mt-2 flex items-center gap-3">
                <button onClick={() => updateQuantity(idx, -1)} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"><Minus className="w-3 h-3" /></button>
                <span className="font-bold text-sm">{item.quantity}</span>
                <button onClick={() => updateQuantity(idx, 1)} className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center hover:shadow-lg transition-transform"><Plus className="w-3 h-3" /></button>
              </div>
            </div>
            <button onClick={() => removeFromCart(idx)} className="p-2 text-muted-foreground/40 hover:text-destructive transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}</div>
        <div className="mt-6 space-y-4">
          <div className="flex gap-2"><Input placeholder="Tem um cupom?" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} /><Button onClick={applyCoupon} variant="outline">Aplicar</Button></div>
          <Button variant="hero" className="w-full h-12 font-bold" onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}>Finalizar Pedido • R$ {(subtotal - discount).toFixed(2)}</Button>
        </div>
      </div></DialogContent></Dialog>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}><DialogContent className="max-w-md p-0 rounded-t-2xl sm:rounded-2xl overflow-hidden"><div className="p-6 space-y-4">
        <h2 className="text-xl font-bold">Finalizar</h2>
        {tableSession ? (
          <div className="bg-primary/10 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-5 h-5 text-primary" />
              <p className="font-bold text-primary">Mesa {tableSession.table_name}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} /></div>
            <div>
              <Label>Tipo</Label>
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
                <div>
                  <Label>Seu Bairro</Label>
                  <Select value={form.neighborhood} onValueChange={(v) => setForm({ ...form, neighborhood: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione seu bairro" /></SelectTrigger>
                    <SelectContent>
                      {deliveryZones.map(zone => (
                        <SelectItem key={zone.id} value={zone.neighborhood}>{zone.neighborhood} ({formatCurrency(zone.fee)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Endereço</Label><Input value={form.customer_address} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} /></div>
              </div>
            )}
            <div>
              <Label>Pagamento</Label>
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

        <div className="bg-muted/30 p-4 rounded-xl space-y-2 mt-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Desconto</span>
              <span>-{formatCurrency(discount)}</span>
            </div>
          )}
          {form.delivery_type === "delivery" && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taxa de Entrega</span>
              <span>{formatCurrency(deliveryFee)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(total)}</span>
          </div>
        </div>

        <Button variant="hero" className="w-full h-12 font-bold mt-4" disabled={isProcessing} onClick={handleCheckout}>
          {isProcessing ? "Enviando..." : "Confirmar Pedido"}
        </Button>
      </div></DialogContent></Dialog>
      <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden bg-white border-none shadow-hero max-h-[90vh] overflow-y-auto scrollbar-hide">
          <div className="relative bg-white">
            {/* Header Image */}
            <div className="h-32 md:h-40 bg-primary/20">
              <img src={store.banner_url || store.banner_mobile_url || ""} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30" />
              <button onClick={() => setInfoDialogOpen(false)} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors">
                <ChevronLeft className="w-6 h-6" />
              </button>
            </div>

            {/* Logo and Name */}
            <div className="relative px-6 pb-6 text-center bg-white">
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full border-4 border-white bg-white overflow-hidden shadow-lg">
                <img src={store.logo_url || ""} className="w-full h-full object-cover" />
              </div>
              <div className="pt-14 pb-4">
                <h2 className="text-2xl font-black uppercase tracking-tight">
                  {((store as any).display_name_type === 'razao_social' && (store as any).razao_social) ? (store as any).razao_social : store.name}
                </h2>
                <div className="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>25-95min</span>
                  <span>•</span>
                  <p className="flex items-center gap-1">
                    <span className="font-bold">Mínimo R$ {Number(store.min_order_value || 0).toFixed(2)}</span>
                  </p>
                </div>
              </div>

              <div className="h-px bg-border w-full my-6" />

              {/* Delivery Options */}
              <div className="text-left space-y-4">
                <h3 className="font-bold text-lg">Opções de entrega</h3>
                <div className="flex flex-wrap gap-3">
                  {store.delivery_enabled && (
                    <div className="px-4 py-3 rounded-xl border border-primary/20 bg-primary/5 flex items-center gap-2 min-w-[120px]">
                      <Bike className="w-5 h-5 text-primary" />
                      <span className="text-[10px] font-bold uppercase">Delivery</span>
                    </div>
                  )}
                  {store.pickup_enabled && (
                    <div className="px-4 py-3 rounded-xl border border-primary/20 bg-primary/5 flex items-center gap-2 min-w-[120px]">
                      <ShoppingBag className="w-5 h-5 text-primary" />
                      <span className="text-[10px] font-bold uppercase">Retirada</span>
                    </div>
                  )}
                  {(store as any).consumo_local_enabled && (
                    <div className="px-4 py-3 rounded-xl border border-primary/20 bg-primary/5 flex items-center gap-2 min-w-[120px]">
                      <Utensils className="w-5 h-5 text-primary" />
                      <span className="text-[10px] font-bold uppercase">Local</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px bg-border w-full my-6 opacity-50" />

              {/* Opening Hours */}
              <div className="text-left space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-lg">Horário de funcionamento</h3>
                </div>
                <div className={`inline-flex px-3 py-1 rounded-full text-[10px] font-bold uppercase ${storeOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {storeOpen ? "Aberto" : "Fechado"}
                </div>
                <div className="space-y-1.5 mt-2">
                  {(store.opening_hours || []).map((day: any, i: number) => (
                    <div key={i} className={`flex justify-between text-xs font-medium ${day.day === new Date().toLocaleDateString('pt-BR', { weekday: 'long' }).split('-')[0].charAt(0).toUpperCase() + new Date().toLocaleDateString('pt-BR', { weekday: 'long' }).split('-')[0].slice(1) ? "font-bold" : "text-muted-foreground"}`}>
                      <span className="uppercase">{day.day.substring(0, 3)}</span>
                      <span>{day.enabled ? (day.periods && day.periods[0] ? `${day.periods[0].open} às ${day.periods[0].close}` : "Fechado") : "Fechado"}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-px bg-border w-full my-6" />

              {/* Payment Methods */}
              <div className="text-left space-y-4">
                <h3 className="font-bold text-lg">Formas de Pagamento</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground mb-2">Pagamento online:</p>
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                      <span className="px-3 py-1.5 bg-muted rounded-md uppercase">Pix</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground mb-2">Na entrega:</p>
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase">
                      <span className="px-3 py-1.5 bg-muted rounded-md tracking-tight">Dinheiro</span>
                      <span className="px-3 py-1.5 bg-muted rounded-md tracking-tight">Cartão de Crédito</span>
                      <span className="px-3 py-1.5 bg-muted rounded-md tracking-tight">Cartão de Débito</span>
                      <span className="px-3 py-1.5 bg-muted rounded-md tracking-tight">Pix Manual</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Business Info */}
              <div className="mt-8 pt-6 border-t border-border/50 text-center space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{(store as any).razao_social || store.name}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">CNPJ: {store.cnpj || "00.000.000/0000-00"}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
};

const ProductCard = ({ product, onAdd, hasVariations }: { product: any; onAdd: () => void; hasVariations?: boolean }) => {
  const isSoldOut = product.is_sold_out;
  const price = product.promotional_price > 0 ? product.promotional_price : product.price;

  return (
    <div className={`bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden flex min-h-[120px] h-auto ${isSoldOut ? "opacity-60" : ""}`}>
      {product.image_url && (
        <div className="w-[120px] h-full relative flex-shrink-0">
          <img src={product.image_url} className="w-full h-full object-cover" />
          {isSoldOut && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white bg-red-600 px-2 py-1 rounded-full uppercase">Esgotado</span>
            </div>
          )}
        </div>
      )}
      <div className="flex-1 p-3 flex flex-col justify-between overflow-hidden">
        <div>
          <h3 className="font-bold text-sm truncate">{product.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{product.description}</p>
        </div>
        <div className="flex justify-between items-end mt-2">
          <div className="flex flex-col">
            {product.promotional_price > 0 && (
              <span className="text-[10px] text-muted-foreground line-through">R$ {product.price.toFixed(2)}</span>
            )}
            <span className="text-primary font-black text-sm">R$ {price.toFixed(2)}</span>
          </div>
          {!isSoldOut && (
            <button 
              onClick={(e) => { e.stopPropagation(); onAdd(); }} 
              className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicStore;
