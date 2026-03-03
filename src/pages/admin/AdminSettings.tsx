import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Settings, ArrowLeft, Save, Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function AdminSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        primaryColor: "#ea384c", // Default FRFood red
        logoUrl: ""
    });
    const navigate = useNavigate();

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        // Standardizing on 'global_theme' key
        const { data, error } = await supabase
            .from("platform_settings")
            .select("value")
            .eq("key", "global_theme")
            .maybeSingle();

        if (error) {
            console.error("Error fetching platform settings:", error);
        } else if (data && data.value) {
            const val = data.value as any;
            setSettings({
                primaryColor: val.primaryColor || "#ea384c",
                logoUrl: val.logoUrl || ""
            });
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase
            .from("platform_settings")
            .upsert({
                key: "global_theme",
                value: settings
            }, { onConflict: "key" });

        if (error) {
            toast.error("Erro ao salvar configurações");
            console.error(error);
        } else {
            toast.success("Configurações salvas com sucesso! (Recarregue para aplicar mudancas no painel)", { duration: 5000 });
            // Small delay then reload to apply CSS globally if any scripts read it on load
        }
        setSaving(false);
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const file = e.target.files?.[0];
            if (!file) return;

            const fileExt = file.name.split('.').pop();
            const filePath = `platform_logo_${Math.random()}.${fileExt}`;

            toast.loading("Fazendo upload da logo...", { id: "upload" });

            const { error: uploadError, data } = await supabase.storage
                .from('store-assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('store-assets')
                .getPublicUrl(filePath);

            setSettings(prev => ({ ...prev, logoUrl: publicUrl }));
            toast.success("Logo enviada!", { id: "upload" });
        } catch (error: any) {
            toast.error(error.message || "Erro no upload", { id: "upload" });
        }
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-screen">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Configurações da Plataforma</h1>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-none shadow-sm bg-white">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-primary" />
                            Identidade Visual
                        </CardTitle>
                        <CardDescription>
                            Configure a cor principal e a logo padrão da plataforma FRFood. Algumas mudanças podem exigir recarregar a página.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>Cor Principal (Primary Color)</Label>
                            <div className="flex gap-4">
                                <Input
                                    type="color"
                                    value={settings.primaryColor}
                                    onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                                    className="w-24 h-12 p-1 cursor-pointer"
                                />
                                <Input
                                    type="text"
                                    value={settings.primaryColor}
                                    onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                                    className="flex-1 uppercase font-mono"
                                    placeholder="#ea384c"
                                />
                            </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-slate-100">
                            <Label>Logo da Plataforma</Label>
                            <div className="flex items-center gap-6">
                                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 relative group">
                                    {settings.logoUrl ? (
                                        <img
                                            src={settings.logoUrl}
                                            alt="Logo"
                                            className="w-full h-full object-contain p-2 mix-blend-multiply"
                                        />
                                    ) : (
                                        <div className="text-slate-400 flex flex-col items-center">
                                            <Plus className="w-8 h-8 opacity-50 mb-1" />
                                            <span className="text-xs font-medium">Add Logo</span>
                                        </div>
                                    )}
                                    <label className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                        <Upload className="w-6 h-6" />
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleLogoUpload}
                                        />
                                    </label>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm text-slate-500 mb-2">
                                        Faça o upload de uma imagem PNG transparente. Formato recomendado: Quadrado (1:1), 512x512px.
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                                    >
                                        Escolher Imagem
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6">
                            <Button onClick={handleSave} disabled={saving} className="w-full">
                                {saving ? (
                                    <>
                                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" />
                                        Salvar Configurações Globais
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
