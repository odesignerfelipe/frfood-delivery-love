import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CreditCard, Check, ArrowLeft, Shield, Lock, Star } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const Checkout = () => {
    const navigate = useNavigate();
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) { navigate("/auth"); return; }
            setSession(session);
            setLoading(false);
        });
    }, [navigate]);

    // Check if user already has a store (already paid)
    useEffect(() => {
        if (!session) return;
        supabase.from("stores").select("id, plan_status").eq("owner_id", session.user.id).maybeSingle().then(({ data }) => {
            if (data && data.plan_status === 'active') {
                navigate("/dashboard");
            }
        });
    }, [session, navigate]);

    const handleStripeCheckout = async () => {
        if (!session) return;
        setSubmitting(true);

        try {
            // Find if user already has a store
            const { data: storeData } = await supabase.from("stores").select("id").eq("owner_id", session.user.id).maybeSingle();

            const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-checkout`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    store_id: storeData?.id || null, // Will be used if renewing, otherwise handled via owner link
                    user_id: session.user.id,
                    plan: plan
                }),
            });

            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || "Erro ao gerar link de pagamento.");

            if (data.url) {
                window.location.href = data.url;
            } else {
                toast.success("Assinatura validada!");
                navigate("/create-store");
            }
        } catch (error: any) {
            toast.error(error.message || "Erro ao redirecionar para o pagamento. Tente novamente.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-muted/50 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/50 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6">
                    <ArrowLeft className="w-4 h-4" /> Voltar ao início
                </Link>

                <div className="grid lg:grid-cols-5 gap-8">
                    {/* Left: Plan selection */}
                    <div className="lg:col-span-2 space-y-4">
                        <h1 className="text-2xl font-extrabold text-foreground mb-2">Escolha seu plano</h1>
                        <p className="text-muted-foreground text-sm mb-6">Todos os recursos inclusos. Comece a vender agora.</p>

                        {/* Monthly */}
                        <button
                            onClick={() => setPlan("monthly")}
                            className={`w-full p-5 rounded-2xl border-2 text-left transition-all ${plan === "monthly" ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card hover:border-primary/50"}`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-foreground">Mensal</span>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${plan === "monthly" ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                                    {plan === "monthly" && <Check className="w-3 h-3 text-primary-foreground" />}
                                </div>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-sm text-muted-foreground">R$</span>
                                <span className="text-3xl font-extrabold text-foreground">149</span>
                                <span className="text-lg font-bold text-foreground">,90</span>
                                <span className="text-sm text-muted-foreground">/mês</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Cancele quando quiser</p>
                        </button>

                        {/* Yearly */}
                        <button
                            onClick={() => setPlan("yearly")}
                            className={`w-full p-5 rounded-2xl border-2 text-left transition-all relative ${plan === "yearly" ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card hover:border-primary/50"}`}
                        >
                            <div className="absolute -top-3 right-4 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                                <Star className="w-3 h-3" /> Mais popular
                            </div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-foreground">Anual</span>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${plan === "yearly" ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                                    {plan === "yearly" && <Check className="w-3 h-3 text-primary-foreground" />}
                                </div>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-sm text-muted-foreground">12x de R$</span>
                                <span className="text-3xl font-extrabold text-foreground">124</span>
                                <span className="text-lg font-bold text-foreground">,90</span>
                                <span className="text-sm text-muted-foreground">/mês</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Total: R$ 1.498,80/ano · Economize R$ 300</p>
                        </button>

                        <div className="bg-card rounded-xl border border-border/50 p-4 mt-4">
                            <p className="text-xs font-semibold text-foreground mb-2">Todos os planos incluem:</p>
                            <ul className="space-y-1.5">
                                {["Catálogo online ilimitado", "Pedidos ilimitados", "Gestão completa de pedidos", "Integração com WhatsApp", "Relatórios detalhados", "Cupons de desconto", "Suporte pelo WhatsApp"].map((f) => (
                                    <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Check className="w-3 h-3 text-primary flex-shrink-0" /> {f}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Right: Payment form */}
                    <div className="lg:col-span-3">
                        <div className="bg-card rounded-2xl p-6 md:p-8 shadow-card border border-border/50">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <CreditCard className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-foreground">Dados de pagamento</h2>
                                    <p className="text-xs text-muted-foreground">Pagamento seguro via Stripe</p>
                                </div>
                            </div>

                            <form onSubmit={(e) => { e.preventDefault(); handleStripeCheckout(); }} className="space-y-4">
                                <div className="bg-muted/30 p-4 rounded-xl text-sm text-muted-foreground border border-muted text-center mb-6">
                                    Ao clicar no botão abaixo, você será redirecionado em segurança para o ambiente do Stripe, onde poderá finalizar sua assinatura com Cartão de Crédito.
                                </div>
                                <Button type="submit" variant="hero" size="lg" className="w-full mt-2 h-14 text-base" disabled={submitting}>
                                    {submitting ? (
                                        <span className="flex items-center gap-2">
                                            <div className="animate-spin w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full" /> Redirecionando...
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            <Lock className="w-4 h-4" /> Ir para Pagamento Seguro
                                        </span>
                                    )}
                                </Button>

                                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-4">
                                    <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Stripe Gateway</span>
                                    <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Dados criptografados</span>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Checkout;
