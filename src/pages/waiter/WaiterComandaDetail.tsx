import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStorePublic } from "@/hooks/useStorePublic";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Receipt, PlusCircle, CheckCircle2, Clock, MapPin, Calculator, X, Bell, Printer } from "lucide-react";
import { printerService } from "@/lib/printer";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { QRCodeSVG } from "qrcode.react";

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
    const [splitCount, setSplitCount] = useState<number>(1);
    const [amountTendered, setAmountTendered] = useState<string>("");
    const [isClosing, setIsClosing] = useState(false);
    const [printerSettings, setPrinterSettings] = useState<any[]>([]);

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
                fetchPrinterSettings();
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

    const fetchPrinterSettings = async () => {
        if (!store) return;
        const { data } = await supabase.from("printer_settings").select("*").eq("store_id", store.id).eq("is_active", true);
        setPrinterSettings(data || []);
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

    const handlePrint = async () => {
        if (!comanda || !store) return;

        const subtotal = calculateSubtotal();
        const discountVal = Number(discount) || 0;
        const total = subtotal - discountVal;

        const html = `
            <html><body style="font-family:monospace; width:300px">
                <h2 style="text-align:center">${store.name}</h2>
                <p style="text-align:center; font-size:12px">MESA: ${table?.name}</p>
                <p style="text-align:center; font-size:10px">${new Date().toLocaleString()}</p>
                <hr/>
                ${orders.filter(o => o.status !== 'cancelled').map(o => `
                    ${o.order_items.map((i: any) => `
                        <div style="display:flex; justify-content:space-between">
                            <span>${i.quantity}x ${i.product_name}</span>
                            <span>${formatCurrency(i.subtotal)}</span>
                        </div>
                    `).join('')}
                `).join('')}
                <hr/>
                <div style="display:flex; justify-content:space-between; font-weight:bold">
                    <span>Subtotal</span>
                    <span>${formatCurrency(subtotal)}</span>
                </div>
                ${discountVal > 0 ? `<div style="display:flex; justify-content:space-between"><span>Desconto</span><span>-${formatCurrency(discountVal)}</span></div>` : ""}
                <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:16px; mt-2; border-top:1px solid #000; pt-2">
                    <span>TOTAL</span>
                    <span>${formatCurrency(total)}</span>
                </div>
            </body></html>
        `;

        const cashierPrinter = printerSettings.find(s => s.type === 'cashier');
        if (cashierPrinter) {
            await printerService.printHTML(cashierPrinter.identifier, html);
        } else {
            const win = window.open("", "_blank", "width=350,height=600");
            if (win) { win.document.write(html); win.document.close(); win.print(); }
        }
    };

    const handleCloseBill = async () => {
        if (!comanda) return;
        setIsClosing(true);
        const subtotal = calculateSubtotal();
        const discountVal = Number(discount) || 0;
        const finalTotal = Math.max(0, subtotal - discountVal);

        try {
            // Se for pagamento em cartão no caixa, apenas avisa e não fecha a comanda agora?
            // De acordo com o fluxo do usuário, o garçom "dispara um alerta no dashboard do caixa".
            if (paymentMethod === 'credito_caixa' || paymentMethod === 'debito_caixa') {
                const { error: notifyError } = await supabase
                    .from("order_payments")
                    .insert({
                        store_id: store.id,
                        order_id: orders[0]?.id, // Vincula ao primeiro pedido para referência
                        payment_method: paymentMethod === 'credito_caixa' ? 'cartao_credito' : 'cartao_debito',
                        amount: finalTotal,
                        status: 'pending'
                    });

                if (notifyError) throw notifyError;
                toast.success("Caixa notificado! Aguarde a conclusão no balcão.");
                setCloseOpen(false);
                return;
            }

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
                <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 shadow-sm">
                    <Printer className="w-4 h-4 mr-1" /> Imprimir
                </Button>
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
                                            {[
                                                { id: 'dinheiro', label: 'Dinheiro', icon: '💵' },
                                                { id: 'pix', label: 'PIX (Aqui)', icon: '📱' },
                                                { id: 'credito_caixa', label: 'Cartão (No Caixa)', icon: '💳' },
                                                { id: 'debito_caixa', label: 'Débito (No Caixa)', icon: '💳' },
                                            ].map(method => (
                                                <Button
                                                    key={method.id}
                                                    variant={paymentMethod === method.id ? "hero" : "outline"}
                                                    className={`w-full text-xs font-bold leading-tight h-14 ${paymentMethod === method.id ? "ring-2 ring-primary ring-offset-2" : ""}`}
                                                    onClick={() => setPaymentMethod(method.id)}
                                                    style={{ backgroundColor: paymentMethod === method.id ? store?.primary_color : undefined }}
                                                >
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-lg">{method.icon}</span>
                                                        {method.label}
                                                    </div>
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {paymentMethod === 'dinheiro' && (
                                        <div className="bg-muted/50 p-4 rounded-xl space-y-3 border border-border">
                                            <div className="flex justify-between items-center">
                                                <Label>Valor Entregue</Label>
                                                <Input
                                                    type="number"
                                                    className="w-32 text-right font-bold"
                                                    value={amountTendered}
                                                    onChange={e => setAmountTendered(e.target.value)}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            {Number(amountTendered) > Math.max(0, subtotal - (Number(discount) || 0)) && (
                                                <div className="flex justify-between items-center text-green-600 font-bold">
                                                    <span>Troco:</span>
                                                    <span>{formatCurrency(Number(amountTendered) - (subtotal - (Number(discount) || 0)))}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {paymentMethod === 'pix' && (
                                        <div className="bg-muted/50 p-4 rounded-xl space-y-3 border border-border">
                                            <div className="space-y-2">
                                                <Label>Dividir conta?</Label>
                                                <div className="flex items-center gap-3">
                                                    <Button variant="outline" size="icon" onClick={() => setSplitCount(Math.max(1, splitCount - 1))}>-</Button>
                                                    <span className="font-bold text-lg w-8 text-center">{splitCount}</span>
                                                    <Button variant="outline" size="icon" onClick={() => setSplitCount(splitCount + 1)}>+</Button>
                                                    <span className="text-xs text-muted-foreground ml-auto">pessoas</span>
                                                </div>
                                            </div>
                                            <div className="pt-2 border-t border-border/50">
                                                <p className="text-sm font-bold text-center mb-2">QR Code PIX {splitCount > 1 ? `(1/${splitCount})` : '(Integral)'}</p>
                                                <div className="bg-white p-3 rounded-lg w-44 h-44 mx-auto flex items-center justify-center border shadow-sm">
                                                    {store?.pix_key ? (
                                                        <QRCodeSVG
                                                            value={store.pix_key}
                                                            size={150}
                                                            level="H"
                                                            includeMargin={true}
                                                            imageSettings={store.logo_url ? {
                                                                src: store.logo_url,
                                                                x: undefined,
                                                                y: undefined,
                                                                height: 24,
                                                                width: 24,
                                                                excavate: true,
                                                            } : undefined}
                                                        />
                                                    ) : (
                                                        <div className="text-[10px] text-center text-muted-foreground">
                                                            PIX não configurado
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-center mt-2 break-all font-mono text-muted-foreground bg-muted p-1 rounded">
                                                    Chave: {store?.pix_key || 'Chave não cadastrada'}
                                                </p>
                                                {splitCount > 1 && (
                                                    <p className="text-center font-black text-primary mt-2">
                                                        {formatCurrency((subtotal - (Number(discount) || 0)) / splitCount)} por pessoa
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between p-4 bg-primary/10 rounded-xl border border-primary/20 text-primary">
                                        <span className="font-bold text-lg">{paymentMethod.includes('caixa') ? 'Total para Receber' : 'Total a Pagar'}</span>
                                        <span className="font-black text-2xl">{formatCurrency(Math.max(0, subtotal - (Number(discount) || 0)))}</span>
                                    </div>

                                    <Button
                                        className="w-full text-lg h-14"
                                        variant="hero"
                                        onClick={handleCloseBill}
                                        disabled={isClosing}
                                        style={{ backgroundColor: store?.primary_color }}
                                    >
                                        {isClosing ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                            <>
                                                {paymentMethod.includes('caixa') ? <Bell className="w-5 h-5 mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                                                {paymentMethod.includes('caixa') ? "Notificar Caixa" : "Confirmar Recebimento"}
                                            </>
                                        )}
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
