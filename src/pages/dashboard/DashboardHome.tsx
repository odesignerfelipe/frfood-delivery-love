import { useStore } from "@/hooks/useStore";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, Package, DollarSign, TrendingUp } from "lucide-react";

const DashboardHome = () => {
  const { store } = useStore();
  const [stats, setStats] = useState({ orders: 0, products: 0, revenue: 0, todayOrders: 0 });

  useEffect(() => {
    if (!store) return;
    const fetchStats = async () => {
      const [ordersRes, productsRes, todayRes] = await Promise.all([
        supabase.from("orders").select("id, total").eq("store_id", store.id),
        supabase.from("products").select("id").eq("store_id", store.id),
        supabase.from("orders").select("id, total").eq("store_id", store.id).gte("created_at", new Date().toISOString().split("T")[0]),
      ]);
      setStats({
        orders: ordersRes.data?.length || 0,
        products: productsRes.data?.length || 0,
        revenue: ordersRes.data?.reduce((s, o) => s + (o.total || 0), 0) || 0,
        todayOrders: todayRes.data?.length || 0,
      });
    };
    fetchStats();
  }, [store]);

  const cards = [
    { label: "Pedidos Hoje", value: stats.todayOrders, icon: ShoppingBag, color: "text-primary" },
    { label: "Total de Pedidos", value: stats.orders, icon: TrendingUp, color: "text-primary" },
    { label: "Produtos", value: stats.products, icon: Package, color: "text-primary" },
    { label: "Faturamento", value: `R$ ${stats.revenue.toFixed(2)}`, icon: DollarSign, color: "text-primary" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Painel</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-card rounded-xl p-6 shadow-card border border-border/50">
            <div className="flex items-center justify-between mb-4">
              <card.icon className={`w-6 h-6 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
            <p className="text-sm text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardHome;
