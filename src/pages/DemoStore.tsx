import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Plus, Minus, Trash2, X, Search, Clock, MapPin, Phone, ArrowRight, Check } from "lucide-react";

const demoStore = {
  name: "Pizzaria do João",
  description: "As melhores pizzas artesanais da cidade! 🍕",
  logo_url: "",
  banner_url: "",
  is_open: true,
  phone: "11999999999",
  address: "Rua das Pizzas, 123",
  city: "São Paulo",
  avg_delivery_time: 40,
  avg_prep_time: 25,
  primary_color: "#ea580c",
};

const demoCategories = [
  { id: "1", name: "🍕 Pizzas Tradicionais" },
  { id: "2", name: "🍕 Pizzas Especiais" },
  { id: "3", name: "🥤 Bebidas" },
  { id: "4", name: "🍰 Sobremesas" },
];

const demoProducts = [
  { id: "1", name: "Pizza Margherita", description: "Molho de tomate, mussarela, manjericão fresco e azeite", price: 39.90, promotional_price: 34.90, category_id: "1", image_url: "" },
  { id: "2", name: "Pizza Calabresa", description: "Calabresa artesanal, cebola roxa e azeitonas", price: 42.90, promotional_price: 0, category_id: "1", image_url: "" },
  { id: "3", name: "Pizza 4 Queijos", description: "Mussarela, parmesão, gorgonzola e provolone", price: 49.90, promotional_price: 0, category_id: "2", image_url: "" },
  { id: "4", name: "Pizza Portuguesa", description: "Presunto, ovos, cebola, ervilha e azeitonas", price: 44.90, promotional_price: 39.90, category_id: "1", image_url: "" },
  { id: "5", name: "Coca-Cola 2L", description: "Refrigerante Coca-Cola 2 litros", price: 12.90, promotional_price: 0, category_id: "3", image_url: "" },
  { id: "6", name: "Suco Natural Laranja", description: "Suco de laranja natural 500ml", price: 9.90, promotional_price: 0, category_id: "3", image_url: "" },
  { id: "7", name: "Petit Gateau", description: "Bolo de chocolate com sorvete de baunilha", price: 19.90, promotional_price: 15.90, category_id: "4", image_url: "" },
];

interface DemoCartItem {
  product: typeof demoProducts[0];
  quantity: number;
  notes: string;
}

