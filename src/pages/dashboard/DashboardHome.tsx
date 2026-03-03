import { useStore } from "@/hooks/useStore";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, Package, DollarSign, TrendingUp, Bell, Plus, Eye, Pencil, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { checkStoreStatus } from "@/lib/utils";

const DashboardHome = () => {
  const { store, updateStore } = useStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ orders: 0, products: 0, revenue: 0, todayOrders: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [toggling, setToggling] = useState(false);
  const isOpenNow = checkStoreStatus(store);


  useOrderNotifications(store?.id, (store as any)?.audio_notifications !== false);

  const fetchStats = useCallback(async () => {
    if (!store) return;
    const [ordersRes, productsRes, todayRes, recentRes] = await Promise.all([
      supabase.from("orders").select("id, total").eq("store_id", store.id),
      supabase.from("products").select("id").eq("store_id", store.id),
      supabase.from("orders").select("id, total").eq("store_id", store.id).gte("created_at", new Date().toISOString().split("T")[0]),
      supabase.from("orders").select("*").eq("store_id", store.id).order("created_at", { ascending: false }).limit(10),
    ]);
    setStats({
      orders: ordersRes.data?.length || 0,
      products: productsRes.data?.length || 0,
      revenue: ordersRes.data?.reduce((s, o) => s + (o.total || 0), 0) || 0,
      todayOrders: todayRes.data?.length || 0,
    });
    setRecentOrders(recentRes.data || []);
  }, [store]);

  useEffect(() => {
    fetchStats();

    if (!store) return;
    // Re-fetch stats on new orders
    const channel = supabase
      .channel("dashboard-stats-refresh")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `store_id=eq.${store.id}` }, () => {
        fetchStats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [store, fetchStats]);

  const toggleStore = async () => {
    if (!store) return;
    setToggling(true);
    const newIsOpen = !store.is_open;
    const newStatusMode = newIsOpen ? "manual_open" : "manual_closed";

    const { error } = await updateStore({
      is_open: newIsOpen,
      status_mode: newStatusMode
    } as any);

    if (error) {
      toast.error("Erro ao alterar status");
    } else {
      toast.success(store.is_open ? "Loja fechada!" : "Loja aberta!");
    }
    setToggling(false);
  };

  const statusLabels: Record<string, string> = {
    pending: "Pendente",
    confirmed: "Confirmado",
    preparing: "Preparando",
    delivering: "Em entrega",
    delivered: "Entregue",
    cancelled: "Cancelado",
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    preparing: "bg-orange-100 text-orange-800",
    delivering: "bg-purple-100 text-purple-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  const statCards = [
    { label: "Pedidos Hoje", value: stats.todayOrders, icon: ShoppingBag },
    { label: "Total de Pedidos", value: stats.orders, icon: TrendingUp },
    { label: "Produtos", value: stats.products, icon: Package },
    { label: "Faturamento", value: `R$ ${stats.revenue.toFixed(2)}`, icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Painel</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-card rounded-xl px-4 py-2 border border-border/50 shadow-card">
            <Power className={`w-4 h-4 ${isOpenNow ? "text-green-500" : "text-destructive"}`} />
            <span className="text-sm font-medium text-foreground">{isOpenNow ? "Aberta" : "Fechada"}</span>
            <Switch checked={isOpenNow} onCheckedChange={toggleStore} disabled={toggling} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-card rounded-xl p-6 shadow-card border border-border/50">
            <div className="flex items-center justify-between mb-4">
              <card.icon className="w-6 h-6 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
            <p className="text-sm text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        <button onClick={() => navigate("/dashboard/products")} className="bg-card rounded-xl p-5 shadow-card border border-border/50 hover:shadow-card-hover transition-shadow text-left group">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
            <Plus className="w-5 h-5 text-primary" />
          </div>
          <p className="font-bold text-foreground">Cadastrar Produto</p>
          <p className="text-sm text-muted-foreground">Adicione novos itens ao cardápio</p>
        </button>
        <button onClick={() => navigate("/dashboard/orders")} className="bg-card rounded-xl p-5 shadow-card border border-border/50 hover:shadow-card-hover transition-shadow text-left group">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
            <Eye className="w-5 h-5 text-primary" />
          </div>
          <p className="font-bold text-foreground">Ver Pedidos</p>
          <p className="text-sm text-muted-foreground">Gerencie pedidos no kanban</p>
        </button>
        <button onClick={() => navigate("/dashboard/store")} className="bg-card rounded-xl p-5 shadow-card border border-border/50 hover:shadow-card-hover transition-shadow text-left group">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
            <Pencil className="w-5 h-5 text-primary" />
          </div>
          <p className="font-bold text-foreground">Configurações</p>
          <p className="text-sm text-muted-foreground">Personalize sua loja</p>
        </button>
      </div>

      {/* Notifications / Recent Orders */}
      <div className="bg-card rounded-xl shadow-card border border-border/50">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-foreground">Pedidos Recentes</h3>
        </div>
        <div className="divide-y divide-border">
          {recentOrders.length === 0 && (
            <p className="text-muted-foreground text-center py-8">Nenhum pedido ainda. Compartilhe sua loja!</p>
          )}
          {recentOrders.map((order) => (
            <div key={order.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate("/dashboard/orders")}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Pedido #{order.order_number} — {order.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(order.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[order.status] || ""}`}>
                  {statusLabels[order.status] || order.status}
                </span>
                <span className="text-sm font-bold text-primary">R$ {order.total.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
