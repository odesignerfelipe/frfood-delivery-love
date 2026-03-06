import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { LayoutDashboard, Store, Users, CreditCard, BarChart3, Settings, FileText, LogOut, Menu, X, ChevronLeft, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/admin/stores", label: "Lojas", icon: Store },
    { to: "/admin/clients", label: "Clientes", icon: Users },
    { to: "/admin/plans", label: "Planos", icon: CreditCard },
    { to: "/admin/reports", label: "Relatórios", icon: BarChart3 },
    { to: "/admin/settings", label: "Configurações", icon: Settings },
    { to: "/admin/landing-page", label: "Landing Page", icon: FileText },
    { to: "/admin/updates", label: "Atualizações", icon: Newspaper },
];

const AdminLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/");
    };

    const linkClass = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
            : "text-slate-400 hover:text-white hover:bg-white/5"
        }`;

    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="px-6 py-5 border-b border-white/10 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center shadow-lg shadow-primary/30">
                    <LayoutDashboard className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-base font-extrabold text-white tracking-tight">FRFood</h1>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Super Admin</p>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={linkClass}
                        onClick={() => setSidebarOpen(false)}
                    >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* Footer */}
            <div className="px-4 py-4 border-t border-white/10 space-y-2">
                <button
                    onClick={() => { navigate("/dashboard"); setSidebarOpen(false); }}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors w-full"
                >
                    <ChevronLeft className="w-5 h-5" />
                    <span>Minha Loja</span>
                </button>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors w-full"
                >
                    <LogOut className="w-5 h-5" />
                    <span>Sair</span>
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex w-64 bg-slate-900 flex-col fixed inset-y-0 left-0 z-30">
                <SidebarContent />
            </aside>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
                    <aside className="absolute left-0 top-0 h-full w-64 bg-slate-900 shadow-2xl">
                        <SidebarContent />
                    </aside>
                </div>
            )}

            {/* Main Area */}
            <div className="flex-1 lg:ml-64">
                {/* Mobile Top Bar */}
                <div className="lg:hidden sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-slate-200/60 px-4 py-3 flex items-center justify-between">
                    <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
                        <Menu className="w-5 h-5 text-slate-700" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center">
                            <LayoutDashboard className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-slate-800 text-sm">FRFood Admin</span>
                    </div>
                    <div className="w-9" />
                </div>

                {/* Page Content */}
                <main className="p-4 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
