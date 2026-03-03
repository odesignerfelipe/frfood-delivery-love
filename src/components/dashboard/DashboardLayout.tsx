import { NavLink, Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/hooks/useStore";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
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
  Users,
  LogOut,
  Menu,
  X,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { checkStoreStatus } from "@/lib/utils";

const links = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Painel", end: true },
  { to: "/dashboard/store", icon: Store, label: "Minha Loja" },
  { to: "/dashboard/categories", icon: FolderOpen, label: "Categorias" },
  { to: "/dashboard/products", icon: Package, label: "Produtos" },
  { to: "/dashboard/orders", icon: ShoppingBag, label: "Pedidos" },
  { to: "/dashboard/coupons", icon: Tag, label: "Cupons" },
  { to: "/dashboard/delivery-zones", icon: MapPin, label: "Taxas de Entrega" },
  { to: "/dashboard/reports", icon: BarChart3, label: "Relatórios" },
  { to: "/dashboard/customers", icon: Users, label: "Clientes" },
];

const DashboardLayout = () => {
  const { user, loading: authLoading } = useRequireAuth();
  const [searchParams] = useSearchParams();
  const impersonateStoreId = searchParams.get("impersonate") || undefined;
  const { store, loading: storeLoading } = useStore(impersonateStoreId);
  const { settings } = useGlobalSettings();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = store?.plan_status === "active";
  const isOverdue = store?.plan_status === "overdue" || !isActive;

  useEffect(() => {
    if (!authLoading && !storeLoading) {
      if (user && !store) {
        navigate("/create-store");
      } else if (store && !isActive) {
        navigate("/checkout");
      }
    }
  }, [authLoading, storeLoading, user, store, isActive, navigate]);

  useOrderNotifications(store?.id, (store as any)?.audio_notifications !== false);

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
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-card border-r border-border z-50 flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 flex items-center justify-center">
                <img src={settings.logoUrl || "/logo-icon.png"} alt="FRFood" className="h-full w-auto object-contain" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground truncate max-w-[140px]">{store.name}</p>
                <p className="text-xs text-muted-foreground">{checkStoreStatus(store) ? "🟢 Aberto" : "🔴 Fechado"}</p>
              </div>
            </div>
            <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {links.map((link) => {
            const isDisabled = isOverdue && link.to !== "/dashboard";
            return (
              <NavLink
                key={link.to}
                to={isDisabled ? "#" : link.to}
                end={link.end}
                onClick={(e) => {
                  if (isDisabled) {
                    e.preventDefault();
                    toast.error("Pagamento pendente. Regularize sua assinatura para acessar este recurso.");
                    return;
                  }
                  setSidebarOpen(false);
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isDisabled
                    ? "opacity-50 cursor-not-allowed text-muted-foreground"
                    : isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`
                }
              >
                <link.icon className="w-4 h-4" />
                {link.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-2">
          <a
            href={`https://${store.slug}.frfood.com.br`}
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
          <div className="flex-1 flex items-center justify-between">
            <div className="h-6 flex items-center justify-center">
              <img src={settings.logoUrl || "/logo-icon.png"} alt="FRFood" className="h-full w-auto object-contain" />
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${checkStoreStatus(store) ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {checkStoreStatus(store) ? (
                  <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Aberta</>
                ) : (
                  <><span className="w-2 h-2 rounded-full bg-red-500" /> Fechada</>
                )}
              </div>
              {isOverdue && (
                <div className="hidden md:flex items-center gap-2 text-destructive font-bold animate-pulse text-sm">
                  <AlertCircle className="w-4 h-4" />
                  Pagamento Pendente
                </div>
              )}
            </div>
          </div>
        </header>

        {isOverdue && (
          <div className="px-4 py-3 lg:px-6">
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertTitle className="font-bold">Atenção: Pagamento Pendente</AlertTitle>
              <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
                <p>Sua assinatura está atrasada. Os recursos da sua loja foram suspensos até que o pagamento seja regularizado.</p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => navigate("/checkout")}
                  className="font-bold whitespace-nowrap"
                >
                  Regularizar Agora
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <main className={`flex-1 p-4 lg:p-6 ${isOverdue ? "pointer-events-none grayscale-[0.5] opacity-80" : ""}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