const DemoStore = () => {
  const [cart, setCart] = useState<DemoCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [stickySearchOpen, setStickySearchOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowStickyHeader(window.scrollY > 280);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const addToCart = (product: typeof demoProducts[0]) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1, notes: "" }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => prev.map((i) => i.product.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter((i) => i.quantity > 0));
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== id));
  };

  const subtotal = cart.reduce((s, i) => s + (i.product.promotional_price > 0 ? i.product.promotional_price : i.product.price) * i.quantity, 0);
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  const filteredProducts = demoProducts.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = !activeCategory || p.category_id === activeCategory;
    return matchSearch && matchCat;
  });

  const productsByCategory = demoCategories.map((cat) => ({
    ...cat,
    products: filteredProducts.filter((p) => p.category_id === cat.id),
  }));

  return (
    <div className="min-h-screen bg-muted/50 pb-24">

      {/* Sticky Compact Header */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-b border-border shadow-sm transition-all duration-300 ${showStickyHeader ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"}`}
      >
        <div className="max-w-3xl mx-auto px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-extrabold text-[10px]">🍕</span>
            </div>
            <span className="font-bold text-foreground text-xs truncate max-w-[80px] flex-shrink-0">{demoStore.name}</span>
            <div className="w-px h-5 bg-border flex-shrink-0" />
            <div className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-hide items-center">
              <button
                onClick={() => setActiveCategory(null)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors flex-shrink-0 ${!activeCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                Todos
              </button>
              {demoCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors flex-shrink-0 ${activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStickySearchOpen(!stickySearchOpen)}
              className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 hover:bg-muted/80 transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
          {stickySearchOpen && (
            <div className="mt-2 pb-0.5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus
                  className="w-full h-8 pl-10 pr-4 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Banner - identical to PublicStore */}
      <div className="relative">
        <div className="w-full h-48 md:h-[250px] gradient-hero" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="max-w-3xl mx-auto flex items-end gap-4">
            <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center border-2 border-background shadow-lg">
              <span className="text-2xl">🍕</span>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-extrabold text-background">{demoStore.name}</h1>
              <p className="text-background/80 text-sm">{demoStore.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info bar - identical to PublicStore */}
      <div className="max-w-3xl mx-auto px-4 mt-4">
        <div className="flex flex-wrap items-center gap-3 py-4 text-sm bg-card rounded-2xl shadow-sm border border-border px-5">
          <div className="flex items-center gap-2 font-medium px-3 py-1.5 rounded-full bg-green-100 text-green-700">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Aberto
          </div>
          <div className="flex items-center gap-2 text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full font-medium">
            <Clock className="w-4 h-4" /> Tempo médio para entrega: {demoStore.avg_delivery_time} min
          </div>
          <div className="flex items-center gap-2 text-muted-foreground w-full sm:w-auto mt-2 sm:mt-0">
            <MapPin className="w-4 h-4" /> {demoStore.address}, {demoStore.city}
          </div>
          <a href="#" onClick={(e) => e.preventDefault()} className="ml-auto flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full font-bold hover:bg-primary/20 transition-colors">
            <Phone className="w-4 h-4" /> WhatsApp
          </a>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text" placeholder="Buscar no cardápio..." value={search} onChange={(e) => setSearch(e.target.value)}
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

        {/* Products - identical card structure to PublicStore */}
        {productsByCategory.map((cat) =>
          cat.products.length > 0 ? (
            <div key={cat.id} className="mb-8">
              <h2 className="text-lg font-bold text-foreground mb-3 border-b border-border pb-2">{cat.name}</h2>
              <div className="space-y-3">
                {cat.products.map((p) => (
                  <DemoProductCard key={p.id} product={p} onAdd={() => addToCart(p)} />
                ))}
              </div>
            </div>
          ) : null
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

      {/* Cart Drawer - identical to PublicStore */}
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
                      <p className="text-sm text-primary font-medium">R$ {((item.product.promotional_price > 0 ? item.product.promotional_price : item.product.price) * item.quantity).toFixed(2)}</p>
                    </div>
                    <button onClick={() => removeFromCart(item.product.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
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
              <div className="text-sm space-y-1">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>R$ {subtotal.toFixed(2)}</span></div>
              </div>
              <p className="text-center text-xs text-muted-foreground bg-primary/5 rounded-lg py-2">
                ✨ Esta é uma demonstração. Crie sua loja para começar a vender!
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="lg" className="flex-1 px-0 truncate" onClick={() => setCartOpen(false)}>
                  Continuar compras
                </Button>
                <Button variant="hero" size="lg" className="flex-1 px-0 truncate group" asChild>
                  <Link to="/auth">
                    Criar minha loja <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer - identical to PublicStore */}
      <div className="max-w-3xl mx-auto px-4 mt-12 pb-8 text-center border-t border-border pt-8">
        <a href="https://frfood.com.br" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
          &copy; Desenvolvido por FRFood
        </a>
      </div>
    </div>
  );
};

// Product card identical to PublicStore's ProductCard
const DemoProductCard = ({ product, onAdd }: { product: typeof demoProducts[0]; onAdd: () => void }) => (
  <div className="bg-card rounded-xl border border-border/50 shadow-card overflow-hidden flex">
    <div className="flex-1 p-4 flex flex-col justify-between">
      <div>
        <h3 className="font-bold text-foreground">{product.name}</h3>
        {product.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{product.description}</p>}
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex flex-col">
          {product.promotional_price > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground line-through text-xs font-medium">R$ {product.price.toFixed(2)}</span>
              <span className="text-primary font-bold text-lg">R$ {product.promotional_price.toFixed(2)}</span>
            </div>
          ) : (
            <span className="text-primary font-bold text-lg">R$ {product.price.toFixed(2)}</span>
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

export default DemoStore;
