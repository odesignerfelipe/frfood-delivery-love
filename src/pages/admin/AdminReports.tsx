import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, TrendingUp, ShoppingBag, DollarSign, Store, Users, Calendar } from "lucide-react";
import { format, subDays, startOfDay, startOfWeek, startOfMonth, startOfYear, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";

const AdminReports = () => {
    const [orders, setOrders] = useState<any[]>([]);
    const [stores, setStores] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<"today" | "week" | "month" | "year" | "all">("month");

    const fetchData = useCallback(async () => {
        const [ordersRes, storesRes, profilesRes] = await Promise.all([
            supabase.from("orders").select("id, total, status, store_id, created_at").order("created_at", { ascending: false }),
            supabase.from("stores").select("id, name, slug, logo_url, created_at"),
            supabase.from("profiles").select("id, created_at"),
        ]);
        setOrders(ordersRes.data || []);
        setStores(storesRes.data || []);
        setProfiles(profilesRes.data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Realtime
    useEffect(() => {
        const channel = supabase
            .channel("admin-reports")
            .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchData())
            .on("postgres_changes", { event: "*", schema: "public", table: "stores" }, () => fetchData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchData]);

    const getPeriodStart = () => {
        const now = new Date();
        if (period === "today") return startOfDay(now);
        if (period === "week") return startOfWeek(now, { locale: ptBR });
        if (period === "month") return startOfMonth(now);
        if (period === "year") return startOfYear(now);
        return new Date(0);
    };

    const periodStart = getPeriodStart();
    const filteredOrders = orders.filter(o => isAfter(new Date(o.created_at), periodStart));
    const deliveredOrders = filteredOrders.filter(o => o.status === "delivered");
    const cancelledOrders = filteredOrders.filter(o => o.status === "cancelled");
    const totalRevenue = deliveredOrders.reduce((s, o) => s + Number(o.total), 0);
    const avgOrderValue = deliveredOrders.length > 0 ? totalRevenue / deliveredOrders.length : 0;
    const newStores = stores.filter(s => isAfter(new Date(s.created_at), periodStart));
    const newUsers = profiles.filter(p => isAfter(new Date(p.created_at), periodStart));

    // Top stores
    const storeStats = stores.map(store => {
        const storeOrders = deliveredOrders.filter(o => o.store_id === store.id);
        const revenue = storeOrders.reduce((s, o) => s + Number(o.total), 0);
        return { ...store, orderCount: storeOrders.length, revenue };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // Daily chart data (last 7 or 30 days)
    const chartDays = period === "today" ? 1 : period === "week" ? 7 : period === "month" ? 30 : period === "year" ? 12 : 30;
    const dailyData = [];

    if (period === "year") {
        // Monthly bars
        for (let i = 11; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthStart = startOfMonth(d);
            const nextMonth = new Date(monthStart);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            const dayOrders = deliveredOrders.filter(o => {
                const od = new Date(o.created_at);
                return od >= monthStart && od < nextMonth;
            });
            dailyData.push({
                label: format(monthStart, "MMM", { locale: ptBR }),
                revenue: dayOrders.reduce((s, o) => s + Number(o.total), 0),
                count: dayOrders.length,
            });
        }
    } else {
        for (let i = Math.min(chartDays, 30) - 1; i >= 0; i--) {
            const day = startOfDay(subDays(new Date(), i));
            const nextDay = startOfDay(subDays(new Date(), i - 1));
            const dayOrders = deliveredOrders.filter(o => {
                const od = new Date(o.created_at);
                return od >= day && od < nextDay;
            });
            dailyData.push({
                label: format(day, "dd/MM"),
                revenue: dayOrders.reduce((s, o) => s + Number(o.total), 0),
                count: dayOrders.length,
            });
        }
    }

    const maxRevenue = Math.max(...dailyData.map(d => d.revenue), 1);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Relatórios</h1>
                    <p className="text-sm text-slate-500">Visão geral da plataforma em tempo real</p>
                </div>
                <div className="flex gap-2">
                    {[
                        { id: "today", label: "Hoje" },
                        { id: "week", label: "Semana" },
                        { id: "month", label: "Mês" },
                        { id: "year", label: "Ano" },
                        { id: "all", label: "Total" },
                    ].map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setPeriod(f.id as any)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${period === f.id
                                    ? "bg-primary text-white border-primary"
                                    : "bg-white text-slate-500 border-slate-200 hover:border-primary/40"
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                    { label: "Receita Total", value: `R$ ${totalRevenue.toFixed(2)}`, icon: DollarSign, color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
                    { label: "Pedidos Entregues", value: deliveredOrders.length, icon: ShoppingBag, color: "bg-blue-50 text-blue-700 border-blue-100" },
                    { label: "Ticket Médio", value: `R$ ${avgOrderValue.toFixed(2)}`, icon: TrendingUp, color: "bg-purple-50 text-purple-700 border-purple-100" },
                    { label: "Cancelados", value: cancelledOrders.length, icon: BarChart3, color: "bg-red-50 text-red-700 border-red-100" },
                    { label: "Novas Lojas", value: newStores.length, icon: Store, color: "bg-amber-50 text-amber-700 border-amber-100" },
                    { label: "Novos Usuários", value: newUsers.length, icon: Users, color: "bg-cyan-50 text-cyan-700 border-cyan-100" },
                ].map((card, i) => (
                    <div key={i} className={`rounded-2xl p-4 border ${card.color}`}>
                        <card.icon className="w-5 h-5 mb-2 opacity-70" />
                        <p className="text-2xl font-extrabold">{card.value}</p>
                        <p className="text-xs font-medium mt-0.5 opacity-80">{card.label}</p>
                    </div>
                ))}
            </div>

            {/* Revenue Chart */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" /> Receita por {period === "year" ? "Mês" : "Dia"}
                </h3>
                <div className="flex items-end gap-1.5" style={{ height: "200px" }}>
                    {dailyData.map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 group cursor-default">
                            {/* Tooltip */}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap">
                                R$ {d.revenue.toFixed(0)} • {d.count} pedidos
                            </div>
                            <div
                                className="w-full bg-gradient-to-t from-primary to-primary/60 rounded-t-lg transition-all duration-300 group-hover:from-primary group-hover:to-primary/80"
                                style={{ height: `${Math.max((d.revenue / maxRevenue) * 160, 4)}px`, minWidth: "8px" }}
                            />
                            <span className="text-[9px] text-slate-400 mt-0.5 truncate w-full text-center">{d.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Top Stores */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" /> Top Lojas por Receita
                </h3>
                <div className="space-y-3">
                    {storeStats.filter(s => s.revenue > 0).map((store, i) => (
                        <div key={store.id} className="flex items-center gap-4">
                            <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                                {i + 1}
                            </span>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                {store.logo_url ? (
                                    <img src={store.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                                ) : (
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <Store className="w-4 h-4 text-primary" />
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-slate-800 text-sm truncate">{store.name}</p>
                                    <p className="text-xs text-slate-400">{store.orderCount} pedidos</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-slate-900">R$ {store.revenue.toFixed(2)}</p>
                            </div>
                            <div className="w-32 hidden sm:block">
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-primary to-orange-400 rounded-full"
                                        style={{ width: `${(store.revenue / (storeStats[0]?.revenue || 1)) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                    {storeStats.filter(s => s.revenue > 0).length === 0 && (
                        <p className="text-center text-slate-400 py-8">Nenhum pedido entregue neste período.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminReports;
