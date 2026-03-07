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
import { ShoppingBag, Plus, Minus, Trash2, X, Send, MapPin, Search, Star, Clock, Phone, Mail, Lock, Check, AlertTriangle, Zap } from "lucide-react";
import { checkStoreStatus } from "@/lib/utils";

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
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [tableSession, setTableSession] = useState<any>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [variationModalOpen, setVariationModalOpen] = useState(false);
  const [variationProduct, setVariationProduct] = useState<any>(null);
  const [variationSelections, setVariationSelections] = useState<Record<string, { name: string; price: number }[]>>({});
  const [session, setSession] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
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
      document.title = store.name;
      const orderId = localStorage.getItem(`latest_order_${store.id}`);
      if (orderId) setActiveOrderId(orderId);
    }
  }, [store?.name, store?.id]);

  useEffect(() => {
    const handleScroll = () => { setShowStickyHeader(window.scrollY > 280); };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  const addToCartDirect = (product: any, selectedVariations: SelectedVariation[], variationsPrice: number) => {
    setCart((prev) => {
      if (selectedVariations.length > 0) { return [...prev, { product, quantity: 1, notes: "", variations: selectedVariations, variationsPrice }]; }
      const existing = prev.find((i) => i.product.id === product.id && i.variations.length === 0);
      if (existing) return prev.map((i) => i.product.id === product.id && i.variations.length === 0 ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1, notes: "", variations: [], variationsPrice: 0 }];
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
        totalVarPrice += selected.reduce((sum, s) => sum + s.price, 0);
      }
    }
    addToCartDirect(variationProduct, selectedVariations, totalVarPrice);
    setVariationModalOpen(false);
    setVariationProduct(null);
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
      if (openComanda) { comandaId = openComanda.id; }
      else {
        const { data: newComanda } = await supabase.from("comandas").insert({ store_id: store.id, table_id: tableSession.table_id, status: "open", subtotal: 0, discount: 0, total: 0 }).select().single();
        if (newComanda) comandaId = (newComanda as any).id;
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

    if (!tableSession && form.customer_phone) {
      try {
        const { data: existingCustomer } = await supabase.from("customers").select("total_orders, total_spent").eq("store_id", store.id).eq("phone", form.customer_phone).maybeSingle();
        const newTotalOrders = (existingCustomer?.total_orders || 0) + 1;
        const newTotalSpent = Number(existingCustomer?.total_spent || 0) + Number(total);
        await supabase.from("customers").upsert({
          store_id: store.id, name: form.customer_name, phone: form.customer_phone, address: form.customer_address, neighborhood: form.neighborhood,
          total_orders: newTotalOrders, total_spent: newTotalSpent, last_order_at: new Date().toISOString(), updated_at: new Date().toISOString()
        }, { onConflict: 'store_id,phone' });
      } catch (custErr) { }
    }

    localStorage.setItem(`latest_order_${store.id}`, orderId);
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
      {activeOrderId && (
        <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shadow-md z-50 relative">
          <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-white animate-pulse" /><p className="text-sm font-bold">Pedido em andamento!</p></div>
          <Link to={`/pedido/${activeOrderId}`} className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold">Ver Status</Link>
        </div>
      )}
      <div className="relative h-48 md:h-64 mb-6"><img src={store.banner_url || store.banner_mobile_url || ""} className="w-full h-full object-cover bg-primary/20" />
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-20 h-20 md:w-28 md:h-28 rounded-full border-4 border-white bg-white overflow-hidden shadow-hero">
          <img src={store.logo_url || ""} className="w-full h-full object-cover" />
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 space-y-4 pt-10 text-center">
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">{store.name}</h1>
        <div className="flex items-center justify-center gap-4 text-sm font-medium">
          <button onClick={() => setInfoDialogOpen(true)} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"><Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> Ver mais</button>
          <div className={`flex items-center gap-1.5 ${storeOpen ? "text-green-600" : "text-destructive"}`}><Clock className="w-4 h-4" /> {storeOpen ? "Aberto" : "Fechado"}</div>
          {todayHours && <div className="text-muted-foreground">{todayHours}</div>}
        </div>
        <div className="relative mt-6"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input type="text" placeholder="Buscar no cardápio..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-11 pl-10 rounded-xl border border-border bg-card shadow-sm focus:ring-2 focus:ring-primary/20" /></div>
        <div className="flex gap-2 overflow-x-auto pb-4 pt-2 scrollbar-hide">
          <button onClick={() => setActiveCategory(null)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${!activeCategory ? "bg-primary text-white" : "bg-card border"}`}>Todos</button>
          {categories.map(cat => <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${activeCategory === cat.id ? "bg-primary text-white" : "bg-card border"}`}>{cat.name}</button>)}
        </div>
        <div className="space-y-8 text-left">
          {productsByCategory.map(cat => cat.products.length > 0 && (
            <div key={cat.id} className="space-y-4 pt-4">
              <h2 className="text-lg font-bold border-b pb-2">{cat.name}</h2>
              <div className="grid grid-cols-1 gap-3">{cat.products.map(p => <ProductCard key={p.id} product={p} onAdd={() => handleAddToCart(p)} hasVariations={!!productVariations[p.id]?.length} />)}</div>
            </div>
          ))}
          {uncategorized.length > 0 && (
            <div className="space-y-4 pt-4">
              <h2 className="text-lg font-bold border-b pb-2">Outros</h2>
              <div className="grid grid-cols-1 gap-3">{uncategorized.map(p => <ProductCard key={p.id} product={p} onAdd={() => handleAddToCart(p)} hasVariations={!!productVariations[p.id]?.length} />)}</div>
            </div>
          )}
        </div>
      </div>

      {variationModalOpen && variationProduct && (
        <Dialog open={variationModalOpen} onOpenChange={setVariationModalOpen}><DialogContent className="max-w-md max-h-[85vh] overflow-y-auto p-0 border-none rounded-2xl overflow-hidden"><div className="p-6 space-y-6">
          <div className="flex gap-4">{variationProduct.image_url && <img src={variationProduct.image_url} className="w-20 h-20 rounded-xl object-cover" />}<div><p className="text-xl font-bold">{variationProduct.name}</p><p className="text-primary font-bold">R$ {(variationProduct.promotional_price > 0 ? variationProduct.promotional_price : variationProduct.price).toFixed(2)}</p></div></div>
          {(productVariations[variationProduct.id] || []).map(v => (
            <div key={v.id} className="space-y-3">
              <div className="flex justify-between items-end"><Label className="text-base font-bold">{v.name}</Label>{v.required && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full uppercase">Obrigatório</span>}</div>
              <div className="space-y-2">{(v.options || []).map((opt: any, oi: number) => {
                const isSelected = (variationSelections[v.id] || []).some(s => s.name === opt.name);
                return <button key={oi} onClick={() => toggleVariationOption(v.id, opt, v.max_selections)} className={`w-full flex justify-between p-3 rounded-xl border text-sm transition-all ${isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"}`}><span className="font-medium">{opt.name}</span>{opt.price > 0 && <span className="text-primary font-bold">+R$ {opt.price.toFixed(2)}</span>}</button>
              })}</div>
            </div>
          ))}
          <Button variant="hero" className="w-full h-12 text-sm font-bold uppercase tracking-wider" onClick={confirmVariationSelection}>Adicionar • R$ {((variationProduct.promotional_price > 0 ? variationProduct.promotional_price : variationProduct.price) + Object.values(variationSelections).flat().reduce((sum, s) => sum + s.price, 0)).toFixed(2)}</Button>
        </div></DialogContent></Dialog>
      )}

      {cart.length > 0 && <div className="fixed bottom-6 left-4 right-4 z-40 max-w-3xl mx-auto"><button onClick={() => setCartOpen(true)} className="w-full gradient-hero h-14 rounded-2xl text-white font-bold flex justify-between items-center px-6 shadow-hero"><span>{cart.reduce((s, i) => s + i.quantity, 0)} itens</span><span>Ver Sacola • R$ {subtotal.toFixed(2)}</span></button></div>}

      <Dialog open={cartOpen} onOpenChange={setCartOpen}><DialogContent className="max-w-md p-0 rounded-t-2xl sm:rounded-2xl overflow-hidden"><div className="p-6 flex flex-col h-full max-h-[85vh]">
        <h2 className="text-xl font-bold mb-4">Sua Sacola</h2>
        <div className="flex-1 overflow-y-auto space-y-4">{cart.map((item, idx) => (
          <div key={idx} className="flex justify-between items-start border-b pb-4"><div className="flex-1">
            <p className="font-bold">{item.product.name}</p>
            <p className="text-sm text-muted-foreground">R$ {(getItemPrice(item) * item.quantity).toFixed(2)}</p>
            <div className="mt-2 flex items-center gap-4"><button onClick={() => updateQuantity(idx, -1)} className="w-8 h-8 rounded-lg border flex items-center justify-center"><Minus className="w-4 h-4" /></button><span className="font-bold">{item.quantity}</span><button onClick={() => updateQuantity(idx, 1)} className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center"><Plus className="w-4 h-4" /></button></div>
          </div><button onClick={() => removeFromCart(idx)}><Trash2 className="w-4 h-4 text-destructive" /></button></div>
        ))}</div>
        <div className="mt-6 space-y-4">
          <div className="flex gap-2"><Input placeholder="Tem um cupom?" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} /><Button onClick={applyCoupon} variant="outline">Aplicar</Button></div>
          <Button variant="hero" className="w-full h-12 font-bold" onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}>Finalizar Pedido • R$ {(subtotal - discount).toFixed(2)}</Button>
        </div>
      </div></DialogContent></Dialog>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}><DialogContent className="max-w-md p-0 rounded-t-2xl sm:rounded-2xl overflow-hidden"><div className="p-6 space-y-4">
        <h2 className="text-xl font-bold">Finalizar</h2>
        {tableSession ? (<div className="bg-primary/10 p-4 rounded-xl flex items-center justify-between"><div className="flex items-center gap-3"><ShoppingBag className="w-5 h-5 text-primary" /><p className="font-bold text-primary">Mesa {tableSession.table_name}</p></div></div>) : (
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} /></div>
            <div><Label>Tipo</Label><Select value={form.delivery_type} onValueChange={(v) => setForm({ ...form, delivery_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{store.delivery_enabled && <SelectItem value="delivery">Entrega</SelectItem>}{store.pickup_enabled && <SelectItem value="pickup">Retirada</SelectItem>}</SelectContent></Select></div>
            {form.delivery_type === "delivery" && <div><Label>Endereço</Label><Input value={form.customer_address} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} /></div>}
            <div><Label>Pagamento</Label><Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pix">PIX</SelectItem><SelectItem value="dinheiro">Dinheiro</SelectItem><SelectItem value="cartao">Cartão</SelectItem></SelectContent></Select></div>
          </div>
        )}
        <Button variant="hero" className="w-full h-12 font-bold mt-4" disabled={isProcessing} onClick={handleCheckout}>{isProcessing ? "Enviando..." : "Confirmar Pedido"}</Button>
      </div></DialogContent></Dialog>
      <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}><DialogContent className="sm:max-w-[420px] p-0 border-none rounded-2xl overflow-hidden"><div className="p-6 space-y-6 text-center">
        <div className="w-24 h-24 rounded-full mx-auto border-4 border-white shadow-lg overflow-hidden"><img src={store.logo_url || ""} /></div>
        <div><h2 className="text-2xl font-black">{store.name}</h2><p className="text-muted-foreground text-sm mt-1">{store.address}</p></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted p-3 rounded-xl"><p className="text-[10px] uppercase font-bold text-muted-foreground">WhatsApp</p><p className="text-xs font-bold">{store.phone}</p></div>
          <div className="bg-muted p-3 rounded-xl"><p className="text-[10px] uppercase font-bold text-muted-foreground">Status</p><p className={`text-xs font-bold ${storeOpen ? "text-green-600" : "text-destructive"}`}>{storeOpen ? "Aberto" : "Fechado"}</p></div>
        </div>
        <Button variant="outline" className="w-full rounded-xl" onClick={() => setInfoDialogOpen(false)}>Fechar</Button>
      </div></DialogContent></Dialog>
    </div>
  );
};

