import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStorePublic } from "@/hooks/useStorePublic";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Receipt, PlusCircle, CheckCircle2, Clock, Calculator, X, Bell, Printer, Copy, ChevronDown } from "lucide-react";
import { printerService } from "@/lib/printer";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { QRCodeSVG } from "qrcode.react";
import { generatePixPayload, isPixExpired } from "@/lib/pix";
import { AlertTriangle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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

    // Dynamic PIX state
    const [pixPayments, setPixPayments] = useState<any[]>([]);
    const [isGeneratingPix, setIsGeneratingPix] = useState(false);
    const [activePixIndex, setActivePixIndex] = useState(1);

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
            const { data: comandaData, error: comandaError } = await supabase
                .from("comandas")
                .select("*")
                .eq("id", comandaId)
                .single();
            if (comandaError) throw comandaError;
            setComanda(comandaData);

            const { data: tableData, error: tableError } = await supabase
                .from("tables")
                .select("*")
                .eq("id", comandaData.table_id)
                .single();
            if (tableError) throw tableError;
            setTable(tableData);

            const { data: ordersData, error: ordersError } = await supabase
                .from("orders")
                .select(`*, order_items (*)`)
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

    // Realtime: Orders + Payment updates
    useEffect(() => {
        if (!store || !comandaId) return;

        const channel = supabase
            .channel("waiter_orders_and_payments")
            .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `comanda_id=eq.${comandaId}` }, () => { fetchDetails(); })
            .on("postgres_changes", { event: "*", schema: "public", table: "order_payments", filter: `comanda_id=eq.${comandaId}` }, (payload) => {
                // Refetch payments when updated
                fetchPixPayments();
                if (payload.new && (payload.new as any).status === 'paid') {
                    toast.success(`✅ PIX ${(payload.new as any).split_index}/${(payload.new as any).split_total} confirmado!`);
                    // Auto-advance to next split
                    setActivePixIndex(prev => Math.min(prev + 1, splitCount));
                }
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "comandas", filter: `id=eq.${comandaId}` }, () => { fetchDetails(); })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [store, comandaId, splitCount]);

    const fetchPixPayments = useCallback(async () => {
        if (!comandaId) return;
        const { data } = await supabase
            .from("order_payments")
            .select("*")
            .eq("comanda_id", comandaId)
            .eq("payment_method", "pix")
            .order("split_index");
        setPixPayments(data || []);
    }, [comandaId]);

    useEffect(() => {
        if (comandaId && paymentMethod === 'pix') fetchPixPayments();
    }, [comandaId, paymentMethod, fetchPixPayments]);

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

    const handleGeneratePix = async (splitIdx: number) => {
        if (!store || !comanda) return;
        setIsGeneratingPix(true);
        try {
            const subtotal = calculateSubtotal();
            const discountVal = Number(discount) || 0;
            const finalTotal = Math.max(0, subtotal - discountVal);
            const splitAmount = finalTotal / splitCount;
            console.log("Waiter PIX Stage 1: Attempting invoke...");
            const { data, error: invokeError } = await supabase.functions.invoke('pix-order-create', {
                body: {
                    store_id: store.id,
                    comanda_id: comanda.id,
                    order_id: orders[0]?.id || null,
                    amount: Number(splitAmount.toFixed(2)),
                    split_index: splitIdx,
                    split_total: splitCount,
                    description: `${store.name} - Mesa ${table?.name} - PIX`,
                }
            });

            if (!invokeError) {
                console.log("Waiter PIX Stage 1: Success");
            } else {
                console.warn("Waiter PIX Stage 1 failed:", invokeError);
                
                console.log("Waiter PIX Stage 2: Attempting direct fetch...");
                const baseUrl = import.meta.env.VITE_SUPABASE_URL;
                const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
                const { data: { session } } = await supabase.auth.getSession();

                const res = await fetch(`${baseUrl.replace(/\/$/, '')}/functions/v1/pix-order-create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': key,
                        'Authorization': `Bearer ${session?.access_token || key}`,
                    },
                    body: JSON.stringify({
                        store_id: store.id,
                        comanda_id: comanda.id,
                        order_id: orders[0]?.id || null,
                        amount: Number(splitAmount.toFixed(2)),
                        split_index: splitIdx,
                        split_total: splitCount,
                        description: `${store.name} - Mesa ${table?.name} - PIX`,
                    }),
                });

                if (!res.ok) {
                    const errorMsg = await res.text();
                    console.error("Waiter PIX Stage 2 failed:", res.status, errorMsg);
                    throw new Error(errorMsg || `Erro ${res.status}`);
                }
                console.log("Waiter PIX Stage 2: Success");
            }

            toast.success(`PIX ${splitIdx}/${splitCount} gerado!`);
            fetchPixPayments();
        } catch (error: any) {
            console.error("Waiter PIX Definitive Failure:", error);
            toast.error("Erro ao gerar PIX. Tente novamente.");
        } finally {
            setIsGeneratingPix(false);
        }
    };

    const handlePrintAction = async (mode: 'manual' | 'auto') => {
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
                <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:16px; border-top:1px solid #000; padding-top:4px; margin-top:4px">
                    <span>TOTAL</span>
                    <span>${formatCurrency(total)}</span>
                </div>
            </body></html>
        `;

        if (mode === 'auto') {
            const cashierPrinter = printerSettings.find(s => s.type === 'cashier');
            if (cashierPrinter) {
                await printerService.printHTML(cashierPrinter.identifier, html);
            } else {
                toast.error("Nenhuma impressora configurada. Use a impressão manual.");
            }
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
            if (paymentMethod === 'credito_caixa' || paymentMethod === 'debito_caixa') {
                const { error: notifyError } = await supabase
                    .from("order_payments")
                    .insert({
                        store_id: store!.id,
                        order_id: orders[0]?.id,
                        comanda_id: comanda.id,
                        payment_method: paymentMethod === 'credito_caixa' ? 'cartao_credito' : 'cartao_debito',
                        amount: finalTotal,
                        status: 'pending'
                    });
                if (notifyError) throw notifyError;
                toast.success("Caixa notificado! Aguarde a conclusão no balcão.");
                setCloseOpen(false);
                return;
            }

            // For PIX: check if all payments are confirmed
            if (paymentMethod === 'pix') {
                const allPaid = pixPayments.length > 0 && pixPayments.every(p => p.status === 'paid');
                if (!allPaid) {
                    toast.error("Aguarde a confirmação de todos os PIX antes de fechar a conta.");
                    setIsClosing(false);
                    return;
                }
            }

            const updateData: any = {
                status: "closed",
                subtotal: subtotal,
                discount: discountVal,
                total: finalTotal,
                payment_method: paymentMethod
            };

            try {
                const { error: comandaError } = await supabase
                    .from("comandas")
                    .update({ ...updateData, closed_at: new Date().toISOString() })
                    .eq("id", comanda.id);
                if (comandaError) {
                    if (comandaError.message.includes('closed_at')) {
                        const { error: retryError } = await supabase.from("comandas").update(updateData).eq("id", comanda.id);
                        if (retryError) throw retryError;
                    } else throw comandaError;
                }
            } catch (err: any) {
                throw new Error(`Erro ao atualizar comanda: ${err.message}`);
            }

            try {
                const { error: tableError } = await supabase.from("tables").update({ status: "available", current_comanda_id: null }).eq("id", comanda.table_id);
                if (tableError) {
                    await supabase.from("tables").update({ status: "available" }).eq("id", comanda.table_id);
                }
            } catch (err) { console.error("Unexpected error updating table:", err); }

            toast.success("Conta encerrada com sucesso!");
            navigate(explicitSlug ? "/garcom/mesas" : `/loja/${store?.slug}/garcom/mesas`);
        } catch (error: any) {
            console.error("Error closing bill:", error);
            toast.error(error.message || "Erro ao encerrar conta");
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
    const finalTotal = Math.max(0, subtotal - (Number(discount) || 0));
    const splitAmount = finalTotal / splitCount;

    // Static PIX fallback (when Mercado Pago is not configured)
    const pixPayload = store?.pix_key ? generatePixPayload({
        key: store.pix_key,
        name: store.name,
        city: store.city || '',
        amount: splitAmount,
        transactionId: comanda.id.split('-')[0].toUpperCase()
    }) : '';

    // Get payment for a specific split index
    const getPixForSplit = (idx: number) => pixPayments.find(p => p.split_index === idx);

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
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 shadow-sm">
                            <Printer className="w-4 h-4 mr-1" /> Imprimir <ChevronDown className="w-3 h-3 ml-1" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handlePrintAction('manual')}>
                            🖥️ Impressão Manual (Navegador)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePrintAction('auto')}>
                            🖨️ Impressão Automática (Impressora)
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </header>

            <main className="max-w-3xl mx-auto p-4 md:p-6 mt-2 space-y-6">

                {comanda.status === "closed" && (
                    <div className="bg-green-500/10 text-green-700 border border-green-500/20 p-4 rounded-xl flex items-center gap-3">
                        <CheckCircle2 className="w-6 h-6" />
                        <div>
                            <p className="font-bold">Comanda Encerrada</p>
                            <p className="text-sm">Total da conta: {formatCurrency(comanda.total)}</p>
                        </div>
                    </div>
                )}

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
                            <DialogContent className="sm:max-w-md max-h-[95vh] overflow-y-auto">
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
                                        <Input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.00" className="text-lg" />
                                    </div>

                                    <div className="space-y-3">
                                        <Label>Forma de Pagamento</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { id: 'dinheiro', label: 'Dinheiro', icon: '💵' },
                                                { id: 'pix', label: 'PIX', icon: '📱' },
                                                { id: 'credito_caixa', label: 'Cartão (No Caixa)', icon: '💳' },
                                                { id: 'debito_caixa', label: 'Débito (No Caixa)', icon: '💳' },
                                            ].map(method => (
                                                <Button
                                                    key={method.id}
                                                    variant={paymentMethod === method.id ? "hero" : "outline"}
                                                    className={`w-full text-xs font-bold leading-tight h-14 ${paymentMethod === method.id ? "ring-2 ring-primary ring-offset-2" : ""}`}
                                                    onClick={() => { setPaymentMethod(method.id); setPixPayments([]); }}
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
                                                <Input type="number" className="w-32 text-right font-bold" value={amountTendered} onChange={e => setAmountTendered(e.target.value)} placeholder="0.00" />
                                            </div>
                                            {Number(amountTendered) > finalTotal && (
                                                <div className="flex justify-between items-center text-green-600 font-bold">
                                                    <span>Troco:</span>
                                                    <span>{formatCurrency(Number(amountTendered) - finalTotal)}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {paymentMethod === 'pix' && (
                                        <div className="bg-muted/50 p-4 rounded-xl space-y-4 border border-border">
                                            {/* Split selector */}
                                            <div className="space-y-2">
                                                <Label>Dividir conta?</Label>
                                                <div className="flex items-center gap-3">
                                                    <Button variant="outline" size="icon" onClick={() => setSplitCount(Math.max(1, splitCount - 1))}>-</Button>
                                                    <span className="font-bold text-lg w-8 text-center">{splitCount}</span>
                                                    <Button variant="outline" size="icon" onClick={() => setSplitCount(splitCount + 1)}>+</Button>
                                                    <span className="text-xs text-muted-foreground ml-auto">pessoas</span>
                                                </div>
                                            </div>

                                            {/* PIX Payment Cards */}
                                            <div className="space-y-3 pt-2 border-t border-border/50">
                                                {Array.from({ length: splitCount }, (_, i) => i + 1).map(idx => {
                                                    const existingPix = getPixForSplit(idx);
                                                    const isPaid = existingPix?.status === 'paid';
                                                    const isPending = existingPix?.status === 'pending';
                                                    const isExpiredPix = existingPix?.expires_at && new Date(existingPix.expires_at) < new Date();

                                                    return (
                                                        <div key={idx} className={`rounded-lg border p-3 transition-all ${isPaid ? 'bg-green-50 border-green-200' : isPending ? 'bg-blue-50 border-blue-200' : 'bg-card border-border'}`}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="font-bold text-sm">
                                                                    PIX {idx}/{splitCount} — {formatCurrency(splitAmount)}
                                                                </span>
                                                                {isPaid && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ PAGO</span>}
                                                                {isPending && !isExpiredPix && <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full animate-pulse">⏳ AGUARDANDO</span>}
                                                                {isExpiredPix && !isPaid && <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">EXPIRADO</span>}
                                                            </div>

                                                            {isPaid ? (
                                                                <p className="text-xs text-green-600">Pagamento confirmado automaticamente!</p>
                                                            ) : isPending && !isExpiredPix && existingPix.pix_copia_cola ? (
                                                                <div className="space-y-2">
                                                                    <div className="bg-white p-2 rounded-lg w-36 h-36 mx-auto flex items-center justify-center border shadow-sm">
                                                                        <QRCodeSVG value={existingPix.pix_copia_cola} size={128} level="H" includeMargin />
                                                                    </div>
                                                                    <Button
                                                                        variant="outline" size="sm" className="w-full gap-2 text-xs h-8"
                                                                        onClick={() => { navigator.clipboard.writeText(existingPix.pix_copia_cola); toast.success("Código PIX copiado!"); }}
                                                                    >
                                                                        <Copy className="w-3 h-3" /> Copiar Copia e Cola
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <Button
                                                                    variant="outline" size="sm" className="w-full text-xs h-9"
                                                                    onClick={() => handleGeneratePix(idx)}
                                                                    disabled={isGeneratingPix || (idx > 1 && !getPixForSplit(idx - 1)?.status)}
                                                                >
                                                                    {isGeneratingPix ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : '📱'}
                                                                    {isExpiredPix ? 'Regerar PIX' : 'Gerar QR Code PIX'}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {splitCount > 1 && (
                                                <p className="text-center font-bold text-primary text-sm pt-1">
                                                    {formatCurrency(splitAmount)} por pessoa
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between p-4 bg-primary/10 rounded-xl border border-primary/20 text-primary">
                                        <span className="font-bold text-lg">{paymentMethod.includes('caixa') ? 'Total para Receber' : 'Total a Pagar'}</span>
                                        <span className="font-black text-2xl">{formatCurrency(finalTotal)}</span>
                                    </div>

                                    <Button
                                        className="w-full text-lg h-14"
                                        variant="hero"
                                        onClick={handleCloseBill}
                                        disabled={isClosing || (paymentMethod === 'pix' && pixPayments.length > 0 && !pixPayments.every(p => p.status === 'paid'))}
                                        style={{ backgroundColor: store?.primary_color }}
                                    >
                                        {isClosing ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                            <>
                                                {paymentMethod.includes('caixa') ? <Bell className="w-5 h-5 mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                                                {paymentMethod === 'pix' && pixPayments.length > 0 && pixPayments.every(p => p.status === 'paid')
                                                    ? "Encerrar Conta (PIX Confirmado)"
                                                    : paymentMethod.includes('caixa') ? "Notificar Caixa" : "Confirmar Recebimento"
                                                }
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
