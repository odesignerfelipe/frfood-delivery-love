import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import { supabase } from "@/integrations/supabase/client";

const CreateStore = () => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const { createStore } = useStore();
  const { settings } = useGlobalSettings();
  const navigate = useNavigate();

  // Verify payment before allowing store creation
  useEffect(() => {
    const verifyPayment = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if already has a store
      const { data: existingStore } = await supabase
        .from("stores")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (existingStore) {
        navigate("/dashboard");
        return;
      }

      // Check if user has a paid PIX payment
      const { data: pixPayment } = await supabase
        .from("pix_payments")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("status", "paid")
        .maybeSingle();

      // Check URL for Stripe success
      const urlParams = new URLSearchParams(window.location.search);
      const paymentSuccess = urlParams.get("payment") === "success";

      if (!pixPayment && !paymentSuccess) {
        toast.error("Você precisa realizar o pagamento antes de criar sua loja.");
        navigate("/checkout");
        return;
      }

      setChecking(false);
    };

    verifyPayment();
  }, [navigate]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const slug = generateSlug(name) + "-" + Date.now().toString(36);
    const { error } = await createStore(name, slug, phone);
    if (error) {
      toast.error("Erro ao criar loja: " + (typeof error === 'string' ? error : error?.message));
    } else {
      toast.success("Loja criada com sucesso!");
      navigate("/dashboard");
    }
    setSubmitting(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="h-16 flex items-center justify-center mx-auto mb-4">
            <img src={settings.logoUrl || "/logo-icon.png"} alt="FRFood" className="h-full w-auto object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Criar sua loja</h1>
          <p className="text-muted-foreground mt-2">
            Configure as informações básicas do seu delivery
          </p>
        </div>

        <div className="bg-card rounded-2xl p-8 shadow-card border border-border/50">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome da loja</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Pizzaria do João"
                required
                maxLength={100}
              />
            </div>

            <div>
              <Label htmlFor="phone">WhatsApp (com DDD)</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: 11999999999"
                required
                maxLength={20}
              />
            </div>

            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? "Criando..." : "Criar minha loja"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateStore;
