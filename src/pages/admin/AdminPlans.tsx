import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CreditCard, Store, Clock, AlertTriangle, CheckCircle, Edit2, Trash2, Eye, Search } from "lucide-react";
import { format } from "date-fns";

const AdminPlans = () => {
    const [stores, setStores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterPlan, setFilterPlan] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [search, setSearch] = useState("");
    // Edit Modal
    const [editStore, setEditStore] = useState<any>(null);
    const [editPlan, setEditPlan] = useState("");
    const [editStatus, setEditStatus] = useState("");
    // Delete Modal
    const [deleteStore, setDeleteStore] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchStores = useCallback(async () => {
        const { data } = await supabase
            .from("stores")
            .select("*, profiles!stores_owner_id_fkey(full_name, phone)")
            .order("created_at", { ascending: false });
        setStores(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchStores(); }, [fetchStores]);

    useEffect(() => {
        const channel = supabase
            .channel("admin-plans")
            .on("postgres_changes", { event: "*", schema: "public", table: "stores" }, () => fetchStores())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchStores]);

    const openEdit = (store: any) => {
        setEditStore(store);
        setEditPlan(store.plan_type || "monthly");
        setEditStatus(store.plan_status || "active");
    };

    const saveEdit = async () => {
        if (!editStore) return;
        const { error } = await supabase
            .from("stores")
            .update({ plan_type: editPlan, plan_status: editStatus } as any)
            .eq("id", editStore.id);
        if (error) { toast.error("Erro ao atualizar"); console.error(error); }
        else { toast.success("Plano atualizado!"); setEditStore(null); fetchStores(); }
    };

    const confirmDelete = async () => {
        if (!deleteStore) return;
        setDeleting(true);
        // Delete all associated data first
        await supabase.from("order_items").delete().in("order_id",
            (await supabase.from("orders").select("id").eq("store_id", deleteStore.id)).data?.map((o: any) => o.id) || []
        );
        await supabase.from("orders").delete().eq("store_id", deleteStore.id);
        await supabase.from("product_variations").delete().in("product_id",
            (await supabase.from("products").select("id").eq("store_id", deleteStore.id)).data?.map((p: any) => p.id) || []
        );
        await supabase.from("products").delete().eq("store_id", deleteStore.id);
        await supabase.from("delivery_areas").delete().eq("store_id", deleteStore.id);
        await supabase.from("coupons").delete().eq("store_id", deleteStore.id);
        const { error } = await supabase.from("stores").delete().eq("id", deleteStore.id);
        if (error) { toast.error("Erro ao remover loja: " + error.message); console.error(error); }
        else { toast.success("Loja removida com sucesso!"); setDeleteStore(null); fetchStores(); }
        setDeleting(false);
    };

    const filteredStores = stores.filter((s) => {
        if (filterPlan !== "all" && s.plan_type !== filterPlan) return false;
        if (filterStatus !== "all" && s.plan_status !== filterStatus) return false;
        if (search) {
            const q = search.toLowerCase();
            if (!(s.name || "").toLowerCase().includes(q) && !(s.slug || "").toLowerCase().includes(q) && !((s as any).profiles?.full_name || "").toLowerCase().includes(q)) return false;
        }
        return true;
    });

    const planCounts = {
        total: stores.length,
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                    { label: "Total de Lojas", value: planCounts.total, icon: Store, color: "bg-slate-100 text-slate-700" },
                    { label: "Mensal", value: planCounts.monthly, icon: CreditCard, color: "bg-blue-50 text-blue-700" },
                    { label: "Anual", value: planCounts.yearly, icon: CreditCard, color: "bg-purple-50 text-purple-700" },
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

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input placeholder="Buscar loja ou proprietário..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                </div>
                <div className="flex gap-2">
                    <span className="text-sm text-slate-500 self-center">Plano:</span>
                    {["all", "monthly", "yearly"].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilterPlan(f)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filterPlan === f ? "bg-primary text-white border-primary" : "bg-white text-slate-500 border-slate-200 hover:border-primary/40"
                                }`}
                        >
                            {f === "all" ? "Todos" : f === "monthly" ? "Mensal" : "Anual"}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <span className="text-sm text-slate-500 self-center">Status:</span>
                    {["all", "active", "overdue", "cancelled"].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilterStatus(f)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filterStatus === f ? "bg-primary text-white border-primary" : "bg-white text-slate-500 border-slate-200 hover:border-primary/40"
                                }`}
                        >
                            {f === "all" ? "Todos" : f === "active" ? "Ativo" : f === "overdue" ? "Inadimplente" : "Cancelado"}
                        </button>
                    ))}
                </div>
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
                                <th className="text-right px-6 py-4 font-semibold text-slate-600">Ações</th>
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
                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${store.plan_type === "yearly" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                                            }`}>
                                            {store.plan_type === "yearly" ? "Anual" : "Mensal"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${store.plan_status === "active" ? "bg-green-100 text-green-700" :
                                                store.plan_status === "overdue" ? "bg-red-100 text-red-700" :
                                                    "bg-slate-100 text-slate-600"
                                            }`}>
                                            {store.plan_status === "active" ? "Ativo" : store.plan_status === "overdue" ? "Inadimplente" : store.plan_status === "cancelled" ? "Cancelado" : store.plan_status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-500">
                                        {format(new Date(store.created_at), "dd/MM/yyyy")}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => window.open(`/loja/${store.slug}`, "_blank")} title="Ver loja">
                                                <Eye className="w-4 h-4 text-slate-500" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(store)} title="Editar plano">
                                                <Edit2 className="w-4 h-4 text-blue-500" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDeleteStore(store)} title="Remover">
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </div>
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

            {/* Edit Plan Modal */}
            <Dialog open={!!editStore} onOpenChange={(v) => !v && setEditStore(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Plano — {editStore?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Tipo de Plano</label>
                            <Select value={editPlan} onValueChange={setEditPlan}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly">Mensal</SelectItem>
                                    <SelectItem value="yearly">Anual</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Status do Plano</label>
                            <Select value={editStatus} onValueChange={setEditStatus}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Ativo</SelectItem>
                                    <SelectItem value="overdue">Inadimplente</SelectItem>
                                    <SelectItem value="cancelled">Cancelado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditStore(null)}>Cancelar</Button>
                        <Button onClick={saveEdit}>Salvar Alterações</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Modal */}
            <Dialog open={!!deleteStore} onOpenChange={(v) => !v && setDeleteStore(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Remover Loja</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-3">
                        <p className="text-sm text-slate-600">
                            Tem certeza que deseja remover a loja <strong>{deleteStore?.name}</strong>?
                        </p>
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                            ⚠️ Esta ação é irreversível. Todos os dados da loja (produtos, pedidos, variações, áreas de entrega, cupons) serão permanentemente excluídos.
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteStore(null)} disabled={deleting}>Cancelar</Button>
                        <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
                            {deleting ? (
                                <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />Removendo...</>
                            ) : "Sim, Remover"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AdminPlans;
