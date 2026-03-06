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
  const [stickySearchOpen, setStickySearchOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Variation modal state
  const [variationModalOpen, setVariationModalOpen] = useState(false);
  const [variationProduct, setVariationProduct] = useState<any>(null);
  const [variationSelections, setVariationSelections] = useState<Record<string, { name: string; price: number }[]>>({});

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

    // Fetch all variations for products
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time store sync
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

  // Real-time product sync (for sold-out updates)
  useEffect(() => {
    if (!store) return;
    const channel = supabase
      .channel(`products-sync-${store.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products", filter: `store_id=eq.${store.id}` },
        () => { fetchData(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [store?.id, fetchData]);

  // Dynamic Title and Favicon
  useEffect(() => {
    if (store) {
      document.title = store.name;
      const orderId = localStorage.getItem(`latest_order_${store.id}`);
      if (orderId) setActiveOrderId(orderId);

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
  }, [store?.name, store?.logo_url, store?.id]);

  // Check active order status
  useEffect(() => {
    const checkActiveOrderStatus = async () => {
      if (!activeOrderId || !store) return;
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("status")
          .eq("id", activeOrderId)
          .single();

        if (data) {
          if (["delivered", "picked_up", "cancelled"].includes(data.status)) {
            localStorage.removeItem(`latest_order_${store.id}`);
            setActiveOrderId(null);
          }
        }
      } catch (err) {
        console.error("Error checking active order status:", err);
      }
    };

    checkActiveOrderStatus();
  }, [activeOrderId, store]);

  // Sticky header on scroll
  useEffect(() => {
    const handleScroll = () => {
      setShowStickyHeader(window.scrollY > 280);
    };
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

  // Close cart on store close
  useEffect(() => {
    if (!loading && store && !storeOpen) {
      if (cartOpen || checkoutOpen) {
        setCartOpen(false);
        setCheckoutOpen(false);
        toast.error("A loja foi fechada! Pedidos não podem mais ser enviados.");
      }
    }
  }, [storeOpen, loading, store, cartOpen, checkoutOpen]);

  const handleAddToCart = (product: any) => {
    if (!storeOpen) { toast.error("Loja fechada no momento"); return; }
    if (product.is_sold_out) { toast.error("Este produto está esgotado"); return; }

    const vars = productVariations[product.id];
    if (vars && vars.length > 0) {
      // Open variation modal
      setVariationProduct(product);
      setVariationSelections({});
      setVariationModalOpen(true);
    } else {
      // Add directly
      addToCartDirect(product, [], 0);
    }
  };

  const addToCartDirect = (product: any, selectedVariations: SelectedVariation[], variationsPrice: number) => {
    setCart((prev) => {
      // For products with variations, always add as new item (different selections)
      if (selectedVariations.length > 0) {
        return [...prev, { product, quantity: 1, notes: "", variations: selectedVariations, variationsPrice }];
      }
      const existing = prev.find((i) => i.product.id === product.id && i.variations.length === 0);
      if (existing) return prev.map((i) => i.product.id === product.id && i.variations.length === 0 ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1, notes: "", variations: [], variationsPrice: 0 }];
    });
    toast.success(`${product.name} adicionado!`);
  };

  const confirmVariationSelection = () => {
    if (!variationProduct) return;
    const vars = productVariations[variationProduct.id] || [];

    // Validate required variations
    for (const v of vars) {
      if (v.required) {
        const selected = variationSelections[v.id] || [];
        if (selected.length === 0) {
          toast.error(`Selecione uma opção para "${v.name}"`);
          return;
        }
      }
    }

    // Build selections
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
      if (exists) {
        return { ...prev, [variationId]: current.filter(o => o.name !== option.name) };
      }
      if (maxSelections === 1) {
        return { ...prev, [variationId]: [option] };
      }
      if (current.length >= maxSelections) {
        toast.error(`Máximo de ${maxSelections} opções`);
        return prev;
      }
      return { ...prev, [variationId]: [...current, option] };
    });
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => prev.map((item, i) => i === index ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter((i) => i.quantity > 0));
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const getItemPrice = (item: CartItem) => {
    const basePrice = item.product.promotional_price > 0 ? Number(item.product.promotional_price) : Number(item.product.price);
    return basePrice + item.variationsPrice;
  };

  const subtotal = cart.reduce((s, i) => s + getItemPrice(i) * i.quantity, 0);

  // Dynamic Coupon Verification
  useEffect(() => {
    if (appliedCoupon && appliedCoupon.min_order_value && subtotal < appliedCoupon.min_order_value) {
      toast.error(`Cupom removido. O pedido não atinge o mínimo de R$ ${appliedCoupon.min_order_value.toFixed(2)}`);
      setAppliedCoupon(null);
    }
  }, [subtotal, appliedCoupon]);
  const selectedZone = deliveryZones.find((z) => z.neighborhood === form.neighborhood);
  const deliveryFee = form.delivery_type === "delivery" ? Number(selectedZone?.fee || 0) : 0;

  let discount = 0;
  if (appliedCoupon) {
    discount = appliedCoupon.discount_type === "percentage" ? subtotal * (appliedCoupon.discount_value / 100) : appliedCoupon.discount_value;
  }
  const total = Number(subtotal) - Number(discount) + deliveryFee;
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
    if (form.delivery_type === "delivery" && deliveryZones.length > 0 && !form.neighborhood) { toast.error("Selecione o bairro"); setIsProcessing(false); return; }
    if (!form.payment_method) { toast.error("Selecione a forma de pagamento"); setIsProcessing(false); return; }

    if (store.min_order_value && subtotal < store.min_order_value) { toast.error(`Pedido mínimo R$ ${store.min_order_value.toFixed(2)}`); setIsProcessing(false); return; }

    const orderId = crypto.randomUUID();
    const { error } = await supabase.from("orders").insert({
      id: orderId,
      store_id: store.id,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      customer_address: form.customer_address,
      neighborhood: form.neighborhood,
      delivery_type: form.delivery_type,
      delivery_fee: deliveryFee,
      subtotal: Number(subtotal),
      discount: Number(discount),
      total: total,
      coupon_code: appliedCoupon?.code || "",
      notes: form.notes,
      payment_method: form.payment_method,
    });

    if (error) {
      console.error("Order Insert Error:", error);
      toast.error(error?.message || "Erro ao criar pedido. Verifique os dados.");
      setIsProcessing(false);
      return;
    }

    await supabase.from("order_items").insert(
      cart.map((i) => ({
        order_id: orderId,
        product_id: i.product.id,
        product_name: i.product.name,
        quantity: i.quantity,
        unit_price: getItemPrice(i),
        subtotal: getItemPrice(i) * i.quantity,
        notes: i.notes,
        variations: (i.variations.length > 0 ? i.variations : []) as any,
      }))
    );

    if (appliedCoupon) {
      await supabase.from("coupons").update({ current_uses: appliedCoupon.current_uses + 1 }).eq("id", appliedCoupon.id);
    }

    localStorage.setItem(`latest_order_${store.id}`, orderId);

    setCart([]);
    setCheckoutOpen(false);
    setCartOpen(false);
    setAppliedCoupon(null);
    setCouponCode("");
    setIsProcessing(false);
    toast.success("Pedido finalizado com sucesso!");
    navigate(`/pedido/${orderId}`);
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


  // Dynamic color theming
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

      {/* Active Order Banner */}
      {activeOrderId && (
        <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shadow-md z-40 relative">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 animate-bounce" />
            <span className="font-bold text-sm">Você tem um pedido recém-realizado!</span>
          </div>
          <Link to={`/pedido/${activeOrderId}`} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-full text-xs font-bold transition-colors shadow-sm">
            Acompanhar
          </Link>
        </div>
      )}

      {/* Sticky Compact Header */}
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
      {/* Banner & Store Header */}
      <div className="bg-slate-50 pt-4 md:pt-8 pb-10 border-b border-slate-100">
        <div className="max-w-[1210px] mx-auto px-4">
          {/* Banner Container */}
          <div className="relative rounded-2xl md:rounded-[2rem] overflow-hidden shadow-lg bg-slate-200">
            {/* Desktop Banner - Using aspect ratio for 1210x250 */}
            <div className="hidden md:block w-full aspect-[1210/250]">
              {store.banner_url ? (
                <img src={store.banner_url} alt={store.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full gradient-hero" />
              )}
            </div>

            {/* Mobile Banner */}
            <div className="block md:hidden w-full h-48">
              {store.banner_mobile_url || store.banner_url ? (
                <img src={store.banner_mobile_url || store.banner_url} alt={store.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full gradient-hero" />
              )}
            </div>
          </div>

          {/* Store Logo & Identity (Floating Overlap) */}
          <div className="relative flex flex-col items-center -mt-12 md:-mt-16 z-20">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white shadow-xl bg-white overflow-hidden flex-shrink-0">
              {store.logo_url ? (
                <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-black text-3xl">{store.name.charAt(0)}</span>
                </div>
              )}
            </div>

            <div className="mt-4 text-center px-4 max-w-2xl w-full">
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight leading-tight">
                {store.name}
              </h1>

              {store.address && (
                <div className="mt-1 flex items-center justify-center gap-1 text-[10px] md:text-xs text-slate-400 font-medium">
                  <MapPin className="w-3 h-3" />
                  <span>{store.address}{store.city ? `, ${store.city}` : ""}</span>
                </div>
              )}

              {store.description && (
                <p className="mt-2 text-slate-500 text-sm md:text-base leading-relaxed line-clamp-2 italic">
                  "{store.description}"
                </p>
              )}

              {/* Badges & Info Row */}
              <div className="mt-4 flex flex-wrap justify-center items-center gap-2 md:gap-3">
                <div className={`inline-flex items-center gap-2 font-bold px-4 py-1.5 rounded-full text-[10px] uppercase tracking-wider shadow-sm ${storeOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  <span className={`w-2 h-2 rounded-full ${storeOpen ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                  {storeOpen ? "Aberto Agora" : "Fechado"}
                </div>

                {todayHours && (
                  <div className="inline-flex items-center gap-1.5 text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {todayHours}
                  </div>
                )}

                {(store as any).avg_delivery_time && (
                  <div className="inline-flex items-center gap-1.5 text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm">
                    <Zap className="w-3.5 h-3.5 text-amber-500 shadow-sm" />
                    {(store as any).avg_delivery_time} min
                  </div>
                )}
              </div>

              {/* Contact Info (Simplified since address is now above) */}
              <div className="mt-6 flex flex-col md:flex-row items-center justify-center gap-4 text-[10px] md:text-xs text-slate-400 font-medium border-t border-slate-100 pt-6">
                <a
                  href={`https://wa.me/55${store.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:bg-primary hover:text-white transition-all bg-primary/5 px-6 py-2 rounded-full font-bold uppercase tracking-wide border border-primary/10"
                >
                  <Phone className="w-4 h-4" />
                  <span>Chamar no WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
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
                  <ProductCard key={p.id} product={p} onAdd={() => handleAddToCart(p)} hasVariations={!!productVariations[p.id]?.length} />
                ))}
              </div>
            </div>
          ) : null
        )}

        {uncategorized.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-foreground mb-3 border-b border-border pb-2">Outros</h2>
            <div className="space-y-3">
              {uncategorized.map((p) => <ProductCard key={p.id} product={p} onAdd={() => handleAddToCart(p)} hasVariations={!!productVariations[p.id]?.length} />)}
            </div>
          </div>
        )}

        {filteredProducts.length === 0 && (
          <p className="text-center text-muted-foreground py-12">
            {search ? "Nenhum produto encontrado para essa busca." : "Nenhum produto disponível no momento."}
          </p>
        )}
      </div>

      {/* Variation Selection Modal */}
      {
        variationModalOpen && variationProduct && (
          <Dialog open={variationModalOpen} onOpenChange={setVariationModalOpen}>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {variationProduct.image_url && (
                    <img src={variationProduct.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                  )}
                  <div>
                    <p className="text-lg font-bold">{variationProduct.name}</p>
                    <p className="text-sm text-primary font-medium">
                      R$ {(variationProduct.promotional_price > 0 ? variationProduct.promotional_price : variationProduct.price).toFixed(2)}
                    </p>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-2">
                {(productVariations[variationProduct.id] || []).map((v: any) => (
                  <div key={v.id}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-bold text-foreground text-sm">{v.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {v.required ? "Obrigatório" : "Opcional"} • {v.max_selections === 1 ? "Escolha 1" : `Até ${v.max_selections}`}
                        </p>
                      </div>
                      {v.required && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">OBRIGATÓRIO</span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {(v.options || []).map((opt: any, oi: number) => {
                        const isSelected = (variationSelections[v.id] || []).some(s => s.name === opt.name);
                        return (
                          <button
                            key={oi}
                            onClick={() => toggleVariationOption(v.id, opt, v.max_selections)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all ${isSelected
                              ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/30"
                              : "border-border bg-card text-muted-foreground hover:border-primary/30"
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                                {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                              </div>
                              <span className={isSelected ? "font-medium text-foreground" : ""}>{opt.name}</span>
                            </div>
                            {opt.price > 0 && (
                              <span className="text-xs font-medium text-primary">+R$ {opt.price.toFixed(2)}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Price preview */}
                <div className="bg-muted/50 rounded-xl p-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Produto</span>
                    <span>R$ {(variationProduct.promotional_price > 0 ? variationProduct.promotional_price : variationProduct.price).toFixed(2)}</span>
                  </div>
                  {Object.values(variationSelections).flat().filter(s => s.price > 0).length > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Opcionais</span>
                      <span>+R$ {Object.values(variationSelections).flat().reduce((sum, s) => sum + s.price, 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-foreground text-base pt-1 border-t border-border mt-1">
                    <span>Total</span>
                    <span>R$ {(
                      (variationProduct.promotional_price > 0 ? variationProduct.promotional_price : variationProduct.price) +
                      Object.values(variationSelections).flat().reduce((sum, s) => sum + s.price, 0)
                    ).toFixed(2)}</span>
                  </div>
                </div>

                <Button variant="hero" className="w-full" onClick={confirmVariationSelection}>
                  <Plus className="w-4 h-4 mr-2" /> Adicionar ao pedido
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )
      }

      {/* Cart FAB */}
      {
        totalItems > 0 && (
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
        )
      }

      {/* Cart Drawer */}
      {
        cartOpen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-foreground/50" onClick={() => setCartOpen(false)} />
            <div className="absolute right-0 top-0 h-full w-full max-w-md bg-card shadow-2xl flex flex-col">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">Seu Pedido</h2>
                <button className="text-muted-foreground hover:text-foreground" onClick={() => setCartOpen(false)}><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.map((item, idx) => (
                  <div key={idx} className="bg-muted/50 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{item.product.name}</p>
                        <div className="flex items-center gap-2">
                          {item.product.promotional_price > 0 ? (
                            <>
                              <span className="text-xs text-muted-foreground line-through">R$ {(item.product.price * item.quantity).toFixed(2)}</span>
                              <span className="text-sm text-primary font-bold">R$ {(getItemPrice(item) * item.quantity).toFixed(2)}</span>
                            </>
                          ) : (
                            <span className="text-sm text-primary font-medium">R$ {(getItemPrice(item) * item.quantity).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => removeFromCart(idx)}><Trash2 className="w-4 h-4 text-destructive" /></button>
                    </div>
                    {/* Variation details in cart */}
                    {item.variations.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {item.variations.map((v, vi) => (
                          <p key={vi} className="text-xs text-muted-foreground">
                            <span className="font-medium">{v.group}:</span> {v.selected.map(s => `${s.name}${s.price > 0 ? ` (+R$${s.price.toFixed(2)})` : ""}`).join(", ")}
                          </p>
                        ))}
                      </div>
                    )}
                    {item.product.description && <p className="text-xs text-muted-foreground mt-1 mb-2 line-clamp-1">{item.product.description}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      <button onClick={() => updateQuantity(idx, -1)} className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                      <span className="font-bold text-foreground">{item.quantity}</span>
                      <button onClick={() => updateQuantity(idx, 1)} className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><Plus className="w-3 h-3" /></button>
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
        )
      }

      {/* Checkout Modal */}
      {
        checkoutOpen && (
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
        )
      }

      {/* Footer */}
      <div className="max-w-3xl mx-auto px-4 mt-12 pb-24 text-center border-t border-border pt-8">
        <a href="https://frfood.com.br" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
          &copy; Desenvolvido por FRFood
        </a>
      </div>

      {
        slug === "demo" && (
          <div className="fixed bottom-0 left-0 right-0 z-[60] p-4 bg-background/80 backdrop-blur-md border-t border-border flex flex-col items-center gap-2">
            <Button variant="hero" size="lg" className="w-full max-w-sm shadow-hero animate-pulse" asChild>
              <Link to="/checkout">Crie sua loja agora mesmo!</Link>
            </Button>
            <Link to="/" className="text-sm font-semibold flex items-center gap-1 text-foreground hover:text-primary transition-colors">
              Voltar ao site principal
            </Link>
          </div>
        )
      }
    </div >
  );
};

const ProductCard = ({ product, onAdd, hasVariations }: { product: any; onAdd: () => void; hasVariations?: boolean }) => {
  const isSoldOut = product.is_sold_out;

  return (
    <div className={`bg-card rounded-xl border border-border/50 shadow-card overflow-hidden flex ${isSoldOut ? "opacity-80" : ""}`} style={{ minHeight: product.image_url ? '130px' : undefined }}>
      {product.image_url && (
        <div className="w-[130px] flex-shrink-0 relative">
          <img src={product.image_url} alt={product.name} className={`absolute inset-0 w-full h-full object-cover object-center rounded-l-xl ${isSoldOut ? "grayscale" : ""}`} loading="lazy" />
          {isSoldOut && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-l-xl">
              <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">ESGOTADO</span>
            </div>
          )}
        </div>
      )}
      <div className="flex-1 p-4 flex flex-col justify-between">
        <div>
          <h3 className={`font-bold ${isSoldOut ? "text-muted-foreground" : "text-foreground"}`}>{product.name}</h3>
          {product.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{product.description}</p>}
          {product.serves_people > 0 && (
            <p className="text-xs font-medium text-primary bg-primary/10 inline-block px-2 py-0.5 rounded-full mt-2">
              Serve até {product.serves_people} {product.serves_people === 1 ? 'pessoa' : 'pessoas'}
            </p>
          )}
          {hasVariations && !isSoldOut && (
            <p className="text-[10px] font-medium text-blue-600 bg-blue-50 inline-block px-2 py-0.5 rounded-full mt-1 ml-1">
              Personalizável
            </p>
          )}
        </div>
        {isSoldOut ? (
          <div className="mt-3">
            <p className="text-xs text-red-600 leading-relaxed">
              Infelizmente o(a) <span className="font-bold">{product.name}</span> acabou. Porém, temos diversos outros pratos deliciosos e disponíveis!
            </p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default PublicStore;
