import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStorePublic } from "@/hooks/useStorePublic";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Receipt, PlusCircle, CheckCircle2, Clock, MapPin, Calculator, X } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface WaiterComandaDetailProps {
    explicitSlug?: string;
}

const WaiterComandaDetail = ({ explicitSlug }: WaiterComandaDetailProps) => {
    const { id: comandaId, slug: paramSlug } = useParams();
    const activeSlug = explicitSlug || paramSlug;
    const { store, loading: storeLoading } = useStorePublic(activeSlug);
    const navigate = useNavigate();

    const [waiterSession, setWaiterSession] = useState<any>(null);
    const [comanda, setComanda] = useState<any>(null);
    const [table, setTable] = useState<any>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Closing bill state
    const [closeOpen, setCloseOpen] = useState(false);
    const [discount, setDiscount] = useState<string>("0");
    const [paymentMethod, setPaymentMethod] = useState("dinheiro");
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (store && !storeLoading) {
            const sessionStr = localStorage.getItem(`waiter_session_${store.id}`);
            if (!sessionStr) {
                navigate(explicitSlug ? "/garcom" : `/loja/${store.slug}/garcom`);
                return;
            }
            try {
                setWaiterSession(JSON.parse(sessionStr));
                fetchDetails();
            } catch (e) {
                navigate(explicitSlug ? "/garcom" : `/loja/${store.slug}/garcom`);
            }
        }
    }, [store, storeLoading]);

    const fetchDetails = async () => {
        if (!store || !comandaId) return;
        setLoading(true);
        try {
            // 1. Fetch Comanda
            const { data: comandaData, error: comandaError } = await supabase
                .from("comandas")
                .select("*")
                .eq("id", comandaId)
                .single();
            if (comandaError) throw comandaError;
            setComanda(comandaData);

            // 2. Fetch Table
            const { data: tableData, error: tableError } = await supabase
                .from("tables")
                .select("*")
                .eq("id", comandaData.table_id)
                .single();
            if (tableError) throw tableError;
            setTable(tableData);

            // 3. Fetch Orders and Items
            const { data: ordersData, error: ordersError } = await supabase
                .from("orders")
                .select(`
          *,
          order_items (*)
        `)
                .eq("comanda_id", comandaId)
                .order("created_at", { ascending: false });
            if (ordersError) throw ordersError;
            setOrders(ordersData || []);

        } catch (err) {
            console.error(err);
            toast.error("Erro ao carregar comanda");
            navigate(explicitSlug ? "/garcom/mesas" : `/loja/${store.slug}/garcom/mesas`);
        } finally {
            setLoading(false);
        }
    };

    // Realtime updates
    useEffect(() => {
        if (!store || !comandaId) return;

        const channel = supabase
            .channel("waiter_orders")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "orders",
                    filter: `comanda_id=eq.${comandaId}`,
                },
                () => {
                    fetchDetails();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [store, comandaId]);

    const calculateSubtotal = () => {
        return orders
            .filter(o => o.status !== "cancelled")
            .reduce((sum, order) => sum + Number(order.total), 0);
    };

    const handleCancelOrder = async (orderId: string) => {
        if (!window.confirm("Deseja realmente cancelar este pedido?")) return;
        try {
            const { error } = await supabase
                .from("orders")
                .update({ status: "cancelled", cancellation_reason: "Cancelado pelo garçom" })
                .eq("id", orderId);
            if (error) throw error;
            toast.success("Pedido cancelado");
        } catch (err) {
            console.error(err);
            toast.error("Erro ao cancelar o pedido");
        }
    };

    const handleCloseBill = async () => {
        if (!comanda) return;
        setIsClosing(true);
        const subtotal = calculateSubtotal();
        const discountVal = Number(discount) || 0;
        const finalTotal = Math.max(0, subtotal - discountVal);

        try {
            const { error } = await supabase
                .from("comandas")
                .update({
                    status: "closed",
                    subtotal: subtotal,
                    discount: discountVal,
                    total: finalTotal,
                    payment_method: paymentMethod
                })
                .eq("id", comanda.id);

            if (error) throw error;

            toast.success("Conta encerrada com sucesso!");
            navigate(explicitSlug ? "/garcom/mesas" : `/loja/${store?.slug}/garcom/mesas`);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao encerrar conta");
        } finally {
            setIsClosing(false);
            setCloseOpen(false);
        }
    };

    if (storeLoading || loading || !comanda || !table) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/30">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    const subtotal = calculateSubtotal();

    return (
        <div className="min-h-screen bg-muted/30 pb-24">
            <header className="bg-card border-b border-border sticky top-0 z-10 shadow-sm px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate(explicitSlug ? "/garcom/mesas" : `/loja/${store?.slug}/garcom/mesas`)} className="mr-1">
                        <ArrowLeft className="w-5 h-5 text-foreground" />
                    </Button>
                    <div>
                        <h1 className="font-bold text-foreground text-lg leading-tight">{table.name}</h1>
                        <p className="text-xs text-muted-foreground leading-tight">Comanda #{comanda.id.split('-')[0].toUpperCase()}</p>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-4 md:p-6 mt-2 space-y-6">

                {/* Status Banner */}
                {comanda.status === "closed" && (
                    <div className="bg-green-500/10 text-green-700 border border-green-500/20 p-4 rounded-xl flex items-center gap-3">
                        <CheckCircle2 className="w-6 h-6" />
                        <div>
                            <p className="font-bold">Comanda Encerrada</p>
                            <p className="text-sm">Total da conta: {formatCurrency(comanda.total)}</p>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                {comanda.status === "open" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Link to={explicitSlug ? `/garcom/comanda/${comanda.id}/cardapio` : `/loja/${store?.slug}/garcom/comanda/${comanda.id}/cardapio`}>
                            <Button variant="hero" className="w-full text-base h-12 shadow-sm" style={{ backgroundColor: store?.primary_color }}>
                                <PlusCircle className="w-5 h-5 mr-2" />
                                Lançar Produtos
                            </Button>
                        </Link>
                    </div>
                )}

                {/* Orders List */}
                <div>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Receipt className="w-5 h-5" />
                        Pedidos Lançados
                    </h2>

                    {orders.length === 0 ? (
                        <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border shadow-sm">
                            <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                            <p className="text-muted-foreground">Nenhum pedido lançado nesta comanda ainda.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {orders.map((order) => (
                                <div key={order.id} className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                                    {/* Order Header */}
                                    <div className={`bg-muted/30 px-4 py-3 border-b flex items-center justify-between ${order.status === 'cancelled' ? 'opacity-60' : ''}`}>
                                        <div>
                                            <p className="font-bold text-sm">Pedido #{order.order_number}</p>
                                            <div className="flex items-center text-xs text-muted-foreground gap-2 mt-0.5">
                                                <Clock className="w-3 h-3" />
                                                {new Date(order.created_at).toLocaleTimeString()}
                                                <span className="mx-1">•</span>
                                                <span className={order.status === 'delivered' ? 'text-green-600 font-medium' : order.status === 'cancelled' ? 'text-red-500 font-medium' : 'text-primary font-medium'}>
                                                    {order.status === 'pending' ? 'Pendente' : order.status === 'preparing' ? 'Preparando' : order.status === 'ready' ? 'Pronto' : order.status === 'cancelled' ? 'Cancelado' : 'Entregue'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-1">
                                            <p className={`font-bold ${order.status === 'cancelled' ? 'text-muted-foreground line-through' : 'text-primary'}`}>{formatCurrency(order.total)}</p>
                                            {order.status !== 'cancelled' && order.status !== 'delivered' && comanda.status === 'open' && (
                                                <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive px-2" onClick={() => handleCancelOrder(order.id)}>
                                                    <X className="w-3 h-3 mr-1" /> Cancelar
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Order Items */}
                                    <div className="p-4 space-y-3">
                                        {order.order_items?.map((item: any) => (
                                            <div key={item.id} className="flex justify-between items-start text-sm">
                                                <div className="flex-1">
                                                    <p className="font-medium text-foreground">
                                                        {item.quantity}x {item.product_name}
                                                    </p>
                                                    {item.variations && item.variations.length > 0 && (
                                                        <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 list-disc pl-4">
                                                            {item.variations.map((v: any, i: number) => (
                                                                <li key={i}>{v.group}: {v.selected?.map((s: any) => s.name).join(', ')}</li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                    {item.notes && (
                                                        <p className="text-xs text-orange-600 mt-1 italic">Obs: {item.notes}</p>
                                                    )}
                                                </div>
                                                <p className="font-medium text-muted-foreground ml-4">
                                                    {formatCurrency(item.subtotal)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Floating Action Bar (Close Bill) */}
            {comanda.status === "open" && orders.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
                    <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subtotal</p>
                            <p className="text-2xl font-black text-foreground">{formatCurrency(subtotal)}</p>
                        </div>

                        <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
                            <DialogTrigger asChild>
                                <Button variant="default" className="text-base h-12 px-8 shadow-md">
                                    <Calculator className="w-5 h-5 mr-2" />
                                    Fechar Conta
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Fechamento de Conta</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-6 pt-2">
                                    <div className="bg-muted p-4 rounded-xl flex items-center justify-between">
                                        <span className="font-semibold text-muted-foreground">Subtotal dos pedidos</span>
                                        <span className="font-bold text-lg">{formatCurrency(subtotal)}</span>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Desconto (R$)</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={discount}
                                            onChange={(e) => setDiscount(e.target.value)}
                                            placeholder="0.00"
                                            className="text-lg"
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <Label>Forma de Pagamento</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['dinheiro', 'pix', 'credito', 'debito'].map(method => (
                                                <Button
                                                    key={method}
                                                    variant={paymentMethod === method ? "hero" : "outline"}
                                                    className={`w-full capitalize ${paymentMethod === method ? "ring-2 ring-primary ring-offset-2" : ""}`}
                                                    onClick={() => setPaymentMethod(method)}
                                                    style={{ backgroundColor: paymentMethod === method ? store?.primary_color : undefined }}
                                                >
                                                    {method === 'credito' ? 'Cartão Crédito' : method === 'debito' ? 'Cartão Débito' : method}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-primary/10 rounded-xl border border-primary/20 text-primary">
                                        <span className="font-bold text-lg">Total a Pagar</span>
                                        <span className="font-black text-2xl">{formatCurrency(Math.max(0, subtotal - (Number(discount) || 0)))}</span>
                                    </div>

                                    <Button
                                        className="w-full text-lg h-14"
                                        variant="hero"
                                        onClick={handleCloseBill}
                                        disabled={isClosing}
                                        style={{ backgroundColor: store?.primary_color }}
                                    >
                                        {isClosing ? <Loader2 className="w-6 h-6 animate-spin" /> : "Confirmar Recebimento"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WaiterComandaDetail;
