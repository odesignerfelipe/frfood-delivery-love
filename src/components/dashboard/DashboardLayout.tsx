import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/hooks/useStore";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  LayoutDashboard,
  Store,
  FolderOpen,
  Package,
  ShoppingBag,
  Tag,
  MapPin,
  BarChart3,
  LogOut,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

const links = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Painel", end: true },
  { to: "/dashboard/store", icon: Store, label: "Minha Loja" },
  { to: "/dashboard/categories", icon: FolderOpen, label: "Categorias" },
  { to: "/dashboard/products", icon: Package, label: "Produtos" },
  { to: "/dashboard/orders", icon: ShoppingBag, label: "Pedidos" },
  { to: "/dashboard/coupons", icon: Tag, label: "Cupons" },
  { to: "/dashboard/delivery-zones", icon: MapPin, label: "Taxas de Entrega" },
  { to: "/dashboard/reports", icon: BarChart3, label: "Relatórios" },
];

const DashboardLayout = () => {
  const { user, loading: authLoading } = useRequireAuth();
  const { store, loading: storeLoading } = useStore();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !storeLoading && user && !store) {
      navigate("/create-store");
    }
  }, [authLoading, storeLoading, user, store, navigate]);

  if (authLoading || storeLoading) {
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!store) return null;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-muted/50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-card border-r border-border z-50 flex flex-col transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center">
                <span className="text-primary-foreground font-extrabold text-xs">FR</span>
              </div>
              <div>
                <p className="text-sm font-bold text-foreground truncate max-w-[140px]">{store.name}</p>
                <p className="text-xs text-muted-foreground">{store.is_open ? "🟢 Aberto" : "🔴 Fechado"}</p>
              </div>
            </div>
            <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`
              }
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border space-y-2">
          <a
            href={`/loja/${store.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Ver minha loja
          </a>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-lg border-b border-border px-4 h-14 flex items-center gap-4 lg:px-6">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">FRFood</h1>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