const ProductCard = ({ product, onAdd, hasVariations }: { product: any; onAdd: () => void; hasVariations?: boolean }) => {
  const isSoldOut = product.is_sold_out;
  return (
    <div className={`bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden flex h-[120px] ${isSoldOut ? "opacity-60" : ""}`}>
      {product.image_url && <div className="w-[120px] h-full relative flex-shrink-0"><img src={product.image_url} className="w-full h-full object-cover" />{isSoldOut && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="text-[10px] font-bold text-white bg-red-600 px-2 py-1 rounded-full">ESGOTADO</span></div>}</div>}
      <div className="flex-1 p-3 flex flex-col justify-between overflow-hidden">
        <div><h3 className="font-bold text-sm truncate">{product.name}</h3><p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{product.description}</p></div>
        <div className="flex justify-between items-end">
          <div className="flex flex-col">{product.promotional_price > 0 ? (<><span className="text-[10px] text-muted-foreground line-through">R$ {product.price.toFixed(2)}</span><span className="text-primary font-black text-sm">R$ {product.promotional_price.toFixed(2)}</span></>) : (<span className="text-primary font-black text-sm">R$ {product.price.toFixed(2)}</span>)}</div>
          {!isSoldOut && <button onClick={onAdd} className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform"><Plus className="w-4 h-4" /></button>}
        </div>
      </div>
    </div>
  );
};

export default PublicStore;
