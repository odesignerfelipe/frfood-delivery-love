import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Store, Users, DollarSign, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const AdminDashboard = () => {
    const [stats, setStats] = useState({ stores: 0, customers: 0, revenue: 0 });
    const navigate = useNavigate();

    useEffect(() => {
        const fetchStats = async () => {
            const { data: stores } = await supabase.from("stores").select("id");
            const { data: profiles } = await supabase.from("profiles").select("id");

            setStats({
                stores: stores?.length || 0,
                customers: profiles?.length || 0,
                revenue: 0, // Placeholder
            });
        };
        fetchStats();
    }, []);

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Painel Super Admin</h1>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-slate-500">Total de Lojas</CardTitle>
                        <Store className="w-4 h-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{stats.stores}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-slate-500">Usuários Cadastrados</CardTitle>
                        <Users className="w-4 h-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{stats.customers}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-slate-500">Faturamento Realizado</CardTitle>
                        <DollarSign className="w-4 h-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">R$ {stats.revenue.toFixed(2)}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Button
                    variant="outline"
                    className="h-32 flex flex-col items-center justify-center gap-2 border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all text-slate-700"
                    onClick={() => navigate("/admin/stores")}
                >
                    <Store className="w-8 h-8" />
                    <span className="font-bold">Gerenciar Lojas</span>
                </Button>
                <Button
                    variant="outline"
                    className="h-32 flex flex-col items-center justify-center gap-2 border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all text-slate-700"
                    onClick={() => navigate("/admin/landing-page")}
                >
                    <LayoutDashboard className="w-8 h-8" />
                    <span className="font-bold">Gerenciar Landing Page</span>
                </Button>
            </div>
        </div>
    );
};

export default AdminDashboard;
