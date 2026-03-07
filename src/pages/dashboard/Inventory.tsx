import { useStore } from "@/hooks/useStore";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, Plus, Search, AlertTriangle, Pencil, Trash2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

const Inventory = () => {
    const { store } = useStore();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);

    // Form states
    const [formData, setFormData] = useState({
        name: "",
        unit: "unidade",
        current_stock: "",
        min_stock: "",
        cost_per_unit: "",
    });

    const fetchInventory = useCallback(async () => {
        if (!store) return;
        setLoading(true);
        const { data, error } = await supabase
            .from("inventory_items")
            .select("*")
            .eq("store_id", store.id)
            .order("name");

        if (error) {
            toast.error("Erro ao carregar estoque");
        } else {
            setItems(data || []);
        }
        setLoading(false);
    }, [store]);

    useEffect(() => {
        fetchInventory();
    }, [fetchInventory]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!store) return;

        const payload = {
            store_id: store.id,
            name: formData.name,
            unit: formData.unit,
            current_stock: Number(formData.current_stock) || 0,
            min_stock: Number(formData.min_stock) || 0,
            cost_per_unit: Number(formData.cost_per_unit) || 0,
        };

        try {
            if (editingItem) {
                const { error } = await supabase.from("inventory_items").update(payload).eq("id", editingItem.id);
                if (error) throw error;
                toast.success("Item atualizado!");
            } else {
                const { error } = await supabase.from("inventory_items").insert(payload);
                if (error) throw error;
                toast.success("Item criado!");
            }
            setIsModalOpen(false);
            setEditingItem(null);
            setFormData({ name: "", unit: "unidade", current_stock: "", min_stock: "", cost_per_unit: "" });
            fetchInventory();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleEdit = (item: any) => {
        setEditingItem(item);
        setFormData({
            name: item.name,
            unit: item.unit,
            current_stock: String(item.current_stock),
            min_stock: String(item.min_stock),
            cost_per_unit: String(item.cost_per_unit),
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Deseja realmente excluir este insumo? Isso pode afetar as fichas técnicas.")) return;
        const { error } = await supabase.from("inventory_items").delete().eq("id", id);
        if (error) {
            toast.error("Erro ao excluir. O item pode estar em uso numa ficha técnica.");
        } else {
            toast.success("Item excluído!");
            fetchInventory();
        }
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Estoque de Insumos</h2>
                    <p className="text-sm text-muted-foreground">Gerencie suas matérias-primas e ficha técnica</p>
                </div>
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => { setEditingItem(null); setFormData({ name: "", unit: "unidade", current_stock: "", min_stock: "", cost_per_unit: "" }); }}>
                            <Plus className="w-4 h-4 mr-2" />
                            Novo Insumo
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>{editingItem ? "Editar Insumo" : "Cadastrar Insumo"}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <Label>Nome do Insumo</Label>
                                <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Queijo Muçarela, Farinha, Tomate" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Unidade de Medida</Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={formData.unit}
                                        onChange={e => setFormData({ ...formData, unit: e.target.value })}
                                    >
                                        <option value="kg">Quilograma (kg)</option>
                                        <option value="g">Grama (g)</option>
                                        <option value="l">Litro (l)</option>
                                        <option value="ml">Mililitro (ml)</option>
                                        <option value="unidade">Unidade (un)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Custo por {formData.unit}</Label>
                                    <Input type="number" step="0.01" value={formData.cost_per_unit} onChange={e => setFormData({ ...formData, cost_per_unit: e.target.value })} placeholder="0.00" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Estoque Atual</Label>
                                    <Input type="number" step="0.001" value={formData.current_stock} onChange={e => setFormData({ ...formData, current_stock: e.target.value })} placeholder="0.000" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Estoque Mínimo</Label>
                                    <Input type="number" step="0.001" value={formData.min_stock} onChange={e => setFormData({ ...formData, min_stock: e.target.value })} placeholder="0.000" />
                                </div>
                            </div>
                            <Button type="submit" className="w-full">{editingItem ? "Salvar Alterações" : "Cadastrar"}</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-card p-5 rounded-xl border border-border/50 shadow-sm">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Total de Itens</p>
                    <p className="text-2xl font-bold">{items.length}</p>
                </div>
                <div className="bg-orange-50 p-5 rounded-xl border border-orange-100 shadow-sm text-orange-700">
                    <p className="text-xs font-semibold uppercase mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Alerta de Ruptura
                    </p>
                    <p className="text-2xl font-bold">{items.filter(i => i.current_stock <= i.min_stock).length}</p>
                </div>
                <div className="bg-card p-5 rounded-xl border border-border/50 shadow-sm">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Custo Total em Estoque</p>
                    <p className="text-2xl font-bold">
                        {formatCurrency(items.reduce((acc, i) => acc + (i.current_stock * i.cost_per_unit), 0))}
                    </p>
                </div>
            </div>

            <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border flex items-center">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input className="pl-9" placeholder="Buscar insumo..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-xs font-medium text-muted-foreground uppercase">
                            <tr>
                                <th className="px-6 py-3">Insumo</th>
                                <th className="px-6 py-3">Estoque</th>
                                <th className="px-6 py-3">Mínimo</th>
                                <th className="px-6 py-3">Custo Unit.</th>
                                <th className="px-6 py-3">Total Estimado</th>
                                <th className="px-6 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredItems.map(item => (
                                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-foreground">{item.name}</p>
                                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded uppercase">{item.unit}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`font-bold ${item.current_stock <= item.min_stock ? 'text-destructive' : 'text-foreground'}`}>
                                            {item.current_stock.toFixed(3)} {item.unit}
                                        </span>
                                        {item.current_stock <= item.min_stock && (
                                            <AlertTriangle className="w-3 h-3 inline ml-1 text-destructive animate-pulse" />
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground">{item.min_stock.toFixed(3)} {item.unit}</td>
                                    <td className="px-6 py-4">{formatCurrency(item.cost_per_unit)}</td>
                                    <td className="px-6 py-4 font-medium text-primary">{formatCurrency(item.current_stock * item.cost_per_unit)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleEdit(item)}>
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground italic">
                                        Nenhum insumo encontrado. Comece cadastrando seus ingredientes.
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

export default Inventory;
