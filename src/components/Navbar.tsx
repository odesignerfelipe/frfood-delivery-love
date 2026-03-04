import { Button } from "@/components/ui/button";
import { Menu, X, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { settings } = useGlobalSettings();
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasActiveStore, setHasActiveStore] = useState(false);

  useEffect(() => {
    const checkUserStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setHasActiveStore(false);
        return;
      }

      // Check admin role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if ((profile as any)?.role === 'admin') {
        setIsAdmin(true);
      }

      // Check if user has a store (any store, paid or not)
      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      setHasActiveStore(!!store);
    };
    checkUserStatus();
  }, [user]);

  // Decide where the main CTA button goes
  const getMainButtonLink = () => {
    if (!user) return "/auth";
    if (hasActiveStore) return "/dashboard";
    return "/checkout";
  };

  const getMainButtonLabel = () => {
    if (!user) return "Entrar";
    if (hasActiveStore) return "Dashboard";
    return "Finalizar assinatura";
  };

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center justify-center h-8">
          <img src={settings.logoUrl || "/logo-icon.png"} alt={settings.siteName || "FRFood"} className="h-full w-auto object-contain" />
        </a>

        <nav className="hidden md:flex items-center gap-8">
          <a href="#funcionalidades" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Funcionalidades</a>
          <a href="#precos" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Preços</a>
          <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
          {isAdmin && (
            <Link to="/admin" className="text-sm font-bold text-primary flex items-center gap-1">
              <Shield className="w-4 h-4" />
              Painel Admin
            </Link>
          )}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to={getMainButtonLink()}>
              {getMainButtonLabel()}
            </Link>
          </Button>
          {!user && (
            <Button variant="hero" size="sm" asChild>
              <Link to="/auth">{settings.navbarButtonText || "Criar conta"}</Link>
            </Button>
          )}
        </div>

        <button className="md:hidden p-2" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-background border-b border-border px-4 pb-4 space-y-3">
          <a href="#funcionalidades" className="block text-sm font-medium text-muted-foreground py-2" onClick={() => setOpen(false)}>Funcionalidades</a>
          <a href="#precos" className="block text-sm font-medium text-muted-foreground py-2" onClick={() => setOpen(false)}>Preços</a>
          <a href="#faq" className="block text-sm font-medium text-muted-foreground py-2" onClick={() => setOpen(false)}>FAQ</a>
          {isAdmin && (
            <Link to="/admin" className="block text-sm font-bold text-primary py-2" onClick={() => setOpen(false)}>
              Painel Admin
            </Link>
          )}
          <Button variant="hero" size="sm" className="w-full" asChild>
            <Link to={getMainButtonLink()} onClick={() => setOpen(false)}>
              {user ? (hasActiveStore ? "Ir para Dashboard" : "Finalizar assinatura") : (settings.navbarButtonText || "Criar conta")}
            </Link>
          </Button>
        </div>
      )}
    </header>
  );
};

export default Navbar;
