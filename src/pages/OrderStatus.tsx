import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ultraResilientInvoke } from "@/lib/supabase-edge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, CheckCircle2, MessageCircle, ShoppingBag, Store, Copy, Link2, XCircle, AlertTriangle, QrCode, Zap, ChevronLeft, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { useCustomerOrderNotifications } from "@/hooks/useCustomerOrderNotifications";
import { generatePixPayload } from "@/lib/pix";

export default function OrderStatus() {
    const { id } = useParams();
    const [order, setOrder] = useState<any>(null);
    const [store, setStore] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [otherActiveOrders, setOtherActiveOrders] = useState<any[]>([]);
    const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
    const [pixPayments, setPixPayments] = useState<any[]>([]);
    const [isGeneratingPix, setIsGeneratingPix] = useState(false);
    const [statusRefreshing, setStatusRefreshing] = useState(false);
    const [pixPayload, setPixPayload] = useState<string | null>(null);
    const [pixGenerated, setPixGenerated] = useState(false);
    const [pixError, setPixError] = useState<string | null>(null);

    useCustomerOrderNotifications(order?.id, order?.status);

    useEffect(() => {
        fetchOrder();

        // Load saved PIX if it exists and is less than 1 hour old
        if (id) {
            const savedPix = localStorage.getItem(`pix_order_${id}`);
            if (savedPix) {
                try {
                    const { payload, timestamp } = JSON.parse(savedPix);
                    const now = new Date().getTime();
                    const oneHour = 60 * 60 * 1000;
                    if (now - timestamp < oneHour) {
                        setPixPayload(payload);
                        setPixGenerated(true);
                    } else {
                        localStorage.removeItem(`pix_order_${id}`);
                    }
                } catch (e) {
                    console.error("Error parsing saved PIX", e);
                }
            }
        }

        const channel = supabase
            .channel(`order-updates-${id}`)
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
                (payload) => {
                    setOrder((prev: any) => ({ ...prev, ...payload.new }));
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "order_payments", filter: `order_id=eq.${id}` },
                async () => {
                    const { data: ppx } = await supabase.from("order_payments").select("*").eq("order_id", id).eq("payment_method", "pix");
                    setPixPayments(ppx || []);
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

        // Fetch PIX payments if payment method is pix
        if (o && o.payment_method === 'pix') {
            const { data: ppx } = await supabase.from("order_payments").select("*").eq("order_id", o.id).eq("payment_method", "pix");
            setPixPayments(ppx || []);
        }
    };

    const handleGenerateStaticPix = async () => {
        if (!order || !store?.pix_key) {
            toast.error("Chave PIX da loja não configurada.");
            return;
        }

        setIsGeneratingPix(true);
        setPixError(null);

        try {
            // Normalizing amount to ensure it's a number
            const amount = Number(order.total);

            // Generating the BRCode payload locally
            const brCode = generatePixPayload({
                key: store.pix_key,
                name: store.name || "FRFood",
                city: store.city || "Brasil",
                amount: amount,
                transactionId: `PEDIDO${order.order_number}`
            });

            setPixPayload(brCode);
            setPixGenerated(true);

            // Persist to localStorage
            localStorage.setItem(`pix_order_${id}`, JSON.stringify({
                payload: brCode,
                timestamp: new Date().getTime()
            }));

            toast.success("QR Code PIX Gerado!");
        } catch (err: any) {
            console.error("Static PIX Generation Error:", err);
            setPixError("Falha ao gerar PIX. Verifique os dados da loja.");
            toast.error("Erro ao gerar PIX");
        } finally {
            setIsGeneratingPix(false);
        }
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        return `${m}m ${s}s`;
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

    const getStatusMessage = (status: string) => {
        switch (status) {
            case "pending": return "Estamos aguardando a confirmação do restaurante.";
            case "confirmed": return "Seu pedido foi confirmado e logo entrará em preparo.";
            case "preparing": return "O chef já está preparando seu pedido com carinho.";
            case "ready_for_pickup": return "Seu pedido está pronto! Você já pode vir retirar.";
            case "delivering": return "Seu pedido saiu para entrega e está indo até você!";
            case "delivered": return "Pedido entregue. Aproveite sua refeição!";
            case "picked_up": return "Pedido retirado. Esperamos que goste!";
            case "cancelled": return "Este pedido foi cancelado.";
            default: return "";
        }
    };

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
                        <div className="bg-primary/5 rounded-xl p-4 mb-6 border border-primary/20 text-center">
                            <p className="text-base font-bold text-foreground">
                                {getStatusMessage(order.status)}
                            </p>
                        </div>
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
                                                        {step.id === "pending" && "Estamos aguardando a confirmação do restaurante."}
                                                        {step.id === "confirmed" && "Seu pedido foi confirmado e logo entrará em preparo."}
                                                        {step.id === "preparing" && "O chef já está preparando seu pedido com carinho."}
                                                        {step.id === "delivering" && "Seu pedido saiu para entrega e está indo até você!"}
                                                        {step.id === "delivered" && "Pedido entregue. Aproveite sua refeição!"}
                                                        {step.id === "ready_for_pickup" && "Seu pedido está pronto! Você já pode vir retirar."}
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
                {order.payment_method === 'pix' && !isCancelled && !['delivered', 'picked_up'].includes(order.status) && (
                    <div className="bg-card rounded-2xl p-6 shadow-card border-2 border-primary/20 bg-primary/5 text-center space-y-4">
                        {(pixPayments.length > 0 || pixGenerated) ? (
                            <div className="space-y-4">
                                {/* Show existing payments or the newly generated static one */}
                                {pixGenerated && !pixPayments.some(p => p.pix_copia_cola === pixPayload) && (
                                    <div className="p-5 rounded-2xl border-2 bg-white border-primary/20 shadow-sm transition-all">
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Pagamento PIX</span>
                                            <Badge className="bg-blue-500">
                                                AGUARDANDO...
                                            </Badge>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="bg-white p-3 rounded-2xl inline-block border-2 border-muted/50 shadow-inner">
                                                <QRCodeSVG value={pixPayload || ""} size={220} level="H" />
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor a pagar</p>
                                                <p className="text-2xl font-black text-primary">R$ {order.total.toFixed(2)}</p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                className="w-full font-bold gap-2 rounded-xl h-12"
                                                onClick={() => {
                                                    const message = encodeURIComponent(`Olá! Segue o comprovante do meu pedido #${order.order_number}.\nValor: R$ ${order.total.toFixed(2)}`);
                                                    window.open(`https://wa.me/55${store.phone.replace(/\D/g, "")}?text=${message}`, "_blank");
                                                }}
                                            >
                                                <MessageCircle className="w-4 h-4 text-green-500" /> Enviar Comprovante
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                className="w-full text-[10px] font-bold gap-2 text-muted-foreground"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(pixPayload || "");
                                                    toast.success("Código PIX copiado!");
                                                }}
                                            >
                                                <Copy className="w-3 h-3" /> Copiar Código PIX
                                            </Button>
                                            <p className="text-[10px] text-muted-foreground italic font-medium">O QR Code expira em 1 hora.</p>
                                        </div>
                                    </div>
                                )}

                                {pixPayments.map((p, idx) => (
                                    <div key={p.id} className={`p-5 rounded-2xl border-2 transition-all ${p.status === 'paid' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-primary/20 shadow-sm'}`}>
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Pagamento PIX {pixPayments.length > 1 ? idx + 1 : ''}</span>
                                            <Badge className={p.status === 'paid' ? "bg-emerald-500" : "bg-blue-500 animate-pulse"}>
                                                {p.status === 'paid' ? "PAGO ✅" : "AGUARDANDO..."}
                                            </Badge>
                                        </div>

                                        {p.status !== 'paid' ? (
                                            <div className="space-y-4">
                                                <div className="bg-white p-3 rounded-2xl inline-block border-2 border-muted/50 shadow-inner">
                                                    <QRCodeSVG value={p.pix_copia_cola} size={220} level="H" />
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor a pagar</p>
                                                    <p className="text-2xl font-black text-primary">R$ {p.amount.toFixed(2)}</p>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    className="w-full font-bold gap-2 rounded-xl h-12"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(p.pix_copia_cola);
                                                        toast.success("Código PIX copiado!");
                                                    }}
                                                >
                                                    <Copy className="w-4 h-4" /> Copiar Código PIX
                                                </Button>
                                                <p className="text-[10px] text-muted-foreground italic font-medium">A confirmação é automática após o pagamento</p>
                                            </div>
                                        ) : (
                                            <div className="py-6 space-y-2">
                                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                                                </div>
                                                <p className="font-bold text-emerald-600">Pagamento Recebido!</p>
                                                <p className="text-xs text-muted-foreground">Seu pedido já foi liberado para produção.</p>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {pixPayments.every(p => p.status !== 'paid') && (
                                    <Button
                                        variant="ghost"
                                        className="w-full text-xs font-bold gap-2 text-muted-foreground"
                                        onClick={() => window.open(`https://wa.me/55${store.phone.replace(/\D/g, "")}`, "_blank")}
                                    >
                                        <MessageCircle className="w-4 h-4" /> Problemas com o pagamento?
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="py-6 space-y-4">
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                                    <QrCode className="w-8 h-8 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">Pagar com PIX</h3>
                                    <p className="text-sm text-muted-foreground px-6 mt-1">
                                        Gere o código PIX da loja para realizar o pagamento do seu pedido.
                                    </p>
                                </div>
                                {pixError && <p className="text-xs text-destructive font-medium">{pixError}</p>}
                                <Button
                                    variant="hero"
                                    className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-lg"
                                    onClick={handleGenerateStaticPix}
                                    disabled={isGeneratingPix}
                                >
                                    {isGeneratingPix ? <Clock className="w-5 h-5 animate-spin mr-2" /> : <Zap className="w-5 h-5 mr-2" />}
                                    Gerar QR Code PIX
                                </Button>
                            </div>
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
