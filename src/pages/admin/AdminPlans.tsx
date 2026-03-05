import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CreditCard, Store, Shield, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";

const AdminPlans = () => {
    const [stores, setStores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterPlan, setFilterPlan] = useState<string>("all");

    const fetchStores = useCallback(async () => {
        const { data } = await supabase.from("stores").select("*, profiles!stores_owner_id_fkey(full_name, phone)").order("created_at", { ascending: false });
        setStores(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchStores(); }, [fetchStores]);

    // Realtime
    useEffect(() => {
        const channel = supabase
            .channel("admin-plans")
            .on("postgres_changes", { event: "*", schema: "public", table: "stores" }, () => fetchStores())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchStores]);

    const changePlan = async (storeId: string, planType: string) => {
        await supabase.from("stores").update({ plan_type: planType }).eq("id", storeId);
        toast.success("Plano atualizado!");
        fetchStores();
    };

    const changePlanStatus = async (storeId: string, status: string) => {
        await supabase.from("stores").update({ plan_status: status }).eq("id", storeId);
        toast.success("Status do plano atualizado!");
        fetchStores();
    };

    const filteredStores = stores.filter((s) => {
        if (filterPlan === "all") return true;
        return s.plan_type === filterPlan;
    });

    const planCounts = {
        total: stores.length,
        trial: stores.filter(s => s.plan_type === "trial").length,
        monthly: stores.filter(s => s.plan_type === "monthly").length,
        yearly: stores.filter(s => s.plan_type === "yearly").length,
        active: stores.filter(s => s.plan_status === "active").length,
        overdue: stores.filter(s => s.plan_status === "overdue").length,
    };

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
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Planos</h1>
                <p className="text-sm text-slate-500">Gerencie os planos de assinatura das lojas</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                    { label: "Total de Lojas", value: planCounts.total, icon: Store, color: "bg-slate-100 text-slate-700" },
                    { label: "Trial", value: planCounts.trial, icon: Clock, color: "bg-amber-50 text-amber-700" },
                    { label: "Mensal", value: planCounts.monthly, icon: CreditCard, color: "bg-blue-50 text-blue-700" },
                    { label: "Anual", value: planCounts.yearly, icon: Shield, color: "bg-purple-50 text-purple-700" },
                    { label: "Ativos", value: planCounts.active, icon: CheckCircle, color: "bg-green-50 text-green-700" },
                    { label: "Inadimplentes", value: planCounts.overdue, icon: AlertTriangle, color: "bg-red-50 text-red-700" },
                ].map((card, i) => (
                    <div key={i} className={`rounded-2xl p-4 ${card.color} border border-white/50`}>
                        <card.icon className="w-5 h-5 mb-2 opacity-70" />
                        <p className="text-2xl font-extrabold">{card.value}</p>
                        <p className="text-xs font-medium mt-0.5 opacity-80">{card.label}</p>
                    </div>
                ))}
            </div>

            {/* Filter */}
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-600">Filtrar por plano:</span>
                {["all", "trial", "monthly", "yearly"].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilterPlan(f)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filterPlan === f
                                ? "bg-primary text-white border-primary"
                                : "bg-white text-slate-500 border-slate-200 hover:border-primary/40"
                            }`}
                    >
                        {f === "all" ? "Todos" : f === "trial" ? "Trial" : f === "monthly" ? "Mensal" : "Anual"}
                    </button>
                ))}
            </div>

            {/* Store List */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200/60 bg-slate-50/50">
                                <th className="text-left px-6 py-4 font-semibold text-slate-600">Loja</th>
                                <th className="text-left px-6 py-4 font-semibold text-slate-600">Proprietário</th>
                                <th className="text-left px-6 py-4 font-semibold text-slate-600">Plano</th>
                                <th className="text-left px-6 py-4 font-semibold text-slate-600">Status</th>
                                <th className="text-left px-6 py-4 font-semibold text-slate-600">Criado em</th>
                                <th className="text-left px-6 py-4 font-semibold text-slate-600">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStores.map((store) => (
                                <tr key={store.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            {store.logo_url ? (
                                                <img src={store.logo_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                                    <Store className="w-5 h-5 text-primary" />
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-medium text-slate-900">{store.name}</p>
                                                <p className="text-xs text-slate-400">{store.slug}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-slate-700">{(store as any).profiles?.full_name || "—"}</p>
                                        <p className="text-xs text-slate-400">{(store as any).profiles?.phone || ""}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Select value={store.plan_type} onValueChange={(v) => changePlan(store.id, v)}>
                                            <SelectTrigger className="w-28 h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="trial">Trial</SelectItem>
                                                <SelectItem value="monthly">Mensal</SelectItem>
                                                <SelectItem value="yearly">Anual</SelectItem>
                                                <SelectItem value="free">Gratuito</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Select value={store.plan_status} onValueChange={(v) => changePlanStatus(store.id, v)}>
                                            <SelectTrigger className={`w-28 h-8 text-xs ${store.plan_status === "active" ? "text-green-700" :
                                                    store.plan_status === "overdue" ? "text-red-700" : "text-slate-600"
                                                }`}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="active">Ativo</SelectItem>
                                                <SelectItem value="overdue">Inadimplente</SelectItem>
                                                <SelectItem value="cancelled">Cancelado</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-500">
                                        {format(new Date(store.created_at), "dd/MM/yyyy")}
                                    </td>
                                    <td className="px-6 py-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={() => window.open(`/loja/${store.slug}`, "_blank")}
                                        >
                                            Ver Loja
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {filteredStores.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                                        Nenhuma loja encontrada.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminPlans;
