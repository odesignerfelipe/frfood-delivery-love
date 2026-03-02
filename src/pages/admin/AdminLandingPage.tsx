import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Save, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const AdminLandingPage = () => {
    const [content, setContent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchContent = async () => {
            const { data, error } = await supabase
                .from("platform_settings")
                .select("*")
                .eq("key", "landing_page")
                .single();

            if (error && error.code !== 'PGRST116') {
                toast.error("Erro ao carregar conteúdo");
            } else if (data) {
                setContent(data.value);
            } else {
                // Initial state
                setContent({
                    hero: { title: "", subtitle: "" },
                    features: []
                });
            }
            setLoading(false);
        };
        fetchContent();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase
            .from("platform_settings")
            .upsert({ key: "landing_page", value: content }, { onConflict: 'key' });

        if (error) {
            toast.error("Erro ao salvar");
        } else {
            toast.success("Conteúdo atualizado com sucesso");
        }
        setSaving(false);
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

    if (loading) return null;

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
                        <CardTitle className="text-xl text-slate-900">Seção Hero</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Título Principal</Label>
                            <Input
                                value={content.hero.title}
                                onChange={(e) => setContent({ ...content, hero: { ...content.hero, title: e.target.value } })}
                                placeholder="Título impactante..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Subtítulo</Label>
                            <Textarea
                                value={content.hero.subtitle}
                                onChange={(e) => setContent({ ...content, hero: { ...content.hero, subtitle: e.target.value } })}
                                placeholder="Descrição resumida..."
                                rows={3}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-xl text-slate-900">Vantagens (Features)</CardTitle>
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
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default AdminLandingPage;
