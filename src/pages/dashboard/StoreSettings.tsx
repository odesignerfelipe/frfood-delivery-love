import { useState, useEffect } from "react";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, CreditCard, Star, Check, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const SEGMENTS = [
  "Pizzaria", "Hamburgueria", "Restaurante", "Lanchonete", "Açaí", "Sorveteria",
  "Padaria", "Cafeteria", "Doceria", "Sushi", "Marmitex", "Outro",
];

const defaultHours = () => DAYS.map((day) => ({
  day,
  enabled: true,
  periods: [{ open: "11:00", close: "23:00" }],
}));

const StoreSettings = () => {
  const { store, updateStore, refetch } = useStore();
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const openingHours = store?.opening_hours && Array.isArray(store.opening_hours) && (store.opening_hours as any[]).length > 0
    ? (store.opening_hours as any[])
    : defaultHours();

  const [form, setForm] = useState({
    name: store?.name || "",
    slug: store?.slug || "",
    description: store?.description || "",
    phone: store?.phone || "",
    address: store?.address || "",
    city: store?.city || "",
    state: store?.state || "",
    status_mode: (store as any)?.status_mode || "auto",
    is_open: store?.is_open || false,
    audio_notifications: (store as any)?.audio_notifications ?? true,
    delivery_enabled: store?.delivery_enabled ?? true,
    pickup_enabled: store?.pickup_enabled || false,
    min_order_value: store?.min_order_value || 0,
    primary_color: (store as any)?.primary_color || "#ea580c",
    logo_url: (store as any)?.logo_url || "",
    banner_url: (store as any)?.banner_url || "",
    banner_mobile_url: (store as any)?.banner_mobile_url || "",
    segment: (store as any)?.segment || "",
    pix_key: (store as any)?.pix_key || "",
    avg_prep_time: (store as any)?.avg_prep_time || 30,
    avg_delivery_time: (store as any)?.avg_delivery_time || 40,
    delivery_radius: (store as any)?.delivery_radius || 5,
    opening_hours: openingHours,
  });

  // Keep form in sync with store updates from context
  useEffect(() => {
    if (store) {
      setForm({
        name: store.name || "",
        slug: store.slug || "",
        description: store.description || "",
        phone: store.phone || "",
        address: store.address || "",
        city: store.city || "",
        state: store.state || "",
        status_mode: (store as any).status_mode || "auto",
        is_open: store.is_open || false,
        audio_notifications: (store as any).audio_notifications ?? true,
        delivery_enabled: store.delivery_enabled ?? true,
        pickup_enabled: store.pickup_enabled || false,
        min_order_value: store.min_order_value || 0,
        primary_color: (store as any).primary_color || "#ea580c",
        logo_url: (store as any).logo_url || "",
        banner_url: (store as any).banner_url || "",
        banner_mobile_url: (store as any).banner_mobile_url || "",
        segment: (store as any).segment || "",
        pix_key: (store as any).pix_key || "",
        avg_prep_time: (store as any).avg_prep_time || 30,
        avg_delivery_time: (store as any).avg_delivery_time || 40,
        delivery_radius: (store as any).delivery_radius || 5,
        opening_hours: store.opening_hours && Array.isArray(store.opening_hours) && store.opening_hours.length > 0 ? (store.opening_hours as any[]) : defaultHours(),
      });
    }
  }, [store]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await updateStore(form as any);
    if (error) {
      toast.error("Erro ao salvar");
    } else {
      toast.success("Loja atualizada!");
    }
    setSaving(false);
  };

  const handleUpload = async (file: File, field: "logo_url" | "banner_url" | "banner_mobile_url") => {
    if (!store) return;
    setUploading(field);
    const path = `${store.id}/${field}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("store-assets").upload(path, file);
    if (error) {
      toast.error("Erro ao enviar imagem");
      setUploading(null);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("store-assets").getPublicUrl(path);
    setForm({ ...form, [field]: publicUrl });
    toast.success("Imagem enviada!");
    setUploading(null);
  };

  const updateHours = (dayIndex: number, field: string, value: any) => {
    const newHours = [...form.opening_hours];
    if (field === "enabled") {
      newHours[dayIndex] = { ...newHours[dayIndex], enabled: value };
    } else {
      const [periodIndex, periodField] = field.split(".");
      const periods = [...newHours[dayIndex].periods];
      periods[parseInt(periodIndex)] = { ...periods[parseInt(periodIndex)], [periodField]: value };
      newHours[dayIndex] = { ...newHours[dayIndex], periods };
    }
    setForm({ ...form, opening_hours: newHours });
  };

  const addPeriod = (dayIndex: number) => {
    const newHours = [...form.opening_hours];
    newHours[dayIndex] = {
      ...newHours[dayIndex],
      periods: [...newHours[dayIndex].periods, { open: "18:00", close: "23:00" }],
    };
    setForm({ ...form, opening_hours: newHours });
  };

  const removePeriod = (dayIndex: number, periodIndex: number) => {
    const newHours = [...form.opening_hours];
    newHours[dayIndex] = {
      ...newHours[dayIndex],
      periods: newHours[dayIndex].periods.filter((_: any, i: number) => i !== periodIndex),
    };
    setForm({ ...form, opening_hours: newHours });
  };

  const handleSlugBlur = async () => {
    // Only update if it changed
    if (form.slug !== store?.slug) {
      const cleanSlug = form.slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
      setForm({ ...form, slug: cleanSlug });
      toast.info("Subdomínio alterado com sucesso! Salve para aplicar.");
    }
  };

  const handleRefreshSubscription = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
    toast.success("Dados da loja atualizados!");
  };

  if (!store) return null;

  const handleSwitchPlan = async (newPlan: "monthly" | "yearly") => {
    const subId = (store as any).asaas_subscription_id;
    if (!subId) {
      toast.error("Assinatura não encontrada. Se você acabou de assinar, aguarde alguns segundos ou verifique sua conta.");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-management`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "update_subscription",
          subscriptionId: subId,
          plan: newPlan,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Erro ao alterar plano");

      toast.success("Solicitação de alteração enviada! O plano será atualizado em instantes.");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSubscription = async () => {
    const subId = (store as any).asaas_subscription_id;
    if (!subId) {
      toast.error("Assinatura não encontrada.");
      return;
    }

    if (!confirm("Tem certeza que deseja cancelar sua assinatura? Sua loja será desativada imediatamente.")) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-management`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "cancel_subscription",
          subscriptionId: subId,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Erro ao cancelar assinatura");

      toast.success("Assinatura cancelada. Sua loja foi desativada.");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-extrabold text-foreground">Configurações</h2>
      </div>

      <Tabs defaultValue="perfil" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="perfil">Perfil da Loja</TabsTrigger>
          <TabsTrigger value="entrega">Entrega & Horários</TabsTrigger>
          <TabsTrigger value="assinatura" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Assinatura
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="space-y-6">

          <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-4">
            <h3 className="font-bold text-foreground">Status do Estabelecimento</h3>

            <RadioGroup
              value={form.status_mode}
              onValueChange={async (v) => {
                setForm({ ...form, status_mode: v });
                // Note: is_open is kept for compatibility but isStoreOpen will prioritize status_mode
                if (store) {
                  await supabase.from("stores").update({
                    status_mode: v,
                    is_open: v === "manual_open"
                  }).eq("id", store.id);
                }
              }}
              className="grid gap-3"
            >
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-transparent hover:border-primary/20 transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="auto" id="auto" />
                  <Label htmlFor="auto" className="cursor-pointer">
                    <p className="font-semibold text-foreground">Horário Automático</p>
                    <p className="text-sm text-muted-foreground">Abre e fecha conforme configurado abaixo</p>
                  </Label>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-transparent hover:border-primary/20 transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="manual_open" id="manual_open" />
                  <Label htmlFor="manual_open" className="cursor-pointer">
                    <p className="font-semibold text-foreground">Sempre Aberto</p>
                    <p className="text-sm text-muted-foreground">Força a loja a ficar aberta 24h</p>
                  </Label>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-transparent hover:border-primary/20 transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="manual_closed" id="manual_closed" />
                  <Label htmlFor="manual_closed" className="cursor-pointer">
                    <p className="font-semibold text-foreground">Sempre Fechado</p>
                    <p className="text-sm text-muted-foreground">Força a loja a ficar fechada (ex: férias)</p>
                  </Label>
                </div>
              </div>
            </RadioGroup>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 mt-4">
              <div>
                <p className="font-semibold text-foreground">Receber pedidos com Áudio</p>
                <p className="text-sm text-muted-foreground">Tocar aviso sonoro ao receber pedido</p>
              </div>
              <Switch checked={form.audio_notifications} onCheckedChange={(v) => setForm({ ...form, audio_notifications: v })} />
            </div>
          </div>

          {/* Profile & Brand */}
          <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-4">
            <h3 className="font-bold text-foreground">Perfil & Marca</h3>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Nome da loja</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Segmento</Label>
                <Select value={form.segment} onValueChange={(v) => setForm({ ...form, segment: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {SEGMENTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Subdomínio (Link da Loja)</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    onBlur={handleSlugBlur}
                    placeholder="minha-loja"
                    className="pr-20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                    .frfood.com.br
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Sua loja será acessada em: <span className="font-bold text-primary">{form.slug || 'slug'}.frfood.com.br</span>
              </p>
            </div>

            <div>
              <Label>Descrição da Loja</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Uma breve descrição sobre sua loja..." rows={3} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>WhatsApp</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>Chave PIX</Label>
                <Input value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} placeholder="Email, CPF, Telefone ou Aleatória" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Logo da loja</Label>
                <div className="flex items-center gap-3">
                  {form.logo_url && <img src={form.logo_url} alt="Logo" className="w-16 h-16 object-cover rounded-xl" />}
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "logo_url")} />
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
                      <Upload className="w-4 h-4" /> {uploading === "logo_url" ? "Enviando..." : "Enviar logo"}
                    </div>
                  </label>
                </div>
              </div>
              <div>
                <Label>Banner Desktop (1210x250)</Label>
                <div className="flex items-center gap-3">
                  {form.banner_url && <img src={form.banner_url} alt="Banner" className="w-24 h-12 object-cover rounded-lg" />}
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "banner_url")} />
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
                      <Upload className="w-4 h-4" /> {uploading === "banner_url" ? "Enviando..." : "Enviar banner"}
                    </div>
                  </label>
                </div>
              </div>
              <div>
                <Label>Banner Mobile (Opcional)</Label>
                <div className="flex items-center gap-3">
                  {form.banner_mobile_url && <img src={form.banner_mobile_url} alt="Banner Mobile" className="w-24 h-12 object-cover rounded-lg" />}
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "banner_mobile_url")} />
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
                      <Upload className="w-4 h-4" /> {uploading === "banner_mobile_url" ? "Enviando..." : "Enviar banner"}
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <Label>Cor principal</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                <Input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="w-32" />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-4">
            <h3 className="font-bold text-foreground">Endereço</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Label>Endereço</Label>
                <Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Estado</Label>
              <Input value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value })} className="w-32" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="entrega" className="space-y-6">

          {/* Delivery */}
          <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-4">
            <h3 className="font-bold text-foreground">Entrega & Retirada</h3>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <p className="font-medium text-foreground">Entrega habilitada</p>
              <Switch checked={form.delivery_enabled} onCheckedChange={(v: boolean) => setForm({ ...form, delivery_enabled: v as true })} />
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <p className="font-medium text-foreground">Retirada no local</p>
              <Switch checked={form.pickup_enabled} onCheckedChange={(v) => setForm({ ...form, pickup_enabled: v })} />
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label>Pedido mínimo (R$)</Label>
                <Input type="number" step="0.01" value={form.min_order_value} onChange={(e) => setForm({ ...form, min_order_value: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Tempo de preparo (min)</Label>
                <Input type="number" value={form.avg_prep_time} onChange={(e) => setForm({ ...form, avg_prep_time: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Tempo de entrega (min)</Label>
                <Input type="number" value={form.avg_delivery_time} onChange={(e) => setForm({ ...form, avg_delivery_time: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <Label>Raio de entrega (km)</Label>
              <Input type="number" step="0.5" value={form.delivery_radius} onChange={(e) => setForm({ ...form, delivery_radius: parseFloat(e.target.value) || 0 })} className="w-32" />
            </div>
          </div>

          {/* Opening Hours */}
          <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-4">
            <h3 className="font-bold text-foreground">Horário de Funcionamento</h3>
            <p className="text-sm text-muted-foreground">Configure os horários para cada dia da semana. A loja abrirá e fechará automaticamente.</p>
            <div className="space-y-3">
              {form.opening_hours.map((day: any, dayIndex: number) => (
                <div key={day.day} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Switch checked={day.enabled} onCheckedChange={(v) => updateHours(dayIndex, "enabled", v)} />
                      <span className={`text-sm font-medium ${day.enabled ? "text-foreground" : "text-muted-foreground"}`}>{day.day}</span>
                    </div>
                    {day.enabled && (
                      <button onClick={() => addPeriod(dayIndex)} className="text-xs text-primary hover:underline">+ intervalo</button>
                    )}
                  </div>
                  {day.enabled && day.periods.map((period: any, periodIndex: number) => (
                    <div key={periodIndex} className="flex items-center gap-2 ml-10 mb-1">
                      <Input type="time" value={period.open} onChange={(e) => updateHours(dayIndex, `${periodIndex}.open`, e.target.value)} className="w-28 h-8 text-xs" />
                      <span className="text-xs text-muted-foreground">às</span>
                      <Input type="time" value={period.close} onChange={(e) => updateHours(dayIndex, `${periodIndex}.close`, e.target.value)} className="w-28 h-8 text-xs" />
                      {day.periods.length > 1 && (
                        <button onClick={() => removePeriod(dayIndex, periodIndex)} className="text-xs text-destructive hover:underline">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-3">
            <h3 className="font-bold text-foreground">Link da Loja</h3>
            <p className="text-sm text-muted-foreground">
              Seu cardápio está disponível em:{" "}
              <a href={`https://${store.slug}.frfood.com.br`} target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">https://{store.slug}.frfood.com.br</a>
            </p>
          </div>
        </TabsContent>

        <TabsContent value="assinatura" className="space-y-6">
          <div className="bg-card rounded-2xl p-6 shadow-card border border-border/50">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${store.plan_status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Plano Atual: {store.plan_type === 'yearly' ? 'Anual' : 'Mensal'}</h3>
                  <p className="text-sm text-muted-foreground">
                    {store.plan_status === 'active' ? '✅ Assinatura Ativa' : '⚠️ Pagamento Pendente'}
                  </p>
                  {(store as any).asaas_next_due_date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Próxima renovação: <span className="font-bold">{new Date((store as any).asaas_next_due_date).toLocaleDateString('pt-BR')}</span>
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshSubscription}
                disabled={refreshing}
                className="gap-2"
              >
                {refreshing ? "Sincronizando..." : "Verificar Assinatura"}
              </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className={`p-6 rounded-2xl border-2 transition-all ${store.plan_type === 'monthly' ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-foreground">Plano Mensal</span>
                  {store.plan_type === 'monthly' && <Check className="w-5 h-5 text-primary" />}
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-2xl font-extrabold text-foreground">R$ 149,90</span>
                  <span className="text-xs text-muted-foreground">/mês</span>
                </div>
                {store.plan_type !== 'monthly' && (
                  <Button variant="outline" className="w-full" onClick={() => handleSwitchPlan('monthly')} disabled={saving}>
                    Alterar para Mensal
                  </Button>
                )}
              </div>

              <div className={`p-6 rounded-2xl border-2 transition-all relative ${store.plan_type === 'yearly' ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
                {store.plan_type !== 'yearly' && (
                  <div className="absolute -top-3 right-4 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3" /> Economia de R$ 300
                  </div>
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-foreground">Plano Anual</span>
                  {store.plan_type === 'yearly' && <Check className="w-5 h-5 text-primary" />}
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-2xl font-extrabold text-foreground">R$ 124,90</span>
                  <span className="text-xs text-muted-foreground">/mês</span>
                </div>
                {store.plan_type !== 'yearly' && (
                  <Button variant="hero" className="w-full" onClick={() => handleSwitchPlan('yearly')} disabled={saving}>
                    Alterar para Anual
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-muted/30 text-xs text-muted-foreground">
              <p>As alterações de plano serão processadas pelo Asaas e refletidas aqui automaticamente após a confirmação.</p>
            </div>

            <div className="mt-8 border-t border-border pt-8">
              <h4 className="font-bold text-foreground mb-4">Zona de Perigo</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Ao cancelar sua assinatura, sua loja será desativada e você não poderá receber novos pedidos até que assine novamente.
              </p>
              <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors" onClick={handleCancelSubscription} disabled={saving}>
                <XCircle className="w-4 h-4 mr-2" /> Cancelar Assinatura & Desativar Loja
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-8 flex justify-end">
        <Button variant="hero" onClick={handleSave} disabled={saving} size="lg">
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
};

export default StoreSettings;

