import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Plus, Minus, Trash2, X, Search, Star, Clock, MapPin, ArrowRight } from "lucide-react";

const demoStore = {
  name: "Pizzaria do João",
  description: "As melhores pizzas artesanais da cidade! 🍕",
  banner_url: "",
  is_open: true,
  phone: "11999999999",
  avg_delivery_time: 40,
  avg_prep_time: 25,
};

const demoCategories = [
  { id: "1", name: "🍕 Pizzas Tradicionais" },
  { id: "2", name: "🍕 Pizzas Especiais" },
  { id: "3", name: "🥤 Bebidas" },
  { id: "4", name: "🍰 Sobremesas" },
];

const demoProducts = [
  { id: "1", name: "Pizza Margherita", description: "Molho de tomate, mussarela, manjericão fresco e azeite", price: 39.90, promo_price: 34.90, category_id: "1", image_url: "" },
  { id: "2", name: "Pizza Calabresa", description: "Calabresa artesanal, cebola roxa e azeitonas", price: 42.90, promo_price: null, category_id: "1", image_url: "" },
  { id: "3", name: "Pizza 4 Queijos", description: "Mussarela, parmesão, gorgonzola e provolone", price: 49.90, promo_price: null, category_id: "2", image_url: "" },
  { id: "4", name: "Pizza Portuguesa", description: "Presunto, ovos, cebola, ervilha e azeitonas", price: 44.90, promo_price: 39.90, category_id: "1", image_url: "" },
  { id: "5", name: "Coca-Cola 2L", description: "Refrigerante Coca-Cola 2 litros", price: 12.90, promo_price: null, category_id: "3", image_url: "" },
  { id: "6", name: "Suco Natural Laranja", description: "Suco de laranja natural 500ml", price: 9.90, promo_price: null, category_id: "3", image_url: "" },
  { id: "7", name: "Petit Gateau", description: "Bolo de chocolate com sorvete de baunilha", price: 19.90, promo_price: 15.90, category_id: "4", image_url: "" },
];

interface DemoCartItem {
  product: typeof demoProducts[0];
  quantity: number;
}

const DemoStore = () => {
  const [cart, setCart] = useState<DemoCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const addToCart = (product: typeof demoProducts[0]) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => prev.map((i) => i.product.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter((i) => i.quantity > 0));
  };

  const subtotal = cart.reduce((s, i) => s + (i.product.promo_price || i.product.price) * i.quantity, 0);
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  const filteredProducts = demoProducts.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !activeCategory || p.category_id === activeCategory;
    return matchSearch && matchCat;
  });

  const productsByCategory = demoCategories.map((cat) => ({
    ...cat,
    products: filteredProducts.filter((p) => p.category_id === cat.id),
  })).filter((cat) => cat.products.length > 0);

  return (
    <div className="min-h-screen bg-muted/50 pb-32">
      {/* Banner */}
      <div className="gradient-hero py-10 px-4 text-center relative">
        <div className="absolute top-4 left-4">
          <Link to="/" className="text-primary-foreground/80 hover:text-primary-foreground text-sm font-medium">← Voltar</Link>
        </div>
        <div className="w-16 h-16 rounded-full bg-primary-foreground/20 flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">🍕</span>
        </div>
        <h1 className="text-3xl font-extrabold text-primary-foreground">{demoStore.name}</h1>
        <p className="text-primary-foreground/80 mt-1">{demoStore.description}</p>
        <div className="flex items-center justify-center gap-4 mt-3 text-sm text-primary-foreground/70">
          <span className="flex items-center gap-1"><Star className="w-4 h-4 fill-current" /> 4.8</span>
          <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {demoStore.avg_delivery_time} min</span>
          <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> 5km</span>
        </div>
        <p className="text-primary-foreground/90 text-xs mt-2 font-medium bg-primary-foreground/10 inline-block px-3 py-1 rounded-full">🟢 Aberto agora</p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
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
          {demoCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Promos highlight */}
        {!search && !activeCategory && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">🔥 Promoções</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {demoProducts.filter((p) => p.promo_price).map((p) => (
                <div key={p.id} className="bg-card rounded-xl border border-primary/20 shadow-card overflow-hidden flex">
                  <div className="w-20 h-20 bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🍕</span>
                  </div>
                  <div className="flex-1 p-3 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-foreground text-sm">{p.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground line-through">R$ {p.price.toFixed(2)}</span>
                        <span className="text-primary font-bold text-sm">R$ {p.promo_price!.toFixed(2)}</span>
                      </div>
                    </div>
                    <button onClick={() => addToCart(p)} className="self-end w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Products by category */}
        {productsByCategory.map((cat) => (
          <div key={cat.id} className="mb-8">
            <h2 className="text-lg font-bold text-foreground mb-3 border-b border-border pb-2">{cat.name}</h2>
            <div className="space-y-3">
              {cat.products.map((p) => (
                <div key={p.id} className="bg-card rounded-xl border border-border/50 shadow-card overflow-hidden flex">
                  <div className="w-24 h-24 bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-3xl">{p.category_id === "3" ? "🥤" : p.category_id === "4" ? "🍰" : "🍕"}</span>
                  </div>
                  <div className="flex-1 p-3 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-foreground text-sm">{p.name}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        {p.promo_price ? (
                          <>
                            <span className="text-xs text-muted-foreground line-through">R$ {p.price.toFixed(2)}</span>
                            <span className="text-primary font-bold text-sm">R$ {p.promo_price.toFixed(2)}</span>
                          </>
                        ) : (
                          <span className="text-primary font-bold text-sm">R$ {p.price.toFixed(2)}</span>
                        )}
                      </div>
                      <button onClick={() => addToCart(p)} className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Cart FAB */}
      {totalItems > 0 && (
        <div className="fixed bottom-16 left-4 right-4 max-w-3xl mx-auto z-40">
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

      {/* CTA Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border p-3">
        <Button variant="hero" size="lg" className="w-full max-w-3xl mx-auto flex group" asChild>
          <Link to="/auth">
            Criar minha loja agora
            <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
          </Link>
        </Button>
      </div>

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => setCartOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-card shadow-2xl flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Seu Carrinho (Demo)</h2>
              <button onClick={() => setCartOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((item) => (
                <div key={item.product.id} className="bg-muted/50 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{item.product.name}</p>
                      <p className="text-sm text-primary font-medium">R$ {((item.product.promo_price || item.product.price) * item.quantity).toFixed(2)}</p>
                    </div>
                    <button onClick={() => setCart((prev) => prev.filter((i) => i.product.id !== item.product.id))}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <button onClick={() => updateQty(item.product.id, -1)} className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                    <span className="font-bold text-foreground">{item.quantity}</span>
                    <button onClick={() => updateQty(item.product.id, 1)} className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-border space-y-3">
              <div className="flex justify-between font-bold text-foreground">
                <span>Subtotal</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              <p className="text-center text-sm text-muted-foreground">Esta é uma demonstração. Crie sua loja para vender de verdade!</p>
              <Button variant="hero" size="lg" className="w-full group" asChild>
                <Link to="/auth">Criar minha loja agora <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" /></Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DemoStore;
