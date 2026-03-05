import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Save, ArrowLeft, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AdminLandingPage = () => {
    const [content, setContent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const navigate = useNavigate();

    const fetchContent = useCallback(async () => {
        const { data, error } = await supabase
            .from("platform_settings")
            .select("*")
            .limit(1)
            .maybeSingle();

        if (error) {
            toast.error("Erro ao carregar conteúdo");
        } else if (data) {
            const row = data as any;
            const val = row.value || {};
            setContent({
                id: row.id,
                hero: {
                    title: val.heroTitle || "",
                    subtitle: val.heroSubtitle || "",
                    buttonText: val.heroButtonText || "",
                    imageUrl: val.heroImageUrl || "",
                    bgType: val.heroBgType || "gradient",
                    bgColor: val.heroBgColor || "",
                },
                features: val.features || []
            });
        } else {
            // Initial fallback
            setContent({
                id: null,
                hero: { title: "", subtitle: "", buttonText: "", imageUrl: "", bgType: "gradient", bgColor: "" },
                features: []
            });
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchContent();
    }, [fetchContent]);

    const handleSave = async () => {
        if (!content.id) {
            toast.error("Configuração não encontrada no banco.");
            return;
        }
        setSaving(true);

        // Fetch current values so we don't overwrite everything else stored in JSONB
        const { data: currentData } = await supabase.from("platform_settings").select("value").eq("id", content.id).single();
        const currentVal = (currentData?.value as any) || {};

        const { error } = await supabase
            .from("platform_settings")
            .update({
                value: {
                    ...currentVal,
                    heroTitle: content.hero.title,
                    heroSubtitle: content.hero.subtitle,
                    heroButtonText: content.hero.buttonText,
                    heroImageUrl: content.hero.imageUrl,
                    heroBgType: content.hero.bgType,
                    heroBgColor: content.hero.bgColor,
                    features: content.features
                } as any
            })
            .eq("id", content.id);

        if (error) {
            toast.error("Erro ao salvar");
        } else {
            toast.success("Conteúdo atualizado com sucesso!");
        }
        setSaving(false);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const file = e.target.files?.[0];
            if (!file) return;

            const fileExt = file.name.split('.').pop();
            const filePath = `landing_hero_${Math.random()}.${fileExt}`;

            toast.loading("Transferindo imagem...", { id: "upload" });

            const { error: uploadError } = await supabase.storage
                .from('store-assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('store-assets')
                .getPublicUrl(filePath);

            setContent({ ...content, hero: { ...content.hero, imageUrl: publicUrl } });
            toast.success("Arte Principal salva!", { id: "upload" });
        } catch (error: any) {
            toast.error(error.message || "Erro no upload", { id: "upload" });
        }
    };

    const addFeature = () => {
        setContent({ ...content, features: [...content.features, ""] });
    };

    const updateFeature = (index: number, value: string) => {
        const newFeatures = [...content.features];
        newFeatures[index] = value;
        setContent({ ...content, features: newFeatures });
    };

    const removeFeature = (index: number) => {
        setContent({ ...content, features: content.features.filter((_: any, i: number) => i !== index) });
    };

    if (loading || !content) return null;

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Gerenciar Landing Page</h1>
                </div>
                <Button onClick={handleSave} disabled={saving} className="gap-2 font-bold shadow-lg shadow-primary/20">
                    <Save className="w-4 h-4" />
                    {saving ? "Salvando..." : "Salvar Alterações"}
                </Button>
            </div>

            <div className="grid gap-6">
                <Card className="border-none shadow-sm bg-white">
                    <CardHeader>
                        <CardTitle className="text-xl text-slate-900">Seção Inicial (Hero & Banner)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Título Principal</Label>
                                <Input
                                    value={content.hero.title}
                                    onChange={(e) => setContent({ ...content, hero: { ...content.hero, title: e.target.value } })}
                                    placeholder="Ex: O melhor sistema para..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Texto do Botão (Call-to-Action)</Label>
                                <Input
                                    value={content.hero.buttonText}
                                    onChange={(e) => setContent({ ...content, hero: { ...content.hero, buttonText: e.target.value } })}
                                    placeholder="Ex: Criar minha loja grátis"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Subtítulo de Apoio</Label>
                            <Textarea
                                value={content.hero.subtitle}
                                onChange={(e) => setContent({ ...content, hero: { ...content.hero, subtitle: e.target.value } })}
                                placeholder="Descrição detalhada para capturar lide..."
                                rows={2}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                            <div className="space-y-2">
                                <Label>Fundo Exibição Principal (Background)</Label>
                                <Select value={content.hero.bgType} onValueChange={(val) => setContent({ ...content, hero: { ...content.hero, bgType: val } })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tipo..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="gradient">Gradiente Animado (Padrão)</SelectItem>
                                        <SelectItem value="solid">Cor Sólida (Específica)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Esquema de Cor Manual (Tailwind Class / Solid Hex)</Label>
                                <Input
                                    value={content.hero.bgColor}
                                    onChange={(e) => setContent({ ...content, hero: { ...content.hero, bgColor: e.target.value } })}
                                    placeholder="ex: bg-[#111] ou from-orange-400 to-red-400"
                                    disabled={content.hero.bgType === "gradient" && !content.hero.bgColor.includes("from-")}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Para Gradientes digite apenas as classes: <code>from-brand to-black</code>
                                </p>
                            </div>
                        </div>

                        <div className="pt-4 border-t space-y-4">
                            <div className="space-y-2">
                                <Label>Arte Lateral (Banner Mockup)</Label>
                                <div className="flex items-center gap-4">
                                    {content.hero.imageUrl && (
                                        <div className="w-16 h-16 rounded overflow-hidden border">
                                            <img src={content.hero.imageUrl} alt="Banner" className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                    <Label className="cursor-pointer">
                                        <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-slate-50">
                                            <Upload className="w-4 h-4" />
                                            <span>Subir Imagem</span>
                                        </div>
                                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                    </Label>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Recomendado: Celulares flutuantes e mockups em .png transparente, em formato vertical.</p>
                            </div>
                        </div>

                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-xl text-slate-900">Vantagens (Features Inferior)</CardTitle>
                        <Button variant="outline" size="sm" onClick={addFeature} className="gap-1">
                            <Plus className="w-4 h-4" /> Adicionar
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {content.features.map((feature: string, index: number) => (
                            <div key={index} className="flex gap-2">
                                <Input
                                    value={feature}
                                    onChange={(e) => updateFeature(index, e.target.value)}
                                    placeholder={`Vantagem ${index + 1}`}
                                />
                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => removeFeature(index)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                        {content.features.length === 0 && (
                            <p className="text-sm text-muted-foreground">Adicione marcadores que aparecerão sob os botões da landing page para impulsionar a venda.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default AdminLandingPage;
