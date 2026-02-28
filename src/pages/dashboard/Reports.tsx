import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/hooks/useStore";
import { BarChart3, TrendingUp, DollarSign, ShoppingBag } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";

const Reports = () => {
  const { store } = useStore();
  const [period, setPeriod] = useState(7);
  const [data, setData] = useState<{ date: string; orders: number; revenue: number }[]>([]);
  const [totals, setTotals] = useState({ orders: 0, revenue: 0, avgTicket: 0 });

  useEffect(() => {
    if (!store) return;
    const fetchData = async () => {
      const since = subDays(new Date(), period).toISOString();
      const { data: orders } = await supabase
        .from("orders")
        .select("created_at, total, status")
        .eq("store_id", store.id)
        .gte("created_at", since)
        .neq("status", "cancelled");

      if (!orders) return;

      const byDay: Record<string, { orders: number; revenue: number }> = {};
      for (let i = 0; i < period; i++) {
        const d = format(subDays(new Date(), i), "yyyy-MM-dd");
        byDay[d] = { orders: 0, revenue: 0 };
      }

      orders.forEach((o) => {
        const d = format(new Date(o.created_at), "yyyy-MM-dd");
        if (byDay[d]) {
          byDay[d].orders++;
          byDay[d].revenue += o.total || 0;
        }
      });

      const chartData = Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({ date: format(new Date(date + "T12:00:00"), "dd/MM"), ...vals }));

      setData(chartData);

      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
      setTotals({
        orders: totalOrders,
        revenue: totalRevenue,
        avgTicket: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      });
    };
    fetchData();
  }, [store, period]);

  const periods = [
    { value: 7, label: "7 dias" },
    { value: 15, label: "15 dias" },
    { value: 30, label: "30 dias" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Relatórios</h2>
        <div className="flex gap-2">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === p.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-xl p-6 shadow-card border border-border/50">
          <ShoppingBag className="w-6 h-6 text-primary mb-2" />
          <p className="text-2xl font-bold text-foreground">{totals.orders}</p>
          <p className="text-sm text-muted-foreground">Pedidos no período</p>
        </div>
        <div className="bg-card rounded-xl p-6 shadow-card border border-border/50">
          <DollarSign className="w-6 h-6 text-primary mb-2" />
          <p className="text-2xl font-bold text-foreground">R$ {totals.revenue.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">Faturamento</p>
        </div>
        <div className="bg-card rounded-xl p-6 shadow-card border border-border/50">
          <TrendingUp className="w-6 h-6 text-primary mb-2" />
          <p className="text-2xl font-bold text-foreground">R$ {totals.avgTicket.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">Ticket médio</p>
        </div>
      </div>

      <div className="bg-card rounded-xl p-6 shadow-card border border-border/50">
        <h3 className="font-bold text-foreground mb-4">Pedidos por dia</h3>
        <div className="space-y-2">
          {data.map((d) => (
            <div key={d.date} className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-12">{d.date}</span>
              <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                <div
                  className="h-full gradient-hero rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                  style={{ width: `${Math.max(data.length > 0 ? (d.orders / Math.max(...data.map((x) => x.orders), 1)) * 100 : 0, 8)}%` }}
                >
                  <span className="text-xs text-primary-foreground font-bold">{d.orders}</span>
                </div>
              </div>
              <span className="text-sm font-medium text-foreground w-24 text-right">R$ {d.revenue.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Reports;
