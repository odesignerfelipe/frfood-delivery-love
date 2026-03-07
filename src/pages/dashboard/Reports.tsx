import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/hooks/useStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, ShoppingBag, DollarSign, Package, AlertTriangle, Users, Download, Printer, Medal, UserCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, endOfWeek, endOfMonth, endOfYear, subDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell, PieChart, Pie } from "recharts";
import { toast } from "sonner";

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6', '#f43f5e', '#84cc16', '#6366f1', '#ec4899'];

const Reports = () => {
  const { store } = useStore();
  const [period, setPeriod] = useState("today");
  const [metrics, setMetrics] = useState({
    revenue: 0,
    orderCount: 0,
    ticketMedio: 0,
    topProducts: [] as { name: string, quantity: number, revenue: number }[],
    leastSoldProducts: [] as { name: string, quantity: number, revenue: number }[],
    topCustomers: [] as { name: string, phone: string, orders: number, total: number }[],
    waiterMetrics: [] as { name: string, orders: number, revenue: number }[],
    chartData: [] as { label: string, amount: number }[],
  });
  const [loading, setLoading] = useState(true);

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
      // Fetch Orders with Customer and Waiter info
      const { data: orders, error: ordersError } = await processOrdersQuery(startDate, endDate);
      if (ordersError) throw ordersError;

      const revenue = (orders || []).reduce((sum, order) => sum + Number(order.total), 0);
      const orderCount = (orders || []).length;
      const ticketMedio = orderCount > 0 ? revenue / orderCount : 0;

      // Ensure we have order IDs before querying order_items
      const orderIds = (orders || []).map(o => o.id);
      let topProducts: any[] = [];
      let leastSoldProducts: any[] = [];

      // Calculate Chart Data (Timeline)
      const chartDataMap: Record<string, number> = {};

      // Calculate Top Customers
      const customersMap: Record<string, { phone: string, orders: number, total: number }> = {};

      // Calculate Waiter Metrics
      const waiterMap: Record<string, { orders: number, revenue: number }> = {};

      (orders || []).forEach(order => {
        // Chart Data (Group by hour if today/yesterday, otherwise by day/month)
        const dateObj = new Date(order.created_at);
        let dateLabel = "";
        if (period === "today" || period === "yesterday") {
          dateLabel = format(dateObj, "HH:mm");
        } else if (period === "year") {
          dateLabel = format(dateObj, "MMM", { locale: ptBR });
        } else {
          dateLabel = format(dateObj, "dd/MM");
        }

        chartDataMap[dateLabel] = (chartDataMap[dateLabel] || 0) + Number(order.total);

        // Top Customers
        const custName = order.customer_name || "Cliente Avulso";
        const custPhone = order.customer_phone || "-";
        if (custName !== "Cliente Avulso") {
          if (!customersMap[custName]) customersMap[custName] = { phone: custPhone, orders: 0, total: 0 };
          customersMap[custName].orders += 1;
          customersMap[custName].total += Number(order.total);
        }

        // Waiter Metrics
        if (order.waiter_id && order.waiter) {
          const waiterName = order.waiter.name;
          if (!waiterMap[waiterName]) waiterMap[waiterName] = { orders: 0, revenue: 0 };
          waiterMap[waiterName].orders += 1;
          waiterMap[waiterName].revenue += Number(order.total);
        }
      });

      const chartData = Object.entries(chartDataMap).map(([label, amount]) => ({ label, amount }));

      const topCustomers = Object.entries(customersMap)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      const waiterMetrics = Object.entries(waiterMap)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.revenue - a.revenue);

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

        const allProducts = Object.entries(productMap)
          .map(([name, stats]) => ({ name, ...stats }));

        // Sort by quantity sold
        topProducts = [...allProducts].sort((a, b) => b.quantity - a.quantity).slice(0, 10);

        // Least sold (but excluding 0 since they wouldn't be in the order_items)
        leastSoldProducts = [...allProducts].sort((a, b) => a.quantity - b.quantity).slice(0, 5);
      }

      setMetrics({
        revenue, orderCount, ticketMedio,
        topProducts, leastSoldProducts,
        topCustomers, waiterMetrics,
        chartData
      });
    } catch (err) {
      console.error("Error fetching metrics:", err);
      toast.error("Erro ao carregar relatórios.");
    } finally {
      setLoading(false);
    }
  };

  const processOrdersQuery = async (startDate: Date, endDate: Date) => {
    return supabase
      .from("orders")
      .select("id, total, status, created_at, customer_name, customer_phone, waiter_id, waiter:waiters(name)")
      .eq("store_id", store?.id)
      .in("status", ["delivered", "picked_up"]) // Only consider completed orders
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: true });
  }

  useEffect(() => {
    if (store) {
      fetchMetrics();
    }
  }, [store, period]);

  // Real-time listener for new completed orders to refresh reports automatically
  useEffect(() => {
    if (!store) return;
    const channel = supabase
      .channel("reports-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `store_id=eq.${store.id}` }, (payload: any) => {
        if (payload.new && (payload.new.status === "delivered" || payload.new.status === "picked_up")) {
          fetchMetrics();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [store, period]);

  const handleExportCSV = () => {
    if (!metrics.topProducts || metrics.topProducts.length === 0) {
      toast.error("Não há dados suficientes para exportar.");
      return;
    }

    const rows = [];

    // Header Info
    rows.push(["Relatorio Financeiro", store?.name]);
    rows.push(["Periodo", period]);
    rows.push(["Faturamento Total", formatCurrency(metrics.revenue)]);
    rows.push(["Pedidos Concluidos", metrics.orderCount]);
    rows.push(["Ticket Medio", formatCurrency(metrics.ticketMedio)]);
    rows.push([]);

    // Top Products
    rows.push(["--- TOP PRODUTOS MAIS VENDIDOS ---"]);
    rows.push(["Posicao", "Produto", "Qtd Vendida", "Faturamento"]);
    metrics.topProducts.forEach((p, i) => {
      rows.push([i + 1, p.name, p.quantity, p.revenue]);
    });
    rows.push([]);

    // Top Customers
    rows.push(["--- TOP CLIENTES ---"]);
    rows.push(["Posicao", "Nome", "Telefone", "Pedidos", "Total Gasto"]);
    metrics.topCustomers.forEach((c, i) => {
      rows.push([i + 1, c.name, c.phone, c.orders, c.total]);
    });
    rows.push([]);

    // Waiters
    rows.push(["--- DESEMPENHO DE GARCONS ---"]);
    rows.push(["Garcom", "Pedidos Atendidos", "Faturamento Gerado"]);
    metrics.waiterMetrics.forEach((w) => {
      rows.push([w.name, w.orders, w.revenue]);
    });

    // Create CSV Output
    const csvContent = rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_${store?.name.replace(/\s+/g, "_")}_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-8 space-y-8 pb-24 print:p-0 print:m-0 print:space-y-4">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Relatórios Financeiros</h1>
          <p className="text-muted-foreground mt-1">Indicadores e gráficos de desempenho em tempo real</p>
        </div>

        <div className="flex items-center gap-3 print:hidden">
          <Button variant="outline" onClick={handleExportCSV} className="border-border">
            <Download className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
          <Button variant="outline" onClick={handlePrint} className="border-border hidden sm:flex">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir / PDF
          </Button>

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
            <Card className="shadow-sm border-border print:shadow-none print:border-foreground/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Total</CardTitle>
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center print:hidden">
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

            <Card className="shadow-sm border-border print:shadow-none print:border-foreground/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pedidos Concluídos</CardTitle>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center print:hidden">
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

            <Card className="shadow-sm border-border print:shadow-none print:border-foreground/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Médio</CardTitle>
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center print:hidden">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-foreground">{formatCurrency(metrics.ticketMedio)}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  Média de valor por pedido
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Chart Section */}
          <Card className="shadow-sm border-border col-span-1 print:break-inside-avoid">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Tendência de Faturamento
              </CardTitle>
              <CardDescription>O volume de vendas baseado no período selecionado.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full mt-4">
                {metrics.chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
                    Sem dados para exibir o gráfico.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(value) => `R$${value}`} dx={-10} />
                      <RechartsTooltip
                        formatter={(value: number) => [formatCurrency(value), "Faturamento"]}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Top Products */}
            <Card className="shadow-sm border-border print:break-inside-avoid">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-500" />
                  Top 10 Produtos Mais Vendidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.topProducts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
                    Nenhuma venda registrada neste período.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {metrics.topProducts.map((product, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-amber-100 text-amber-700 shadow-sm' :
                              index === 1 ? 'bg-slate-200 text-slate-700 shadow-sm' :
                                index === 2 ? 'bg-orange-100 text-orange-700 shadow-sm' :
                                  'bg-muted text-muted-foreground'
                            }`}>
                            {index === 0 ? <Medal className="w-4 h-4" /> : index + 1}
                          </div>
                          <div>
                            <p className="font-bold text-foreground text-sm">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.quantity} unidades vendidas</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600">{formatCurrency(product.revenue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Least Sold Products */}
            <Card className="shadow-sm border-border print:break-inside-avoid">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Produtos Menos Vendidos (Atenção)
                </CardTitle>
                <CardDescription>Produtos que tiveram menor saída baseados nas vendas do período.</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.leastSoldProducts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
                    Nenhuma venda registrada.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {metrics.leastSoldProducts.map((product, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-orange-50/50 border border-orange-100">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-bold text-foreground text-sm">{product.name}</p>
                            <p className="text-xs text-orange-600/80 font-medium">Apenas {product.quantity} un. vendidas</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-muted-foreground">{formatCurrency(product.revenue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Customers */}
            <Card className="shadow-sm border-border print:break-inside-avoid">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  Ranking de Clientes (Top 10)
                </CardTitle>
                <CardDescription>Clientes que mais geraram receita no período selecionado.</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.topCustomers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
                    Sem dados de clientes ainda.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {metrics.topCustomers.map((customer, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-bold text-foreground text-sm">{customer.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {customer.phone !== "-" ? customer.phone : "Sem telefone"} • {customer.orders} {customer.orders === 1 ? 'pedido' : 'pedidos'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">{formatCurrency(customer.total)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Waiters Ranking */}
            <Card className="shadow-sm border-border print:break-inside-avoid">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCircle className="w-5 h-5 text-purple-500" />
                  Desempenho dos Garçons
                </CardTitle>
                <CardDescription>Ranking de vendas e atendimentos da sua equipe do salão.</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.waiterMetrics.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
                    Nenhum pedido de mesa registrado neste período.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="space-y-3">
                      {metrics.waiterMetrics.map((waiter, index) => (
                        <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-xs ring-2 ring-purple-100/50">
                              {index === 0 ? <Medal className="w-4 h-4" /> : index + 1}
                            </div>
                            <div>
                              <p className="font-bold text-foreground text-sm">{waiter.name}</p>
                              <p className="text-xs text-muted-foreground">{waiter.orders} atendimentos</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-purple-600">{formatCurrency(waiter.revenue)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Waiter Revenue Chart */}
                    <div className="h-[200px] print:hidden">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={metrics.waiterMetrics}
                            dataKey="revenue"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                          >
                            {metrics.waiterMetrics.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </>
      )}

      {/* Global CSS for printing functionality */}
      <style>{`
        @media print {
          body { background-color: white !important; }
          * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
};

export default Reports;
