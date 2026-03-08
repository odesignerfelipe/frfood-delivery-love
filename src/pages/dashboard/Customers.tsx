import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    Users, Search, FileDown, FileSpreadsheet, Phone,
    Pencil, Trash2, MoreVertical, X
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Customer {
    id: string;
    name: string;
    phone: string;
    address: string;
    neighborhood: string;
    total_orders: number;
    total_spent: number;
    last_order_at: string;
}

const Customers = () => {
    const { store } = useStore();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

    const fetchCustomers = useCallback(async () => {
        if (!store) return;
        setLoading(true);
        try {
            // Tenta buscar com a ordenação da nova coluna
            const { data, error } = await supabase
                .from("customers")
                .select("*")
                .eq("store_id", store.id)
                .order("last_order_at", { ascending: false });

            if (error) {
                // Se o erro for especificamente a coluna que falta no cache (last_order_at)
                if (error.message.includes('last_order_at')) {
                    const { data: fallbackData, error: fallbackError } = await supabase
                        .from("customers")
                        .select("id, name, phone, address, neighborhood, created_at")
                        .eq("store_id", store.id);

                    if (fallbackError) throw fallbackError;

                    // Mapeia para garantir que campos não existentes no cache tenham valores padrão
                    const normalizedData = (fallbackData as any[] || []).map(c => ({
                        ...c,
                        total_orders: c.total_orders || 0,
                        total_spent: c.total_spent || 0,
                        last_order_at: c.last_order_at || null
                    }));

                    setCustomers(normalizedData);
                } else {
                    throw error;
                }
            } else {
                setCustomers(data || []);
            }
        } catch (error: any) {
            console.error("Error fetching customers:", error);
            toast.error(`Erro ao carregar clientes: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, [store]);

    useEffect(() => {
        fetchCustomers();
    }, [store]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCustomer) return;

        const { error } = await supabase
            .from("customers")
            .update({
                name: selectedCustomer.name,
                phone: selectedCustomer.phone,
                address: selectedCustomer.address,
                neighborhood: selectedCustomer.neighborhood,
                updated_at: new Date().toISOString(),
            })
            .eq("id", selectedCustomer.id);

        if (error) {
            toast.error("Erro ao atualizar cliente");
        } else {
            toast.success("Cliente atualizado!");
            setIsEditing(false);
            fetchCustomers();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Deseja realmente excluir este cliente?")) return;

        const { error } = await supabase
            .from("customers")
            .delete()
            .eq("id", id);

        if (error) {
            toast.error("Erro ao excluir cliente");
        } else {
            toast.success("Cliente excluído!");
            fetchCustomers();
        }
    };

    const filtered = useMemo(() => {
        if (!search.trim()) return customers;
        const q = search.toLowerCase();
        return customers.filter(
            (c) =>
                c.name.toLowerCase().includes(q) ||
                c.phone.toLowerCase().includes(q) ||
                (c.address || "").toLowerCase().includes(q) ||
                (c.neighborhood || "").toLowerCase().includes(q)
        );
    }, [customers, search]);

    const exportCSV = () => {
        if (filtered.length === 0) {
            toast.error("Nenhum cliente para exportar");
            return;
        }
        const header = "Nome,Telefone/WhatsApp,Endereço,Bairro,Total de Pedidos,Total Gasto";
        const rows = filtered.map(
            (c) =>
                `"${c.name}","${c.phone}","${c.address || ""}","${c.neighborhood || ""}",${c.total_orders},${c.total_spent}`
        );
        const csv = [header, ...rows].join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `clientes_${store?.name || "loja"}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Planilha exportada!");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Clientes</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        {customers.length} cliente{customers.length !== 1 ? "s" : ""} cadastrado{customers.length !== 1 ? "s" : ""}
                    </p>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={exportCSV}>
                        <FileSpreadsheet className="w-4 h-4 mr-1" /> Planilha
                    </Button>
                </div>
            </div>

            <div className="relative mb-4 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar cliente por nome, telefone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                />
            </div>

            <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                            <tr>
                                <th className="px-4 py-3">Nome</th>
                                <th className="px-4 py-3">Telefone</th>
                                <th className="px-4 py-3">Endereço</th>
                                <th className="px-4 py-3">Pedidos / Gasto</th>
                                <th className="px-4 py-3">Último Pedido</th>
                                <th className="px-4 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((c) => (
                                <tr key={c.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                                    <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">{c.phone}</td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                        {c.address ? `${c.address}${c.neighborhood ? `, ${c.neighborhood}` : ""}` : "—"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-primary">{c.total_orders} pedidos</span>
                                            <span className="text-xs text-muted-foreground">R$ {Number(c.total_spent || 0).toFixed(2)}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                        {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString("pt-BR") : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <a
                                                href={`https://wa.me/55${c.phone.replace(/\D/g, "")}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 text-green-600 hover:bg-green-50 rounded-full transition-colors"
                                            >
                                                <Phone className="w-4 h-4" />
                                            </a>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-blue-600"
                                                onClick={() => {
                                                    setSelectedCustomer(c);
                                                    setIsEditing(true);
                                                }}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive"
                                                onClick={() => handleDelete(c.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filtered.length === 0 && (
                        <div className="p-12 text-center text-muted-foreground">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">Nenhum cliente encontrado</p>
                        </div>
                    )}
                </div>
            </div>

            <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Cliente</DialogTitle>
                    </DialogHeader>
                    {selectedCustomer && (
                        <form onSubmit={handleUpdate} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>Nome</Label>
                                <Input
                                    value={selectedCustomer.name}
                                    onChange={e => setSelectedCustomer({ ...selectedCustomer, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Telefone</Label>
                                <Input
                                    value={selectedCustomer.phone}
                                    onChange={e => setSelectedCustomer({ ...selectedCustomer, phone: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Endereço</Label>
                                <Input
                                    value={selectedCustomer.address || ""}
                                    onChange={e => setSelectedCustomer({ ...selectedCustomer, address: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Bairro</Label>
                                <Input
                                    value={selectedCustomer.neighborhood || ""}
                                    onChange={e => setSelectedCustomer({ ...selectedCustomer, neighborhood: e.target.value })}
                                />
                            </div>
                            <DialogFooter className="pt-4">
                                <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>Cancelar</Button>
                                <Button type="submit">Salvar Alterações</Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Customers;
