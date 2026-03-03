import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Store, Pencil, Trash2, ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
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

const AdminStores = () => {
    const [stores, setStores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchStores = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("stores")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            toast.error("Erro ao carregar lojas");
        } else {
            setStores(data || []);
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
            toast.success(`Loja ${newStatus === 'active' ? 'ativada' : 'bloqueada'} com sucesso`);
            fetchStores();
        }
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-screen">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Gerenciar Lojas</h1>
                </div>
            </div>

            <Card className="border-none shadow-sm overflow-hidden bg-white">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead>Loja</TableHead>
                            <TableHead>Slug</TableHead>
                            <TableHead>Plano</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {stores.map((store) => (
                            <TableRow key={store.id} className="hover:bg-slate-50/50 transition-colors">
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                                            <Store className="w-4 h-4 text-slate-500" />
                                        </div>
                                        {store.name}
                                    </div>
                                </TableCell>
                                <TableCell className="text-slate-500">{store.slug}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="capitalize">
                                        {store.plan_type}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={store.plan_status === 'active' ? 'default' : 'destructive'}
                                        className="flex w-fit items-center gap-1"
                                    >
                                        {store.plan_status === 'active' ? 'Ativa' : 'Pendente'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-slate-500">
                                    {store.asaas_next_due_date ? new Date(store.asaas_next_due_date).toLocaleDateString() : '-'}
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => togglePlanStatus(store.id, store.plan_status)}
                                        title={store.plan_status === 'active' ? 'Bloquear Loja' : 'Ativar Loja'}
                                        className={store.plan_status === 'active' ? 'text-amber-600' : 'text-emerald-600'}
                                    >
                                        <ShieldCheck className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => window.open(`https://${store.slug}.frfood.com.br`, '_blank')}
                                        title="Ver Loja"
                                    >
                                        <ExternalLink className="w-4 h-4 text-primary" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDelete(store.id)}
                                        title="Excluir Loja"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
};

// Simple Card component if not imported from UI
const Card = ({ children, className }: any) => (
    <div className={`rounded-xl border border-slate-200 ${className}`}>{children}</div>
);

export default AdminStores;
