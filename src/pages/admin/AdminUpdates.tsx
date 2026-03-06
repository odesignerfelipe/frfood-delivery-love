import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { toast } from "sonner";
import {
    Newspaper,
    Video,
    Trash2,
    Plus,
    Loader2,
    Image as ImageIcon
} from "lucide-react";

export default function AdminUpdates() {
    const [updates, setUpdates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<"update" | "tutorial">("update");

    // Form State
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [author, setAuthor] = useState("Equipe FRFood");
    const [videoUrl, setVideoUrl] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);

    useEffect(() => {
        fetchUpdates();
    }, []);

    const fetchUpdates = async () => {
        try {
            const { data, error } = await supabase
                .from("platform_updates")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setUpdates(data || []);
        } catch (error: any) {
            toast.error("Erro ao carregar atualizações.");
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setImageFile(e.target.files[0]);
        }
    };

    const uploadImage = async (file: File) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `updates/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('store-assets')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('store-assets')
            .getPublicUrl(filePath);

        return publicUrl;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            let uploadedImageUrl = null;

            if (activeTab === "update" && imageFile) {
                uploadedImageUrl = await uploadImage(imageFile);
            }

            const { error } = await supabase.from("platform_updates").insert({
                type: activeTab,
                title,
                content: activeTab === "update" ? content : null,
                video_url: activeTab === "tutorial" ? videoUrl : null,
                image_url: uploadedImageUrl,
                author: activeTab === "update" ? author : null
            });

            if (error) throw error;

            toast.success(activeTab === "update" ? "Atualização publicada!" : "Tutorial publicado!");

            // Reset form
            setTitle("");
            setContent("");
            setVideoUrl("");
            setImageFile(null);

            await fetchUpdates();
        } catch (error: any) {
            console.error(error);
            toast.error("Erro ao publicar: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, imageUrl: string | null) => {
        if (!confirm("Tem certeza que deseja excluir esta publicação?")) return;

        try {
            const { error } = await supabase.from("platform_updates").delete().eq("id", id);
            if (error) throw error;

            // Optional: Delete image from storage
            if (imageUrl) {
                const path = imageUrl.split('/').pop();
                if (path) {
                    await supabase.storage.from("store-assets").remove([`updates/${path}`]);
                }
            }

            setUpdates(updates.filter(u => u.id !== id));
            toast.success("Excluído com sucesso!");
        } catch (error: any) {
            toast.error("Erro ao excluir.");
        }
    };

    if (loading) return <div>Carregando...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Atualizações e Tutoriais</h1>
                    <p className="text-muted-foreground mt-1">Publique novidades e manuais para seus lojistas.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Formulário de Criação */}
                <div className="lg:col-span-1 bg-card border border-border rounded-xl p-6 shadow-sm h-fit">
                    <div className="flex bg-muted p-1 rounded-lg mb-6">
                        <button
                            onClick={() => setActiveTab("update")}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "update" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            <Newspaper className="w-4 h-4" />
                            Notícia / Update
                        </button>
                        <button
                            onClick={() => setActiveTab("tutorial")}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "tutorial" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            <Video className="w-4 h-4" />
                            Tutorial (Vídeo)
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Título da Publicação</Label>
                            <Input
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Ex: Nova funcionalidade liberada!"
                                required
                            />
                        </div>

                        {activeTab === "update" ? (
                            <>
                                <div className="space-y-2">
                                    <Label>Conteúdo da Atualização</Label>
                                    <div className="bg-background">
                                        <ReactQuill
                                            theme="snow"
                                            value={content}
                                            onChange={setContent}
                                            placeholder="Descreva as novidades ou correções aqui..."
                                            modules={{
                                                toolbar: [
                                                    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                                                    ['bold', 'italic', 'underline', 'strike'],
                                                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                                    ['link', 'blockquote', 'code-block'],
                                                    ['clean']
                                                ]
                                            }}
                                            className="min-h-[200px]"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Imagem ou GIF (Opcional)</Label>
                                    <Input
                                        type="file"
                                        accept="image/*,.gif"
                                        onChange={handleImageChange}
                                    />
                                    {imageFile && <p className="text-xs text-muted-foreground">{imageFile.name}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label>Autor</Label>
                                    <Input
                                        value={author}
                                        onChange={e => setAuthor(e.target.value)}
                                        placeholder="Ex: Equipe de Suporte"
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="space-y-2">
                                <Label>Link do Vídeo (Youtube)</Label>
                                <Input
                                    value={videoUrl}
                                    onChange={e => setVideoUrl(e.target.value)}
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    required
                                />
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={saving}>
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            {activeTab === "update" ? "Publicar Atualização" : "Publicar Tutorial"}
                        </Button>
                    </form>
                </div>

                {/* Lista de Publicações Existentes */}
                <div className="lg:col-span-2 bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-border">
                        <h2 className="text-lg font-semibold">Publicações Anteriores</h2>
                    </div>

                    <div className="divide-y divide-border">
                        {updates.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                <Newspaper className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                                Nenhuma publicação criada até o momento.
                            </div>
                        ) : (
                            updates.map((update) => (
                                <div key={update.id} className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:bg-muted/30 transition-colors">
                                    <div className="flex gap-4 items-center">
                                        <div className={`p-3 rounded-xl ${update.type === 'update' ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-500'}`}>
                                            {update.type === 'update' ? <Newspaper className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-foreground">{update.title}</h3>
                                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                                <span className="capitalize">{update.type === 'update' ? 'Atualização' : 'Tutorial'}</span>
                                                <span>•</span>
                                                <span>{new Date(update.created_at).toLocaleDateString('pt-BR')}</span>
                                                {update.author && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{update.author}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:bg-destructive/10 shrink-0"
                                        onClick={() => handleDelete(update.id, update.image_url)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
