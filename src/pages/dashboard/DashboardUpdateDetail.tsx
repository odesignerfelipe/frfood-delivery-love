import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, User, Newspaper, Image as ImageIcon } from "lucide-react";

export default function DashboardUpdateDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [update, setUpdate] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        const fetchUpdate = async () => {
            const { data } = await supabase
                .from("platform_updates")
                .select("*")
                .eq("id", id)
                .single();

            if (data) setUpdate(data);
            setLoading(false);
        };

        fetchUpdate();
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
        );
    }

    if (!update) {
        return (
            <div className="text-center py-12">
                <h2 className="text-2xl font-bold mb-4">Atualização não encontrada</h2>
                <Button onClick={() => navigate("/dashboard/updates")} variant="outline">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar para Novidades
                </Button>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
            <Button onClick={() => navigate("/dashboard/updates")} variant="ghost" className="mb-2 -ml-4 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para Novidades
            </Button>

            <article className="bg-card rounded-2xl overflow-hidden shadow-card border border-border/50">
                {update.image_url ? (
                    <div className="w-full h-64 sm:h-80 md:h-[400px] bg-muted/30 relative">
                        <img src={update.image_url} alt={update.title} className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="w-full h-32 bg-primary/5 flex items-center justify-center border-b border-border/30">
                        <Newspaper className="w-10 h-10 text-primary/40" />
                    </div>
                )}

                <div className="p-6 md:p-10">
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                        <span className="flex items-center gap-1.5 font-medium px-2.5 py-1 bg-primary/10 text-primary rounded-full">
                            {update.type === "update" ? "Notícia" : "Tutorial"}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            {new Date(update.created_at).toLocaleDateString("pt-BR", {
                                day: '2-digit', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                            })}
                        </span>
                        {update.author && (
                            <span className="flex items-center gap-1.5">
                                <User className="w-4 h-4" />
                                {update.author}
                            </span>
                        )}
                    </div>

                    <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-8 leading-tight">
                        {update.title}
                    </h1>

                    <div
                        className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary prose-img:rounded-xl"
                        dangerouslySetInnerHTML={{ __html: update.content || "" }}
                    />
                </div>
            </article>
        </div>
    );
}
