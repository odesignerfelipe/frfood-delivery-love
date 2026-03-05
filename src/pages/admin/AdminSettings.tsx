import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Settings, ArrowLeft, Save, Upload, Plus, Trash2, Palette, Type, Image, LayoutDashboard, HelpCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type FaqItem = { q: string; a: string };
type HeroStat = { value: string; label: string };

export default function AdminSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settingsId, setSettingsId] = useState("");
    const [settings, setSettings] = useState({
        primaryColor: "#ea384c",
        secondaryColor: "#f97316",
        logoUrl: "",
        faviconUrl: "",
        siteName: "FRFood",
        navbarButtonText: "Criar conta",
        heroTitle: "O melhor sistema para o seu Delivery",
        heroSubtitle: "Receba pedidos ilimitados direto no seu WhatsApp. Sem comissões, sem taxas ocultas.",
        heroButtonText: "Começar agora",
        heroImageUrl: "",
        heroBgType: "gradient",
        heroBgColor: "from-orange-500 to-orange-600",
        heroBadgeText: "Plataforma completa de delivery",
        heroStats: [
            { value: "5.000+", label: "Restaurantes" },
            { value: "1M+", label: "Pedidos/mês" },
            { value: "0%", label: "Taxa por pedido" },
        ] as HeroStat[],
        pricingTitle: "Planos simples e transparentes",
        pricingSubtitle: "Todos os recursos inclusos em qualquer plano. Sem taxa por pedido.",
        monthlyPrice: "149,90",
        yearlyPrice: "124,90",
        ctaTitle: "Pronto para vender mais?",
        ctaSubtitle: "Comece agora e tenha seu delivery online funcionando em minutos.",
        ctaButtonText: "Criar minha loja agora",
        faqItems: [] as FaqItem[],
        footerText: "",
        features: [] as string[],
    });
    const navigate = useNavigate();

    useEffect(() => { fetchSettings(); }, []);

    const fetchSettings = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("platform_settings")
            .select("*")
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error("Error fetching platform settings:", error);
        } else if (data) {
            const v = data as any;
            setSettingsId(v.id || "");
            // Read from the JSONB 'value' column first, then fall back to individual columns
            const val = v.value || {};
            setSettings({
                primaryColor: v.primary_color || val.primaryColor || "#ea384c",
                secondaryColor: v.secondary_color || val.secondaryColor || "#f97316",
                logoUrl: v.logo_url || val.logoUrl || "",
                faviconUrl: v.favicon_url || val.faviconUrl || "",
                siteName: v.site_name || val.siteName || "FRFood",
                navbarButtonText: v.navbar_button_text || val.navbarButtonText || "Criar conta",
                heroTitle: v.hero_title || val.heroTitle || "O melhor sistema para o seu Delivery",
                heroSubtitle: v.hero_subtitle || val.heroSubtitle || "",
                heroButtonText: v.hero_button_text || val.heroButtonText || "Começar agora",
                heroImageUrl: v.hero_image_url || val.heroImageUrl || "",
                heroBgType: v.hero_bg_type || val.heroBgType || "gradient",
                heroBgColor: v.hero_bg_color || val.heroBgColor || "from-orange-500 to-orange-600",
                heroBadgeText: v.hero_badge_text || val.heroBadgeText || "Plataforma completa de delivery",
                heroStats: v.hero_stats || val.heroStats || [{ value: "5.000+", label: "Restaurantes" }, { value: "1M+", label: "Pedidos/mês" }, { value: "0%", label: "Taxa por pedido" }],
                pricingTitle: v.pricing_title || val.pricingTitle || "Planos simples e transparentes",
                pricingSubtitle: v.pricing_subtitle || val.pricingSubtitle || "",
                monthlyPrice: v.monthly_price || val.monthlyPrice || "149,90",
                yearlyPrice: v.yearly_price || val.yearlyPrice || "124,90",
                ctaTitle: v.cta_title || val.ctaTitle || "Pronto para vender mais?",
                ctaSubtitle: v.cta_subtitle || val.ctaSubtitle || "",
                ctaButtonText: v.cta_button_text || val.ctaButtonText || "Criar minha loja agora",
                faqItems: v.faq_items || val.faqItems || [],
                footerText: v.footer_text || val.footerText || "",
                features: v.features || val.features || [],
            });
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!settingsId) { toast.error("Erro: ID de configurações não encontrado."); return; }
        setSaving(true);

        // Store settings inside individual columns and the 'value' JSONB column for backward compatibility
        const { error } = await supabase
            .from("platform_settings")
            .update({
                primary_color: settings.primaryColor,
                secondary_color: settings.secondaryColor,
                logo_url: settings.logoUrl,
                favicon_url: settings.faviconUrl,
                site_name: settings.siteName,
                navbar_button_text: settings.navbarButtonText,
                hero_title: settings.heroTitle,
                hero_subtitle: settings.heroSubtitle,
                hero_button_text: settings.heroButtonText,
                hero_image_url: settings.heroImageUrl,
                hero_badge_text: settings.heroBadgeText,
                hero_bg_type: settings.heroBgType,
                hero_bg_color: settings.heroBgColor,
                pricing_title: settings.pricingTitle,
                pricing_subtitle: settings.pricingSubtitle,
                monthly_price: settings.monthlyPrice,
                yearly_price: settings.yearlyPrice,
                cta_title: settings.ctaTitle,
                cta_subtitle: settings.ctaSubtitle,
                cta_button_text: settings.ctaButtonText,
                footer_text: settings.footerText,
                hero_stats: settings.heroStats as any,
                faq_items: settings.faqItems as any,
                features: settings.features as any,
                value: settings as any,
            })
            .eq("id", settingsId);

        if (error) {
            console.error("Save error:", error);
            toast.error("Erro ao salvar: " + (error.message || "Tente novamente"));
        } else {
            toast.success("Configurações salvas! Recarregue a página inicial para ver as mudanças.", { duration: 5000 });
        }
        setSaving(false);
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: "logoUrl" | "faviconUrl" | "heroImageUrl") => {
        try {
            const file = e.target.files?.[0];
            if (!file) return;
            const fileExt = file.name.split('.').pop();
            const filePath = `platform_${field}_${Date.now()}.${fileExt}`;
            toast.loading("Fazendo upload...", { id: "upload" });
            const { error: uploadError } = await supabase.storage.from('store-assets').upload(filePath, file);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('store-assets').getPublicUrl(filePath);
            setSettings(prev => ({ ...prev, [field]: publicUrl }));
            toast.success("Upload concluído!", { id: "upload" });
        } catch (error: any) {
            toast.error(error.message || "Erro no upload", { id: "upload" });
        }
    };

    const updateStat = (index: number, key: "value" | "label", val: string) => {
        const stats = [...settings.heroStats];
        stats[index] = { ...stats[index], [key]: val };
        setSettings(prev => ({ ...prev, heroStats: stats }));
    };

    const addFaq = () => setSettings(prev => ({ ...prev, faqItems: [...prev.faqItems, { q: "", a: "" }] }));
    const updateFaq = (i: number, key: "q" | "a", val: string) => {
        const items = [...settings.faqItems];
        items[i] = { ...items[i], [key]: val };
        setSettings(prev => ({ ...prev, faqItems: items }));
    };
    const removeFaq = (i: number) => setSettings(prev => ({ ...prev, faqItems: prev.faqItems.filter((_, idx) => idx !== i) }));

    const addFeature = () => setSettings(prev => ({ ...prev, features: [...prev.features, ""] }));
    const updateFeature = (i: number, val: string) => {
        const f = [...settings.features]; f[i] = val;
        setSettings(prev => ({ ...prev, features: f }));
    };
    const removeFeature = (i: number) => setSettings(prev => ({ ...prev, features: prev.features.filter((_, idx) => idx !== i) }));

    if (loading) return (
        <div className="p-6 flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Configurações da Plataforma</h1>
                    <p className="text-sm text-slate-500">Personalize a aparência e conteúdo da landing page</p>
                </div>
                <Button onClick={handleSave} disabled={saving} size="lg">
                    {saving ? (
                        <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />Salvando...</>
                    ) : (
                        <><Save className="w-4 h-4 mr-2" />Salvar Tudo</>
                    )}
                </Button>
            </div>

            <Tabs defaultValue="visual" className="space-y-6">
                <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
                    <TabsTrigger value="visual"><Palette className="w-4 h-4 mr-1" />Visual</TabsTrigger>
                    <TabsTrigger value="hero"><Image className="w-4 h-4 mr-1" />Hero</TabsTrigger>
                    <TabsTrigger value="pricing"><LayoutDashboard className="w-4 h-4 mr-1" />Preços</TabsTrigger>
                    <TabsTrigger value="cta"><MessageSquare className="w-4 h-4 mr-1" />CTA</TabsTrigger>
                    <TabsTrigger value="faq"><HelpCircle className="w-4 h-4 mr-1" />FAQ</TabsTrigger>
                    <TabsTrigger value="extras"><Type className="w-4 h-4 mr-1" />Extras</TabsTrigger>
                </TabsList>

                {/* === VISUAL === */}
                <TabsContent value="visual">
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card className="border-none shadow-sm">
                            <CardHeader><CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5 text-primary" />Cores e Nome</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nome do Site (aba do navegador)</Label>
                                    <Input value={settings.siteName} onChange={e => setSettings(p => ({ ...p, siteName: e.target.value }))} placeholder="FRFood" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Cor Principal</Label>
                                    <div className="flex gap-3">
                                        <Input type="color" value={settings.primaryColor} onChange={e => setSettings(p => ({ ...p, primaryColor: e.target.value }))} className="w-16 h-10 p-1 cursor-pointer" />
                                        <Input value={settings.primaryColor} onChange={e => setSettings(p => ({ ...p, primaryColor: e.target.value }))} className="flex-1 uppercase font-mono" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Cor Secundária</Label>
                                    <div className="flex gap-3">
                                        <Input type="color" value={settings.secondaryColor} onChange={e => setSettings(p => ({ ...p, secondaryColor: e.target.value }))} className="w-16 h-10 p-1 cursor-pointer" />
                                        <Input value={settings.secondaryColor} onChange={e => setSettings(p => ({ ...p, secondaryColor: e.target.value }))} className="flex-1 uppercase font-mono" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Texto do Botão na Navbar</Label>
                                    <Input value={settings.navbarButtonText} onChange={e => setSettings(p => ({ ...p, navbarButtonText: e.target.value }))} placeholder="Criar conta" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-sm">
                            <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5 text-primary" />Logo & Favicon</CardTitle></CardHeader>
                            <CardContent className="space-y-6">
                                {(["logoUrl", "faviconUrl"] as const).map(field => (
                                    <div key={field} className="space-y-2">
                                        <Label>{field === "logoUrl" ? "Logo da Plataforma" : "Favicon (ícone da aba)"}</Label>
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 relative group">
                                                {settings[field] ? (
                                                    <img src={settings[field]} alt={field} className="w-full h-full object-contain" />
                                                ) : (
                                                    <Plus className="w-6 h-6 text-slate-300" />
                                                )}
                                                <label className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                                    <Upload className="w-5 h-5" />
                                                    <input type="file" className="hidden" accept="image/*" onChange={e => handleUpload(e, field)} />
                                                </label>
                                            </div>
                                            <Input value={settings[field]} onChange={e => setSettings(p => ({ ...p, [field]: e.target.value }))} placeholder="https://..." className="flex-1 text-xs" />
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* === HERO === */}
                <TabsContent value="hero">
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card className="border-none shadow-sm">
                            <CardHeader><CardTitle>Textos do Hero</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2"><Label>Badge (etiqueta)</Label><Input value={settings.heroBadgeText} onChange={e => setSettings(p => ({ ...p, heroBadgeText: e.target.value }))} /></div>
                                <div className="space-y-2"><Label>Título Principal</Label><Input value={settings.heroTitle} onChange={e => setSettings(p => ({ ...p, heroTitle: e.target.value }))} /></div>
                                <div className="space-y-2"><Label>Subtítulo</Label><Textarea value={settings.heroSubtitle} onChange={e => setSettings(p => ({ ...p, heroSubtitle: e.target.value }))} rows={3} /></div>
                                <div className="space-y-2"><Label>Texto do Botão</Label><Input value={settings.heroButtonText} onChange={e => setSettings(p => ({ ...p, heroButtonText: e.target.value }))} /></div>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-sm">
                            <CardHeader><CardTitle>Imagem & Background</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Imagem do Hero</Label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 relative group">
                                            {settings.heroImageUrl ? <img src={settings.heroImageUrl} alt="Hero" className="w-full h-full object-cover" /> : <Image className="w-6 h-6 text-slate-300" />}
                                            <label className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                                <Upload className="w-5 h-5" />
                                                <input type="file" className="hidden" accept="image/*" onChange={e => handleUpload(e, "heroImageUrl")} />
                                            </label>
                                        </div>
                                        <Input value={settings.heroImageUrl} onChange={e => setSettings(p => ({ ...p, heroImageUrl: e.target.value }))} placeholder="URL da imagem" className="flex-1 text-xs" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Tipo de Background</Label>
                                    <Select value={settings.heroBgType} onValueChange={v => setSettings(p => ({ ...p, heroBgType: v }))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="gradient">Gradiente</SelectItem>
                                            <SelectItem value="solid">Cor sólida</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2"><Label>Classe de cor do BG</Label><Input value={settings.heroBgColor} onChange={e => setSettings(p => ({ ...p, heroBgColor: e.target.value }))} /></div>

                                <div className="space-y-3 pt-4 border-t">
                                    <Label className="font-semibold">Estatísticas (3 colunas)</Label>
                                    {settings.heroStats.map((stat, i) => (
                                        <div key={i} className="grid grid-cols-2 gap-2">
                                            <Input value={stat.value} onChange={e => updateStat(i, "value", e.target.value)} placeholder="5.000+" />
                                            <Input value={stat.label} onChange={e => updateStat(i, "label", e.target.value)} placeholder="Restaurantes" />
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* === PRICING === */}
                <TabsContent value="pricing">
                    <Card className="border-none shadow-sm max-w-2xl">
                        <CardHeader><CardTitle>Seção de Preços</CardTitle><CardDescription>Altere os textos e valores dos planos.</CardDescription></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2"><Label>Título da Seção</Label><Input value={settings.pricingTitle} onChange={e => setSettings(p => ({ ...p, pricingTitle: e.target.value }))} /></div>
                            <div className="space-y-2"><Label>Subtítulo</Label><Input value={settings.pricingSubtitle} onChange={e => setSettings(p => ({ ...p, pricingSubtitle: e.target.value }))} /></div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                <div className="space-y-2"><Label>Preço Mensal (ex: 149,90)</Label><Input value={settings.monthlyPrice} onChange={e => setSettings(p => ({ ...p, monthlyPrice: e.target.value }))} /></div>
                                <div className="space-y-2"><Label>Preço Anual (ex: 124,90)</Label><Input value={settings.yearlyPrice} onChange={e => setSettings(p => ({ ...p, yearlyPrice: e.target.value }))} /></div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* === CTA === */}
                <TabsContent value="cta">
                    <Card className="border-none shadow-sm max-w-2xl">
                        <CardHeader><CardTitle>Seção CTA (Call To Action)</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2"><Label>Título</Label><Input value={settings.ctaTitle} onChange={e => setSettings(p => ({ ...p, ctaTitle: e.target.value }))} /></div>
                            <div className="space-y-2"><Label>Subtítulo</Label><Textarea value={settings.ctaSubtitle} onChange={e => setSettings(p => ({ ...p, ctaSubtitle: e.target.value }))} rows={3} /></div>
                            <div className="space-y-2"><Label>Texto do Botão</Label><Input value={settings.ctaButtonText} onChange={e => setSettings(p => ({ ...p, ctaButtonText: e.target.value }))} /></div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* === FAQ === */}
                <TabsContent value="faq">
                    <Card className="border-none shadow-sm">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>Perguntas Frequentes (FAQ)</CardTitle>
                                <Button size="sm" variant="outline" onClick={addFaq}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {settings.faqItems.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma pergunta cadastrada. Clique em "Adicionar" para começar.</p>}
                            {settings.faqItems.map((item, i) => (
                                <div key={i} className="p-4 bg-slate-50 rounded-xl space-y-3 relative group">
                                    <Button size="icon" variant="ghost" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={() => removeFaq(i)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                    <div className="space-y-1"><Label className="text-xs">Pergunta {i + 1}</Label><Input value={item.q} onChange={e => updateFaq(i, "q", e.target.value)} placeholder="Ex: Preciso ter conhecimento técnico?" /></div>
                                    <div className="space-y-1"><Label className="text-xs">Resposta</Label><Textarea value={item.a} onChange={e => updateFaq(i, "a", e.target.value)} rows={2} /></div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* === EXTRAS === */}
                <TabsContent value="extras">
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card className="border-none shadow-sm">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>Funcionalidades (Features)</CardTitle>
                                    <Button size="sm" variant="outline" onClick={addFeature}><Plus className="w-4 h-4 mr-1" />Add</Button>
                                </div>
                                <CardDescription>Deixe vazio para usar as features padrão do sistema.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {settings.features.map((f, i) => (
                                    <div key={i} className="flex gap-2">
                                        <Input value={f} onChange={e => updateFeature(i, e.target.value)} placeholder="Nome da funcionalidade" />
                                        <Button size="icon" variant="ghost" className="text-destructive flex-shrink-0" onClick={() => removeFeature(i)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-sm">
                            <CardHeader><CardTitle>Footer</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Texto do Rodapé (copyright, etc)</Label>
                                    <Input value={settings.footerText} onChange={e => setSettings(p => ({ ...p, footerText: e.target.value }))} placeholder={`© ${new Date().getFullYear()} FRFood. Todos os direitos reservados.`} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
