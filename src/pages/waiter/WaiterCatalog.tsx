import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStorePublic } from "@/hooks/useStorePublic";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ArrowLeft, Search, Check, ShoppingBag, Plus, Minus, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

interface SelectedVariation {
    group: string;
    selected: { name: string; price: number }[];
}

interface CartItem {
    id: string; // unique local id
    product: any;
    quantity: number;
    notes: string;
    variations: SelectedVariation[];
    variationsPrice: number;
}

interface WaiterCatalogProps {
    explicitSlug?: string;
}

const WaiterCatalog = ({ explicitSlug }: WaiterCatalogProps) => {
    const { id: comandaId, slug: paramSlug } = useParams();
    const activeSlug = explicitSlug || paramSlug;
    const { store, loading: storeLoading } = useStorePublic(activeSlug);
    const navigate = useNavigate();

    const [waiterSession, setWaiterSession] = useState<any>(null);
    const [comanda, setComanda] = useState<any>(null);

    const [categories, setCategories] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [productVariations, setProductVariations] = useState<Record<string, any[]>>({});
    const [loading, setLoading] = useState(true);

    // Cart & UI State
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [cartOpen, setCartOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);

    // Variation Modal State
    const [variationModalOpen, setVariationModalOpen] = useState(false);
    const [variationProduct, setVariationProduct] = useState<any>(null);
    const [variationSelections, setVariationSelections] = useState<Record<string, { name: string; price: number }[]>>({});
    const [itemNotes, setItemNotes] = useState("");

    useEffect(() => {
        if (store && !storeLoading) {
            const sessionStr = localStorage.getItem(`waiter_session_${store.id}`);
            if (!sessionStr) {
                navigate(explicitSlug ? "/garcom" : `/loja/${store.slug}/garcom`);
                return;
            }
            try {
                setWaiterSession(JSON.parse(sessionStr));
            } catch (e) {
                navigate(explicitSlug ? "/garcom" : `/loja/${store.slug}/garcom`);
            }
        }
    }, [store, storeLoading]);

    const fetchData = useCallback(async () => {
        if (!store || !comandaId) return;

        try {
            // 1. Fetch Comanda
            const { data: comandaData, error: comandaError } = await supabase
                .from("comandas")
                .select("*")
                .eq("id", comandaId)
                .single();

            if (comandaError) throw comandaError;
            if (comandaData.status !== "open") {
                toast.error("Esta comanda já está fechada.");
                navigate(explicitSlug ? `/garcom/comanda/${comandaId}` : `/loja/${store.slug}/garcom/comanda/${comandaId}`);
                return;
            }
            setComanda(comandaData);

            // 2. Fetch Catalog
            const [cats, prods] = await Promise.all([
                supabase.from("categories").select("*").eq("store_id", store.id).eq("is_active", true).order("sort_order"),
                supabase.from("products").select("*").eq("store_id", store.id).eq("is_active", true).order("sort_order"),
            ]);
            setCategories(cats.data || []);
            setProducts(prods.data || []);

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
            toast.error("Erro ao carregar dados.");
        } finally {
            setLoading(false);
        }
    }, [store, comandaId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddToCart = (product: any) => {
        if (product.is_sold_out) { toast.error("Produto esgotado"); return; }

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

    const addToCartDirect = (product: any, selectedVariations: SelectedVariation[], variationsPrice: number, notes: string) => {
        setCart(prev => {
            // Find exact same item
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
        toast.success(`${product.name} adicionado`);
    };

    const confirmVariationSelection = () => {
        if (!variationProduct) return;
        const vars = productVariations[variationProduct.id] || [];

        for (const v of vars) {
            if (v.required) {
                const selected = variationSelections[v.id] || [];
                if (selected.length === 0) {
                    toast.error(`Selecione uma opção para "${v.name}"`);
                    return;
                }
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

        addToCartDirect(variationProduct, selectedVariations, totalVarPrice, itemNotes);
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

    const updateQuantity = (id: string, delta: number) => {
        setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter(i => i.quantity > 0));
    };

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(i => i.id !== id));
    };

    const getItemPrice = (item: CartItem) => {
        const basePrice = item.product.promotional_price > 0 ? Number(item.product.promotional_price) : Number(item.product.price);
        return basePrice + item.variationsPrice;
    };

    const subtotal = cart.reduce((s, i) => s + getItemPrice(i) * i.quantity, 0);
    const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

    const handleSendOrder = async () => {
        if (!store || !waiterSession || !comanda || cart.length === 0) return;
        setIsSending(true);

        try {
            const orderId = crypto.randomUUID();

            // 1. Create Order
            const { error: orderError } = await supabase.from("orders").insert({
                id: orderId,
                store_id: store.id,
                origin: "waiter",
                comanda_id: comanda.id,
                table_id: comanda.table_id,
                waiter_id: waiterSession.waiter_id,
                subtotal: subtotal,
                total: subtotal,
                status: "pending",
                payment_method: "comanda",
                delivery_type: "table",
                customer_name: "Mesa " + comanda.table_id, // placeholder
                customer_phone: "00000000000"
            });

            if (orderError) throw orderError;

            // 2. Create Order Items
            const { error: itemsError } = await supabase.from("order_items").insert(
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

            if (itemsError) throw itemsError;

            toast.success("Pedido enviado para a cozinha!");
            setCart([]);
            setCartOpen(false);

            // Navigate back to comanda details
            navigate(explicitSlug ? `/garcom/comanda/${comanda.id}` : `/loja/${store.slug}/garcom/comanda/${comanda.id}`);

        } catch (err) {
            console.error(err);
            toast.error("Erro ao enviar pedido");
        } finally {
            setIsSending(false);
        }
    };

    // Filter products
    const filteredProducts = products.filter((p) => {
        const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
        const matchCat = !activeCategory || p.category_id === activeCategory;
        return matchSearch && matchCat;
    });

    const productsByCategory = categories.map((cat) => ({
        ...cat,
        products: filteredProducts.filter((p) => p.category_id === cat.id),
    }));

    if (storeLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/30">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/30 pb-32">
            <header className="bg-card border-b border-border sticky top-0 z-10 shadow-sm px-4 h-16 flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-1">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="font-bold text-foreground leading-tight">Adicionar ao Pedido</h1>
                    <p className="text-xs text-muted-foreground leading-tight">Comanda #{comanda?.id.split('-')[0].toUpperCase()}</p>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-4 md:p-6 mt-2">
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar produtos..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
                    />
                </div>

                {/* Categories */}
                <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                    <button
                        onClick={() => setActiveCategory(null)}
                        className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${!activeCategory ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}
                        style={!activeCategory ? { backgroundColor: store?.primary_color } : {}}
                    >
                        Todos
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}
                            style={activeCategory === cat.id ? { backgroundColor: store?.primary_color } : {}}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>

                {/* Product List */}
                <div className="space-y-6 mt-4">
                    {productsByCategory.map((cat) =>
                        cat.products.length > 0 ? (
                            <div key={cat.id}>
                                <h2 className="text-lg font-black text-foreground mb-3">{cat.name}</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {cat.products.map((p: any) => {
                                        const price = p.promotional_price > 0 ? p.promotional_price : p.price;
                                        return (
                                            <div key={p.id} className="bg-card rounded-xl border border-border p-3 flex gap-3 shadow-sm" onClick={() => handleAddToCart(p)}>
                                                {p.image_url && (
                                                    <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                                                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0 py-1 flex flex-col justify-between">
                                                    <div>
                                                        <h3 className="font-bold text-foreground text-sm line-clamp-2">{p.name}</h3>
                                                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.description}</p>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-2">
                                                        <span className="font-bold text-primary">{formatCurrency(price)}</span>
                                                        <Button size="sm" variant="ghost" className="h-7 px-2 text-primary bg-primary/10 hover:bg-primary/20">
                                                            <Plus className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null
                    )}
                </div>
            </main>

            {/* Floating Cart Button */}
            {cart.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
                    <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-muted-foreground">{totalItems} {totalItems === 1 ? 'item' : 'itens'}</span>
                            <span className="text-xl font-black">{formatCurrency(subtotal)}</span>
                        </div>

                        <Dialog open={cartOpen} onOpenChange={setCartOpen}>
                            <Button variant="hero" className="text-base h-12 px-6 shadow-md flex-1 max-w-[200px]" style={{ backgroundColor: store?.primary_color }} onClick={() => setCartOpen(true)}>
                                Ver Pedido
                                <ArrowLeft className="w-5 h-5 ml-2 rotate-180" />
                            </Button>

                            <DialogContent className="sm:max-w-md w-full h-[90vh] sm:h-auto flex flex-col p-0 gap-0 overflow-hidden">
                                <DialogHeader className="p-4 border-b">
                                    <DialogTitle>Itens do Pedido</DialogTitle>
                                </DialogHeader>

                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {cart.map((item) => (
                                        <div key={item.id} className="flex gap-3 bg-muted/40 p-3 rounded-xl border border-border/50">
                                            <div className="flex-1">
                                                <p className="font-bold text-sm">{item.product.name}</p>
                                                {item.variations.length > 0 && (
                                                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                                        {item.variations.map((v, i) => (
                                                            <div key={i}>{v.group}: {v.selected.map(s => s.name).join(', ')}</div>
                                                        ))}
                                                    </div>
                                                )}
                                                {item.notes && <p className="text-xs italic text-orange-600 mt-1">Obs: {item.notes}</p>}
                                                <p className="font-bold text-primary text-sm mt-2">{formatCurrency(getItemPrice(item) * item.quantity)}</p>
                                            </div>

                                            <div className="flex flex-col items-end justify-between">
                                                <button onClick={() => removeFromCart(item.id)} className="p-1 text-muted-foreground hover:text-destructive">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>

                                                <div className="flex items-center gap-2 bg-background border rounded-lg p-1">
                                                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-muted rounded"><Minus className="w-3 h-3" /></button>
                                                    <span className="font-bold text-sm min-w-[1.2rem] text-center">{item.quantity}</span>
                                                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-muted rounded"><Plus className="w-3 h-3" /></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-4 border-t bg-card">
                                    <div className="flex justify-between font-black text-xl mb-4">
                                        <span>Total</span>
                                        <span className="text-primary">{formatCurrency(subtotal)}</span>
                                    </div>
                                    <Button
                                        className="w-full text-lg h-14 space-x-2"
                                        variant="hero"
                                        onClick={handleSendOrder}
                                        disabled={isSending}
                                        style={{ backgroundColor: store?.primary_color }}
                                    >
                                        {isSending ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                            <>
                                                <Send className="w-5 h-5" />
                                                <span>Enviar para a Cozinha</span>
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            )}

            {/* Variation Modal */}
            {variationModalOpen && variationProduct && (
                <Dialog open={variationModalOpen} onOpenChange={setVariationModalOpen}>
                    <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-4 md:p-6">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-black">{variationProduct.name}</DialogTitle>
                            <p className="text-primary font-bold">R$ {(variationProduct.promotional_price > 0 ? variationProduct.promotional_price : variationProduct.price).toFixed(2)}</p>
                        </DialogHeader>

                        <div className="space-y-6 mt-4">
                            {(productVariations[variationProduct.id] || []).map((v: any) => (
                                <div key={v.id} className="space-y-3">
                                    <div className="flex justify-between items-center bg-muted/50 p-2 rounded-lg">
                                        <p className="font-bold text-sm tracking-wide">{v.name}</p>
                                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-background border">
                                            {v.required ? "Obrigatório" : "Opcional"} • {v.max_selections === 1 ? "1 opção" : `Até ${v.max_selections}`}
                                        </span>
                                    </div>

                                    <div className="space-y-2">
                                        {v.options.map((opt: any, idx: number) => {
                                            const isSelected = (variationSelections[v.id] || []).some(s => s.name === opt.name);
                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => toggleVariationOption(v.id, opt, v.max_selections)}
                                                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm transition-all ${isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card"
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 ${isSelected ? "border-primary bg-primary text-white" : "border-muted"}`}>
                                                            {isSelected && <Check className="w-3.5 h-3.5" />}
                                                        </div>
                                                        <span className={isSelected ? "font-bold text-foreground" : "font-medium text-foreground"}>{opt.name}</span>
                                                    </div>
                                                    {opt.price > 0 && <span className="font-bold text-primary">+R$ {opt.price.toFixed(2)}</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            <div className="space-y-2 pt-2">
                                <label className="text-sm font-bold text-foreground">Observações</label>
                                <textarea
                                    className="w-full min-h-[80px] p-3 rounded-xl border border-border bg-background resize-none text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                                    placeholder="Ex: Tirar cebola, ponto da carne..."
                                    value={itemNotes}
                                    onChange={e => setItemNotes(e.target.value)}
                                />
                            </div>

                            <Button
                                className="w-full h-14 text-base font-bold shadow-md rounded-xl"
                                onClick={confirmVariationSelection}
                                variant="hero"
                                style={{ backgroundColor: store?.primary_color }}
                            >
                                Adicionar ao Pedido
                                <span className="ml-auto font-black px-3 py-1 bg-black/10 rounded-lg">
                                    R$ {(
                                        (variationProduct.promotional_price > 0 ? variationProduct.promotional_price : variationProduct.price) +
                                        Object.values(variationSelections).flat().reduce((sum, s) => sum + s.price, 0)
                                    ).toFixed(2)}
                                </span>
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
};

export default WaiterCatalog;
