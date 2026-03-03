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

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if ((data as any)?.role === 'admin') {
        setIsAdmin(true);
      }
    };
    checkAdmin();
  }, [user]);

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center justify-center h-8">
          <img src={settings.logoUrl || "/logo-icon.png"} alt="FRFood" className="h-full w-auto object-contain" />
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
            <Link to={user ? "/dashboard" : "/auth"}>
              {user ? "Dashboard" : "Entrar"}
            </Link>
          </Button>
          {!user && (
            <Button variant="hero" size="sm" asChild><Link to="/auth">Criar conta</Link></Button>
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
            <Link to={user ? "/dashboard" : "/auth"} onClick={() => setOpen(false)}>
              {user ? "Ir para Dashboard" : "Criar conta"}
            </Link>
          </Button>
        </div>
      )}
    </header>
  );
};

export default Navbar;
