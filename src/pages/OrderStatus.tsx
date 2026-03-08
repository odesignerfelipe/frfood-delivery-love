import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, CheckCircle2, MessageCircle, ShoppingBag, Store, Copy, Link2, XCircle, AlertTriangle, QrCode, Zap, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { useCustomerOrderNotifications } from "@/hooks/useCustomerOrderNotifications";
import { generatePixPayload, isPixExpired } from "@/lib/pix";

export default function OrderStatus() {
    const { id } = useParams();
    const [order, setOrder] = useState<any>(null);
    const [store, setStore] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [otherActiveOrders, setOtherActiveOrders] = useState<any[]>([]);

    useCustomerOrderNotifications(order?.id, order?.status);

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

    useEffect(() => {
        if (store) {
            document.title = `${store.name} - Pedido #${order?.order_number || ''}`;

            // Update favicon
            if (store.logo_url) {
                let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
                if (!link) {
                    link = document.createElement('link');
                    link.rel = 'icon';
                    document.getElementsByTagName('head')[0].appendChild(link);
                }
                link.href = store.logo_url;
            }
        }
    }, [store, order?.order_number]);

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

            // Manage active orders in localStorage
            if (s) {
                const stored = localStorage.getItem(`active_orders_${s.id}`);
                let ids: string[] = [];
                if (stored) { try { ids = JSON.parse(stored); } catch (e) { } }

                // Add current if not present
                if (!ids.includes(o.id) && !["delivered", "picked_up", "cancelled"].includes(o.status)) {
                    ids.push(o.id);
                    localStorage.setItem(`active_orders_${s.id}`, JSON.stringify(ids));
                }

                // If finished, remove it
                if (["delivered", "picked_up", "cancelled"].includes(o.status)) {
                    const remaining = ids.filter(orderId => orderId !== o.id);
                    localStorage.setItem(`active_orders_${s.id}`, JSON.stringify(remaining));
                    ids = remaining;
                }

                // Fetch other active orders to show in switcher
                const otherIds = ids.filter(orderId => orderId !== o.id);
                if (otherIds.length > 0) {
                    const { data: others } = await supabase
                        .from("orders")
                        .select("id, order_number, status")
                        .in("id", otherIds);
                    if (others) setOtherActiveOrders(others);
                } else {
                    setOtherActiveOrders([]);
                }
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        if (store) {
            document.title = `Pedido #${order?.order_number || ''} - ${store.name}`;

            if (store.logo_url) {
                let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
                if (!link) {
                    link = document.createElement('link');
                    link.rel = 'icon';
                    document.getElementsByTagName('head')[0].appendChild(link);
                }
                link.href = store.logo_url;
            }
        }
    }, [store, order]);

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

    const isCancelled = order.status === "cancelled";

    const estimatedMinutes = ((store as any).avg_prep_time || 25) + (order.delivery_type === "delivery" ? ((store as any).avg_delivery_time || 40) : 0);
    const etaDate = new Date(new Date(order.created_at).getTime() + estimatedMinutes * 60000);
    const etaString = etaDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const steps = order.delivery_type === "delivery" ? [
        { id: "pending", label: "Pedido Realizado" },
        { id: "confirmed", label: "Pedido Confirmado" },
        { id: "preparing", label: "Preparando" },
        { id: "delivering", label: "Saiu para Entrega" },
        { id: "delivered", label: "Entregue" },
    ] : [
        { id: "pending", label: "Pedido Realizado" },
        { id: "confirmed", label: "Pedido Confirmado" },
        { id: "preparing", label: "Preparando" },
        { id: "ready_for_pickup", label: "Pronto para Retirada" },
        { id: "picked_up", label: "Retirado" },
    ];

    const currentStepIndex = steps.findIndex(s => s.id === order.status);

    const renderItemVariations = (item: any) => {
        const vars = item.variations;
        if (!vars || !Array.isArray(vars) || vars.length === 0) return null;
        return (
            <div className="mt-0.5 space-y-0.5">
                {vars.map((v: any, i: number) => (
                    <p key={i} className="text-xs text-muted-foreground">
                        <span className="font-medium">{v.group}:</span>{" "}
                        {Array.isArray(v.selected)
                            ? v.selected.map((s: any) => `${s.name}${s.price > 0 ? ` (+R$${s.price.toFixed(2)})` : ""}`).join(", ")
                            : v.selected}
                    </p>
                ))}
            </div>
        );
    };

    const isExpired = isPixExpired(order.created_at);
    const pixPayload = order.payment_method === 'pix' && store.pix_key
        ? generatePixPayload({
            key: store.pix_key,
            name: store.name,
            city: store.city || '',
            amount: order.total,
            transactionId: order.order_number.toString()
        })
        : '';

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

                {/* Cancelled Order Banner */}
                {isCancelled && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 text-center space-y-4">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                            <XCircle className="w-8 h-8 text-red-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-red-700">Pedido Cancelado</h2>
                            <p className="text-red-600 text-sm mt-1">
                                Infelizmente seu pedido foi cancelado pelo estabelecimento.
                            </p>
                        </div>
                        {order.cancellation_reason && (
                            <div className="bg-white rounded-xl p-4 border border-red-200">
                                <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-1">Motivo do cancelamento</p>
                                <p className="text-sm text-foreground font-medium">{order.cancellation_reason}</p>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <Link to={`/loja/${store.slug}`} className="contents">
                                <Button variant="hero" className="flex-col h-auto py-4">
                                    <ShoppingBag className="w-6 h-6 mb-2" />
                                    <span className="text-sm font-medium">Fazer Novo Pedido</span>
                                </Button>
                            </Link>
                            <Button
                                variant="outline"
                                className="flex-col h-auto py-4 bg-white"
                                onClick={() => window.open(`https://wa.me/55${store.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Meu pedido #${order.order_number} foi cancelado. Gostaria de mais informações.`)}`, "_blank")}
                            >
                                <MessageCircle className="w-6 h-6 text-green-500 mb-2" />
                                <span className="text-sm font-medium">Falar com a Loja</span>
                            </Button>
                        </div>
                    </div>
                )}

                {/* Multi-Order Switcher */}
                {otherActiveOrders.length > 0 && (
                    <div className="bg-primary/5 rounded-2xl p-6 shadow-card border-2 border-primary/10 space-y-4">
                        <div className="flex items-center gap-2 text-primary">
                            <Zap className="w-5 h-5 animate-pulse" />
                            <h3 className="font-bold">Você tem outros pedidos ativos</h3>
                        </div>
                        <div className="grid gap-2">
                            {otherActiveOrders.map(other => (
                                <Link
                                    key={other.id}
                                    to={`/pedido/${other.id}`}
                                    className="flex items-center justify-between p-3 bg-white rounded-xl border border-primary/20 hover:border-primary hover:bg-primary/5 transition-all group"
                                >
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-foreground">Pedido #{other.order_number}</span>
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold">
                                            {other.status === 'pending' && 'Pendente'}
                                            {other.status === 'confirmed' && 'Confirmado'}
                                            {other.status === 'preparing' && 'Preparando'}
                                            {other.status === 'delivering' && 'Em entrega'}
                                            {other.status === 'ready_for_pickup' && 'Pronto para retirada'}
                                        </span>
                                    </div>
                                    <Button variant="ghost" size="sm" className="text-primary font-bold group-hover:translate-x-1 transition-transform">
                                        Acompanhar <ChevronLeft className="w-4 h-4 ml-1 rotate-180" />
                                    </Button>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Status Tracker - only show if NOT cancelled */}
                {!isCancelled && (
                    <div className="bg-card rounded-2xl p-6 shadow-card border border-border/50">
                        <div className="flex flex-col items-center mb-6 border-b border-border/50 pb-4">
                            <h2 className="text-lg font-bold text-foreground">Status do seu Pedido</h2>
                            {order.status !== "delivered" && order.status !== "picked_up" && (
                                <div className="mt-2 inline-flex items-center gap-1.5 text-primary bg-primary/10 px-3 py-1.5 rounded-full text-sm font-semibold">
                                    <Clock className="w-4 h-4" />
                                    Horário Previsto: ~ {etaString}
                                </div>
                            )}
                        </div>
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
                                                        {step.id === "ready_for_pickup" && "Seu pedido está pronto e aguardando retirada no local."}
                                                        {step.id === "picked_up" && "Pedido retirado. Bom apetite!"}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Pix Payment Info */}
                {order.payment_method === 'pix' && store.pix_key && !isCancelled && order.status === 'pending' && (
                    <div className="bg-card rounded-2xl p-6 shadow-card border-2 border-primary/20 bg-primary/5 text-center space-y-4">
                        {isExpired ? (
                            <div className="py-4 space-y-3">
                                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
                                    <AlertTriangle className="w-6 h-6 text-yellow-600" />
                                </div>
                                <h3 className="font-bold text-foreground">QR Code Expirado</h3>
                                <p className="text-xs text-muted-foreground px-4">
                                    Por segurança, este QR Code expirou (validade de 1 hora).
                                    Se você já realizou o pagamento, aguarde a confirmação do restaurante.
                                    Caso contrário, entre em contato com a loja.
                                </p>
                                <Button
                                    variant="outline"
                                    className="w-full mt-2"
                                    onClick={() => window.open(`https://wa.me/55${store.phone.replace(/\D/g, "")}`, "_blank")}
                                >
                                    Falar com a Loja
                                </Button>
                            </div>
                        ) : (
                            <>
                                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                                    <QrCode className="w-6 h-6 text-primary" />
                                </div>

                                <div>
                                    <h3 className="font-bold text-foreground">Pagamento via PIX</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Escaneie o QR Code ou cole o código para pagar
                                    </p>
                                </div>

                                {/* QR Code */}
                                <div className="bg-white p-4 rounded-2xl inline-block shadow-sm">
                                    <QRCodeSVG value={pixPayload} size={200} />
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 text-center">Código Pix Copia e Cola</p>
                                        <div className="relative group">
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(pixPayload);
                                                    toast.success("Código PIX copiado!");
                                                }}
                                                className="w-full p-3 bg-muted/50 rounded-xl text-xs font-mono break-all text-left border border-border group-hover:border-primary/30 transition-colors pr-10"
                                            >
                                                <span className="line-clamp-2">{pixPayload}</span>
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-background p-1.5 rounded-lg border shadow-sm">
                                                    <Copy className="w-3.5 h-3.5 text-primary" />
                                                </div>
                                            </button>
                                        </div>
                                    </div>

                                    <Button
                                        variant="hero"
                                        className="w-full font-bold shadow-lg h-12"
                                        onClick={() => {
                                            const text = `Olá! Acabei de fazer o pedido #${order.order_number} no valor de R$ ${order.total.toFixed(2)} e este é o comprovante do PIX.`;
                                            window.open(`https://wa.me/55${store.phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank");
                                        }}
                                    >
                                        <MessageCircle className="w-4 h-4 mr-2" />
                                        Enviar Comprovante
                                    </Button>
                                </div>
                            </>
                        )}
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

                {!isCancelled && (
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
                                <span className="text-sm font-medium">Voltar ao Cardápio</span>
                            </Button>
                        </Link>
                    </div>
                )}

                {/* Order Details */}
                <div className="bg-card rounded-2xl p-6 shadow-card border border-border/50 space-y-4">
                    <h3 className="font-bold text-foreground border-b border-border pb-2">Detalhes do Pedido</h3>

                    <div className="space-y-3">
                        {order.order_items.map((item: any) => (
                            <div key={item.id}>
                                <div className="flex justify-between text-sm">
                                    <span><span className="font-bold text-primary">{item.quantity}x</span> {item.product_name}</span>
                                    <span className="font-medium">R$ {item.subtotal.toFixed(2)}</span>
                                </div>
                                {renderItemVariations(item)}
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
