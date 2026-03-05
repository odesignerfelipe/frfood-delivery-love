import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, Search, Phone, Store, Calendar, Trash2, Edit2 } from "lucide-react";
import { format } from "date-fns";

const AdminClients = () => {
    const [profiles, setProfiles] = useState<any[]>([]);
    const [stores, setStores] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    // Edit
    const [editProfile, setEditProfile] = useState<any>(null);
    const [editName, setEditName] = useState("");
    const [editPhone, setEditPhone] = useState("");
    // Delete
    const [deleteProfile, setDeleteProfile] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchData = useCallback(async () => {
        const [profilesRes, storesRes] = await Promise.all([
            supabase.from("profiles").select("*").order("created_at", { ascending: false }),
            supabase.from("stores").select("id, name, slug, owner_id, plan_type, plan_status"),
        ]);
        setProfiles(profilesRes.data || []);
        setStores(storesRes.data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        const channel = supabase
            .channel("admin-clients")
            .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchData]);

    const filteredProfiles = profiles.filter((p) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            (p.full_name || "").toLowerCase().includes(q) ||
            (p.phone || "").toLowerCase().includes(q) ||
            (p.user_id || "").toLowerCase().includes(q)
        );
    });

    const getStore = (userId: string) => stores.find((s) => s.owner_id === userId);

    const openEdit = (profile: any) => {
        setEditProfile(profile);
        setEditName(profile.full_name || "");
        setEditPhone(profile.phone || "");
    };

    const saveEdit = async () => {
        if (!editProfile) return;
        const { error } = await supabase
            .from("profiles")
            .update({ full_name: editName, phone: editPhone })
            .eq("id", editProfile.id);
        if (error) { toast.error("Erro ao atualizar"); console.error(error); }
        else { toast.success("Cliente atualizado!"); setEditProfile(null); fetchData(); }
    };

    const confirmDelete = async () => {
        if (!deleteProfile) return;
        setDeleting(true);

        // Find and delete any associated store + data
        const userStore = getStore(deleteProfile.user_id);
        if (userStore) {
            await supabase.from("order_items").delete().in("order_id",
                (await supabase.from("orders").select("id").eq("store_id", userStore.id)).data?.map((o: any) => o.id) || []
            );
            await supabase.from("orders").delete().eq("store_id", userStore.id);
            await supabase.from("product_variations").delete().in("product_id",
                (await supabase.from("products").select("id").eq("store_id", userStore.id)).data?.map((p: any) => p.id) || []
            );
            await supabase.from("products").delete().eq("store_id", userStore.id);
            await supabase.from("delivery_areas").delete().eq("store_id", userStore.id);
            await supabase.from("coupons").delete().eq("store_id", userStore.id);
            await supabase.from("stores").delete().eq("id", userStore.id);
        }

        // Delete profile
        const { error } = await supabase.from("profiles").delete().eq("id", deleteProfile.id);
        if (error) { toast.error("Erro ao remover: " + error.message); console.error(error); }
        else { toast.success("Cliente removido com sucesso!"); setDeleteProfile(null); fetchData(); }
        setDeleting(false);
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Clientes</h1>
                    <p className="text-sm text-slate-500">{profiles.length} usuários registrados na plataforma</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input placeholder="Buscar por nome, telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 w-72" />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200/60 bg-slate-50/50">
                                <th className="text-left px-6 py-4 font-semibold text-slate-600">Usuário</th>
                                <th className="text-left px-6 py-4 font-semibold text-slate-600">Telefone</th>
                                <th className="text-left px-6 py-4 font-semibold text-slate-600">Loja</th>
                                <th className="text-left px-6 py-4 font-semibold text-slate-600">Plano</th>
                                <th className="text-left px-6 py-4 font-semibold text-slate-600">Cadastro</th>
                                <th className="text-right px-6 py-4 font-semibold text-slate-600">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProfiles.map((profile) => {
                                const userStore = getStore(profile.user_id);
                                return (
                                    <tr key={profile.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-orange-100 flex items-center justify-center">
                                                    <span className="text-primary font-bold text-sm">{(profile.full_name || "?").charAt(0).toUpperCase()}</span>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-900">{profile.full_name || "Sem nome"}</p>
                                                    <p className="text-xs text-slate-400 font-mono">{profile.user_id?.slice(0, 8)}...</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {profile.phone ? (
                                                <span className="flex items-center gap-1.5 text-slate-600">
                                                    <Phone className="w-3.5 h-3.5" /> {profile.phone}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {userStore ? (
                                                <div className="flex items-center gap-2">
                                                    <Store className="w-4 h-4 text-primary" />
                                                    <div>
                                                        <p className="font-medium text-slate-700">{userStore.name}</p>
                                                        <p className="text-xs text-slate-400">{userStore.slug}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">Sem loja</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {userStore ? (
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${userStore.plan_type === "yearly" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                                                    }`}>
                                                    {userStore.plan_type === "yearly" ? "Anual" : "Mensal"}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="flex items-center gap-1.5 text-slate-500 text-xs">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {format(new Date(profile.created_at), "dd/MM/yyyy")}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(profile)} title="Editar">
                                                    <Edit2 className="w-4 h-4 text-blue-500" />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDeleteProfile(profile)} title="Remover">
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredProfiles.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                                        {search ? "Nenhum resultado encontrado." : "Nenhum usuário cadastrado."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Client Modal */}
            <Dialog open={!!editProfile} onOpenChange={(v) => !v && setEditProfile(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Cliente</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Nome Completo</label>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome do cliente" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Telefone</label>
                            <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="(00) 00000-0000" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditProfile(null)}>Cancelar</Button>
                        <Button onClick={saveEdit}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Client Modal */}
            <Dialog open={!!deleteProfile} onOpenChange={(v) => !v && setDeleteProfile(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Remover Cliente</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-3">
                        <p className="text-sm text-slate-600">
                            Tem certeza que deseja remover o cliente <strong>{deleteProfile?.full_name || "Sem nome"}</strong>?
                        </p>
                        {getStore(deleteProfile?.user_id) && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                                ⚠️ Este cliente possui a loja <strong>{getStore(deleteProfile?.user_id)?.name}</strong>. Todos os dados da loja (produtos, pedidos, etc.) serão permanentemente excluídos junto com o perfil.
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteProfile(null)} disabled={deleting}>Cancelar</Button>
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

export default AdminClients;
