import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, CheckCircle2, MessageCircle, ShoppingBag, Store, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";

export default function OrderStatus() {
    const { id } = useParams();
    const [order, setOrder] = useState<any>(null);
    const [store, setStore] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrder();

        const channel = supabase
            .channel("order-updates")
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
                (payload) => {
                    setOrder((prev: any) => ({ ...prev, ...payload.new }));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id]);

    const fetchOrder = async () => {
        const { data: o } = await supabase
            .from("orders")
            .select("*, order_items(*)")
            .eq("id", id)
            .single();

        if (o) {
            setOrder(o);
            const { data: s } = await supabase.from("stores").select("*").eq("id", o.store_id).single();
            setStore(s);
        }
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!order || !store) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
                <ShoppingBag className="w-16 h-16 text-muted-foreground mb-4" />
                <h1 className="text-2xl font-bold text-foreground">Pedido não encontrado</h1>
                <p className="text-muted-foreground mb-6">Não conseguimos localizar as informações do seu pedido.</p>
                <Link to="/">
                    <Button variant="hero">Voltar ao Início</Button>
                </Link>
            </div>
        );
    }

    const steps = [
        { id: "pending", label: "Pedido Realizado" },
        { id: "confirmed", label: "Pedido Confirmado" },
        { id: "preparing", label: "Preparando" },
        { id: "delivering", label: "Saiu para Entrega" },
        { id: "delivered", label: "Entregue" },
    ];

    const currentStepIndex = steps.findIndex(s => s.id === order.status);

    return (
        <div className="min-h-screen bg-muted/50 pb-24">
            <header className="bg-card border-b border-border p-4 sticky top-0 z-30">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <Link to={`/loja/${store.slug}`} className="flex items-center gap-2">
                        {store.logo_url ? (
                            <img src={store.logo_url} className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                            <Store className="w-6 h-6 text-primary" />
                        )}
                        <span className="font-bold text-foreground">{store.name}</span>
                    </Link>
                    <span className="text-sm font-medium text-muted-foreground">Pedido#{order.order_number}</span>
                </div>
            </header>

            <div className="max-w-2xl mx-auto p-4 space-y-6 mt-6">

                {/* Status Tracker */}
                <div className="bg-card rounded-2xl p-6 shadow-card border border-border/50">
                    <h2 className="text-lg font-bold text-foreground mb-6 text-center">Status do seu Pedido</h2>
                    <div className="relative">
                        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted-foreground/20" />
                        <div className="space-y-6 relative">
                            {steps.map((step, index) => {
                                const isCompleted = currentStepIndex >= index;
                                const isCurrent = currentStepIndex === index;

                                return (
                                    <div key={step.id} className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 transition-colors ${isCompleted ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground border-2 border-muted-foreground/20"
                                            }`}>
                                            {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-2.5 h-2.5 rounded-full bg-current opacity-20" />}
                                        </div>
                                        <div>
                                            <p className={`font-bold ${isCurrent ? "text-primary text-lg" : isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                                                {step.label}
                                            </p>
                                            {isCurrent && (
                                                <p className="text-sm text-muted-foreground">
                                                    {step.id === "pending" && "O restaurante recebeu seu pedido."}
                                                    {step.id === "confirmed" && "Seu pedido foi confirmado pelo restaurante."}
                                                    {step.id === "preparing" && "Seu pedido está sendo feito com carinho."}
                                                    {step.id === "delivering" && "Seu pedido já está a caminho!"}
                                                    {step.id === "delivered" && "Bom apetite!"}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Pix Payment Info */}
                {order.payment_method === 'pix' && store.pix_key && (
                    <div className="bg-card rounded-2xl p-6 shadow-card border border-primary/20 bg-primary/5 text-center">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                            <span className="text-primary font-bold text-xl">P</span>
                        </div>
                        <h3 className="font-bold text-foreground mb-2">Pagamento via PIX</h3>
                        <p className="text-sm text-muted-foreground mb-4 border-b border-border/50 pb-4">
                            Faça o pagamento usando a chave abaixo e envie o comprovante pelo WhatsApp.
                        </p>

                        <div className="mb-4">
                            <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Chave PIX da loja</p>
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-lg font-bold text-foreground">{store.pix_key}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => {
                                        navigator.clipboard.writeText(store.pix_key);
                                        toast.success("Chave PIX copiada!");
                                    }}
                                >
                                    <Copy className="w-4 h-4 text-primary" />
                                </Button>
                            </div>
                        </div>

                        <Button
                            variant="hero"
                            className="w-full font-bold shadow-lg"
                            typeof="button"
                            onClick={() => {
                                const text = `Olá! Acabei de fazer o pedido #${order.order_number} no valor de R$ ${order.total.toFixed(2)} e este é o comprovante do PIX.`;
                                window.open(`https://wa.me/55${store.phone.replace(/\\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank");
                            }}
                        >
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Enviar Comprovante
                        </Button>
                    </div>
                )}

                {/* Copy Link */}
                <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50">
                    <p className="text-sm text-muted-foreground mb-2 text-center">Salve o link para acompanhar seu pedido:</p>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(window.location.href);
                            const btn = document.getElementById("copy-link-btn");
                            if (btn) { btn.textContent = "✓ Link copiado!"; setTimeout(() => { btn.textContent = "Copiar link de acompanhamento"; }, 2000); }
                        }}
                        id="copy-link-btn"
                        className="w-full flex items-center justify-center gap-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors py-2.5 rounded-xl"
                    >
                        <Link2 className="w-4 h-4" /> Copiar link de acompanhamento
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Button
                        variant="outline"
                        className="flex-col h-auto py-4 bg-card"
                        onClick={() => window.open(`https://wa.me/55${store.phone.replace(/\D/g, "")}`, "_blank")}
                    >
                        <MessageCircle className="w-6 h-6 text-green-500 mb-2" />
                        <span className="text-sm font-medium">Falar com a loja</span>
                    </Button>
                    <Link to={`/loja/${store.slug}`} className="contents">
                        <Button variant="hero" className="flex-col h-auto py-4">
                            <ShoppingBag className="w-6 h-6 mb-2" />
                            <span className="text-sm font-medium">Novo pedido</span>
                        </Button>
                    </Link>
                </div>

                {/* Order Details */}
                <div className="bg-card rounded-2xl p-6 shadow-card border border-border/50 space-y-4">
                    <h3 className="font-bold text-foreground border-b border-border pb-2">Detalhes do Pedido</h3>

                    <div className="space-y-3">
                        {order.order_items.map((item: any) => (
                            <div key={item.id} className="flex justify-between text-sm">
                                <span><span className="font-bold text-primary">{item.quantity}x</span> {item.product_name}</span>
                                <span className="font-medium">R$ {item.subtotal.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 border-t border-border/50 text-sm space-y-2">
                        <div className="flex justify-between text-muted-foreground">
                            <span>Subtotal</span>
                            <span>R$ {order.subtotal.toFixed(2)}</span>
                        </div>
                        {order.delivery_fee > 0 && (
                            <div className="flex justify-between text-muted-foreground">
                                <span>Taxa de entrega</span>
                                <span>R$ {order.delivery_fee.toFixed(2)}</span>
                            </div>
                        )}
                        {order.discount > 0 && (
                            <div className="flex justify-between text-green-600">
                                <span>Desconto</span>
                                <span>-R$ {order.discount.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                            <span>Total</span>
                            <span>R$ {order.total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {order.delivery_type === "delivery" && (
                    <div className="bg-card rounded-2xl p-6 shadow-card border border-border/50 flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-foreground">Endereço de Entrega</p>
                            <p className="text-sm text-muted-foreground mt-1">{order.customer_address}</p>
                            <p className="text-sm text-muted-foreground">{order.neighborhood}</p>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
