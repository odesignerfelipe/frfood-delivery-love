import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShoppingBag, Plus, Minus, Trash2, X, Send, MapPin } from "lucide-react";

interface CartItem {
  product: any;
  quantity: number;
  notes: string;
}

const PublicStore = () => {
  const { slug } = useParams();
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
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    neighborhood: "",
    delivery_type: "delivery",
    payment_method: "",
    notes: "",
  });

  useEffect(() => {
    const fetch = async () => {
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
    };
    fetch();
  }, [slug]);

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1, notes: "" }];
    });
    toast.success(`${product.name} adicionado!`);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) => i.product.id === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter((i) => i.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);

  const selectedZone = deliveryZones.find((z) => z.neighborhood === form.neighborhood);
  const deliveryFee = form.delivery_type === "delivery" ? (selectedZone?.fee || 0) : 0;

  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discount_type === "percentage") {
      discount = subtotal * (appliedCoupon.discount_value / 100);
    } else {
      discount = appliedCoupon.discount_value;
    }
  }

  const total = subtotal - discount + deliveryFee;

  const applyCoupon = async () => {
    if (!store || !couponCode.trim()) return;
    const { data } = await supabase
      .from("coupons")
      .select("*")
      .eq("store_id", store.id)
      .eq("code", couponCode.toUpperCase())
      .eq("is_active", true)
      .maybeSingle();

    if (!data) {
      toast.error("Cupom inválido");
      return;
    }
    if (data.min_order_value && subtotal < data.min_order_value) {
      toast.error(`Pedido mínimo de R$ ${data.min_order_value.toFixed(2)} para usar este cupom`);
      return;
    }
    if (data.max_uses && data.current_uses >= data.max_uses) {
      toast.error("Este cupom já atingiu o limite de usos");
      return;
    }
    setAppliedCoupon(data);
    toast.success("Cupom aplicado!");
  };

  const handleCheckout = async () => {
    if (!store || cart.length === 0) return;
    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      toast.error("Preencha seu nome e telefone");
      return;
    }
    if (form.delivery_type === "delivery" && !form.customer_address.trim()) {
      toast.error("Preencha o endereço de entrega");
      return;
    }
    if (store.min_order_value && subtotal < store.min_order_value) {
      toast.error(`Pedido mínimo de R$ ${store.min_order_value.toFixed(2)}`);
      return;
    }

    // Create order in DB
    const { data: order, error } = await supabase.from("orders").insert({
      store_id: store.id,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      customer_address: form.customer_address,
      neighborhood: form.neighborhood,
      delivery_type: form.delivery_type,
      delivery_fee: deliveryFee,
      subtotal,
      discount,
      total,
      coupon_code: appliedCoupon?.code || "",
      notes: form.notes,
      payment_method: form.payment_method,
    }).select().single();

    if (error || !order) {
      toast.error("Erro ao criar pedido");
      return;
    }

    // Create order items
    await supabase.from("order_items").insert(
      cart.map((i) => ({
        order_id: order.id,
        product_id: i.product.id,
        product_name: i.product.name,
        quantity: i.quantity,
        unit_price: i.product.price,
        subtotal: i.product.price * i.quantity,
        notes: i.notes,
      }))
    );

    // Update coupon usage
    if (appliedCoupon) {
      await supabase.from("coupons").update({ current_uses: appliedCoupon.current_uses + 1 }).eq("id", appliedCoupon.id);
    }

    // Build WhatsApp message
    const items = cart.map((i) => `${i.quantity}x ${i.product.name} - R$ ${(i.product.price * i.quantity).toFixed(2)}${i.notes ? ` (${i.notes})` : ""}`).join("\n");
    const msg = encodeURIComponent(
      `🛒 *Novo Pedido #${order.order_number}*\n\n` +
      `*Cliente:* ${form.customer_name}\n` +
      `*Tel:* ${form.customer_phone}\n` +
      `${form.delivery_type === "delivery" ? `*Endereço:* ${form.customer_address}\n*Bairro:* ${form.neighborhood}\n` : "*Retirada no local*\n"}` +
      `\n*Itens:*\n${items}\n\n` +
      `*Subtotal:* R$ ${subtotal.toFixed(2)}\n` +
      `${discount > 0 ? `*Desconto:* -R$ ${discount.toFixed(2)}\n` : ""}` +
      `${deliveryFee > 0 ? `*Entrega:* R$ ${deliveryFee.toFixed(2)}\n` : ""}` +
      `*Total: R$ ${total.toFixed(2)}*\n` +
      `${form.payment_method ? `*Pagamento:* ${form.payment_method}\n` : ""}` +
      `${form.notes ? `*Obs:* ${form.notes}` : ""}`
    );

    const phone = store.phone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");

    setCart([]);
    setCheckoutOpen(false);
    setCartOpen(false);
    setAppliedCoupon(null);
    setCouponCode("");
    toast.success("Pedido enviado com sucesso!");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Loja não encontrada</h1>
          <p className="text-muted-foreground">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  if (!store.is_open) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">{store.name}</h1>
          <p className="text-lg text-destructive font-medium">🔴 Estamos fechados no momento</p>
          <p className="text-muted-foreground mt-2">Volte mais tarde!</p>
        </div>
      </div>
    );
  }

  const productsByCategory = categories.map((cat) => ({
    ...cat,
    products: products.filter((p) => p.category_id === cat.id),
  }));

  const uncategorized = products.filter((p) => !p.category_id);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="gradient-hero py-8 px-4 text-center">
        <h1 className="text-3xl font-extrabold text-primary-foreground">{store.name}</h1>
        {store.description && <p className="text-primary-foreground/80 mt-1">{store.description}</p>}
        <p className="text-primary-foreground/60 text-sm mt-2">🟢 Aberto agora</p>
      </div>

      {/* Menu */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {productsByCategory.map((cat) =>
          cat.products.length > 0 ? (
            <div key={cat.id} className="mb-8">
              <h2 className="text-xl font-bold text-foreground mb-4 border-b border-border pb-2">{cat.name}</h2>
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
            <h2 className="text-xl font-bold text-foreground mb-4 border-b border-border pb-2">Outros</h2>
            <div className="space-y-3">
              {uncategorized.map((p) => (
                <ProductCard key={p.id} product={p} onAdd={() => addToCart(p)} />
              ))}
            </div>
          </div>
        )}

        {products.length === 0 && (
          <p className="text-center text-muted-foreground py-12">Nenhum produto disponível no momento.</p>
        )}
      </div>

      {/* Cart FAB */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-3xl mx-auto z-50">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full gradient-hero text-primary-foreground rounded-2xl p-4 shadow-hero flex items-center justify-between font-bold"
          >
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-5 h-5" />
              <span>{cart.reduce((s, i) => s + i.quantity, 0)} itens</span>
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
              <h2 className="text-lg font-bold text-foreground">Seu Carrinho</h2>
              <button onClick={() => setCartOpen(false)}><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((item) => (
                <div key={item.product.id} className="bg-muted/50 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{item.product.name}</p>
                      <p className="text-sm text-primary font-medium">R$ {(item.product.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <button onClick={() => removeFromCart(item.product.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <button onClick={() => updateQuantity(item.product.id, -1)} className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-bold text-foreground">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.id, 1)} className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-border space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Cupom de desconto"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={applyCoupon}>Aplicar</Button>
              </div>
              {appliedCoupon && (
                <p className="text-sm text-green-600 font-medium">
                  ✅ Cupom {appliedCoupon.code} aplicado! -{appliedCoupon.discount_type === "percentage" ? `${appliedCoupon.discount_value}%` : `R$ ${appliedCoupon.discount_value.toFixed(2)}`}
                </p>
              )}
              <div className="text-sm space-y-1">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>R$ {subtotal.toFixed(2)}</span></div>
                {discount > 0 && <div className="flex justify-between text-green-600"><span>Desconto</span><span>-R$ {discount.toFixed(2)}</span></div>}
              </div>
              <Button variant="hero" size="lg" className="w-full" onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}>
                Finalizar pedido • R$ {(subtotal - discount).toFixed(2)}
              </Button>
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
                <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Seu nome" required />
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
                            <SelectItem key={z.id} value={z.neighborhood}>
                              {z.neighborhood} - R$ {z.fee.toFixed(2)}
                            </SelectItem>
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
              </div>

              <Button variant="hero" size="lg" className="w-full" onClick={handleCheckout}>
                <Send className="w-4 h-4 mr-2" /> Enviar pedido pelo WhatsApp
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ProductCard = ({ product, onAdd }: { product: any; onAdd: () => void }) => (
  <div className="bg-card rounded-xl border border-border/50 shadow-card overflow-hidden flex">
    {product.image_url && (
      <img src={product.image_url} alt={product.name} className="w-28 h-28 object-cover flex-shrink-0" loading="lazy" />
    )}
    <div className="flex-1 p-4 flex flex-col justify-between">
      <div>
        <h3 className="font-bold text-foreground">{product.name}</h3>
        {product.description && <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-primary font-bold">R$ {product.price.toFixed(2)}</span>
        <button
          onClick={onAdd}
          className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
);

export default PublicStore;
