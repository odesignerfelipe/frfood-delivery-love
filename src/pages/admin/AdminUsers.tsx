import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, UserPlus, Search, Edit2, Trash2, Mail, Phone, Shield, Calendar, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const AdminUsers = () => {
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterRole, setFilterRole] = useState("all");

    // Create Modal
    const [createOpen, setCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newPhone, setNewPhone] = useState("");
    const [newRole, setNewRole] = useState("user");
    const [showPassword, setShowPassword] = useState(false);

    // Edit Modal
    const [editUser, setEditUser] = useState<any>(null);
    const [editName, setEditName] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editRole, setEditRole] = useState("");
    const [editPassword, setEditPassword] = useState("");
    const [saving, setSaving] = useState(false);

    // Delete Modal
    const [deleteUser, setDeleteUser] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchProfiles = useCallback(async () => {
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) console.error("Error fetching profiles:", error);
        setProfiles(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

    useEffect(() => {
        const channel = supabase
            .channel("admin-users-live")
            .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchProfiles())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchProfiles]);

    const getAuthToken = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token || "";
    };

    const handleCreate = async () => {
        if (!newEmail || !newPassword) {
            toast.error("Email e senha são obrigatórios");
            return;
        }
        if (newPassword.length < 6) {
            toast.error("Senha deve ter pelo menos 6 caracteres");
            return;
        }
        setCreating(true);

        try {
            const token = await getAuthToken();
            const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-user-management`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    action: "create",
                    email: newEmail,
                    password: newPassword,
                    full_name: newName,
                    phone: newPhone,
                    role: newRole,
                }),
            });

            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || "Erro ao criar usuário");

            toast.success("Usuário criado com sucesso!");
            setCreateOpen(false);
            resetCreateForm();
            fetchProfiles();
        } catch (err: any) {
            toast.error(err.message || "Erro ao criar usuário");
        } finally {
            setCreating(false);
        }
    };

    const resetCreateForm = () => {
        setNewName("");
        setNewEmail("");
        setNewPassword("");
        setNewPhone("");
        setNewRole("user");
        setShowPassword(false);
    };

    const openEdit = (profile: any) => {
        setEditUser(profile);
        setEditName(profile.full_name || "");
        setEditPhone(profile.phone || "");
        setEditRole((profile as any).role || "user");
        setEditPassword("");
    };

    const handleSaveEdit = async () => {
        if (!editUser) return;
        setSaving(true);

        try {
            const token = await getAuthToken();
            const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-user-management`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    action: "update",
                    targetUserId: editUser.id,
                    full_name: editName,
                    phone: editPhone,
                    role: editRole,
                    ...(editPassword ? { password: editPassword } : {}),
                }),
            });

            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || "Erro ao atualizar");

            toast.success("Usuário atualizado!");
            setEditUser(null);
            fetchProfiles();
        } catch (err: any) {
            toast.error(err.message || "Erro ao atualizar");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteUser) return;
        setDeleting(true);

        try {
            const token = await getAuthToken();
            const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-user-management`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    action: "delete",
                    targetUserId: deleteUser.id,
                }),
            });

            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || "Erro ao excluir");

            toast.success("Usuário removido!");
            setDeleteUser(null);
            fetchProfiles();
        } catch (err: any) {
            toast.error(err.message || "Erro ao excluir");
        } finally {
            setDeleting(false);
        }
    };

    const filteredProfiles = profiles.filter((p) => {
        if (filterRole !== "all" && (p as any).role !== filterRole) return false;
        if (search) {
            const q = search.toLowerCase();
            if (
                !(p.full_name || "").toLowerCase().includes(q) &&
                !(p.phone || "").toLowerCase().includes(q) &&
                !(p.id || "").toLowerCase().includes(q)
            ) return false;
        }
        return true;
    });

    const roleCounts = {
        total: profiles.length,
        admin: profiles.filter(p => (p as any).role === "admin").length,
        user: profiles.filter(p => (p as any).role !== "admin").length,
    };

    const roleBadge = (role: string) => {
        switch (role) {
            case "admin": return "bg-red-100 text-red-700";
            default: return "bg-blue-100 text-blue-700";
        }
    };

    const roleLabel = (role: string) => {
        switch (role) {
            case "admin": return "Admin";
            default: return "Usuário";
        }
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
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Usuários</h1>
                    <p className="text-sm text-slate-500">Gerencie os usuários cadastrados na plataforma</p>
                </div>
                <Button onClick={() => { resetCreateForm(); setCreateOpen(true); }} className="shadow-lg shadow-primary/20">
                    <UserPlus className="w-4 h-4 mr-2" /> Novo Usuário
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: "Total", value: roleCounts.total, icon: Users, color: "bg-slate-100 text-slate-700" },
                    { label: "Administradores", value: roleCounts.admin, icon: Shield, color: "bg-red-50 text-red-700" },
                    { label: "Usuários", value: roleCounts.user, icon: Users, color: "bg-blue-50 text-blue-700" },
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
                    <Input placeholder="Buscar por nome ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                </div>
                <div className="flex gap-2">
                    <span className="text-sm text-slate-500 self-center">Tipo:</span>
                    {["all", "user", "admin"].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilterRole(f)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filterRole === f ? "bg-primary text-white border-primary" : "bg-white text-slate-500 border-slate-200 hover:border-primary/40"}`}
                        >
                            {f === "all" ? "Todos" : roleLabel(f)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200/60 bg-slate-50/50">
                                <th className="text-left px-6 py-4 font-semibold text-slate-600">Nome</th>
                                <th className="text-left px-6 py-4 font-semibold text-slate-600">Telefone</th>
                                <th className="text-left px-6 py-4 font-semibold text-slate-600">Tipo</th>
                                <th className="text-left px-6 py-4 font-semibold text-slate-600">Cadastro</th>
                                <th className="text-right px-6 py-4 font-semibold text-slate-600">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProfiles.map((profile) => (
                                <tr key={profile.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                                <Users className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900">{profile.full_name || "Sem nome"}</p>
                                                <p className="text-xs text-slate-400 font-mono">{profile.id.substring(0, 8)}...</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-slate-700">{profile.phone || "—"}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${roleBadge((profile as any).role)}`}>
                                            {roleLabel((profile as any).role)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-500">
                                        {profile.created_at ? format(new Date(profile.created_at), "dd/MM/yyyy") : "—"}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(profile)} title="Editar">
                                                <Edit2 className="w-4 h-4 text-blue-500" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDeleteUser(profile)} title="Remover">
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredProfiles.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-slate-400">
                                        Nenhum usuário encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create User Modal */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-primary" /> Cadastrar Novo Usuário
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Nome Completo</Label>
                            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="João da Silva" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Email *</Label>
                            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="joao@email.com" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Senha *</Label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Mínimo 6 caracteres"
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Telefone</Label>
                            <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="(11) 99999-9999" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Tipo</Label>
                            <Select value={newRole} onValueChange={setNewRole}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">Usuário</SelectItem>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancelar</Button>
                        <Button onClick={handleCreate} disabled={creating}>
                            {creating ? (
                                <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />Criando...</>
                            ) : "Criar Usuário"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit User Modal */}
            <Dialog open={!!editUser} onOpenChange={(v) => !v && setEditUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Usuário</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Nome Completo</Label>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Telefone</Label>
                            <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Tipo</Label>
                            <Select value={editRole} onValueChange={setEditRole}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">Usuário</SelectItem>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Nova Senha (opcional)</Label>
                            <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Deixe vazio para não alterar" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
                        <Button onClick={handleSaveEdit} disabled={saving}>
                            {saving ? (
                                <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />Salvando...</>
                            ) : "Salvar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Modal */}
            <Dialog open={!!deleteUser} onOpenChange={(v) => !v && setDeleteUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Remover Usuário</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-3">
                        <p className="text-sm text-slate-600">
                            Tem certeza que deseja remover <strong>{deleteUser?.full_name || "este usuário"}</strong>?
                        </p>
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                            ⚠️ Esta ação é irreversível. O usuário será permanentemente excluído do sistema de autenticação e perderá acesso à plataforma.
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteUser(null)} disabled={deleting}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
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

export default AdminUsers;
