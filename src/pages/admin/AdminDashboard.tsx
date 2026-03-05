import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { LayoutDashboard, Store, Users, ShoppingBag, DollarSign, TrendingUp, ArrowRight, Clock, Activity } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const AdminDashboard = () => {
    const [stores, setStores] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        const [storesRes, profilesRes, ordersRes] = await Promise.all([
            supabase.from("stores").select("id, name, slug, logo_url, plan_type, plan_status, is_open, created_at").order("created_at", { ascending: false }),
            supabase.from("profiles").select("id, full_name, created_at").order("created_at", { ascending: false }),
            supabase.from("orders").select("id, total, status, store_id, created_at, customer_name").order("created_at", { ascending: false }),
        ]);
        setStores(storesRes.data || []);
        setProfiles(profilesRes.data || []);
        setOrders(ordersRes.data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Realtime
    useEffect(() => {
        const channel = supabase
            .channel("admin-dashboard-live")
            .on("postgres_changes", { event: "*", schema: "public", table: "stores" }, () => fetchData())
            .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchData())
            .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchData]);

    const totalRevenue = orders.filter(o => o.status === "delivered").reduce((s, o) => s + Number(o.total), 0);
    const todayOrders = orders.filter(o => {
        const d = new Date(o.created_at);
        const today = new Date();
        return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    });
    const openStores = stores.filter(s => s.is_open);
    const recentOrders = orders.slice(0, 8);
    const recentStores = stores.slice(0, 5);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
                <p className="text-sm text-slate-500">Visão geral da plataforma FRFood</p>
            </div>

            {/* Realtime indicator */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
                <Activity className="w-3.5 h-3.5 text-green-500 animate-pulse" />
                <span>Dados atualizados em tempo real</span>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Link to="/admin/stores" className="group bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-shadow">
                    <Store className="w-6 h-6 mb-3 opacity-80" />
                    <p className="text-3xl font-extrabold">{stores.length}</p>
                    <div className="flex items-center justify-between mt-1">
                        <p className="text-sm opacity-80">Lojas Cadastradas</p>
                        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-80 transition-opacity" />
                    </div>
                    <p className="text-xs opacity-60 mt-1">{openStores.length} abertas agora</p>
                </Link>

                <Link to="/admin/clients" className="group bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-shadow">
                    <Users className="w-6 h-6 mb-3 opacity-80" />
                    <p className="text-3xl font-extrabold">{profiles.length}</p>
                    <div className="flex items-center justify-between mt-1">
                        <p className="text-sm opacity-80">Usuários</p>
                        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-80 transition-opacity" />
                    </div>
                </Link>

                <Link to="/admin/reports" className="group bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-shadow">
                    <DollarSign className="w-6 h-6 mb-3 opacity-80" />
                    <p className="text-3xl font-extrabold">R$ {totalRevenue.toFixed(0)}</p>
                    <div className="flex items-center justify-between mt-1">
                        <p className="text-sm opacity-80">Receita Total</p>
                        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-80 transition-opacity" />
                    </div>
                </Link>

                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg shadow-orange-500/20">
                    <ShoppingBag className="w-6 h-6 mb-3 opacity-80" />
                    <p className="text-3xl font-extrabold">{todayOrders.length}</p>
                    <p className="text-sm opacity-80 mt-1">Pedidos Hoje</p>
                    <p className="text-xs opacity-60 mt-1">{orders.length} total</p>
                </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Recent Orders */}
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <ShoppingBag className="w-4 h-4 text-primary" /> Pedidos Recentes
                        </h3>
                        <Link to="/admin/reports" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                            Ver todos <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {recentOrders.map((order) => {
                            const storeName = stores.find(s => s.id === order.store_id)?.name || "—";
                            const statusColors: Record<string, string> = {
                                pending: "bg-yellow-100 text-yellow-700",
                                confirmed: "bg-blue-100 text-blue-700",
                                preparing: "bg-orange-100 text-orange-700",
                                delivering: "bg-purple-100 text-purple-700",
                                delivered: "bg-green-100 text-green-700",
                                cancelled: "bg-red-100 text-red-700",
                            };
                            return (
                                <div key={order.id} className="px-6 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-800 truncate">{order.customer_name}</p>
                                        <p className="text-xs text-slate-400">{storeName} • {format(new Date(order.created_at), "dd/MM HH:mm")}</p>
                                    </div>
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[order.status] || "bg-slate-100"}`}>
                                        {order.status}
                                    </span>
                                    <span className="text-sm font-bold text-slate-900 whitespace-nowrap">R$ {Number(order.total).toFixed(2)}</span>
                                </div>
                            );
                        })}
                        {recentOrders.length === 0 && (
                            <p className="px-6 py-8 text-center text-slate-400 text-sm">Nenhum pedido ainda.</p>
                        )}
                    </div>
                </div>

                {/* Recent Stores */}
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <Store className="w-4 h-4 text-primary" /> Lojas Recentes
                        </h3>
                        <Link to="/admin/stores" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                            Ver todas <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {recentStores.map((store) => (
                            <div key={store.id} className="px-6 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                                {store.logo_url ? (
                                    <img src={store.logo_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
                                ) : (
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Store className="w-5 h-5 text-primary" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800 truncate">{store.name}</p>
                                    <p className="text-xs text-slate-400">{store.slug}</p>
                                </div>
                                <div className="text-right">
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${store.plan_type === "yearly" ? "bg-purple-100 text-purple-700" :
                                            store.plan_type === "monthly" ? "bg-blue-100 text-blue-700" :
                                                "bg-slate-100 text-slate-600"
                                        }`}>
                                        {store.plan_type}
                                    </span>
                                    <p className="text-xs text-slate-400 mt-0.5">{format(new Date(store.created_at), "dd/MM/yyyy")}</p>
                                </div>
                            </div>
                        ))}
                        {recentStores.length === 0 && (
                            <p className="px-6 py-8 text-center text-slate-400 text-sm">Nenhuma loja cadastrada.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
