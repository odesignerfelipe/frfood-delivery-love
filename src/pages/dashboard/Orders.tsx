import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Clock, Check, ChefHat, Truck, X, Printer, GripVertical } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const columns = [
  { id: "pending", label: "Pendente", icon: Clock, color: "border-yellow-400 bg-yellow-50" },
  { id: "confirmed", label: "Confirmado", icon: Check, color: "border-blue-400 bg-blue-50" },
  { id: "preparing", label: "Preparando", icon: ChefHat, color: "border-orange-400 bg-orange-50" },
  { id: "delivering", label: "Em Entrega", icon: Truck, color: "border-purple-400 bg-purple-50" },
  { id: "delivered", label: "Entregue", icon: Check, color: "border-green-400 bg-green-50" },
];

const Orders = () => {
  const { store } = useStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, any[]>>({});

  const fetchOrders = async () => {
    if (!store) return;
    const { data } = await supabase.from("orders").select("*").eq("store_id", store.id).neq("status", "cancelled").order("created_at", { ascending: false });
    setOrders(data || []);
  };

  useEffect(() => { fetchOrders(); }, [store]);

  useEffect(() => {
    if (!store) return;
    const channel = supabase
      .channel("orders-kanban")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${store.id}` }, () => {
        fetchOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [store]);

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

  const handlePrint = (order: any) => {
    const printContent = `
      <html>
      <head><title>Pedido #${order.order_number}</title>
      <style>
        body { font-family: monospace; font-size: 12px; width: 280px; margin: 0 auto; padding: 10px; }
        h1 { font-size: 16px; text-align: center; margin-bottom: 5px; }
        hr { border: 1px dashed #000; }
        .row { display: flex; justify-content: space-between; }
        .total { font-size: 14px; font-weight: bold; }
      </style></head>
      <body>
        <h1>${store?.name}</h1>
        <p style="text-align:center">Pedido #${order.order_number}</p>
        <p style="text-align:center">${format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}</p>
        <hr/>
        <p><strong>Cliente:</strong> ${order.customer_name}</p>
        <p><strong>Tel:</strong> ${order.customer_phone}</p>
        ${order.delivery_type === "delivery" ? `<p><strong>Endereço:</strong> ${order.customer_address || ""}</p><p><strong>Bairro:</strong> ${order.neighborhood || ""}</p>` : "<p><strong>Retirada no local</strong></p>"}
        <hr/>
        <div class="row total"><span>TOTAL</span><span>R$ ${order.total.toFixed(2)}</span></div>
        ${order.payment_method ? `<p><strong>Pagamento:</strong> ${order.payment_method}</p>` : ""}
      </body></html>
    `;
    const win = window.open("", "_blank", "width=320,height=600");
    if (win) { win.document.write(printContent); win.document.close(); win.print(); }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Pedidos — Kanban</h2>

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
    </div>
  );
};

export default Orders;
