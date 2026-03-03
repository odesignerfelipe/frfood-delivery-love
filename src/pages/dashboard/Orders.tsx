import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Clock, Check, ChefHat, Truck, X, Printer, GripVertical } from "lucide-react";
import { format, isToday, isThisWeek, isThisMonth, isThisYear, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const columns = [
  { id: "pending", label: "Pendente", icon: Clock, color: "border-yellow-400 bg-yellow-50" },
  { id: "confirmed", label: "Confirmado", icon: Check, color: "border-blue-400 bg-blue-50" },
  { id: "preparing", label: "Preparando", icon: ChefHat, color: "border-orange-400 bg-orange-50" },
  { id: "delivering", label: "Em Entrega", icon: Truck, color: "border-purple-400 bg-purple-50" },
  { id: "delivered", label: "Entregue", icon: Check, color: "border-green-400 bg-green-50" },
  { id: "cancelled", label: "Cancelado", icon: X, color: "border-red-400 bg-red-50" },
];

const Orders = () => {
  const { store } = useStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, any[]>>({});
  const [viewMode, setViewMode] = useState<"kanban" | "history">("kanban");
  const [historyFilter, setHistoryFilter] = useState<"today" | "week" | "month" | "year" | "all">("today");

  const fetchOrders = useCallback(async () => {
    if (!store) return;
    const { data } = await supabase.from("orders").select("*").eq("store_id", store.id).order("created_at", { ascending: false });
    setOrders(data || []);
  }, [store]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!store) return;
    const channel = supabase
      .channel("orders-kanban")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${store.id}` }, () => {
        fetchOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [store, fetchOrders]);

  const updateStatus = async (orderId: string, status: string) => {
    await supabase.from("orders").update({ status }).eq("id", orderId);
    toast.success("Status atualizado!");
    fetchOrders();
  };

  const cancelOrder = async (orderId: string) => {
    if (!confirm("Cancelar este pedido?")) return;
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId);
    toast.success("Pedido cancelado");
    fetchOrders();
  };

  const fetchItems = async (orderId: string) => {
    if (orderItems[orderId]) return;
    const { data } = await supabase.from("order_items").select("*").eq("order_id", orderId);
    setOrderItems((prev) => ({ ...prev, [orderId]: data || [] }));
  };

  const toggleExpand = (orderId: string) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
    } else {
      setExpandedOrder(orderId);
      fetchItems(orderId);
    }
  };

  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    setDragging(orderId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", orderId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData("text/plain");
    if (!orderId) return;
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status === targetStatus) {
      setDragging(null);
      return;
    }
    await updateStatus(orderId, targetStatus);
    setDragging(null);
  };

  const handlePrint = async (order: any) => {
    // We need the items to print properly
    let itemsToPrint = orderItems[order.id];
    if (!itemsToPrint) {
      const { data } = await supabase.from("order_items").select("*").eq("order_id", order.id);
      itemsToPrint = data || [];
      setOrderItems((prev) => ({ ...prev, [order.id]: data || [] }));
    }

    const paymentLabels: Record<string, string> = {
      pix: "PIX",
      dinheiro: "Dinheiro",
      cartao_credito: "Cartão de Crédito",
      cartao_debito: "Cartão de Débito",
    };
    const paymentLabel = order.payment_method ? (paymentLabels[order.payment_method] || order.payment_method.toUpperCase()) : "";

    const printContent = `
      <html>
      <head><title>Pedido #${order.order_number}</title>
      <style>
        body { font-family: 'Courier New', Courier, monospace; font-size: 13px; width: 300px; margin: 0 auto; padding: 10px; color: #000; }
        h1 { font-size: 18px; text-align: center; margin-bottom: 5px; text-transform: uppercase; }
        hr { border: none; border-top: 1px dashed #000; margin: 10px 0; }
        .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
        .total { font-size: 16px; font-weight: bold; margin-top: 5px; padding-top: 5px; border-top: 2px solid #000; }
        .text-center { text-align: center; }
        .item-row { margin-bottom: 4px; }
        .item-line { display: flex; justify-content: space-between; }
        .item-name { flex: 1; padding-right: 10px; }
        .item-note { font-size: 11px; color: #555; margin-left: 16px; font-style: italic; }
      </style></head>
      <body>
        <h1>${store?.name}</h1>
        <p class="text-center">PEDIDO #${order.order_number}</p>
        <p class="text-center">${format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}</p>
        <hr/>
        <p><strong>CLIENTE:</strong> ${order.customer_name}</p>
        <p><strong>TELEFONE:</strong> ${order.customer_phone}</p>
        ${order.delivery_type === "delivery"
        ? `<p><strong>ENDEREÇO:</strong> ${order.customer_address || ""}</p><p><strong>BAIRRO:</strong> ${order.neighborhood || ""}</p>`
        : "<p><strong>🏪 RETIRADA NO LOCAL</strong></p>"}
        <hr/>
        <p><strong>ITENS DO PEDIDO:</strong></p>
        ${itemsToPrint.map((item: any) => `
          <div class="item-row">
            <div class="item-line">
              <span class="item-name">${item.quantity}x ${item.product_name}</span>
              <span>R$ ${item.subtotal.toFixed(2)}</span>
            </div>
            ${item.notes ? `<div class="item-note">Obs: ${item.notes}</div>` : ""}
          </div>
        `).join('')}
        ${order.notes ? `
          <hr/>
          <p><strong>OBSERVAÇÕES DO PEDIDO:</strong></p>
          <p>${order.notes}</p>
        ` : ""}
        <hr/>
        <div class="row"><span>Subtotal</span><span>R$ ${order.subtotal.toFixed(2)}</span></div>
        ${order.discount > 0 ? `<div class="row"><span>Desconto</span><span>-R$ ${order.discount.toFixed(2)}</span></div>` : ""}
        ${order.delivery_type === "delivery"
        ? `<div class="row"><span>Taxa de Entrega</span><span>R$ ${(order.delivery_fee || 0).toFixed(2)}</span></div>`
        : `<div class="row"><span>Retirada no Local</span><span>R$ 0,00</span></div>`}
        <div class="row total"><span>TOTAL</span><span>R$ ${order.total.toFixed(2)}</span></div>
        ${paymentLabel ? `<p><strong>PAGAMENTO:</strong> ${paymentLabel}</p>` : ""}
      </body></html>
    `;
    const win = window.open("", "_blank", "width=350,height=600");
    if (win) { win.document.write(printContent); win.document.close(); win.print(); }
  };

  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredHistory = orders.filter((o) => {
    const date = new Date(o.created_at);
    const matchesDate = () => {
      if (historyFilter === "today") return isToday(date);
      if (historyFilter === "week") return isThisWeek(date, { locale: ptBR });
      if (historyFilter === "month") return isThisMonth(date);
      if (historyFilter === "year") return isThisYear(date);
      return true;
    };

    const matchesStatus = () => {
      if (statusFilter === "all") return true;
      if (statusFilter === "completed") return o.status === "delivered";
      if (statusFilter === "cancelled") return o.status === "cancelled";
      return o.status === statusFilter;
    };

    return matchesDate() && matchesStatus();
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-foreground">Pedidos</h2>
        <div className="flex bg-muted rounded-lg p-1">
          <button
            onClick={() => setViewMode("kanban")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "kanban" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Kanban Visual
          </button>
          <button
            onClick={() => setViewMode("history")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "history" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Histórico & Lista
          </button>
        </div>
      </div>

      {viewMode === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "70vh" }}>
          {columns.map((col) => {
            const colOrders = orders.filter((o) => o.status === col.id);
            return (
              <div
                key={col.id}
                className={`flex-shrink-0 w-72 rounded-xl border-t-4 ${col.color} bg-card/50 flex flex-col`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                <div className="p-3 border-b border-border flex items-center gap-2">
                  <col.icon className="w-4 h-4" />
                  <span className="font-bold text-foreground text-sm">{col.label}</span>
                  <span className="ml-auto text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">{colOrders.length}</span>
                </div>

                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {colOrders.map((order) => (
                    <div
                      key={order.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, order.id)}
                      className={`bg-card rounded-lg border border-border shadow-sm cursor-grab active:cursor-grabbing transition-opacity ${dragging === order.id ? "opacity-50" : ""}`}
                    >
                      <div className="p-3" onClick={() => toggleExpand(order.id)}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-foreground">#{order.order_number}</span>
                          <span className="text-xs text-muted-foreground">{format(new Date(order.created_at), "HH:mm")}</span>
                        </div>
                        <p className="text-sm text-foreground">{order.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground">
                            {order.delivery_type === "delivery" ? `📍 ${order.neighborhood || "Entrega"}` : "🏪 Retirada"}
                          </span>
                          <span className="text-sm font-bold text-primary">R$ {order.total.toFixed(2)}</span>
                        </div>
                      </div>

                      {expandedOrder === order.id && (
                        <div className="px-3 pb-3 border-t border-border pt-2 space-y-2">
                          {order.customer_address && (
                            <p className="text-xs text-muted-foreground">📍 {order.customer_address}</p>
                          )}
                          {order.notes && (
                            <p className="text-xs text-muted-foreground">📝 {order.notes}</p>
                          )}
                          {order.payment_method && (
                            <p className="text-xs text-muted-foreground">💳 {order.payment_method}</p>
                          )}

                          {orderItems[order.id] && (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-foreground">Itens:</p>
                              {orderItems[order.id].map((item: any) => (
                                <p key={item.id} className="text-xs text-muted-foreground">
                                  {item.quantity}x {item.product_name} — R$ {item.subtotal.toFixed(2)}
                                </p>
                              ))}
                            </div>
                          )}

                          <div className="flex gap-1 flex-wrap pt-1">
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); handlePrint(order); }}>
                              <Printer className="w-3 h-3 mr-1" /> Imprimir
                            </Button>
                            {col.id === "pending" && (
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={(e) => { e.stopPropagation(); cancelOrder(order.id); }}>
                                <X className="w-3 h-3 mr-1" /> Cancelar
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {colOrders.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">Nenhum pedido</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border/50 shadow-card overflow-hidden">
          <div className="p-4 border-b border-border flex flex-col gap-4 bg-muted/20">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm font-medium mr-2">Filtro de Período:</span>
              {[
                { id: "today", label: "Hoje" },
                { id: "week", label: "Esta Semana" },
                { id: "month", label: "Este Mês" },
                { id: "year", label: "Este Ano" },
                { id: "all", label: "Todo o Histórico" }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setHistoryFilter(f.id as any)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${historyFilter === f.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm font-medium mr-2">Categoria:</span>
              {[
                { id: "all", label: "Todos" },
                { id: "completed", label: "Concluídos" },
                { id: "cancelled", label: "Cancelados" },
                { id: "pending", label: "Pendentes" },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${statusFilter === f.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                <tr>
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Data/Hora</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((order) => {
                  const statusInfo = columns.find(c => c.id === order.status) || columns[0];
                  return (
                    <tr key={order.id} className="border-b border-border hover:bg-muted/20">
                      <td className="px-4 py-3 font-bold">#{order.order_number}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}</td>
                      <td className="px-4 py-3">{order.customer_name}</td>
                      <td className="px-4 py-3">
                        <span className="bg-muted px-2 py-1 rounded-full text-xs">
                          {order.delivery_type === "delivery" ? "Entrega" : "Retirada"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-primary">R$ {order.total.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs border ${statusInfo.color.split(' ')[0]} ${statusInfo.color.split(' ')[1]} text-foreground`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handlePrint(order)}>
                          <Printer className="w-3 h-3 mr-1" /> Imprimir
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredHistory.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum pedido encontrado para o período selecionado.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
