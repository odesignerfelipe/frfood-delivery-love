import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CreditCard, Check, ArrowLeft, Shield, Lock, Star, QrCode, Copy, CheckCircle2, Clock } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const Checkout = () => {
    const navigate = useNavigate();
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");
    const [paymentMethod, setPaymentMethod] = useState<"card" | "pix">("card");

    // PIX state
    const [pixData, setPixData] = useState<{
        payment_id: string;
        qr_code: string;
        qr_code_base64: string;
        amount: number;
        expires_at: string;
    } | null>(null);
    const [pixStatus, setPixStatus] = useState<"idle" | "loading" | "waiting" | "paid">("idle");
    const [copied, setCopied] = useState(false);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) { navigate("/auth"); return; }
            setSession(session);
            setLoading(false);
        });
    }, [navigate]);

    // Check if user already has an active store
    useEffect(() => {
        if (!session) return;
        supabase.from("stores").select("id, plan_status").eq("owner_id", session.user.id).maybeSingle().then(({ data }) => {
            if (data && data.plan_status === 'active') {
                navigate("/dashboard");
            }
        });
    }, [session, navigate]);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    // Poll PIX status
    const startPolling = useCallback((paymentId: string) => {
        if (pollingRef.current) clearInterval(pollingRef.current);

        pollingRef.current = setInterval(async () => {
            try {
                const res = await fetch(`${SUPABASE_URL}/functions/v1/pix-status`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${session?.access_token}`,
                    },
                    body: JSON.stringify({ payment_id: paymentId }),
                });
                const data = await res.json();

                if (data.status === "paid") {
                    setPixStatus("paid");
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    toast.success("Pagamento PIX confirmado!");
                    setTimeout(() => navigate("/create-store?payment=success"), 2000);
                } else if (data.status === "cancelled" || data.status === "expired") {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    setPixStatus("idle");
                    setPixData(null);
                    toast.error("Pagamento PIX expirou ou foi cancelado.");
                }
            } catch (err) {
                console.error("Polling error:", err);
            }
        }, 5000); // Check every 5 seconds
    }, [session, navigate]);

    const handleStripeCheckout = async () => {
        if (!session) return;
        setSubmitting(true);

        try {
            const { data: storeData } = await supabase.from("stores").select("id").eq("owner_id", session.user.id).maybeSingle();

            const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-checkout`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    store_id: storeData?.id || null,
                    user_id: session.user.id,
                    plan: plan
                }),
            });

            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || `Erro ao gerar link de pagamento (${res.status}).`);

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

    const handlePixCheckout = async () => {
        if (!session) return;
        setPixStatus("loading");

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

            const res = await fetch(`${SUPABASE_URL}/functions/v1/pix-create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ plan }),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || "Erro ao gerar PIX.");

            setPixData(data);
            setPixStatus("waiting");
            startPolling(data.payment_id);
        } catch (error: any) {
            toast.error(error.message || "Erro ao gerar PIX. Tente novamente.");
            setPixStatus("idle");
        }
    };

    const copyPixCode = () => {
        if (pixData?.qr_code) {
            navigator.clipboard.writeText(pixData.qr_code);
            setCopied(true);
            toast.success("Código PIX copiado!");
            setTimeout(() => setCopied(false), 3000);
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

                    {/* Right: Payment */}
                    <div className="lg:col-span-3">
                        <div className="bg-card rounded-2xl p-6 md:p-8 shadow-card border border-border/50">
                            {/* Payment method tabs */}
                            <div className="flex rounded-xl bg-muted/50 p-1 mb-6">
                                <button
                                    onClick={() => { setPaymentMethod("card"); setPixData(null); setPixStatus("idle"); }}
                                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${paymentMethod === "card" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    <CreditCard className="w-4 h-4" /> Cartão
                                </button>
                                <button
                                    onClick={() => setPaymentMethod("pix")}
                                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${paymentMethod === "pix" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    <QrCode className="w-4 h-4" /> PIX
                                </button>
                            </div>

                            {/* === CARD TAB === */}
                            {paymentMethod === "card" && (
                                <div>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                            <CreditCard className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-foreground">Cartão de Crédito</h2>
                                            <p className="text-xs text-muted-foreground">Pagamento seguro via Stripe</p>
                                        </div>
                                    </div>

                                    <div className="bg-muted/30 p-4 rounded-xl text-sm text-muted-foreground border border-muted text-center mb-6">
                                        Ao clicar no botão abaixo, você será redirecionado em segurança para o ambiente do Stripe, onde poderá finalizar sua assinatura com Cartão de Crédito.
                                    </div>

                                    <Button onClick={handleStripeCheckout} variant="hero" size="lg" className="w-full h-14 text-base" disabled={submitting}>
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
                                </div>
                            )}

                            {/* === PIX TAB === */}
                            {paymentMethod === "pix" && (
                                <div>
                                    {pixStatus === "idle" && (
                                        <div>
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                                                    <QrCode className="w-5 h-5 text-green-600" />
                                                </div>
                                                <div>
                                                    <h2 className="font-bold text-foreground">Pagamento via PIX</h2>
                                                    <p className="text-xs text-muted-foreground">Pagamento instantâneo • Confirmação automática</p>
                                                </div>
                                            </div>

                                            <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-xl text-sm text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800 text-center mb-6">
                                                <p className="font-semibold mb-1">💰 {plan === "monthly" ? "R$ 149,90" : "R$ 1.498,80"}</p>
                                                <p className="text-xs opacity-80">Um QR code será gerado para você pagar pelo app do seu banco. A confirmação é automática!</p>
                                            </div>

                                            <Button onClick={handlePixCheckout} size="lg" className="w-full h-14 text-base bg-green-600 hover:bg-green-700 text-white">
                                                <QrCode className="w-4 h-4 mr-2" /> Gerar QR Code PIX
                                            </Button>
                                        </div>
                                    )}

                                    {pixStatus === "loading" && (
                                        <div className="flex flex-col items-center justify-center py-12">
                                            <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mb-4" />
                                            <p className="text-sm text-muted-foreground">Gerando QR Code PIX...</p>
                                        </div>
                                    )}

                                    {pixStatus === "waiting" && pixData && (
                                        <div className="space-y-6">
                                            <div className="text-center">
                                                <h2 className="font-bold text-foreground text-lg mb-1">Escaneie o QR Code</h2>
                                                <p className="text-xs text-muted-foreground">Abra seu app de banco e escaneie o código abaixo</p>
                                            </div>

                                            {/* QR Code */}
                                            <div className="flex justify-center">
                                                <div className="bg-white p-4 rounded-2xl shadow-lg border">
                                                    {pixData.qr_code_base64 ? (
                                                        <img
                                                            src={`data:image/png;base64,${pixData.qr_code_base64}`}
                                                            alt="QR Code PIX"
                                                            className="w-52 h-52"
                                                        />
                                                    ) : (
                                                        <div className="w-52 h-52 flex items-center justify-center text-muted-foreground text-sm">
                                                            QR Code indisponível
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Copia e Cola */}
                                            <div className="space-y-2">
                                                <p className="text-xs font-semibold text-foreground text-center">Ou copie o código PIX:</p>
                                                <div className="relative">
                                                    <div className="bg-muted/50 rounded-xl p-3 pr-12 text-xs font-mono text-muted-foreground break-all border max-h-20 overflow-y-auto">
                                                        {pixData.qr_code}
                                                    </div>
                                                    <button
                                                        onClick={copyPixCode}
                                                        className="absolute top-2 right-2 p-2 rounded-lg bg-card border shadow-sm hover:bg-muted transition-colors"
                                                        title="Copiar código"
                                                    >
                                                        {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Amount */}
                                            <div className="text-center">
                                                <p className="text-2xl font-extrabold text-foreground">
                                                    R$ {pixData.amount.toFixed(2).replace('.', ',')}
                                                </p>
                                            </div>

                                            {/* Waiting indicator */}
                                            <div className="flex items-center justify-center gap-2 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 rounded-xl p-3 border border-amber-200 dark:border-amber-800">
                                                <Clock className="w-4 h-4 animate-pulse" />
                                                <span className="text-sm font-medium">Aguardando pagamento...</span>
                                            </div>
                                        </div>
                                    )}

                                    {pixStatus === "paid" && (
                                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                                <CheckCircle2 className="w-8 h-8 text-green-600" />
                                            </div>
                                            <h2 className="text-xl font-bold text-foreground">Pagamento confirmado!</h2>
                                            <p className="text-sm text-muted-foreground">Redirecionando para criar sua loja...</p>
                                            <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-6">
                                <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Pagamento Seguro</span>
                                <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Dados criptografados</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Checkout;
