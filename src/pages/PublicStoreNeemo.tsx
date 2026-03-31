import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShoppingCart, Plus, Minus, Trash2, Search, Clock, ChevronLeft, Home, FileText, Share2, X, Check, Zap, Bike, Store, Utensils, ShoppingBag, Phone, MapPin, CreditCard, ChevronRight, AlertCircle } from "lucide-react";
import { formatCurrency, checkStoreStatus } from "@/lib/utils";
import "@/styles/neemo.css";

interface SelectedVariation { group: string; selected: { name: string; price: number }[]; }
interface CartItem { product: any; quantity: number; notes: string; variations: SelectedVariation[]; variationsPrice: number; }

const PublicStoreNeemo = ({ store, categories, products, productVariations, deliveryZones }: {
  store: any; categories: any[]; products: any[]; productVariations: Record<string, any[]>; deliveryZones: any[];
}) => {
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [activeOrders, setActiveOrders] = useState<{ id: string; status: string; order_number?: string }[]>([]);
  const [tableSession, setTableSession] = useState<any>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [varModalOpen, setVarModalOpen] = useState(false);
  const [varProduct, setVarProduct] = useState<any>(null);
  const [varSelections, setVarSelections] = useState<Record<string, { name: string; price: number }[]>>({});
  const [session, setSession] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [itemNotes, setItemNotes] = useState("");
  const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'cart'>('home');
  const [detailQty, setDetailQty] = useState(1);
  const [flavorSearch, setFlavorSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [showStickyCats, setShowStickyCats] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const catRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [form, setForm] = useState({
    email: "", password: "", customer_name: "", customer_phone: "",
    customer_address: "", neighborhood: "", delivery_type: "delivery",
    payment_method: "", notes: "",
  });

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      supabase.from("profiles").select("*").eq("id", session.user.id).single().then(({ data }) => {
        if (data) {
          const d = data as any;
          setForm(p => ({ ...p, customer_name: d.full_name || p.customer_name, customer_phone: d.phone || p.customer_phone, customer_address: d.address || p.customer_address, neighborhood: d.neighborhood || p.neighborhood }));
        }
      });
    }
  }, [session]);

  // Table session
  useEffect(() => {
    if (!store) return;
    const s = localStorage.getItem(`frfood_table_${store.id}`);
    if (s) { try { const p = JSON.parse(s); if (Date.now() - p.timestamp < 4*3600000) setTableSession(p); else localStorage.removeItem(`frfood_table_${store.id}`); } catch {} }
  }, [store]);

  // Active orders
  useEffect(() => {
    if (!store) return;
    const load = async () => {
      const stored = localStorage.getItem(`active_orders_${store.id}`);
      const oldId = localStorage.getItem(`latest_order_${store.id}`);
      let ids: string[] = [];
      if (stored) try { ids = JSON.parse(stored); } catch {}
      if (oldId && !ids.includes(oldId)) { ids.push(oldId); localStorage.setItem(`active_orders_${store.id}`, JSON.stringify(ids)); localStorage.removeItem(`latest_order_${store.id}`); }
      if (ids.length > 0) {
        const { data } = await supabase.from("orders").select("id, status, order_number").in("id", ids);
        if (data) { const a = data.filter(o => !["delivered","picked_up","cancelled"].includes(o.status)); setActiveOrders(a); localStorage.setItem(`active_orders_${store.id}`, JSON.stringify(a.map(o => o.id))); }
      }
    };
    load();
  }, [store?.id]);

  // Scroll tracking for sticky categories
  useEffect(() => {
    const h = () => setShowStickyCats(window.scrollY > 400);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const storeOpen = checkStoreStatus(store);
  const getTodayHours = () => {
    if (!store?.opening_hours || !Array.isArray(store.opening_hours)) return null;
    const days = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
    const t = (store.opening_hours as any[]).find((d: any) => d.day === days[new Date().getDay()]);
    if (!t?.enabled || !t.periods?.length) return null;
    return `${t.periods[0].open} às ${t.periods[0].close}`;
  };
  const todayHours = getTodayHours();
  const storeColor = store?.primary_color || "#7b5a3a";

  // Cart logic
  const handleAddToCart = (product: any) => {
    if (!storeOpen) { toast.error("Loja fechada no momento"); return; }
    if (product.is_sold_out || (product.manage_stock && product.stock_quantity <= 0)) { toast.error("Produto esgotado"); return; }
    const vars = productVariations[product.id];
    if (vars?.length > 0) { setVarProduct(product); setVarSelections({}); setItemNotes(""); setDetailQty(1); setFlavorSearch(""); setVarModalOpen(true); }
    else addDirect(product, [], 0);
  };

  const addDirect = (product: any, sv: SelectedVariation[], vp: number, n = "", q = 1) => {
    setCart(prev => {
      if (sv.length > 0 || n) return [...prev, { product, quantity: q, notes: n, variations: sv, variationsPrice: vp }];
      const ex = prev.find(i => i.product.id === product.id && !i.variations.length && !i.notes);
      if (ex) return prev.map(i => i.product.id === product.id && !i.variations.length && !i.notes ? { ...i, quantity: i.quantity + q } : i);
      return [...prev, { product, quantity: q, notes: n, variations: [], variationsPrice: 0 }];
    });
    toast.success(`${product.name} adicionado!`);
  };

  const confirmVar = () => {
    if (!varProduct) return;
    const vars = productVariations[varProduct.id] || [];
    for (const v of vars) { if (v.required && !(varSelections[v.id]?.length)) { toast.error(`Selecione "${v.name}"`); return; } }
    const sv: SelectedVariation[] = [];
    let tp = 0;
    for (const v of vars) {
      const sel = varSelections[v.id] || [];
      if (sel.length > 0) {
        sv.push({ group: v.name, selected: sel });
        tp += (v as any).is_half_half ? Math.max(...sel.map(s => s.price)) : sel.reduce((s, o) => s + o.price, 0);
      }
    }
    addDirect(varProduct, sv, tp, itemNotes, detailQty);
    setVarModalOpen(false); setVarProduct(null);
  };

  const toggleVarOpt = (vid: string, opt: { name: string; price: number }, max: number) => {
    setVarSelections(prev => {
      const cur = prev[vid] || [];
      if (cur.find(o => o.name === opt.name)) return { ...prev, [vid]: cur.filter(o => o.name !== opt.name) };
      if (max === 1) return { ...prev, [vid]: [opt] };
      if (cur.length >= max) { toast.error(`Máximo ${max} opções`); return prev; }
      return { ...prev, [vid]: [...cur, opt] };
    });
  };

  const updateQty = (i: number, d: number) => setCart(p => p.map((it, idx) => idx === i ? { ...it, quantity: Math.max(0, it.quantity + d) } : it).filter(it => it.quantity > 0));
  const removeItem = (i: number) => setCart(p => p.filter((_, idx) => idx !== i));
  const getPrice = (it: CartItem) => (it.product.promotional_price > 0 ? Number(it.product.promotional_price) : Number(it.product.price)) + it.variationsPrice;
  const subtotal = cart.reduce((s, i) => s + getPrice(i) * i.quantity, 0);

  const applyCoupon = async () => {
    if (!store || !couponCode.trim()) return;
    const { data } = await supabase.from("coupons").select("*").eq("store_id", store.id).eq("code", couponCode.toUpperCase()).eq("is_active", true).maybeSingle();
    if (!data) { toast.error("Cupom inválido"); return; }
    if (data.min_order_value && subtotal < data.min_order_value) { toast.error(`Pedido mínimo R$ ${data.min_order_value.toFixed(2)}`); return; }
    if (data.max_uses && data.current_uses >= data.max_uses) { toast.error("Cupom esgotado"); return; }
    setAppliedCoupon(data); toast.success("Cupom aplicado!");
  };

  const selZone = deliveryZones.find(z => z.neighborhood === form.neighborhood);
  const deliveryFee = form.delivery_type === "delivery" ? Number(selZone?.fee || 0) : 0;
  let discount = 0;
  if (appliedCoupon) discount = appliedCoupon.discount_type === "percentage" ? subtotal * (appliedCoupon.discount_value / 100) : appliedCoupon.discount_value;
  const total = subtotal - discount + deliveryFee;

  const handleCheckout = async () => {
    if (!store || !cart.length) return;
    setIsProcessing(true);
    let fdt = form.delivery_type, origin = "delivery", comandaId = null;
    if (tableSession) {
      fdt = "table"; origin = "qr_code";
      const { data: oc } = await supabase.from("comandas").select("id").eq("store_id", store.id).eq("table_id", tableSession.table_id).eq("status", "open").maybeSingle();
      if (oc) comandaId = oc.id;
      else {
        const { data: nc, error: nce } = await supabase.from("comandas").insert({ store_id: store.id, table_id: tableSession.table_id, status: "open", subtotal: 0, discount: 0, total: 0 }).select().single();
        if (nce) { toast.error("Erro ao iniciar comanda"); setIsProcessing(false); return; }
        if (nc) { comandaId = (nc as any).id; await supabase.from("tables").update({ status: 'occupied', current_comanda_id: comandaId }).eq("id", tableSession.table_id); }
      }
    }
    if (!tableSession) {
      if (!form.customer_name || !form.customer_phone) { toast.error("Preencha nome e telefone"); setIsProcessing(false); return; }
      if (form.delivery_type === "delivery" && !form.customer_address.trim()) { toast.error("Preencha o endereço"); setIsProcessing(false); return; }
      if (!form.payment_method) { toast.error("Selecione pagamento"); setIsProcessing(false); return; }
    }
    const oid = crypto.randomUUID();
    const { error } = await supabase.from("orders").insert({
      id: oid, store_id: store.id, customer_name: form.customer_name || (tableSession ? `Mesa ${tableSession.table_name}` : ""),
      customer_phone: form.customer_phone || "00000000000", customer_address: form.customer_address, neighborhood: form.neighborhood,
      delivery_type: fdt, delivery_fee: tableSession ? 0 : deliveryFee, subtotal,
      discount, total: tableSession ? subtotal - discount : total,
      coupon_code: appliedCoupon?.code || "", notes: form.notes, payment_method: tableSession ? "comanda" : form.payment_method,
      origin, comanda_id: comandaId, table_id: tableSession?.table_id || null
    });
    if (error) { toast.error("Erro ao criar pedido"); setIsProcessing(false); return; }
    await supabase.from("order_items").insert(cart.map(i => ({
      order_id: oid, product_id: i.product.id, product_name: i.product.name, quantity: i.quantity,
      unit_price: getPrice(i), subtotal: getPrice(i) * i.quantity, notes: i.notes,
      variations: (i.variations.length > 0 ? i.variations : []) as any,
    })));
    if (appliedCoupon) await supabase.from("coupons").update({ current_uses: appliedCoupon.current_uses + 1 }).eq("id", appliedCoupon.id);
    const st = localStorage.getItem(`active_orders_${store.id}`);
    let ai: string[] = []; if (st) try { ai = JSON.parse(st); } catch {}
    if (!ai.includes(oid)) { ai.push(oid); localStorage.setItem(`active_orders_${store.id}`, JSON.stringify(ai)); }
    setCart([]); setCheckoutOpen(false); setCartOpen(false); setAppliedCoupon(null); setCouponCode(""); setIsProcessing(false); setCheckoutStep(1);
    toast.success("Pedido enviado!"); navigate(`/pedido/${oid}`);
  };

  // Filtered products
  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.description || "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => { if (a.is_sold_out && !b.is_sold_out) return 1; if (!a.is_sold_out && b.is_sold_out) return -1; return (a.sort_order||0) - (b.sort_order||0); });
  const byCat = categories.map(c => ({ ...c, products: filtered.filter(p => p.category_id === c.id) }));
  const uncat = filtered.filter(p => !p.category_id);
  const popular = products.filter(p => p.image_url && !p.is_sold_out).slice(0, 8);

  const scrollToCat = (id: string) => {
    setActiveCat(id);
    catRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const whatsappUrl = store?.customer_phone ? `https://wa.me/55${store.customer_phone.replace(/\D/g, '')}` : null;
  const displayName = ((store as any)?.display_name_type === 'razao_social' && (store as any)?.razao_social) ? (store as any).razao_social : store.name;

  return (
    <div className="neemo-layout" style={{ "--store-accent": storeColor } as React.CSSProperties}>
      {/* Active Orders */}
      {activeOrders.map(o => (
        <div key={o.id} className="nm-active-order">
          <div className="nm-active-order-left"><Zap className="w-4 h-4" style={{animation:'nm-pulse 2s infinite'}} /><span>Pedido em andamento!</span></div>
          <Link to={`/pedido/${o.id}`} className="nm-active-order-link">Ver Status</Link>
        </div>
      ))}
      {tableSession && <div className="nm-table-banner"><Utensils className="w-4 h-4" /><span>Você está na <strong>{tableSession.table_name}</strong></span></div>}

      {/* Header */}
      <header className="nm-header">
        <div className="nm-header-inner">
          <div className="nm-header-left">
            {store.logo_url && <img src={store.logo_url} alt="" className="nm-header-logo" onClick={() => window.scrollTo({top:0,behavior:'smooth'})} />}
            <div className="nm-header-info">
              <span className="nm-header-name">{displayName}</span>
              {store.address && <span className="nm-header-address"><MapPin className="w-3 h-3 inline" /> {store.address}</span>}
            </div>
          </div>
          <div className="nm-header-right">
            <button className="nm-header-hours-btn" onClick={() => setInfoOpen(true)}>
              <span className={`nm-header-hours-dot ${storeOpen ? 'open' : 'closed'}`} />
              {storeOpen ? (todayHours ? `Aberto • ${todayHours}` : 'Aberto') : 'Fechado'}
            </button>
            <button className="nm-icon-btn" onClick={() => {navigator.clipboard.writeText(window.location.href); toast.success("Link copiado!")}}>
              <Share2 className="w-5 h-5" />
            </button>
            <button className="nm-cart-btn" onClick={() => setCartOpen(true)}>
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">{formatCurrency(subtotal)}</span>
              {cart.length > 0 && <span className="nm-cart-badge">{cart.reduce((s,i) => s+i.quantity, 0)}</span>}
            </button>
          </div>
        </div>
      </header>

      {/* Sticky Categories */}
      {showStickyCats && (
        <div className="nm-sticky-cats">
          <div className="nm-sticky-cats-inner neemo-scrollbar-hide">
            {categories.filter(c => byCat.find(bc => bc.id === c.id)?.products.length).map(c => (
              <button key={c.id} className={`nm-cat-chip ${activeCat === c.id ? 'active' : ''}`} onClick={() => scrollToCat(c.id)}>{c.name}</button>
            ))}
          </div>
        </div>
      )}

      {/* Banner */}
      {(store.banner_url || store.banner_mobile_url) && (
        <div className="nm-banner">
          <img src={store.banner_url || store.banner_mobile_url} alt="" />
        </div>
      )}

      {/* Main Content */}
      <div className="nm-container">
        {/* Search Bar */}
        <div className="nm-search-bar">
          <div className="nm-search-input-wrap">
            <Search className="w-4 h-4" />
            <input type="text" placeholder="Buscar no cardápio..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className="nm-search-btn" onClick={() => setSearch("")}><X className="w-3 h-3" /></button>}
          </div>
          <div className="nm-info-pill desktop-only"><Clock className="w-3.5 h-3.5" /> {storeOpen ? 'Aberto agora' : 'Fechado'}</div>
        </div>

        {!storeOpen && <div className="nm-closed-alert"><AlertCircle className="w-4 h-4" /> Loja fechada{todayHours ? ` — Abre hoje às ${todayHours.split(" às ")[0]}` : ""}</div>}

        {/* Categories Chips */}
        <div className="nm-categories-nav neemo-scrollbar-hide">
          {categories.filter(c => byCat.find(bc => bc.id === c.id)?.products.length).map(c => (
            <button key={c.id} className={`nm-cat-chip ${activeCat === c.id ? 'active' : ''}`} onClick={() => scrollToCat(c.id)}>{c.name}</button>
          ))}
        </div>

        {/* Popular */}
        {popular.length > 0 && !search && (
          <div className="nm-popular-section">
            <h2>⭐ Os mais pedidos</h2>
            <div className="nm-popular-scroll neemo-scrollbar-hide">
              {popular.map(p => (
                <button key={p.id} onClick={() => handleAddToCart(p)} className="nm-popular-item">
                  <div className="nm-popular-img-wrap"><img src={p.image_url} alt={p.name} className="nm-popular-img" /></div>
                  <span className="nm-popular-name">{p.name}</span>
                  <span className="nm-popular-price">A partir de <strong>{formatCurrency(p.promotional_price > 0 ? p.promotional_price : p.price)}</strong></span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Products by Category */}
        <div style={{paddingBottom: '24px'}}>
          {byCat.map(cat => cat.products.length > 0 && (
            <div key={cat.id} ref={el => { catRefs.current[cat.id] = el; }} id={`cat-${cat.id}`} style={{scrollMarginTop: '140px', marginBottom: '24px'}}>
              <h2 className="nm-section-title">{cat.name}</h2>
              <div className="nm-products-grid">
                {cat.products.map(p => <NeemoCard key={p.id} product={p} onAdd={() => handleAddToCart(p)} />)}
              </div>
            </div>
          ))}
          {uncat.length > 0 && (
            <div style={{marginBottom:'24px'}}>
              <h2 className="nm-section-title">Outros</h2>
              <div className="nm-products-grid">{uncat.map(p => <NeemoCard key={p.id} product={p} onAdd={() => handleAddToCart(p)} />)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Product Variation Modal */}
      {varModalOpen && varProduct && (
        <div className="nm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setVarModalOpen(false); setFlavorSearch(""); } }}>
          <div className="nm-modal">
            <div className="nm-modal-head">
              <button onClick={() => { setVarModalOpen(false); setFlavorSearch(""); }} className="nm-close-btn"><ChevronLeft className="w-4 h-4" /></button>
              <h2>Detalhes do produto</h2>
              <div style={{width:32}} />
            </div>
            <div className="nm-modal-body">
              <div className="nm-detail-hero">
                {varProduct.image_url ? <img src={varProduct.image_url} className="nm-detail-hero-img" alt={varProduct.name} /> : <div className="nm-detail-hero-img" style={{background:'var(--nm-bg)',display:'flex',alignItems:'center',justifyContent:'center'}}><Utensils className="w-10 h-10" style={{color:'var(--nm-text-light)'}} /></div>}
                <div className="nm-detail-hero-info">
                  <h3 className="nm-detail-hero-title">{varProduct.name}</h3>
                  {varProduct.description && <p className="nm-detail-hero-note">{varProduct.description}</p>}
                </div>
              </div>
              <div className="nm-detail-search" style={{marginTop:12}}>
                <Search className="w-4 h-4" style={{color:'var(--nm-text-light)',flexShrink:0}} />
                <input type="text" placeholder="Pesquise pelo sabor..." value={flavorSearch} onChange={e => setFlavorSearch(e.target.value)} />
              </div>
              {(productVariations[varProduct.id] || []).map((v: any) => {
                const opts = flavorSearch ? (v.options||[]).filter((o:any) => o.name.toLowerCase().includes(flavorSearch.toLowerCase())) : (v.options||[]);
                return (
                  <div key={v.id} className="nm-var-group">
                    <div className="nm-var-group-head">
                      <div><h3>{v.name}</h3><span className="nm-var-count">{v.max_selections === 1 ? 'Escolha 1' : `Até ${v.max_selections}`} • {(varSelections[v.id]||[]).length} selecionado(s)</span></div>
                      {v.required && <span className="nm-var-required-badge">Obrigatório</span>}
                    </div>
                    {opts.map((opt: any, oi: number) => {
                      const sel = (varSelections[v.id]||[]).some((s:any) => s.name === opt.name);
                      return (
                        <button key={oi} onClick={() => toggleVarOpt(v.id, opt, v.max_selections)} className={`nm-var-option ${sel ? 'selected' : ''}`}>
                          {opt.image_url ? <img src={opt.image_url} alt={opt.name} className="nm-var-option-thumb" /> : <div className="nm-var-option-thumb placeholder" />}
                          <div className="nm-var-option-info">
                            <span className="nm-var-option-name">{opt.name}</span>
                            {opt.description && <span className="nm-var-option-desc">{opt.description}</span>}
                            {opt.price > 0 && <span className="nm-var-option-price">+ {formatCurrency(opt.price)}</span>}
                          </div>
                          <div className={`nm-checkbox ${sel ? 'checked' : ''}`}>{sel && <Check className="w-3 h-3" />}</div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              <div className="nm-obs-section">
                <div className="nm-var-group-head"><div><h3>Observações</h3></div></div>
                <textarea placeholder="Ex.: Tirar cebola, sem azeitona..." value={itemNotes} onChange={e => setItemNotes(e.target.value)} />
              </div>
            </div>
            <div className="nm-modal-foot">
              <div className="nm-qty">
                <button onClick={() => setDetailQty(Math.max(1, detailQty - 1))} className="nm-qty-btn"><Minus className="w-4 h-4" /></button>
                <span className="nm-qty-val">{detailQty}</span>
                <button onClick={() => setDetailQty(detailQty + 1)} className="nm-qty-btn accent"><Plus className="w-4 h-4" /></button>
              </div>
              {(() => {
                const vars = productVariations[varProduct.id] || [];
                const allMet = vars.every((v:any) => !v.required || (varSelections[v.id]||[]).length > 0);
                const bp = varProduct.promotional_price > 0 ? varProduct.promotional_price : varProduct.price;
                const vp = Object.entries(varSelections).reduce((s,[vid,opts]) => {
                  const v = vars.find((vv:any) => vv.id === vid);
                  if (v && (v as any).is_half_half) return s + Math.max(...opts.map(o => o.price), 0);
                  return s + opts.reduce((a, o) => a + o.price, 0);
                }, 0);
                const tp = (bp + vp) * detailQty;
                if (!allMet) return <button className="nm-add-btn disabled" disabled>Selecione as opções</button>;
                return <button onClick={confirmVar} className="nm-add-btn"><span>Adicionar</span><span className="nm-btn-price">{formatCurrency(tp)}</span></button>;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Cart Sidebar */}
      {cartOpen && <>
        <div className="nm-cart-backdrop" onClick={() => setCartOpen(false)} />
        <div className="nm-cart-sidebar">
          <div className="nm-cart-head"><h2>Carrinho</h2><button onClick={() => setCartOpen(false)} className="nm-close-btn"><X className="w-4 h-4" /></button></div>
          <div className="nm-cart-body">
            {cart.length === 0 ? (
              <div style={{padding:'48px 20px',textAlign:'center'}}>
                <ShoppingBag className="w-12 h-12 mx-auto" style={{color:'var(--nm-text-light)',marginBottom:16}} />
                <p style={{fontWeight:700,marginBottom:8}}>Seu carrinho está vazio</p>
                <p style={{fontSize:13,color:'var(--nm-text-muted)'}}>Adicione itens do cardápio</p>
              </div>
            ) : <>
              {cart.map((item, idx) => (
                <div key={idx} className="nm-cart-item">
                  <div className="nm-cart-item-info">
                    <p className="nm-cart-item-name">{item.product.name}</p>
                    {item.variations.length > 0 && <div className="nm-cart-item-vars">{item.variations.map((v,vi) => <span key={vi}>{v.group}: {v.selected.map(s => s.name).join(", ")}</span>)}</div>}
                    {item.notes && <p className="nm-cart-item-note">Obs: {item.notes}</p>}
                    <p className="nm-cart-item-price">{formatCurrency(getPrice(item) * item.quantity)}</p>
                  </div>
                  <div className="nm-cart-item-actions">
                    <button onClick={() => removeItem(idx)} className="nm-remove-btn"><Trash2 className="w-4 h-4" /></button>
                    <div className="nm-qty" style={{transform:'scale(0.85)'}}>
                      <button onClick={() => updateQty(idx, -1)} className="nm-qty-btn"><Minus className="w-3 h-3" /></button>
                      <span className="nm-qty-val">{item.quantity}</span>
                      <button onClick={() => updateQty(idx, 1)} className="nm-qty-btn accent"><Plus className="w-3 h-3" /></button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="nm-cart-coupon">
                <input placeholder="Cupom de desconto" value={couponCode} onChange={e => setCouponCode(e.target.value)} />
                <button onClick={applyCoupon}>Aplicar</button>
              </div>
            </>}
          </div>
          {cart.length > 0 && (
            <div className="nm-cart-foot">
              <button onClick={() => { setCartOpen(false); setCheckoutOpen(true); setCheckoutStep(1); }} className="nm-add-btn" style={{width:'100%'}}>
                <span>Finalizar Pedido</span><span className="nm-btn-price">{formatCurrency(subtotal - discount)}</span>
              </button>
            </div>
          )}
        </div>
      </>}

      {/* Checkout Modal */}
      {checkoutOpen && (
        <div className="nm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setCheckoutOpen(false); }}>
          <div className="nm-modal">
            <div className="nm-modal-head">
              <button onClick={() => { if (checkoutStep > 1) setCheckoutStep(checkoutStep - 1); else setCheckoutOpen(false); }} className="nm-close-btn"><ChevronLeft className="w-4 h-4" /></button>
              <h2>{tableSession ? 'Confirmar Pedido' : ['Seus Dados','Entrega','Pagamento','Confirmar'][checkoutStep-1]}</h2>
              <div style={{width:32}} />
            </div>
            <div className="nm-modal-body" style={{padding:20}}>
              {tableSession ? (
                <div style={{textAlign:'center',padding:'24px 0'}}><ShoppingBag className="w-8 h-8 mx-auto" style={{color:'var(--nm-accent)', marginBottom:8}} /><p style={{fontWeight:800}}>Mesa {tableSession.table_name}</p></div>
              ) : checkoutStep === 1 ? (
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  <div className="nm-form-group"><label className="nm-form-label">Nome</label><input className="nm-form-input" value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} /></div>
                  <div className="nm-form-group"><label className="nm-form-label">Telefone</label><input className="nm-form-input" value={form.customer_phone} onChange={e => setForm({...form, customer_phone: e.target.value})} /></div>
                </div>
              ) : checkoutStep === 2 ? (
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  <div className="nm-form-group"><label className="nm-form-label">Tipo</label>
                    <select className="nm-form-select" value={form.delivery_type} onChange={e => setForm({...form, delivery_type: e.target.value})}>
                      {store.delivery_enabled && <option value="delivery">Entrega</option>}
                      {store.pickup_enabled && <option value="pickup">Retirada</option>}
                    </select>
                  </div>
                  {form.delivery_type === "delivery" && <>
                    <div className="nm-form-group"><label className="nm-form-label">Bairro</label>
                      <select className="nm-form-select" value={form.neighborhood} onChange={e => setForm({...form, neighborhood: e.target.value})}>
                        <option value="">Selecione</option>
                        {deliveryZones.map(z => <option key={z.id} value={z.neighborhood}>{z.neighborhood} ({formatCurrency(z.fee)})</option>)}
                      </select>
                    </div>
                    <div className="nm-form-group"><label className="nm-form-label">Endereço completo</label><input className="nm-form-input" value={form.customer_address} onChange={e => setForm({...form, customer_address: e.target.value})} /></div>
                  </>}
                </div>
              ) : checkoutStep === 3 ? (
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  <div className="nm-form-group"><label className="nm-form-label">Forma de Pagamento</label>
                    <select className="nm-form-select" value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}>
                      <option value="">Selecione</option>
                      <option value="pix">PIX</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="cartao">Cartão</option>
                    </select>
                  </div>
                  <div className="nm-form-group"><label className="nm-form-label">Observações</label><textarea className="nm-form-input" style={{height:'auto',padding:12,minHeight:80}} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Alguma observação?" /></div>
                </div>
              ) : (
                <div className="nm-checkout-summary">
                  <div className="nm-checkout-row"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                  {discount > 0 && <div className="nm-checkout-row"><span className="green">Desconto</span><span className="green">-{formatCurrency(discount)}</span></div>}
                  {form.delivery_type === "delivery" && <div className="nm-checkout-row"><span>Taxa de Entrega</span><span>{formatCurrency(deliveryFee)}</span></div>}
                  <div className="nm-divider" />
                  <div className="nm-checkout-row total"><span>Total</span><span className="accent">{formatCurrency(total)}</span></div>
                </div>
              )}
            </div>
            <div className="nm-modal-foot">
              {tableSession || checkoutStep === 4 ? (
                <button onClick={handleCheckout} className="nm-add-btn" style={{width:'100%'}} disabled={isProcessing}>{isProcessing ? "Enviando..." : "Confirmar Pedido"}</button>
              ) : (
                <button onClick={() => {
                  if (checkoutStep === 1 && (!form.customer_name || !form.customer_phone)) { toast.error("Preencha nome e telefone"); return; }
                  if (checkoutStep === 2 && form.delivery_type === "delivery" && !form.customer_address.trim()) { toast.error("Preencha o endereço"); return; }
                  if (checkoutStep === 3 && !form.payment_method) { toast.error("Selecione pagamento"); return; }
                  setCheckoutStep(checkoutStep + 1);
                }} className="nm-add-btn" style={{width:'100%'}}>Avançar <ChevronRight className="w-4 h-4" /></button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Store Info Modal */}
      {infoOpen && (
        <div className="nm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setInfoOpen(false); }}>
          <div className="nm-modal">
            <div className="nm-modal-head"><button onClick={() => setInfoOpen(false)} className="nm-close-btn"><ChevronLeft className="w-4 h-4" /></button><h2>Perfil da Loja</h2><div style={{width:32}} /></div>
            <div className="nm-modal-body">
              <div style={{textAlign:'center',padding:'24px 20px'}}>
                {store.logo_url && <div style={{width:80,height:80,borderRadius:'50%',margin:'0 auto 12px',overflow:'hidden',border:'2px solid var(--nm-border)'}}><img src={store.logo_url} style={{width:'100%',height:'100%',objectFit:'cover'}} /></div>}
                <h3 style={{fontWeight:800,fontSize:18}}>{displayName}</h3>
                <span style={{display:'inline-block',marginTop:8,padding:'4px 12px',borderRadius:999,fontSize:11,fontWeight:800,background:storeOpen?'#dcfce7':'#fee2e2',color:storeOpen?'#166534':'#991b1b'}}>{storeOpen ? 'Aberto' : 'Fechado'}</span>
              </div>
              <div className="nm-info-section">
                <h3><Clock className="w-4 h-4" /> Horários</h3>
                {(store.opening_hours || []).map((d: any, i: number) => {
                  const days = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
                  const isToday = d.day === days[new Date().getDay()];
                  return <div key={i} className={`nm-info-hours-row ${isToday ? 'today' : ''}`}><span>{d.day?.substring(0,3)}</span><span>{d.enabled ? (d.periods?.[0] ? `${d.periods[0].open} às ${d.periods[0].close}` : 'Fechado') : 'Fechado'}</span></div>;
                })}
              </div>
              <div className="nm-info-section">
                <h3><CreditCard className="w-4 h-4" /> Pagamentos</h3>
                <div className="nm-info-payment-chips"><span className="nm-info-payment-chip">Pix</span><span className="nm-info-payment-chip">Dinheiro</span><span className="nm-info-payment-chip">Cartão</span></div>
              </div>
              <div className="nm-info-section">
                <h3><Bike className="w-4 h-4" /> Entregas</h3>
                <div className="nm-info-delivery-opts">
                  {store.delivery_enabled && <span className="nm-info-delivery-opt"><Bike className="w-4 h-4" /> Entrega</span>}
                  {store.pickup_enabled && <span className="nm-info-delivery-opt"><Store className="w-4 h-4" /> Retirada</span>}
                </div>
              </div>
              {store.cnpj && <div className="nm-info-footer"><p>CNPJ: {store.cnpj}</p></div>}
            </div>
          </div>
        </div>
      )}

      {/* Floating Cart (Mobile) */}
      {cart.length > 0 && !cartOpen && !checkoutOpen && !varModalOpen && (
        <button className="nm-floating-cart" onClick={() => setCartOpen(true)}>
          <span><ShoppingCart className="w-4 h-4 inline mr-2" />{cart.reduce((s,i)=>s+i.quantity,0)} {cart.reduce((s,i)=>s+i.quantity,0) === 1 ? 'item' : 'itens'}</span>
          <span>{formatCurrency(subtotal)}</span>
        </button>
      )}

      {/* Bottom Navigation (Mobile) */}
      <div className="nm-bottom-nav">
        <button onClick={() => { setActiveTab('home'); window.scrollTo({top:0,behavior:'smooth'}); }} className={`nm-nav-item ${activeTab === 'home' ? 'active' : ''}`}><Home className="w-5 h-5" /><span>Início</span></button>
        <button onClick={() => { if (activeOrders.length > 0) navigate(`/pedido/${activeOrders[0].id}`); else toast.info("Nenhum pedido"); }} className={`nm-nav-item ${activeTab === 'orders' ? 'active' : ''}`}>
          <FileText className="w-5 h-5" /><span>Pedidos</span>
          {activeOrders.length > 0 && <span className="nm-nav-badge">{activeOrders.length}</span>}
        </button>
        <button onClick={() => setCartOpen(true)} className={`nm-nav-item ${activeTab === 'cart' ? 'active' : ''}`}>
          <ShoppingCart className="w-5 h-5" /><span>Carrinho</span>
          {cart.length > 0 && <span className="nm-nav-badge">{cart.reduce((s,i) => s+i.quantity, 0)}</span>}
        </button>
      </div>

      {/* WhatsApp FAB */}
      {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="nm-whatsapp-fab"><Phone className="w-5 h-5" /></a>}
    </div>
  );
};

/* Product Card */
const NeemoCard = ({ product, onAdd }: { product: any; onAdd: () => void }) => {
  const sold = product.is_sold_out;
  const price = product.promotional_price > 0 ? product.promotional_price : product.price;
  return (
    <button onClick={onAdd} className={`nm-product-card ${sold ? 'sold-out' : ''}`} disabled={sold}>
      <div className="nm-product-card-img">
        {product.image_url ? <img src={product.image_url} alt={product.name} /> : <div style={{width:'100%',height:'100%',background:'var(--nm-bg)',display:'flex',alignItems:'center',justifyContent:'center'}}><Utensils className="w-8 h-8" style={{color:'var(--nm-text-light)'}} /></div>}
        {sold && <div className="nm-sold-out-overlay"><span className="nm-sold-out-badge">Esgotado</span></div>}
      </div>
      <div className="nm-product-card-body">
        <span className="nm-product-card-name">{product.name}</span>
        {product.description && <span className="nm-product-card-desc">{product.description}</span>}
        <div className="nm-product-card-divider" />
        <div className="nm-product-card-price">
          {product.promotional_price > 0 && <span className="old-price">{formatCurrency(product.price)}</span>}
          <span className="label">A partir de</span>
          <span className="current-price">{formatCurrency(price)}</span>
        </div>
      </div>
    </button>
  );
};

export default PublicStoreNeemo;
