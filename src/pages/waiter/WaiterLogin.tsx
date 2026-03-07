import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStorePublic } from "@/hooks/useStorePublic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface WaiterLoginProps {
    explicitSlug?: string;
}

const WaiterLogin = ({ explicitSlug }: WaiterLoginProps) => {
    const { slug: paramSlug } = useParams();
    const activeSlug = explicitSlug || paramSlug;
    const { store, loading, error } = useStorePublic(activeSlug);
    const navigate = useNavigate();

    const [login, setLogin] = useState("");
    const [password, setPassword] = useState("");
    const [storeSlugInput, setStoreSlugInput] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Check if already logged in for this store
        const sessionStr = localStorage.getItem(`waiter_session_${store?.id}`);
        if (sessionStr && store) {
            try {
                const session = JSON.parse(sessionStr);
                if (session.waiter_id) {
                    if (explicitSlug) {
                        navigate("/garcom/mesas");
                    } else {
                        navigate(`/loja/${store.slug}/garcom/mesas`);
                    }
                }
            } catch (e) {
                // ignore
            }
        }
    }, [store, navigate, explicitSlug]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/30">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!activeSlug) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
                <div className="w-full max-w-sm bg-card rounded-2xl shadow-xl border border-border/50 p-6 sm:p-8">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-4 text-primary">
                            <ShieldCheck className="w-8 h-8" />
                        </div>
                        <h1 className="text-2xl font-bold text-foreground text-center line-clamp-1">Portal do Garçom</h1>
                        <p className="text-muted-foreground text-sm font-medium mt-1">Identifique o restaurante</p>
                    </div>

                    <form onSubmit={(e) => {
                        e.preventDefault();
                        if (storeSlugInput.trim()) {
                            navigate(`/loja/${storeSlugInput.trim()}/garcom`);
                        } else {
                            toast.error("Informe o código da loja");
                        }
                    }} className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="storeSlug">Código da Loja (Link)</Label>
                            <Input
                                id="storeSlug"
                                placeholder="Ex: minha-loja"
                                value={storeSlugInput}
                                onChange={(e) => setStoreSlugInput(e.target.value)}
                                className="bg-muted/50"
                            />
                        </div>

                        <Button
                            type="submit"
                            variant="hero"
                            className="w-full h-11 text-base shadow-md mt-4"
                        >
                            Continuar
                        </Button>
                    </form>
                </div>
            </div>
        );
    }

    if (error || !store) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 flex-col gap-4">
                <div className="text-center max-w-md">
                    <h2 className="text-2xl font-bold mb-2">Loja não encontrada</h2>
                    <p className="text-muted-foreground mb-4">O código "{activeSlug}" não corresponde a nenhuma loja ativa no momento.</p>
                    <Button onClick={() => navigate("/garcom")} variant="outline">Tentar outro código</Button>
                </div>
            </div>
        );
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!login.trim() || !password.trim()) {
            toast.error("Preencha login e senha");
            return;
        }

        setIsSubmitting(true);
        try {
            // Call our Postgres function
            const { data, error } = await supabase.rpc("authenticate_waiter", {
                p_login: login,
                p_password: password,
                p_store_id: store.id
            });

            if (error) throw error;

            // data should be { success: true, waiter_id: "...", name: "..." }
            // The rpc function returns jsonb, but supabase rpc parses it to JS object.
            // Wait, let's type check
            const result = data as any;

            if (result && result.success) {
                toast.success(`Bem-vindo, ${result.name}!`);
                localStorage.setItem(`waiter_session_${store.id}`, JSON.stringify({
                    waiter_id: result.waiter_id,
                    name: result.name,
                    store_id: store.id
                }));

                if (explicitSlug) {
                    navigate("/garcom/mesas");
                } else {
                    navigate(`/loja/${store.slug}/garcom/mesas`);
                }
            } else {
                toast.error("Login ou senha incorretos, ou usuário inativo.");
            }
        } catch (err: any) {
            console.error(err);
            toast.error("Erro ao autenticar. Tente novamente.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: store.primary_color ? `${store.primary_color}10` : '#f8fafc' }}>
            <div className="w-full max-w-sm bg-card rounded-2xl shadow-xl border border-border/50 p-6 sm:p-8">
                <div className="flex flex-col items-center mb-8">
                    {store.logo_url ? (
                        <img src={store.logo_url} alt={store.name} className="h-16 w-auto object-contain mb-4 rounded-xl shadow-sm" />
                    ) : (
                        <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-4 text-primary">
                            <ShieldCheck className="w-8 h-8" />
                        </div>
                    )}
                    <h1 className="text-2xl font-bold text-foreground text-center line-clamp-1">{store.name}</h1>
                    <p className="text-muted-foreground text-sm font-medium">Acesso Garçom</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="login">Login do Garçom</Label>
                        <Input
                            id="login"
                            placeholder="Digite seu usuário"
                            value={login}
                            onChange={(e) => setLogin(e.target.value)}
                            className="bg-muted/50"
                        />
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="password">Senha</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="Sua senha"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-muted/50"
                        />
                    </div>

                    <Button
                        type="submit"
                        variant="hero"
                        className="w-full h-11 text-base shadow-md mt-4"
                        disabled={isSubmitting}
                        style={{ backgroundColor: store.primary_color, color: '#fff' }}
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            "Acessar Mesas"
                        )}
                    </Button>
                </form>
            </div>
            <div className="mt-8 text-center text-sm text-muted-foreground">
                © {new Date().getFullYear()} FRFood Delivery
            </div>
        </div>
    );
};

export default WaiterLogin;
