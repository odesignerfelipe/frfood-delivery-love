import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/hooks/useStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, TrendingUp, ShoppingBag, DollarSign, Package } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, endOfWeek, endOfMonth, endOfYear, subDays } from "date-fns";

const Reports = () => {
  const { store } = useStore();
  const [period, setPeriod] = useState("today");
  const [metrics, setMetrics] = useState({
    revenue: 0,
    orderCount: 0,
    ticketMedio: 0,
    topProducts: [] as { name: string, quantity: number, revenue: number }[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (store) {
      fetchMetrics();
    }
  }, [store, period]);

  const fetchMetrics = async () => {
    if (!store) return;
    setLoading(true);

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case "today":
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        break;
      case "yesterday":
        startDate = startOfDay(subDays(now, 1));
        endDate = endOfDay(subDays(now, 1));
        break;
      case "week":
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case "month":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case "year":
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      default:
        startDate = startOfDay(now);
        endDate = endOfDay(now);
    }

    try {
      // Fetch Orders
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, total, status")
        .eq("store_id", store.id)
        .in("status", ["delivered", "picked_up"]) // Only consider completed orders
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (ordersError) throw ordersError;

      const revenue = (orders || []).reduce((sum, order) => sum + Number(order.total), 0);
      const orderCount = (orders || []).length;
      const ticketMedio = orderCount > 0 ? revenue / orderCount : 0;

      // Ensure we have order IDs before querying order_items
      const orderIds = (orders || []).map(o => o.id);
      let topProducts: { name: string, quantity: number, revenue: number }[] = [];

      if (orderIds.length > 0) {
        // Fetch Order Items for the closed orders to calculate top products
        const { data: orderItems, error: itemsError } = await supabase
          .from("order_items")
          .select("quantity, unit_price, product:products(name)")
          .in("order_id", orderIds);

        if (itemsError) throw itemsError;

        // Aggregate products
        const productMap: Record<string, { quantity: number, revenue: number }> = {};
        (orderItems || []).forEach((item: any) => {
          const productName = item.product?.name || "Produto Removido";
          if (!productMap[productName]) {
            productMap[productName] = { quantity: 0, revenue: 0 };
          }
          productMap[productName].quantity += item.quantity;
          productMap[productName].revenue += (item.quantity * Number(item.unit_price));
        });

        // Sort by quantity sold
        topProducts = Object.entries(productMap)
          .map(([name, stats]) => ({ name, ...stats }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 10); // get top 10
      }

      setMetrics({ revenue, orderCount, ticketMedio, topProducts });
    } catch (err) {
      console.error("Error fetching metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground mt-1">Visão geral do desempenho da sua loja</p>
        </div>

        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px] bg-card border-border shadow-sm">
            <SelectValue placeholder="Selecione o período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="yesterday">Ontem</SelectItem>
            <SelectItem value="week">Esta Semana</SelectItem>
            <SelectItem value="month">Este Mês</SelectItem>
            <SelectItem value="year">Este Ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-card rounded-2xl animate-pulse border border-border" />
          ))}
        </div>
      ) : (
        <>
          {/* Main KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="shadow-sm border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Total</CardTitle>
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-foreground">{formatCurrency(metrics.revenue)}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  Pedidos faturados e concluídos
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pedidos Concluídos</CardTitle>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-foreground">{metrics.orderCount}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  entregues ou retirados
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Médio</CardTitle>
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-foreground">{formatCurrency(metrics.ticketMedio)}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  Média por pedido
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Top Products */}
          <Card className="shadow-sm border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Produtos Mais Vendidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.topProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
                  Nenhuma venda registrada neste período.
                </div>
              ) : (
                <div className="space-y-4">
                  {metrics.topProducts.map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-amber-100 text-amber-700' :
                            index === 1 ? 'bg-slate-200 text-slate-700' :
                              index === 2 ? 'bg-orange-100 text-orange-700' :
                                'bg-muted text-muted-foreground'
                          }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-bold text-foreground text-sm">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.quantity} unidades vendidas</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{formatCurrency(product.revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Reports;
