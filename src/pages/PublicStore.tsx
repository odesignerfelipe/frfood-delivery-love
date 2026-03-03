import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShoppingBag, Plus, Minus, Trash2, X, Send, MapPin, Search, Star, Clock, Phone, Mail, Lock, Check } from "lucide-react";

interface CartItem {
  product: any;
  quantity: number;
  notes: string;
}

const PublicStore = ({ explicitSlug }: { explicitSlug?: string }) => {
  const params = useParams();
  const slug = explicitSlug || params.slug;
  const navigate = useNavigate();
  const [store, setStore] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
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
  const [stickySearchOpen, setStickySearchOpen] = useState(false);

  const [session, setSession] = useState<any>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [isProcessing, setIsProcessing] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    neighborhood: "",
    delivery_type: "delivery",
    payment_method: "",
    notes: "",
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

    const [cats, prods, zones] = await Promise.all([
      supabase.from("categories").select("*").eq("store_id", s.id).eq("is_active", true).order("sort_order"),
      supabase.from("products").select("*").eq("store_id", s.id).eq("is_active", true).order("sort_order"),
      supabase.from("delivery_zones").select("*").eq("store_id", s.id).eq("is_active", true).order("neighborhood"),
    ]);
    setCategories(cats.data || []);
    setProducts(prods.data || []);
    setDeliveryZones(zones.data || []);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time store sync (feature 6)
  useEffect(() => {
    if (!store) return;
    const channel = supabase
      .channel(`store-sync-${store.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "stores", filter: `id=eq.${store.id}` },
        (payload: any) => {
          setStore((prev: any) => ({ ...prev, ...payload.new }));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [store?.id]);

  // Dynamic Title and Favicon
  useEffect(() => {
    if (store) {
      document.title = store.name;
      if (store.logo_url) {
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = store.logo_url;
      }
    }
  }, [store?.name, store?.logo_url]);

  // Sticky header on scroll (feature 7)
  useEffect(() => {
    const handleScroll = () => {
      setShowStickyHeader(window.scrollY > 280);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Check auto open/close based on opening_hours
  const isStoreOpen = () => {
    if (!store) return false;

    // Status Mode logic (New)
    const mode = (store as any).status_mode || "auto";
    if (mode === "manual_open") return true;
    if (mode === "manual_closed") return false;

    // Fallback to "auto" (schedule logic)
    if (!store.opening_hours || !Array.isArray(store.opening_hours)) return store.is_open;
    const now = new Date();
    const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const today = dayNames[now.getDay()];
    const todayConfig = (store.opening_hours as any[]).find((d: any) => d.day === today);
    if (!todayConfig?.enabled) return false;

    const currentTime = now.getHours() * 60 + now.getMinutes();
    return todayConfig.periods.some((p: any) => {
      if (!p.open || !p.close) return false;
      const [hO, mO] = p.open.split(":").map(Number);
      const [hC, mC] = p.close.split(":").map(Number);
      const openTime = hO * 60 + mO;
      let closeTime = hC * 60 + mC;
      if (closeTime < openTime) closeTime += 24 * 60; // Crosses midnight
      let checkTime = currentTime;
      if (checkTime < openTime && closeTime > 24 * 60) checkTime += 24 * 60;
      return checkTime >= openTime && checkTime <= closeTime;
    });
  };

  const getTodayHours = () => {
    if (!store?.opening_hours || !Array.isArray(store.opening_hours)) return null;
    const now = new Date();
    const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const today = dayNames[now.getDay()];
    const todayConfig = (store.opening_hours as any[]).find((d: any) => d.day === today);
    if (!todayConfig?.enabled || !todayConfig.periods?.length) return null;
    return `${todayConfig.periods[0].open} às ${todayConfig.periods[0].close}`;
  };

  const storeOpen = isStoreOpen();
  const todayHours = getTodayHours();

  const addToCart = (product: any) => {
    if (!storeOpen) { toast.error("Loja fechada no momento"); return; }
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1, notes: "" }];
    });
    toast.success(`${product.name} adicionado!`);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => prev.map((i) => i.product.id === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter((i) => i.quantity > 0));
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const subtotal = cart.reduce((s, i) => {
    const price = i.product.promotional_price > 0 ? Number(i.product.promotional_price) : Number(i.product.price);
    return s + price * i.quantity;
  }, 0);

  // Dynamic Coupon Verification
  useEffect(() => {
    if (appliedCoupon && appliedCoupon.min_order_value && subtotal < appliedCoupon.min_order_value) {
      toast.error(`Cupom removido. O pedido não atinge o mínimo de R$ ${appliedCoupon.min_order_value.toFixed(2)}`);
      setAppliedCoupon(null);
    }
  }, [subtotal, appliedCoupon]);
  const selectedZone = deliveryZones.find((z) => z.neighborhood === form.neighborhood);
  const deliveryFee = form.delivery_type === "delivery" ? (selectedZone?.fee || 0) : 0;

  let discount = 0;
  if (appliedCoupon) {
    discount = appliedCoupon.discount_type === "percentage" ? subtotal * (appliedCoupon.discount_value / 100) : appliedCoupon.discount_value;
  }
  const total = subtotal - discount + deliveryFee;
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  const estimatedTime = store ? ((store as any).avg_prep_time || 25) + (form.delivery_type === "delivery" ? ((store as any).avg_delivery_time || 40) : 0) : 0;

  const applyCoupon = async () => {
    if (!store || !couponCode.trim()) return;
    const { data } = await supabase.from("coupons").select("*").eq("store_id", store.id).eq("code", couponCode.toUpperCase()).eq("is_active", true).maybeSingle();
    if (!data) { toast.error("Cupom inválido"); return; }
    if (data.min_order_value && subtotal < data.min_order_value) { toast.error(`Pedido mínimo R$ ${data.min_order_value.toFixed(2)}`); return; }
    if (data.max_uses && data.current_uses >= data.max_uses) { toast.error("Cupom esgotado"); return; }
    setAppliedCoupon(data);
    toast.success("Cupom aplicado!");
  };

  const handleCheckout = async () => {
    if (!store || cart.length === 0) return;
    setIsProcessing(true);

    if (!form.customer_name || !form.customer_phone) {
      toast.error("Preencha o nome e telefone");
      setIsProcessing(false);
      return;
    }

    if (form.delivery_type === "delivery" && !form.customer_address.trim()) { toast.error("Preencha o endereço"); setIsProcessing(false); return; }
    if (store.min_order_value && subtotal < store.min_order_value) { toast.error(`Pedido mínimo R$ ${store.min_order_value.toFixed(2)}`); setIsProcessing(false); return; }

    const { data: order, error } = await supabase.from("orders").insert({
      store_id: store.id,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      customer_address: form.customer_address,
      neighborhood: form.neighborhood,
      delivery_type: form.delivery_type,
      delivery_fee: deliveryFee,
      subtotal, discount, total,
      coupon_code: appliedCoupon?.code || "",
      notes: form.notes,
      payment_method: form.payment_method,
    }).select().single();

    if (error || !order) { toast.error("Erro ao criar pedido"); setIsProcessing(false); return; }

    await supabase.from("order_items").insert(
      cart.map((i) => ({
        order_id: order.id,
        product_id: i.product.id,
        product_name: i.product.name,
        quantity: i.quantity,
        unit_price: i.product.promotional_price > 0 ? Number(i.product.promotional_price) : Number(i.product.price),
        subtotal: (i.product.promotional_price > 0 ? Number(i.product.promotional_price) : Number(i.product.price)) * i.quantity,
        notes: i.notes,
      }))
    );

    if (appliedCoupon) {
      await supabase.from("coupons").update({ current_uses: appliedCoupon.current_uses + 1 }).eq("id", appliedCoupon.id);
    }

    setCart([]);
    setCheckoutOpen(false);
    setCartOpen(false);
    setAppliedCoupon(null);
    setCouponCode("");
    setIsProcessing(false);
    toast.success("Pedido finalizado com sucesso!");
    navigate(`/pedido/${order.id}`);
  };

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.description || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = !activeCategory || p.category_id === activeCategory;
    return matchSearch && matchCat;
  });

  const productsByCategory = categories.map((cat) => ({
    ...cat,
    products: filteredProducts.filter((p) => p.category_id === cat.id),
  }));
  const uncategorized = filteredProducts.filter((p) => !p.category_id);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!store && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <div className="max-w-md w-full text-center space-y-6 bg-card p-10 rounded-2xl shadow-card border border-border/50">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto ring-8 ring-primary/5">
            <ShoppingBag className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-foreground">Loja não encontrada</h1>
            <p className="text-muted-foreground">O link que você acessou pode estar incorreto ou o estabelecimento não está mais ativo.</p>
          </div>
          <Button onClick={() => window.location.href = "https://frfood.com.br"} variant="hero" className="w-full">
            Conhecer o FRFood
          </Button>
          <p className="text-[11px] text-muted-foreground pt-4 border-t border-border">
            &copy; {new Date().getFullYear()} FRFood Delivery
          </p>
        </div>
      </div>
    );
  }


  // Dynamic color theming (feature 2)
  const storeColor = store?.primary_color || "#ea580c";
  const hexToHSL = (hex: string) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16); g = parseInt(hex[2] + hex[2], 16); b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex.slice(1, 3), 16); g = parseInt(hex.slice(3, 5), 16); b = parseInt(hex.slice(5, 7), 16);
    }
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };
  const primaryHSL = hexToHSL(storeColor);

  return (
    <div className="min-h-screen bg-muted/50 pb-24" style={{ "--primary": primaryHSL, "--store-color": storeColor } as React.CSSProperties}>

      {/* Sticky Compact Header (feature 7) */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-b border-border shadow-sm transition-all duration-300 ${showStickyHeader ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
          }`}
      >
        <div className="max-w-3xl mx-auto px-3 py-2.5">
          <div className="flex items-center gap-2">
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-primary-foreground font-extrabold text-[10px]">{store.name.charAt(0)}</span>
              </div>
            )}
            <span className="font-bold text-foreground text-xs truncate max-w-[80px] flex-shrink-0">{store.name}</span>
            <div className="w-px h-5 bg-border flex-shrink-0" />
            <div className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-hide items-center">
              <button
                onClick={() => { setActiveCategory(null); document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors flex-shrink-0 ${!activeCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors flex-shrink-0 ${activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setStickySearchOpen(!stickySearchOpen); }}
              className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 hover:bg-muted/80 transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
          {stickySearchOpen && (
            <div className="mt-2 pb-0.5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar produto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  className="w-full h-8 pl-10 pr-4 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Banner */}
      <div className="relative">
        {store.banner_url ? (
          <img src={store.banner_url} alt={store.name} className="w-full h-48 md:h-[250px] object-cover" />
        ) : (
          <div className="w-full h-48 md:h-[250px] gradient-hero" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="max-w-3xl mx-auto flex items-end gap-4">
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="w-16 h-16 rounded-xl border-2 border-background object-cover shadow-lg" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center border-2 border-background shadow-lg">
                <span className="text-primary-foreground font-extrabold text-lg">{store.name.charAt(0)}</span>
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-extrabold text-background">{store.name}</h1>
              {store.description && <p className="text-background/80 text-sm">{store.description}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div className="max-w-3xl mx-auto px-4 mt-4">
        <div className="flex flex-wrap items-center gap-3 py-4 text-sm bg-card rounded-2xl shadow-sm border border-border px-5">
          <div className={`flex items-center gap-2 font-medium px-3 py-1.5 rounded-full ${storeOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {storeOpen ? (
              <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Aberto</>
            ) : (
              <><span className="w-2 h-2 rounded-full bg-red-500" /> Fechado</>
            )}
          </div>

          {todayHours && (
            <div className="flex items-center gap-2 text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full font-medium">
              <Clock className="w-4 h-4" /> Entregas das: {todayHours}
            </div>
          )}

          {(store as any).avg_delivery_time && (
            <div className="flex items-center gap-2 text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full font-medium">
              <Clock className="w-4 h-4" /> Tempo médio para entrega: {(store as any).avg_delivery_time} min
            </div>
          )}

          {store.address && (
            <div className="flex items-center gap-2 text-muted-foreground w-full sm:w-auto mt-2 sm:mt-0">
              <MapPin className="w-4 h-4" /> {store.address}{store.city ? `, ${store.city}` : ""}
            </div>
          )}

          <a href={`https://wa.me/55${store.phone.replace(/\D/g, "")}`} target="_blank" className="ml-auto flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full font-bold hover:bg-primary/20 transition-colors">
            <Phone className="w-4 h-4" /> WhatsApp
          </a>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4" id="products-section">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar no cardápio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${!activeCategory ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Products */}
        {productsByCategory.map((cat) =>
          cat.products.length > 0 ? (
            <div key={cat.id} id={`cat-${cat.id}`} className="mb-8">

              <h2 className="text-lg font-bold text-foreground mb-3 border-b border-border pb-2">{cat.name}</h2>
              <div className="space-y-3">
                {cat.products.map((p: any) => (
                  <ProductCard key={p.id} product={p} onAdd={() => addToCart(p)} />
                ))}
              </div>
            </div>
          ) : null
        )}

        {uncategorized.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-foreground mb-3 border-b border-border pb-2">Outros</h2>
            <div className="space-y-3">
              {uncategorized.map((p) => <ProductCard key={p.id} product={p} onAdd={() => addToCart(p)} />)}
            </div>
          </div>
        )}

        {filteredProducts.length === 0 && (
          <p className="text-center text-muted-foreground py-12">
            {search ? "Nenhum produto encontrado para essa busca." : "Nenhum produto disponível no momento."}
          </p>
        )}
      </div>

      {/* Cart FAB */}
      {totalItems > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-3xl mx-auto z-50">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full gradient-hero text-primary-foreground rounded-2xl p-4 shadow-hero flex items-center justify-between font-bold"
          >
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-5 h-5" />
              <span>{totalItems} {totalItems === 1 ? "item" : "itens"}</span>
            </div>
            <span>R$ {subtotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => setCartOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-card shadow-2xl flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Seu Pedido</h2>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setCartOpen(false)}><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((item) => (
                <div key={item.product.id} className="bg-muted/50 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{item.product.name}</p>
                      <div className="flex items-center gap-2">
                        {item.product.promotional_price > 0 ? (
                          <>
                            <span className="text-xs text-muted-foreground line-through">R$ {(item.product.price * item.quantity).toFixed(2)}</span>
                            <span className="text-sm text-primary font-bold">R$ {(item.product.promotional_price * item.quantity).toFixed(2)}</span>
                          </>
                        ) : (
                          <span className="text-sm text-primary font-medium">R$ {(item.product.price * item.quantity).toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => removeFromCart(item.product.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
                  </div>
                  {item.product.description && <p className="text-xs text-muted-foreground mt-1 mb-2 line-clamp-1">{item.product.description}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    <button onClick={() => updateQuantity(item.product.id, -1)} className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                    <span className="font-bold text-foreground">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.id, 1)} className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-border space-y-3">
              <div className="flex items-center gap-2">
                <Input placeholder="Cupom de desconto" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} className="flex-1" />
                <Button variant="outline" size="sm" onClick={applyCoupon}>Aplicar</Button>
              </div>
              {appliedCoupon && (
                <p className="text-sm text-green-600 font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Cupom {appliedCoupon.code} aplicado!</p>
              )}
              <div className="text-sm space-y-1">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>R$ {subtotal.toFixed(2)}</span></div>
                {discount > 0 && <div className="flex justify-between text-green-600"><span>Desconto</span><span>-R$ {discount.toFixed(2)}</span></div>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="lg" className="flex-1 px-0 truncate" onClick={() => setCartOpen(false)}>
                  Continuar compras
                </Button>
                <Button variant="hero" size="lg" className="flex-1 px-0 truncate" onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}>
                  Finalizar • R$ {(subtotal - discount).toFixed(2)}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => setCheckoutOpen(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">Finalizar Pedido</h2>
              <button onClick={() => setCheckoutOpen(false)}><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">

              <div>
                <Label>Nome</Label>
                <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Seu nome completo" required />
              </div>

              <div>
                <Label>WhatsApp</Label>
                <Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} placeholder="11999999999" required />
              </div>

              <div>
                <Label>Tipo de entrega</Label>
                <Select value={form.delivery_type} onValueChange={(v) => setForm({ ...form, delivery_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {store.delivery_enabled && <SelectItem value="delivery">Entrega</SelectItem>}
                    {store.pickup_enabled && <SelectItem value="pickup">Retirada no local</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              {form.delivery_type === "delivery" && (
                <>
                  <div>
                    <Label>Endereço</Label>
                    <Input value={form.customer_address} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} placeholder="Rua, número, complemento" required />
                  </div>
                  {deliveryZones.length > 0 && (
                    <div>
                      <Label>Bairro</Label>
                      <Select value={form.neighborhood} onValueChange={(v) => setForm({ ...form, neighborhood: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione o bairro" /></SelectTrigger>
                        <SelectContent>
                          {deliveryZones.map((z) => (
                            <SelectItem key={z.id} value={z.neighborhood}>{z.neighborhood} - R$ {z.fee.toFixed(2)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              <div>
                <Label>Forma de pagamento</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="cartao_credito">Cartão de crédito</SelectItem>
                    <SelectItem value="cartao_debito">Cartão de débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Alguma observação?" rows={2} />
              </div>

              <div className="bg-muted/50 rounded-xl p-4 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>R$ {subtotal.toFixed(2)}</span></div>
                {discount > 0 && <div className="flex justify-between text-green-600"><span>Desconto</span><span>-R$ {discount.toFixed(2)}</span></div>}
                {deliveryFee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Entrega</span><span>R$ {deliveryFee.toFixed(2)}</span></div>}
                <div className="flex justify-between font-bold text-foreground text-base pt-1 border-t border-border"><span>Total</span><span>R$ {total.toFixed(2)}</span></div>
                {estimatedTime > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 pt-1">
                    <Clock className="w-3 h-3" /> Estimativa: {estimatedTime} min
                  </p>
                )}
              </div>

              <Button variant="hero" size="lg" className="w-full" onClick={handleCheckout} disabled={isProcessing}>
                {isProcessing ? "Processando..." : (
                  <><Check className="w-4 h-4 mr-2" /> Finalizar Pedido</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="max-w-3xl mx-auto px-4 mt-12 pb-24 text-center border-t border-border pt-8">
        <a href="https://frfood.com.br" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
          &copy; Desenvolvido por FRFood
        </a>
      </div>

      {slug === "demo" && (
        <div className="fixed bottom-0 left-0 right-0 z-[60] p-4 bg-background/80 backdrop-blur-md border-t border-border flex flex-col items-center gap-2">
          <Button variant="hero" size="lg" className="w-full max-w-sm shadow-hero animate-pulse" asChild>
            <Link to="/checkout">Crie sua loja agora mesmo!</Link>
          </Button>
          <Link to="/" className="text-sm font-semibold flex items-center gap-1 text-foreground hover:text-primary transition-colors">
            Voltar ao site principal
          </Link>
        </div>
      )}
    </div>
  );
};

const ProductCard = ({ product, onAdd }: { product: any; onAdd: () => void }) => (
  <div className="bg-card rounded-xl border border-border/50 shadow-card overflow-hidden flex" style={{ minHeight: product.image_url ? '130px' : undefined }}>
    {product.image_url && (
      <div className="w-[130px] flex-shrink-0 relative">
        <img src={product.image_url} alt={product.name} className="absolute inset-0 w-full h-full object-cover object-center rounded-l-xl" loading="lazy" />
      </div>
    )}
    <div className="flex-1 p-4 flex flex-col justify-between">
      <div>
        <h3 className="font-bold text-foreground">{product.name}</h3>
        {product.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{product.description}</p>}
        {product.serves_people > 0 && (
          <p className="text-xs font-medium text-primary bg-primary/10 inline-block px-2 py-0.5 rounded-full mt-2">
            Serve até {product.serves_people} {product.serves_people === 1 ? 'pessoa' : 'pessoas'}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex flex-col">
          {product.promotional_price > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground line-through text-xs font-medium">R$ {Number(product.price).toFixed(2)}</span>
              <span className="text-primary font-bold text-lg">R$ {Number(product.promotional_price).toFixed(2)}</span>
            </div>
          ) : (
            <span className="text-primary font-bold text-lg">R$ {Number(product.price).toFixed(2)}</span>
          )}
        </div>
        <button
          onClick={onAdd}
          className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  </div>
);

export default PublicStore;
