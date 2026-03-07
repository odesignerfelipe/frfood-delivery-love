import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStorePublic } from "@/hooks/useStorePublic";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, Coffee, ArrowRight, UserCircle } from "lucide-react";
import { toast } from "sonner";

interface WaiterDashboardProps {
    explicitSlug?: string;
}

const WaiterDashboard = ({ explicitSlug }: WaiterDashboardProps) => {
    const { slug: paramSlug } = useParams();
    const activeSlug = explicitSlug || paramSlug;
    const { store, loading } = useStorePublic(activeSlug);
    const navigate = useNavigate();

    const [waiterSession, setWaiterSession] = useState<any>(null);
    const [tables, setTables] = useState<any[]>([]);
    const [openComandas, setOpenComandas] = useState<any[]>([]);
    const [isLoadingTables, setIsLoadingTables] = useState(true);

    useEffect(() => {
        if (store && !loading) {
            const sessionStr = localStorage.getItem(`waiter_session_${store.id}`);
            if (!sessionStr) {
                // Redirect to login
                if (explicitSlug) {
                    navigate("/garcom");
                } else {
                    navigate(`/loja/${store.slug}/garcom`);
                }
                return;
            }

            try {
                const session = JSON.parse(sessionStr);
                setWaiterSession(session);
                fetchTablesAndComandas();
            } catch (e) {
                navigate(explicitSlug ? "/garcom" : `/loja/${store.slug}/garcom`);
            }
        }
    }, [store, loading, explicitSlug, navigate]);

    const fetchTablesAndComandas = async () => {
        if (!store) return;
        setIsLoadingTables(true);
        try {
            // Fetch Tables
            const { data: tablesData, error: tablesError } = await supabase
                .from("tables")
                .select("*")
                .eq("store_id", store.id)
                .order("name");

            if (tablesError) throw tablesError;

            // Fetch Open Comandas
            const { data: comandasData, error: comandasError } = await supabase
                .from("comandas")
                .select("*")
                .eq("store_id", store.id)
                .eq("status", "open");

            if (comandasError) throw comandasError;

            setTables(tablesData || []);
            setOpenComandas(comandasData || []);
        } catch (err) {
            console.error(err);
            toast.error("Erro ao carregar mesas");
        } finally {
            setIsLoadingTables(false);
        }
    };

    // Subscribe to real-time changes on comandas
    useEffect(() => {
        if (!store) return;

        const channel = supabase
            .channel("waiter_comandas")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "comandas",
                    filter: `store_id=eq.${store.id}`,
                },
                () => {
                    fetchTablesAndComandas();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [store]);

    const logout = () => {
        if (store) {
            localStorage.removeItem(`waiter_session_${store.id}`);
            navigate(explicitSlug ? "/garcom" : `/loja/${store.slug}/garcom`);
        }
    };

    const handleTableClick = async (table: any, comanda: any) => {
        if (comanda) {
            // Already has open comanda, go to detail
            navigate(explicitSlug
                ? `/garcom/comanda/${comanda.id}`
                : `/loja/${store?.slug}/garcom/comanda/${comanda.id}`);
        } else {
            // Create new comanda
            try {
                const { data, error } = await supabase
                    .from("comandas")
                    .insert({
                        store_id: store?.id,
                        table_id: table.id,
                        waiter_id: waiterSession.waiter_id,
                        status: "open",
                        subtotal: 0,
                        discount: 0,
                        total: 0
                    })
                    .select()
                    .single();

                if (error) throw error;
                toast.success(`Comanda aberta para ${table.name}`);
                navigate(explicitSlug
                    ? `/garcom/comanda/${data.id}`
                    : `/loja/${store?.slug}/garcom/comanda/${data.id}`);
            } catch (err) {
                console.error(err);
                toast.error("Erro ao abrir comanda");
            }
        }
    };

    if (loading || !waiterSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/30">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/30 pb-20">
            {/* Header */}
            <header className="bg-card border-b border-border sticky top-0 z-10 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                            <UserCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="font-bold text-foreground leading-tight">Painel do Garçom</h1>
                            <p className="text-xs text-muted-foreground leading-tight">{waiterSession.name}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-destructive">
                        <LogOut className="w-5 h-5" />
                    </Button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto p-4 mt-4">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Coffee className="w-5 h-5" />
                    Mesas Disponíveis
                </h2>

                {isLoadingTables ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : tables.length === 0 ? (
                    <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border">
                        <p className="text-muted-foreground">Nenhuma mesa cadastrada na loja.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {tables.map(table => {
                            const activeComanda = openComandas.find(c => c.table_id === table.id);
                            const isOccupied = !!activeComanda;

                            return (
                                <button
                                    key={table.id}
                                    onClick={() => handleTableClick(table, activeComanda)}
                                    className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all text-left ${isOccupied
                                        ? "bg-primary/5 border-primary shadow-sm hover:bg-primary/10"
                                        : "bg-card border-border hover:border-primary/50 shadow-sm"
                                        }`}
                                >
                                    {isOccupied && (
                                        <span className="absolute top-2 right-2 flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                        </span>
                                    )}
                                    <h3 className={`text-2xl font-black mb-1 ${isOccupied ? "text-primary" : "text-foreground"}`}>
                                        {table.name}
                                    </h3>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        {isOccupied ? "Ocupada" : "Livre"}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
};

export default WaiterDashboard;
