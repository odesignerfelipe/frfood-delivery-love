import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Search, Mail, Phone, Store, Calendar } from "lucide-react";
import { format } from "date-fns";

const AdminClients = () => {
    const [profiles, setProfiles] = useState<any[]>([]);
    const [stores, setStores] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);

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

    // Realtime
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
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por nome, telefone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 w-72"
                        />
                    </div>
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
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${userStore.plan_type === "yearly" ? "bg-purple-100 text-purple-700" :
                                                        userStore.plan_type === "monthly" ? "bg-blue-100 text-blue-700" :
                                                            "bg-slate-100 text-slate-600"
                                                    }`}>
                                                    {userStore.plan_type === "yearly" ? "Anual" : userStore.plan_type === "monthly" ? "Mensal" : userStore.plan_type === "trial" ? "Trial" : userStore.plan_type}
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
                                    </tr>
                                );
                            })}
                            {filteredProfiles.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-slate-400">
                                        {search ? "Nenhum resultado encontrado." : "Nenhum usuário cadastrado."}
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

export default AdminClients;
