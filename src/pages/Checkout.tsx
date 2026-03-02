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

    const [form, setForm] = useState({
        name: "",
        email: "",
        cpfCnpj: "",
        phone: "",
        cardNumber: "",
        cardName: "",
        cardExpiry: "",
        cardCvv: "",
        postalCode: "",
        addressNumber: "",
    });

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) { navigate("/auth"); return; }
            setSession(session);
            setForm(prev => ({ ...prev, email: session.user.email || "", name: session.user.user_metadata?.full_name || "" }));
            setLoading(false);
        });
    }, [navigate]);

    // Check if user already has a store (already paid)
    useEffect(() => {
        if (!session) return;
        supabase.from("stores").select("id").eq("user_id", session.user.id).maybeSingle().then(({ data }) => {
            if (data) navigate("/dashboard");
        });
    }, [session, navigate]);

    const formatCPF = (v: string) => {
        const n = v.replace(/\D/g, "").slice(0, 14);
        if (n.length <= 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4").replace(/[-.]$/, "");
        return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5").replace(/[-./]$/, "");
    };

    const formatCardNumber = (v: string) => {
        return v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})/g, "$1 ").trim();
    };

    const formatExpiry = (v: string) => {
        const n = v.replace(/\D/g, "").slice(0, 4);
        if (n.length > 2) return n.slice(0, 2) + "/" + n.slice(2);
        return n;
    };

    const formatPhone = (v: string) => {
        const n = v.replace(/\D/g, "").slice(0, 11);
        if (n.length > 6) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
        if (n.length > 2) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
        return n;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session) return;
        setSubmitting(true);

        try {
            // 1. Create client and subscription via management backend
            const [expiryMonth, expiryYear] = form.cardExpiry.split("/");
            const res = await fetch(`${SUPABASE_URL}/functions/v1/asaas-management`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    action: "create_subscription",
                    plan: plan,
                    billingType: "CREDIT_CARD",
                    customer: {
                        name: form.name,
                        email: form.email,
                        cpfCnpj: form.cpfCnpj.replace(/\D/g, ""),
                        phone: form.phone.replace(/\D/g, ""),
                    },
                    creditCard: {
                        holderName: form.cardName,
                        number: form.cardNumber.replace(/\s/g, ""),
                        expiryMonth: expiryMonth,
                        expiryYear: `20${expiryYear}`,
                        ccv: form.cardCvv,
                    },
                    creditCardHolderInfo: {
                        name: form.name,
                        email: form.email,
                        cpfCnpj: form.cpfCnpj.replace(/\D/g, ""),
                        postalCode: form.postalCode.replace(/\D/g, ""),
                        addressNumber: form.addressNumber,
                        phone: form.phone.replace(/\D/g, ""),
                    },
                }),
            });

            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || "Erro ao processar assinatura");

            toast.success("Assinatura criada com sucesso! 🎉");
            navigate("/dashboard");
        } catch (error: any) {
            toast.error(error.message || "Erro ao processar pagamento. Tente novamente.");
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
                                    <p className="text-xs text-muted-foreground">Pagamento seguro via cartão de crédito</p>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 sm:col-span-1">
                                        <Label htmlFor="name">Nome completo</Label>
                                        <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Seu nome" required />
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <Label htmlFor="email">Email</Label>
                                        <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="seu@email.com" required />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="cpf">CPF / CNPJ</Label>
                                        <Input id="cpf" value={form.cpfCnpj} onChange={(e) => setForm({ ...form, cpfCnpj: formatCPF(e.target.value) })} placeholder="000.000.000-00" required />
                                    </div>
                                    <div>
                                        <Label htmlFor="phone">Telefone</Label>
                                        <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} placeholder="(00) 00000-0000" required />
                                    </div>
                                </div>

                                <hr className="my-2 border-border" />

                                <div>
                                    <Label htmlFor="cardNumber">Número do cartão</Label>
                                    <Input id="cardNumber" value={form.cardNumber} onChange={(e) => setForm({ ...form, cardNumber: formatCardNumber(e.target.value) })} placeholder="0000 0000 0000 0000" required />
                                </div>

                                <div>
                                    <Label htmlFor="cardName">Nome no cartão</Label>
                                    <Input id="cardName" value={form.cardName} onChange={(e) => setForm({ ...form, cardName: e.target.value.toUpperCase() })} placeholder="NOME COMO NO CARTÃO" required />
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label htmlFor="expiry">Validade</Label>
                                        <Input id="expiry" value={form.cardExpiry} onChange={(e) => setForm({ ...form, cardExpiry: formatExpiry(e.target.value) })} placeholder="MM/AA" required />
                                    </div>
                                    <div>
                                        <Label htmlFor="cvv">CVV</Label>
                                        <Input id="cvv" value={form.cardCvv} onChange={(e) => setForm({ ...form, cardCvv: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="000" required />
                                    </div>
                                    <div>
                                        <Label htmlFor="addressNumber">Nº endereço</Label>
                                        <Input id="addressNumber" value={form.addressNumber} onChange={(e) => setForm({ ...form, addressNumber: e.target.value })} placeholder="123" required />
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="postalCode">CEP</Label>
                                    <Input id="postalCode" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value.replace(/\D/g, "").slice(0, 8) })} placeholder="00000000" required />
                                </div>

                                <Button type="submit" variant="hero" size="lg" className="w-full mt-2" disabled={submitting}>
                                    {submitting ? (
                                        <span className="flex items-center gap-2">
                                            <div className="animate-spin w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full" /> Processando...
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            <Lock className="w-4 h-4" /> Assinar por R$ {plan === "yearly" ? "124,90/mês" : "149,90/mês"}
                                        </span>
                                    )}
                                </Button>

                                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-2">
                                    <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Pagamento seguro</span>
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
