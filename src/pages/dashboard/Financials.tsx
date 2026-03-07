import { useStore } from "@/hooks/useStore";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
    DollarSign,
    ArrowUpCircle,
    ArrowDownCircle,
    Plus,
    Search,
    Filter,
    Calendar,
    CheckCircle2,
    Clock,
    Trash2,
    MoreVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Financials = () => {
    const { store } = useStore();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all"); // 'all', 'entry', 'exit'
    const [search, setSearch] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [formData, setFormData] = useState({
        description: "",
        amount: "",
        type: "exit",
        category_id: "",
        due_date: format(new Date(), "yyyy-MM-dd"),
        status: "pending"
    });

    const fetchData = useCallback(async () => {
        if (!store) return;
        setLoading(true);

        const [tRes, cRes] = await Promise.all([
            supabase.from("financial_transactions")
                .select("*, financial_categories(name)")
                .eq("store_id", store.id)
                .order("due_date", { ascending: false }),
            supabase.from("financial_categories")
                .select("*")
                .eq("store_id", store.id)
        ]);

        setTransactions(tRes.data || []);
        setCategories(cRes.data || []);
        setLoading(false);
    }, [store]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!store) return;

        try {
            const { error } = await supabase.from("financial_transactions").insert({
                store_id: store.id,
                description: formData.description,
                amount: Number(formData.amount),
                type: formData.type,
                category_id: formData.category_id || null,
                due_date: formData.due_date,
                status: formData.status,
                paid_at: formData.status === "paid" ? new Date().toISOString() : null
            });

            if (error) throw error;

            toast.success("Movimentação registrada!");
            setIsModalOpen(false);
            setFormData({
                description: "",
                amount: "",
                type: "exit",
                category_id: "",
                due_date: format(new Date(), "yyyy-MM-dd"),
                status: "pending"
            });
            fetchData();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleToggleStatus = async (transaction: any) => {
        const newStatus = transaction.status === "paid" ? "pending" : "paid";
        const { error } = await supabase.from("financial_transactions")
            .update({
                status: newStatus,
                paid_at: newStatus === "paid" ? new Date().toISOString() : null
            })
            .eq("id", transaction.id);

        if (error) {
            toast.error("Erro ao atualizar status");
        } else {
            toast.success("Status atualizado!");
            fetchData();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Excluir esta movimentação?")) return;
        const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
        if (error) {
            toast.error("Erro ao excluir");
        } else {
            toast.success("Movimentação excluída!");
            fetchData();
        }
    };

    const totals = transactions.reduce((acc, t) => {
        if (t.status === 'cancelled') return acc;
        if (t.type === 'entry') acc.entries += t.amount;
        else acc.exits += t.amount;
        return acc;
    }, { entries: 0, exits: 0 });

    const filteredTransactions = transactions.filter(t => {
        const matchesSearch = t.description?.toLowerCase().includes(search.toLowerCase());
        const matchesFilter = filter === "all" || t.type === filter;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Financeiro</h2>
                    <p className="text-sm text-muted-foreground">Gestão de contas a pagar, receber e fluxo de caixa</p>
                </div>
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-primary hover:bg-primary/90">
                            <Plus className="w-4 h-4 mr-2" />
                            Nova Movimentação
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Registrar Movimentação</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                            <div className="flex bg-muted p-1 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'entry' })}
                                    className={`flex-1 flex items-center justify-center py-2 px-4 rounded-md text-sm font-bold transition-all ${formData.type === 'entry' ? 'bg-white text-green-600 shadow-sm' : 'text-muted-foreground'}`}
                                >
                                    <ArrowUpCircle className="w-4 h-4 mr-2" /> Receita
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'exit' })}
                                    className={`flex-1 flex items-center justify-center py-2 px-4 rounded-md text-sm font-bold transition-all ${formData.type === 'exit' ? 'bg-white text-red-600 shadow-sm' : 'text-muted-foreground'}`}
                                >
                                    <ArrowDownCircle className="w-4 h-4 mr-2" /> Despesa
                                </button>
                            </div>

                            <div className="space-y-2">
                                <Label>Descrição</Label>
                                <Input required value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Ex: Aluguel, Compra de Insumos, Venda Balcão" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Valor (R$)</Label>
                                    <Input required type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Vencimento</Label>
                                    <Input required type="date" value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Categoria</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    value={formData.category_id}
                                    onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                                >
                                    <option value="">Selecione uma categoria...</option>
                                    {categories.filter(c => c.type === formData.type).map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_paid"
                                    checked={formData.status === 'paid'}
                                    onChange={e => setFormData({ ...formData, status: e.target.checked ? 'paid' : 'pending' })}
                                    className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                                />
                                <Label htmlFor="is_paid" className="cursor-pointer">Marcar como Pago/Recebido</Label>
                            </div>

                            <Button type="submit" className="w-full h-12 text-lg">Confirmar Registro</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-card p-6 rounded-xl border border-border/50 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                        <ArrowUpCircle className="w-12 h-12 text-green-600" />
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Total Receitas</p>
                    <p className="text-3xl font-black text-green-600">{formatCurrency(totals.entries)}</p>
                </div>
                <div className="bg-card p-6 rounded-xl border border-border/50 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                        <ArrowDownCircle className="w-12 h-12 text-red-600" />
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Total Despesas</p>
                    <p className="text-3xl font-black text-red-600">{formatCurrency(totals.exits)}</p>
                </div>
                <div className="bg-card p-6 rounded-xl border border-border/50 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                        <DollarSign className="w-12 h-12 text-primary" />
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Saldo Previsto</p>
                    <p className={`text-3xl font-black ${totals.entries - totals.exits >= 0 ? "text-primary" : "text-destructive"}`}>
                        {formatCurrency(totals.entries - totals.exits)}
                    </p>
                </div>
            </div>

            <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border flex flex-col sm:flex-row items-center gap-4 bg-muted/20">
                    <div className="relative flex-1 w-full sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input className="pl-9 h-10" placeholder="Buscar descrição..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2 bg-muted p-1 rounded-lg w-full sm:w-auto">
                        <button onClick={() => setFilter('all')} className={`flex-1 sm:px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filter === 'all' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground'}`}>Todos</button>
                        <button onClick={() => setFilter('entry')} className={`flex-1 sm:px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filter === 'entry' ? 'bg-white shadow-sm text-green-600' : 'text-muted-foreground'}`}>Entradas</button>
                        <button onClick={() => setFilter('exit')} className={`flex-1 sm:px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filter === 'exit' ? 'bg-white shadow-sm text-red-600' : 'text-muted-foreground'}`}>Saídas</button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-xs font-bold text-muted-foreground uppercase">
                            <tr>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Transação</th>
                                <th className="px-6 py-4">Vencimento</th>
                                <th className="px-6 py-4">Categoria</th>
                                <th className="px-6 py-4 text-right">Valor</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredTransactions.map(t => (
                                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleToggleStatus(t)}
                                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all ${t.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}
                                        >
                                            {t.status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                            {t.status === 'paid' ? 'Pago' : 'Pendente'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {t.type === 'entry' ? <ArrowUpCircle className="w-4 h-4 text-green-600" /> : <ArrowDownCircle className="w-4 h-4 text-red-600" />}
                                            <div>
                                                <p className="font-bold text-foreground leading-tight">{t.description}</p>
                                                {t.order_id && <span className="text-[10px] text-muted-foreground font-mono">Pedido Vinculado</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-muted-foreground">
                                        {format(new Date(t.due_date + "T12:00:00"), "dd 'de' MMM", { locale: ptBR })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                                            {t.financial_categories?.name || 'Geral'}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-4 text-right font-black ${t.type === 'entry' ? "text-green-600" : "text-red-600"}`}>
                                        {t.type === 'entry' ? "+" : "-"} {formatCurrency(t.amount)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(t.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {filteredTransactions.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground italic bg-muted/10">
                                        Nenhuma movimentação financeira encontrada para os filtros selecionados.
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

export default Financials;
