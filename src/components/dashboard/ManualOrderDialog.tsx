import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  ShoppingBag, Plus, Minus, Trash2, Send, MapPin, 
  Search, Package, Clock, Phone, Check, User, 
  Bike, Store, ChevronRight, ChevronLeft, CreditCard, Banknote, QrCode
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

interface ManualOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  onOrderCreated?: () => void;
}

export default function ManualOrderDialog({ open, onOpenChange, storeId, onOrderCreated }: ManualOrderDialogProps) {
  const [step, setStep] = useState<"catalog" | "checkout">("catalog");
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [store, setStore] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [productVariations, setProductVariations] = useState<Record<string, any[]>>({});
  const [deliveryZones, setDeliveryZones] = useState<any[]>([]);
  
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  
  // Variations Modal
  const [variationModalOpen, setVariationModalOpen] = useState(false);
  const [variationProduct, setVariationProduct] = useState<any>(null);
  const [variationSelections, setVariationSelections] = useState<Record<string, { name: string; price: number }[]>>({});
  const [itemNotes, setItemNotes] = useState("");

  // Form State
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    neighborhood: "",
    delivery_type: "delivery",
    payment_method: "dinheiro",
    notes: ""
  });

  useEffect(() => {
    if (open && storeId) {
      fetchData();
      // Reset state on open
      setCart([]);
      setStep("catalog");
      setForm({
        customer_name: "",
        customer_phone: "",
        customer_address: "",
        neighborhood: "",
        delivery_type: "delivery",
        payment_method: "dinheiro",
        notes: ""
      });
    }
  }, [open, storeId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: s } = await supabase.from("stores").select("*").eq("id", storeId).single();
      if (!s) return;
      setStore(s);

      const [cats, prods, zones] = await Promise.all([
        supabase.from("categories").select("*").eq("store_id", storeId).eq("is_active", true).order("sort_order"),
        supabase.from("products").select("*").eq("store_id", storeId).eq("is_active", true).order("sort_order"),
        supabase.from("delivery_zones").select("*").eq("store_id", storeId).eq("is_active", true).order("neighborhood")
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
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product: any) => {
    const vars = productVariations[product.id];
    if (vars && vars.length > 0) {
      setVariationProduct(product);
      setVariationSelections({});
      setItemNotes("");
      setVariationModalOpen(true);
    } else {
      addToCartDirect(product, [], 0, "");
    }
  };

  const addToCartDirect = (product: any, selectedVariations: any[], variationsPrice: number, notes: string) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(i => 
        i.product.id === product.id && 
        i.notes === notes && 
        JSON.stringify(i.variations) === JSON.stringify(selectedVariations)
      );

      if (existingIdx >= 0) {
        const newCart = [...prev];
        newCart[existingIdx].quantity += 1;
        return newCart;
      }

      return [...prev, {
        id: crypto.randomUUID(),
        product,
        quantity: 1,
        notes,
        variations: selectedVariations,
        variationsPrice
      }];
    });
    toast.success(`${product.name} adicionado!`);
  };

  const toggleVariationOption = (variationId: string, option: { name: string; price: number }, maxSelections: number) => {
    setVariationSelections(prev => {
      const current = prev[variationId] || [];
      const exists = current.find(o => o.name === option.name);
      if (exists) return { ...prev, [variationId]: current.filter(o => o.name !== option.name) };
      if (maxSelections === 1) return { ...prev, [variationId]: [option] };
      if (current.length >= maxSelections) {
        toast.error(`Máximo de ${maxSelections} opções`);
        return prev;
      }
      return { ...prev, [variationId]: [...current, option] };
    });
  };

  const confirmVariationSelection = () => {
    if (!variationProduct) return;
    const vars = productVariations[variationProduct.id] || [];
    for (const v of vars) {
      if (v.required && (!variationSelections[v.id] || variationSelections[v.id].length === 0)) {
        toast.error(`Selecione uma opção para "${v.name}"`);
        return;
      }
    }

    const selectedVariations: any[] = [];
    let totalVarPrice = 0;
    for (const v of vars) {
      const selected = variationSelections[v.id] || [];
      if (selected.length > 0) {
        selectedVariations.push({ group: v.name, selected });
        totalVarPrice += selected.reduce((sum, s) => sum + s.price, 0);
      }
    }

    addToCartDirect(variationProduct, selectedVariations, totalVarPrice, itemNotes);
    setVariationModalOpen(false);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter(i => i.quantity > 0));
  };

  const getItemPrice = (item: any) => {
    const base = item.product.promotional_price > 0 ? item.product.promotional_price : item.product.price;
    return Number(base) + item.variationsPrice;
  };

  const subtotal = cart.reduce((s, i) => s + getItemPrice(i) * i.quantity, 0);
  const activeZone = deliveryZones.find(z => z.neighborhood === form.neighborhood);
  const deliveryFee = form.delivery_type === "delivery" ? (activeZone?.fee || 0) : 0;
  const total = subtotal + deliveryFee;

  const handleCreateOrder = async () => {
    if (cart.length === 0) return;
    if (!form.customer_name || !form.customer_phone) {
      toast.error("Preencha o nome e telefone do cliente");
      return;
    }
    if (form.delivery_type === "delivery" && (!form.neighborhood || !form.customer_address)) {
      toast.error("Preencha os dados de entrega");
      return;
    }

    setIsSending(true);
    try {
      const orderId = crypto.randomUUID();

      const { error: orderError } = await supabase.from("orders").insert({
        id: orderId,
        store_id: storeId,
        origin: "cashier",
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_address: form.customer_address,
        neighborhood: form.neighborhood,
        delivery_type: form.delivery_type,
        delivery_fee: deliveryFee,
        subtotal: subtotal,
        total: total,
        status: "pending",
        payment_method: form.payment_method,
        notes: form.notes
      });

      if (orderError) throw orderError;

      // Register customer
      await supabase.rpc('register_customer_from_order', {
        p_store_id: storeId,
        p_name: form.customer_name,
        p_phone: form.customer_phone,
        p_address: form.customer_address,
        p_neighborhood: form.neighborhood,
        p_total_spent: total
      });

      // Insert Items
      const { error: itemsError } = await supabase.from("order_items").insert(
        cart.map(i => ({
          order_id: orderId,
          product_id: i.product.id,
          product_name: i.product.name,
          quantity: i.quantity,
          unit_price: getItemPrice(i),
          subtotal: getItemPrice(i) * i.quantity,
          notes: i.notes,
          variations: i.variations
        }))
      );

      if (itemsError) throw itemsError;

      toast.success("Pedido manual criado!");
      onOrderCreated?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar pedido");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl h-[90vh] md:h-[80vh] p-0 overflow-hidden flex flex-col md:flex-row border-none rounded-3xl">
          {/* Left Side: Product Selector (Only in catalog step) */}
          <div className={`flex-1 flex flex-col min-w-0 bg-background ${step === 'checkout' ? 'hidden md:flex' : ''}`}>
            <DialogHeader className="p-6 border-b border-border bg-card/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" /> Novo Pedido Manual
                </DialogTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar produtos..." 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    className="pl-9 h-9 w-full sm:w-64 rounded-xl"
                  />
                </div>
              </div>
              <ScrollArea className="w-full mt-4">
                <div className="flex gap-2 pb-2">
                  <Button 
                    variant={!activeCategory ? "hero" : "outline"} 
                    size="sm" 
                    className="rounded-full px-4 h-8 text-[10px] uppercase font-bold"
                    onClick={() => setActiveCategory(null)}
                  >
                    Todos
                  </Button>
                  {categories.map(cat => (
                    <Button 
                      key={cat.id} 
                      variant={activeCategory === cat.id ? "hero" : "outline"} 
                      size="sm" 
                      className="rounded-full px-4 h-8 text-[10px] uppercase font-bold"
                      onClick={() => setActiveCategory(cat.id)}
                    >
                      {cat.name}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </DialogHeader>

            <ScrollArea className="flex-1 p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.filter(p => 
                  (!search || p.name.toLowerCase().includes(search.toLowerCase())) && 
                  (!activeCategory || p.category_id === activeCategory)
                ).map(p => {
                  const isOut = p.is_sold_out || (p.manage_stock && p.stock_quantity <= 0);
                  return (
                    <button
                      key={p.id}
                      disabled={isOut}
                      onClick={() => handleAddToCart(p)}
                      className={`flex gap-3 p-3 bg-card rounded-2xl border border-border hover:border-primary/50 transition-all text-left group ${isOut ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:shadow-md'}`}
                    >
                      {p.image_url ? (
                        <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                          <img src={p.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                          <Package className="w-6 h-6 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs line-clamp-2">{p.name}</p>
                        <p className="text-[10px] text-primary font-black mt-1">
                          {formatCurrency(p.promotional_price > 0 ? p.promotional_price : p.price)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right Side: Cart / Checkout Form */}
          <div className="w-full md:w-[380px] bg-muted/30 border-l border-border flex flex-col overflow-hidden">
            <div className="p-6 border-b border-border bg-background/50 flex items-center justify-between">
              <h3 className="font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-primary" /> {step === 'catalog' ? 'Itens Selecionados' : 'Dados da Venda'}
              </h3>
              {step === 'checkout' && (
                <Button variant="ghost" size="sm" className="h-7 text-[9px] uppercase font-bold" onClick={() => setStep("catalog")}>
                  <ChevronLeft className="w-3 h-3 mr-1" /> Voltar
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1 p-6">
              {step === 'catalog' ? (
                <div className="space-y-4">
                  {cart.length === 0 ? (
                    <div className="text-center py-12 opacity-50 space-y-2">
                      <ShoppingBag className="w-12 h-12 mx-auto" />
                      <p className="text-xs italic">Nenhum item adicionado.</p>
                    </div>
                  ) : (
                    cart.map(item => (
                      <div key={item.id} className="bg-card p-3 rounded-xl border border-border shadow-sm space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-xs leading-tight">{item.product.name}</p>
                            <p className="text-[10px] font-black text-primary mt-1">{formatCurrency(getItemPrice(item) * item.quantity)}</p>
                          </div>
                          <button onClick={() => updateQuantity(item.id, -100)} className="text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between bg-muted rounded-lg p-1">
                          <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-background"><Minus className="w-3 h-3" /></button>
                          <span className="text-xs font-black">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-background"><Plus className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setForm({...form, delivery_type: 'delivery'})}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${form.delivery_type === 'delivery' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card'}`}
                      >
                        <Bike className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-black uppercase">Entrega</span>
                      </button>
                      <button 
                        onClick={() => setForm({...form, delivery_type: 'pickup'})}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${form.delivery_type === 'pickup' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card'}`}
                      >
                        <Store className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-black uppercase">Retirada</span>
                      </button>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Nome do Cliente</Label>
                        <Input value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} placeholder="Ex: João Silva" className="rounded-xl h-10 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">WhatsApp</Label>
                        <Input value={form.customer_phone} onChange={e => setForm({...form, customer_phone: e.target.value})} placeholder="31999999999" className="rounded-xl h-10 text-sm" />
                      </div>

                      {form.delivery_type === 'delivery' && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Bairro / Taxa</Label>
                            <Select value={form.neighborhood} onValueChange={v => setForm({...form, neighborhood: v})}>
                              <SelectTrigger className="rounded-xl h-10 text-sm bg-card">
                                <SelectValue placeholder="Selecione o bairro" />
                              </SelectTrigger>
                              <SelectContent>
                                {deliveryZones.map(z => (
                                  <SelectItem key={z.id} value={z.neighborhood}>
                                    {z.neighborhood} ({formatCurrency(z.fee)})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Endereço Completo</Label>
                            <Input value={form.customer_address} onChange={e => setForm({...form, customer_address: e.target.value})} placeholder="Rua, Número, Complemento" className="rounded-xl h-10 text-sm" />
                          </div>
                        </>
                      )}

                      <div className="space-y-1 pt-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Pagamento</Label>
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            {id: 'dinheiro', icon: Banknote},
                            {id: 'cartao', icon: CreditCard},
                            {id: 'pix', icon: QrCode}
                          ].map(pm => (
                            <button
                              key={pm.id}
                              onClick={() => setForm({...form, payment_method: pm.id})}
                              className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${form.payment_method === pm.id ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
                            >
                              <pm.icon className={`w-4 h-4 ${form.payment_method === pm.id ? 'text-primary' : 'text-muted-foreground'}`} />
                              <span className="text-[8px] font-bold uppercase">{pm.id}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Observações do Pedido</Label>
                        <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Opcional..." className="rounded-xl h-10 text-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>

            <div className="p-6 bg-background border-t border-border space-y-4">
              <div className="space-y-1.5 bg-muted/20 p-3 rounded-2xl border border-border/40">
                <div className="flex justify-between text-xs font-bold text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {deliveryFee > 0 && (
                  <div className="flex justify-between text-xs font-bold text-muted-foreground">
                    <span>Taxa Entrega</span>
                    <span>{formatCurrency(deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-border/50">
                  <span className="font-black uppercase text-[10px]">Total</span>
                  <span className="text-xl font-black text-primary">{formatCurrency(total)}</span>
                </div>
              </div>

              {step === 'catalog' ? (
                <Button 
                  className="w-full h-14 font-black uppercase tracking-widest rounded-2xl shadow-lg ring-offset-background hover:scale-[1.02] active:scale-[0.98] transition-all"
                  variant="hero"
                  disabled={cart.length === 0}
                  onClick={() => setStep("checkout")}
                >
                  Próximo <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              ) : (
                <Button 
                  className="w-full h-14 font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-500/20 bg-emerald-500 hover:bg-emerald-600 ring-offset-background hover:scale-[1.02] active:scale-[0.98] transition-all"
                  disabled={isSending || cart.length === 0}
                  onClick={handleCreateOrder}
                >
                  {isSending ? <Clock className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5 mr-2" /> Finalizar Pedido</>}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Variation Modal - Reusing the one from Dashboard/PublicStore but styled consistently */}
      <Dialog open={variationModalOpen} onOpenChange={setVariationModalOpen}>
        <DialogContent className="sm:max-w-md p-0 border-none rounded-3xl overflow-hidden shadow-hero">
          {variationProduct && (
            <>
              <div className="bg-primary p-6 text-white">
                <h4 className="text-xl font-black uppercase">{variationProduct.name}</h4>
                <p className="text-sm font-black opacity-80 mt-1">{formatCurrency(variationProduct.promotional_price > 0 ? variationProduct.promotional_price : variationProduct.price)}</p>
              </div>
              <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                {(productVariations[variationProduct.id] || []).map(v => (
                  <div key={v.id} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">{v.name}</p>
                      <Badge variant="outline" className="text-[9px] uppercase font-black">
                        {v.required ? "Obrigatório" : "Opcional"} • {v.max_selections === 1 ? "1 opção" : `Até ${v.max_selections}`}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {v.options.map((opt: any, idx: number) => {
                        const isSelected = (variationSelections[v.id] || []).some(s => s.name === opt.name);
                        return (
                          <button
                            key={idx}
                            onClick={() => toggleVariationOption(v.id, opt, v.max_selections)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${isSelected ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card'}`}
                          >
                            <span className={`text-sm ${isSelected ? 'font-bold' : 'font-medium'}`}>{opt.name}</span>
                            {opt.price > 0 && <span className="text-[10px] font-black uppercase">+ {formatCurrency(opt.price)}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Observações do Item</Label>
                  <Input value={itemNotes} onChange={e => setItemNotes(e.target.value)} placeholder="Ex: Sem gelo..." className="rounded-xl" />
                </div>
              </div>
              <div className="p-6 bg-muted/30 border-t">
                <Button className="w-full h-12 font-black uppercase rounded-2xl" variant="hero" onClick={confirmVariationSelection}>
                  Confirmar e Adicionar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
