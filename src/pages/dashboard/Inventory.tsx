import { useStore } from "@/hooks/useStore";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, Plus, Search, AlertTriangle, Pencil, Trash2, Scale, ShoppingCart, History, ArrowUpCircle, ArrowDownCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
        supplier: "",
    });

    const [adjustingStockItem, setAdjustingStockItem] = useState<any>(null);
    const [stockAdjustment, setStockAdjustment] = useState({ newBalance: "" });

    // Purchase entry state
    const [purchaseItem, setPurchaseItem] = useState<any>(null);
    const [purchaseData, setPurchaseData] = useState({ quantity: "", cost: "", notes: "" });

    // Movement history state
    const [historyItem, setHistoryItem] = useState<any>(null);
    const [movements, setMovements] = useState<any[]>([]);
    const [loadingMovements, setLoadingMovements] = useState(false);

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
            supplier: formData.supplier,
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
            setFormData({ name: "", unit: "unidade", current_stock: "", min_stock: "", cost_per_unit: "", supplier: "" });
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
            supplier: item.supplier || "",
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

    const handleAdjustStock = async () => {
        if (!adjustingStockItem || !stockAdjustment.newBalance) return;
        try {
            const newStock = Number(stockAdjustment.newBalance);
            const diff = newStock - adjustingStockItem.current_stock;
            const { error } = await supabase
                .from("inventory_items")
                .update({ current_stock: newStock })
                .eq("id", adjustingStockItem.id);

            if (error) throw error;

            // Log the adjustment movement
            if (store && diff !== 0) {
                await supabase.from("stock_movements").insert({
                    store_id: store.id,
                    inventory_item_id: adjustingStockItem.id,
                    type: "adjustment",
                    quantity: Math.abs(diff),
                    cost: 0,
                    reference: diff > 0 ? "Ajuste manual (+)" : "Ajuste manual (-)",
                    notes: `Estoque ajustado de ${adjustingStockItem.current_stock} para ${newStock}`,
                });
            }

            toast.success("Estoque ajustado com sucesso!");
            setAdjustingStockItem(null);
            setStockAdjustment({ newBalance: "" });
            fetchInventory();
        } catch (err: any) {
            toast.error(err.message || "Erro ao ajustar o estoque.");
        }
    };

    const handlePurchaseEntry = async () => {
        if (!purchaseItem || !store || !purchaseData.quantity) return;
        try {
            const qty = Number(purchaseData.quantity);
            const cost = Number(purchaseData.cost) || 0;

            // Update stock
            const { error } = await supabase
                .from("inventory_items")
                .update({ current_stock: purchaseItem.current_stock + qty })
                .eq("id", purchaseItem.id);

            if (error) throw error;

            // Log entry movement
            await supabase.from("stock_movements").insert({
                store_id: store.id,
                inventory_item_id: purchaseItem.id,
                type: "entry",
                quantity: qty,
                cost: cost,
                reference: `Compra - ${purchaseItem.supplier || "Fornecedor não informado"}`,
                notes: purchaseData.notes,
            });

            toast.success(`Entrada de ${qty} ${purchaseItem.unit} registrada!`);
            setPurchaseItem(null);
            setPurchaseData({ quantity: "", cost: "", notes: "" });
            fetchInventory();
        } catch (err: any) {
            toast.error(err.message || "Erro ao registrar compra.");
        }
    };

    const fetchMovements = async (itemId: string) => {
        setLoadingMovements(true);
        const { data, error } = await supabase
            .from("stock_movements")
            .select("*")
            .eq("inventory_item_id", itemId)
            .order("created_at", { ascending: false })
            .limit(50);

        if (!error) setMovements(data || []);
        setLoadingMovements(false);
    };

    const openHistory = (item: any) => {
        setHistoryItem(item);
        fetchMovements(item.id);
    };

    const getStepForUnit = (unit: string) => {
        return unit === "unidade" ? "1" : "0.001";
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.supplier || "").toLowerCase().includes(search.toLowerCase())
    );

    const typeLabel: Record<string, string> = { entry: "Entrada", exit: "Saída", adjustment: "Ajuste" };
    const typeColor: Record<string, string> = { entry: "text-green-600 bg-green-50", exit: "text-red-600 bg-red-50", adjustment: "text-amber-600 bg-amber-50" };
    const typeIcon: Record<string, any> = { entry: <ArrowUpCircle className="w-4 h-4" />, exit: <ArrowDownCircle className="w-4 h-4" />, adjustment: <RotateCcw className="w-4 h-4" /> };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Estoque de Insumos</h2>
                    <p className="text-sm text-muted-foreground">Gerencie matérias-primas, compras e movimentações</p>
                </div>
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => { setEditingItem(null); setFormData({ name: "", unit: "unidade", current_stock: "", min_stock: "", cost_per_unit: "", supplier: "" }); }}>
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
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                                    <Input type="number" step={getStepForUnit(formData.unit)} value={formData.current_stock} onChange={e => setFormData({ ...formData, current_stock: e.target.value })} placeholder="0.000" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Estoque Mínimo</Label>
                                    <Input type="number" step={getStepForUnit(formData.unit)} value={formData.min_stock} onChange={e => setFormData({ ...formData, min_stock: e.target.value })} placeholder="0.000" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Fornecedor</Label>
                                <Input value={formData.supplier} onChange={e => setFormData({ ...formData, supplier: e.target.value })} placeholder="Ex: Distribuidora XYZ" />
                            </div>
                            <Button type="submit" className="w-full">{editingItem ? "Salvar Alterações" : "Cadastrar"}</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Adjust Stock Dialog */}
            <Dialog open={!!adjustingStockItem} onOpenChange={(open) => !open && setAdjustingStockItem(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Ajuste Manual de Balanço</DialogTitle>
                    </DialogHeader>
                    {adjustingStockItem && (
                    <div className="space-y-4 pt-4">
                        <div className="bg-muted p-4 rounded-lg flex justify-between items-center border border-border">
                            <div>
                                <p className="font-bold text-sm text-foreground">{adjustingStockItem.name}</p>
                                <p className="text-xs text-muted-foreground">Estoque Atual: {adjustingStockItem.current_stock} {adjustingStockItem.unit}</p>
                            </div>
                            <Scale className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div className="space-y-2">
                            <Label>Novo Saldo (Quantidade Exata)</Label>
                            <Input
                                type="number"
                                step={getStepForUnit(adjustingStockItem.unit)}
                                value={stockAdjustment.newBalance}
                                onChange={e => setStockAdjustment({ newBalance: e.target.value })}
                                placeholder={`Ex: ${adjustingStockItem.current_stock}`}
                            />
                        </div>
                        <Button onClick={handleAdjustStock} className="w-full">Confirmar Retificação</Button>
                    </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Purchase Entry Dialog */}
            <Dialog open={!!purchaseItem} onOpenChange={(open) => !open && setPurchaseItem(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Entrada de Estoque (Compra)</DialogTitle>
                    </DialogHeader>
                    {purchaseItem && (
                    <div className="space-y-4 pt-4">
                        <div className="bg-green-50 p-4 rounded-lg flex justify-between items-center border border-green-200">
                            <div>
                                <p className="font-bold text-sm text-green-800">{purchaseItem.name}</p>
                                <p className="text-xs text-green-600">Estoque Atual: {purchaseItem.current_stock} {purchaseItem.unit}</p>
                                {purchaseItem.supplier && <p className="text-xs text-green-600">Fornecedor: {purchaseItem.supplier}</p>}
                            </div>
                            <ShoppingCart className="w-6 h-6 text-green-600" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Quantidade Comprada ({purchaseItem.unit})</Label>
                                <Input
                                    type="number"
                                    step={getStepForUnit(purchaseItem.unit)}
                                    value={purchaseData.quantity}
                                    onChange={e => setPurchaseData({ ...purchaseData, quantity: e.target.value })}
                                    placeholder="0.000"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Custo Total (R$)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={purchaseData.cost}
                                    onChange={e => setPurchaseData({ ...purchaseData, cost: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Observações (Opcional)</Label>
                            <Input
                                value={purchaseData.notes}
                                onChange={e => setPurchaseData({ ...purchaseData, notes: e.target.value })}
                                placeholder="Ex: NF 12345, Lote ABC"
                            />
                        </div>
                        <div className="bg-muted/50 p-3 rounded-lg border border-border text-xs text-muted-foreground">
                            Novo estoque após entrada: <strong className="text-foreground">{(purchaseItem.current_stock + (Number(purchaseData.quantity) || 0)).toFixed(3)} {purchaseItem.unit}</strong>
                        </div>
                        <Button onClick={handlePurchaseEntry} className="w-full bg-green-600 hover:bg-green-700">
                            <ShoppingCart className="w-4 h-4 mr-2" /> Confirmar Entrada
                        </Button>
                    </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Movement History Dialog */}
            <Dialog open={!!historyItem} onOpenChange={(open) => !open && setHistoryItem(null)}>
                <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Histórico — {historyItem?.name}</DialogTitle>
                    </DialogHeader>
                    {historyItem && (
                    <div className="space-y-3 pt-2">
                        {loadingMovements ? (
                            <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>
                        ) : movements.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm italic">Nenhuma movimentação registrada para este insumo.</div>
                        ) : (
                            movements.map(m => (
                                <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${typeColor[m.type]}`}>
                                        {typeIcon[m.type]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${typeColor[m.type]}`}>{typeLabel[m.type]}</span>
                                            <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")}</span>
                                        </div>
                                        <p className="text-sm font-medium text-foreground mt-0.5">{m.quantity.toFixed(3)} {historyItem.unit}</p>
                                        {m.reference && <p className="text-xs text-muted-foreground truncate">{m.reference}</p>}
                                        {m.notes && <p className="text-xs text-muted-foreground italic truncate">{m.notes}</p>}
                                    </div>
                                    {m.cost > 0 && <span className="text-xs font-bold text-foreground shrink-0">{formatCurrency(m.cost)}</span>}
                                </div>
                            ))
                        )}
                    </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* KPI Cards */}
            <div className="grid sm:grid-cols-4 gap-4">
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
                <div className="bg-card p-5 rounded-xl border border-border/50 shadow-sm">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Fornecedores</p>
                    <p className="text-2xl font-bold">{new Set(items.map(i => i.supplier).filter(Boolean)).size}</p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border flex items-center">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input className="pl-9" placeholder="Buscar por insumo ou fornecedor..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-xs font-medium text-muted-foreground uppercase">
                            <tr>
                                <th className="px-6 py-3">Insumo</th>
                                <th className="px-6 py-3">Fornecedor</th>
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
                                    <td className="px-6 py-4 text-muted-foreground text-xs">{item.supplier || "—"}</td>
                                    <td className="px-6 py-4">
                                        <span className={`font-bold ${item.current_stock <= item.min_stock ? 'text-destructive' : 'text-foreground'}`}>
                                            {Number(item.current_stock).toFixed(3)} {item.unit}
                                        </span>
                                        {item.current_stock <= item.min_stock && (
                                            <AlertTriangle className="w-3 h-3 inline ml-1 text-destructive animate-pulse" />
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground">{Number(item.min_stock).toFixed(3)} {item.unit}</td>
                                    <td className="px-6 py-4">{formatCurrency(item.cost_per_unit)}</td>
                                    <td className="px-6 py-4 font-medium text-primary">{formatCurrency(item.current_stock * item.cost_per_unit)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" title="Entrada de Compra" onClick={() => { setPurchaseItem(item); setPurchaseData({ quantity: "", cost: "", notes: "" }); }}>
                                                <ShoppingCart className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" title="Ajuste de Balanço" onClick={() => { setAdjustingStockItem(item); setStockAdjustment({ newBalance: String(item.current_stock) }); }}>
                                                <Scale className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-600" title="Histórico" onClick={() => openHistory(item)}>
                                                <History className="w-4 h-4" />
                                            </Button>
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
                                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground italic">
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
