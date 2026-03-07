import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, UserCircle, ShieldAlert } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const Waiters = () => {
    const { store } = useStore();
    const [waiters, setWaiters] = useState<any[]>([]);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);

    // Form State
    const [name, setName] = useState("");
    const [login, setLogin] = useState("");
    const [password, setPassword] = useState("");
    const [isActive, setIsActive] = useState(true);

    const fetchWaiters = async () => {
        if (!store) return;
        const { data } = await supabase
            .from("waiters")
            .select("id, name, login, is_active") // We don't fetch password_hash
            .eq("store_id", store.id)
            .order("name");
        setWaiters(data || []);
    };

    useEffect(() => {
        fetchWaiters();
    }, [store]);

    const handleSave = async () => {
        if (!store || !name.trim() || !login.trim()) {
            toast.error("Preencha todos os campos obrigatórios");
            return;
        }

        if (!editing && !password) {
            toast.error("Uma senha inicial é obrigatória para o novo garçom");
            return;
        }

        try {
            if (editing) {
                const updateData: any = { name, login, is_active: isActive };
                // Only update password if a new one is provided
                if (password.trim()) {
                    updateData.password_hash = password;
                    // The database trigger will automatically hash this plaintext password
                }

                const { error } = await supabase.from("waiters").update(updateData).eq("id", editing.id);
                if (error) throw error;
                toast.success("Garçom atualizado!");
            } else {
                const { error } = await supabase.from("waiters").insert({
                    name,
                    login,
                    password_hash: password, // Database hashes it
                    is_active: isActive,
                    store_id: store.id
                });
                if (error) throw error;
                toast.success("Garçom cadastrado!");
            }
            setOpen(false);
            resetForm();
            fetchWaiters();
        } catch (err: any) {
            if (err.code === '23505') {
                toast.error("Já existe um garçom com este login na sua loja.");
            } else {
                toast.error("Erro ao salvar garçom.");
                console.error(err);
            }
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Excluir este garçom? O histórico dele nas comandas será mantido mas ele perderá o acesso.")) return;
        await supabase.from("waiters").delete().eq("id", id);
        toast.success("Garçom excluído da equipe.");
        fetchWaiters();
    };

    const openEdit = (waiter: any) => {
        setEditing(waiter);
        setName(waiter.name);
        setLogin(waiter.login);
        setPassword(""); // Keep it empty, only change if typing
        setIsActive(waiter.is_active);
        setOpen(true);
    };

    const openNew = () => {
        resetForm();
        setOpen(true);
    };

    const resetForm = () => {
        setEditing(null);
        setName("");
        setLogin("");
        setPassword("");
        setIsActive(true);
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Garçons</h2>
                    <p className="text-muted-foreground text-sm">Gerencie o acesso da sua equipe ao painel de pedidos nas mesas.</p>
                </div>
                <Dialog open={open} onOpenChange={(val) => {
                    if (!val) resetForm();
                    setOpen(val);
                }}>
                    <DialogTrigger asChild>
                        <Button variant="hero" size="sm" onClick={openNew}>
                            <Plus className="w-4 h-4 mr-1" /> Novo Garçom
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editing ? "Editar Garçom" : "Novo Garçom"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label>Nome Completo</Label>
                                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: João Silva" />
                            </div>
                            <div>
                                <Label>Login <span className="text-muted-foreground font-normal text-xs">(Sem espaços)</span></Label>
                                <Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Ex: joao123" />
                            </div>
                            <div>
                                <Label>Senha {editing && <span className="text-muted-foreground font-normal text-xs">(Deixe em branco para não alterar)</span>}</Label>
                                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="*******" />
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <Label>Acesso Ativo</Label>
                                    <p className="text-xs text-muted-foreground">O garçom pode logar no sistema.</p>
                                </div>
                                <Switch checked={isActive} onCheckedChange={setIsActive} />
                            </div>
                            <Button variant="hero" onClick={handleSave} className="w-full">
                                {editing ? "Salvar Alterações" : "Cadastrar Garçom"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="space-y-4">
                {waiters.length === 0 && (
                    <div className="text-center py-16 bg-card rounded-xl border border-dashed border-border">
                        <UserCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium text-foreground mb-1">Nenhum garçom cadastrado</h3>
                        <p className="text-muted-foreground mb-4">Cadastre sua equipe para permitir o lançamento de comandas nas mesas.</p>
                        <Button variant="outline" onClick={openNew}>
                            <Plus className="w-4 h-4 mr-1" /> Cadastrar o Primeiro
                        </Button>
                    </div>
                )}

                <div className="bg-card rounded-xl shadow-sm border border-border/50 overflow-hidden">
                    {waiters.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground bg-muted/50 uppercase">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Nome</th>
                                        <th className="px-6 py-3 font-medium">Login</th>
                                        <th className="px-6 py-3 font-medium">Status do Acesso</th>
                                        <th className="px-6 py-3 font-medium text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {waiters.map((waiter) => (
                                        <tr key={waiter.id} className="hover:bg-muted/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-foreground flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                    <UserCircle className="w-5 h-5" />
                                                </div>
                                                {waiter.name}
                                            </td>
                                            <td className="px-6 py-4">
                                                <code className="bg-muted px-2 py-1 rounded text-xs">{waiter.login}</code>
                                            </td>
                                            <td className="px-6 py-4">
                                                {waiter.is_active ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                        Ativo
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                                        Inativo
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(waiter)}>
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(waiter.id)}>
                                                    <Trash2 className="w-4 h-4 text-destructive" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="flex items-start gap-3 p-4 bg-blue-50/50 text-blue-800 rounded-lg text-sm border border-blue-100 dark:bg-blue-900/10 dark:text-blue-200 dark:border-blue-900/30">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <p>
                        <strong>Acesso dos Garçons:</strong> O link para os garçons acessarem o sistema de comandas é <code className="bg-white dark:bg-black/20 px-1 py-0.5 rounded">{window.location.protocol}//{window.location.host}/garcom</code>. Informe este endereço para sua equipe logar com o usuário e senha cadastrados acima.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Waiters;
