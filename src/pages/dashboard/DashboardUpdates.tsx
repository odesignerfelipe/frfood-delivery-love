import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Newspaper, Video, Search, Calendar as CalendarIcon } from "lucide-react";

// Helper function to extract YouTube video ID
const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
};

export default function DashboardUpdates() {
    const [updates, setUpdates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [activeTab, setActiveTab] = useState<"update" | "tutorial">("update");
    const [searchQuery, setSearchQuery] = useState("");
    const [dateFilter, setDateFilter] = useState("");

    useEffect(() => {
        fetchUpdates();

        // Subscribe to realtime updates
        const channel = supabase
            .channel('public:platform_updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'platform_updates' },
                (payload: any) => {
                    if (payload.eventType === 'INSERT') {
                        setUpdates(current => [payload.new, ...current]);
                    } else if (payload.eventType === 'DELETE') {
                        setUpdates(current => current.filter((u: any) => u.id !== payload.old.id));
                    } else if (payload.eventType === 'UPDATE') {
                        setUpdates(current => current.map((u: any) => u.id === payload.new.id ? payload.new : u));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchUpdates = async () => {
        try {
            const { data, error } = await supabase
                .from("platform_updates")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setUpdates(data || []);
        } catch (error) {
            console.error("Erro ao carregar atualizações", error);
        } finally {
            setLoading(false);
        }
    };

    // Filter application
    const filteredUpdates = updates.filter(update => {
        if (update.type !== activeTab) return false;

        // Search filter
        if (searchQuery && !update.title.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
        }

        // Date filter
        if (dateFilter) {
            const updateDate = new Date(update.created_at).toISOString().split('T')[0];
            if (updateDate !== dateFilter) return false;
        }

        return true;
    });

    if (loading) {
        return (
            <div className="flex-1 p-4 lg:p-8 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="flex-1 p-4 lg:p-8 max-w-5xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Novidades e Tutoriais</h1>
                <p className="text-muted-foreground mt-2">
                    Acompanhe os novos recursos, correções e aprenda como extrair o máximo da plataforma.
                </p>
            </div>

            {/* Controls: Tabs & Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">

                {/* Tabs */}
                <div className="flex bg-card border border-border p-1 rounded-lg shadow-sm w-full sm:w-auto">
                    <button
                        onClick={() => setActiveTab("update")}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-md transition-all duration-200 ${activeTab === "update"
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                    >
                        <Newspaper className="w-4 h-4" />
                        Atualizações
                    </button>
                    <button
                        onClick={() => setActiveTab("tutorial")}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-md transition-all duration-200 ${activeTab === "tutorial"
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                    >
                        <Video className="w-4 h-4" />
                        Tutoriais
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64 border border-border bg-card rounded-md shadow-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Pesquisar título..."
                            className="pl-9 border-none bg-transparent focus-visible:ring-0 shadow-none"
                        />
                    </div>
                    <div className="relative w-full sm:w-44 border border-border bg-card rounded-md shadow-sm">
                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="pl-9 border-none bg-transparent focus-visible:ring-0 shadow-none"
                        />
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            {filteredUpdates.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
                        {activeTab === 'update' ? (
                            <Newspaper className="w-8 h-8 text-muted-foreground" />
                        ) : (
                            <Video className="w-8 h-8 text-muted-foreground" />
                        )}
                    </div>
                    <h3 className="text-lg font-bold text-foreground">Nada encontrado</h3>
                    <p className="text-muted-foreground mt-1 max-w-sm">
                        Nenhuma publicação bate com os filtros ou não existem publicações nessa categoria ainda.
                    </p>
                    {(searchQuery || dateFilter) && (
                        <button
                            onClick={() => { setSearchQuery(""); setDateFilter("") }}
                            className="mt-4 text-sm font-semibold text-primary hover:underline"
                        >
                            Limpar filtros
                        </button>
                    )}
                </div>
            ) : (
                <div className={`grid gap-6 ${activeTab === 'tutorial' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:max-w-4xl'}`}>
                    {filteredUpdates.map((item) => (
                        <div key={item.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col">

                            {/* Media Section */}
                            {activeTab === 'tutorial' && item.video_url ? (
                                <div className="aspect-video w-full bg-black relative">
                                    <iframe
                                        className="absolute inset-0 w-full h-full"
                                        src={`https://www.youtube.com/embed/${getYoutubeId(item.video_url)}`}
                                        title={item.title}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    ></iframe>
                                </div>
                            ) : activeTab === 'update' && item.image_url ? (
                                <div className="w-full aspect-video sm:aspect-[21/9] bg-muted relative overflow-hidden">
                                    <img
                                        src={item.image_url}
                                        alt={item.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                </div>
                            ) : null}

                            {/* Text Content */}
                            <div className="p-6 flex-1 flex flex-col">
                                <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground mb-3">
                                    <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-md">
                                        {new Date(item.created_at).toLocaleDateString('pt-BR')}
                                    </span>
                                    {item.author && (
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-1 h-1 rounded-full bg-border" />
                                            {item.author}
                                        </span>
                                    )}
                                </div>

                                <h3 className="text-xl font-bold text-foreground mb-3 leading-tight group-hover:text-primary transition-colors">
                                    {item.title}
                                </h3>

                                {item.content && activeTab === 'update' && (
                                    <div className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap flex-1">
                                        {item.content}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
