import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, Clock, Truck, ChefHat, X, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusMap: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  confirmed: { label: "Confirmado", color: "bg-blue-100 text-blue-800", icon: Check },
  preparing: { label: "Preparando", color: "bg-orange-100 text-orange-800", icon: ChefHat },
  delivering: { label: "Saiu para entrega", color: "bg-purple-100 text-purple-800", icon: Truck },
  delivered: { label: "Entregue", color: "bg-green-100 text-green-800", icon: Check },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800", icon: X },
};

const nextStatus: Record<string, string> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "delivering",
  delivering: "delivered",
};

const Orders = () => {
  const { store } = useStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");

  const fetchOrders = async () => {
    if (!store) return;
    let query = supabase.from("orders").select("*").eq("store_id", store.id).order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    setOrders(data || []);
  };

  useEffect(() => { fetchOrders(); }, [store, filter]);

  // Realtime subscription
  useEffect(() => {
    if (!store) return;
    const channel = supabase
      .channel("orders-realtime")
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
        <p><strong>Obs:</strong> ${order.notes || "Nenhuma"}</p>
        <hr/>
        <div class="row"><span>Subtotal</span><span>R$ ${order.subtotal.toFixed(2)}</span></div>
        ${order.discount > 0 ? `<div class="row"><span>Desconto</span><span>-R$ ${order.discount.toFixed(2)}</span></div>` : ""}
        ${order.delivery_fee > 0 ? `<div class="row"><span>Entrega</span><span>R$ ${order.delivery_fee.toFixed(2)}</span></div>` : ""}
        <hr/>
        <div class="row total"><span>TOTAL</span><span>R$ ${order.total.toFixed(2)}</span></div>
        ${order.payment_method ? `<p><strong>Pagamento:</strong> ${order.payment_method}</p>` : ""}
      </body></html>
    `;
    const win = window.open("", "_blank", "width=320,height=600");
    if (win) {
      win.document.write(printContent);
      win.document.close();
      win.print();
    }
  };

  const filters = [
    { value: "all", label: "Todos" },
    { value: "pending", label: "Pendentes" },
    { value: "confirmed", label: "Confirmados" },
    { value: "preparing", label: "Preparando" },
    { value: "delivering", label: "Em entrega" },
    { value: "delivered", label: "Entregues" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Pedidos</h2>

      <div className="flex gap-2 flex-wrap mb-6">
        {filters.map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {orders.length === 0 && (
          <p className="text-muted-foreground text-center py-12">Nenhum pedido encontrado.</p>
        )}
        {orders.map((order) => {
          const st = statusMap[order.status] || statusMap.pending;
          const next = nextStatus[order.status];
          return (
            <div key={order.id} className="bg-card rounded-xl p-6 shadow-card border border-border/50">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-foreground">Pedido #{order.order_number}</h3>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${st.color}`}>{st.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <p className="text-xl font-bold text-primary">R$ {order.total.toFixed(2)}</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p className="font-medium text-foreground">{order.customer_name}</p>
                  <p className="text-muted-foreground">{order.customer_phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{order.delivery_type === "delivery" ? "Entrega" : "Retirada"}</p>
                  {order.delivery_type === "delivery" && (
                    <>
                      <p className="font-medium text-foreground">{order.customer_address}</p>
                      <p className="text-muted-foreground">{order.neighborhood}</p>
                    </>
                  )}
                </div>
              </div>

              {order.notes && (
                <div className="bg-muted/50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-muted-foreground"><strong>Obs:</strong> {order.notes}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {next && (
                  <Button variant="hero" size="sm" onClick={() => updateStatus(order.id, next)}>
                    Avançar para: {statusMap[next]?.label}
                  </Button>
                )}
                {order.status === "pending" && (
                  <Button variant="ghost" size="sm" onClick={() => updateStatus(order.id, "cancelled")} className="text-destructive">
                    Cancelar
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => handlePrint(order)}>
                  <Printer className="w-3 h-3 mr-1" /> Imprimir
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Orders;
