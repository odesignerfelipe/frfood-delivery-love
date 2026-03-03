import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Store, Trash2, ArrowLeft, ExternalLink, ShieldCheck, Activity, Users, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { checkStoreStatus } from "@/lib/utils";

const AdminStores = () => {
    const [stores, setStores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchStores = async () => {
        setLoading(true);
        // Busca baseada em tabela separada para evitar bloqueio por foreign key ausente (PostgREST issue)
        const { data: storesData, error: storesError } = await supabase
            .from("stores")
            .select("*")
            .order("created_at", { ascending: false });

        if (storesError) {
            console.error(storesError);
            toast.error("Erro ao carregar lojas");
            setLoading(false);
            return;
        }

        if (storesData && storesData.length > 0) {
            const ownerIds = storesData.map(s => s.owner_id);
            const { data: profilesData } = await supabase
                .from("profiles")
                .select("user_id, full_name, phone")
                .in("user_id", ownerIds);

            const profilesMap = new Map();
            profilesData?.forEach(p => profilesMap.set(p.user_id, p));

            const combinedStores = storesData.map(store => ({
                ...store,
                profiles: profilesMap.get(store.owner_id) || null
            }));

            setStores(combinedStores);
        } else {
            setStores([]);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchStores();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta loja? Todos os dados serão perdidos.")) return;

        const { error } = await supabase.from("stores").delete().eq("id", id);
        if (error) {
            toast.error("Erro ao excluir loja");
        } else {
            toast.success("Loja excluída com sucesso");
            fetchStores();
        }
    };

    const togglePlanStatus = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'overdue' : 'active';
        const { error } = await supabase
            .from("stores")
            .update({ plan_status: newStatus })
            .eq("id", id);

        if (error) {
            toast.error("Erro ao atualizar status");
        } else {
            toast.success(`Loja ${newStatus === 'active' ? 'ativada' : 'congelada'} com sucesso`);
            fetchStores();
        }
    };

    const changePlanType = async (id: string, newPlan: string) => {
        const { error } = await supabase
            .from("stores")
            .update({ plan_type: newPlan })
            .eq("id", id);

        if (error) {
            toast.error("Erro ao alterar plano");
        } else {
            toast.success("Plano alterado com sucesso");
            fetchStores();
        }
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-screen bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    const activeCount = stores.filter(s => s.plan_status === 'active').length;
    const pendingCount = stores.length - activeCount;

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Gerenciar Lojas</h1>
                        <p className="text-sm text-slate-500 mt-1">Visão geral de todas as lojas e assinantes da plataforma.</p>
                    </div>
                </div>
            </div>

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                        <Store className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Total de Lojas</p>
                        <h3 className="text-2xl font-bold text-slate-900">{stores.length}</h3>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Lojas Ativas</p>
                        <h3 className="text-2xl font-bold text-slate-900">{activeCount}</h3>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-rose-100 text-rose-600 rounded-lg">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Assinaturas Pendentes</p>
                        <h3 className="text-2xl font-bold text-slate-900">{pendingCount}</h3>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-800">Listagem de Clientes e Lojas</h2>
                </div>
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-[250px]">Loja / Cliente</TableHead>
                            <TableHead>Subdomínio</TableHead>
                            <TableHead>Operação</TableHead>
                            <TableHead>Plano</TableHead>
                            <TableHead>Status Financeiro</TableHead>
                            <TableHead className="text-right">Ações Rápidas</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {stores.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-slate-500">Nenhuma loja cadastrada ainda.</TableCell>
                            </TableRow>
                        ) : stores.map((store) => (
                            <TableRow key={store.id} className="hover:bg-slate-50/80 transition-colors">
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                                            {store.logo_url ? (
                                                <img src={store.logo_url} className="w-full h-full object-cover" alt="Logo" />
                                            ) : (
                                                <Store className="w-5 h-5 text-slate-400" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900">{store.name}</p>
                                            <p className="text-xs text-slate-500 font-medium">Resp: {store.profiles?.full_name || 'Desconhecido'}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <a href={`https://${store.slug}.frfood.com.br`} target="_blank" className="text-sm text-primary hover:underline flex items-center gap-1 font-medium">
                                        {store.slug}
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={checkStoreStatus(store) ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}>
                                        {checkStoreStatus(store) ? "Aberta Agora" : "Fechada Agora"}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Select
                                        value={store.plan_type || "free"}
                                        onValueChange={(val) => changePlanType(store.id, val)}
                                    >
                                        <SelectTrigger className="w-[120px] h-8 text-xs font-medium focus:ring-1 focus:ring-primary/20">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="free">Gratuito</SelectItem>
                                            <SelectItem value="monthly">Mensal</SelectItem>
                                            <SelectItem value="yearly">Anual</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={store.plan_status === 'active' ? 'default' : 'destructive'}
                                        className={`font-semibold ${store.plan_status === 'active' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : ''}`}
                                    >
                                        {store.plan_status === 'active' ? 'Ativo' : 'Congelado'}
                                    </Badge>
                                    {store.asaas_next_due_date && (
                                        <p className="text-[10px] text-slate-400 mt-1 font-medium">Vence: {new Date(store.asaas_next_due_date).toLocaleDateString()}</p>
                                    )}
                                </TableCell>
                                <TableCell className="text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => navigate(`/dashboard/store?impersonate=${store.id}`)}
                                            title="Configurar Loja (Painel do Cliente)"
                                            className="text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                        >
                                            <ShoppingCart className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => togglePlanStatus(store.id, store.plan_status)}
                                            title={store.plan_status === 'active' ? 'Congelar Loja' : 'Descongelar Loja'}
                                            className={store.plan_status === 'active' ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}
                                        >
                                            <ShieldCheck className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-rose-600 hover:bg-rose-50"
                                            onClick={() => handleDelete(store.id)}
                                            title="Excluir Loja Definitivamente"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default AdminStores;
