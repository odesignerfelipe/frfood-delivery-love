import { useState } from "react";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload } from "lucide-react";

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
  const { store, updateStore } = useStore();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const openingHours = store?.opening_hours && Array.isArray(store.opening_hours) && (store.opening_hours as any[]).length > 0
    ? (store.opening_hours as any[])
    : defaultHours();

  const [form, setForm] = useState({
    name: store?.name || "",
    description: store?.description || "",
    phone: store?.phone || "",
    address: store?.address || "",
    city: store?.city || "",
    state: store?.state || "",
    is_open: store?.is_open || false,
    delivery_enabled: store?.delivery_enabled ?? true,
    pickup_enabled: store?.pickup_enabled || false,
    min_order_value: store?.min_order_value || 0,
    primary_color: (store as any)?.primary_color || "#ea580c",
    logo_url: (store as any)?.logo_url || "",
    banner_url: (store as any)?.banner_url || "",
    segment: (store as any)?.segment || "",
    avg_prep_time: (store as any)?.avg_prep_time || 30,
    avg_delivery_time: (store as any)?.avg_delivery_time || 40,
    delivery_radius: (store as any)?.delivery_radius || 5,
    opening_hours: openingHours,
  });

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

  const handleUpload = async (file: File, field: "logo_url" | "banner_url") => {
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

  if (!store) return null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Configurações da Loja</h2>
      <div className="space-y-6 max-w-2xl">

        {/* Status */}
        <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-4">
          <h3 className="font-bold text-foreground">Status</h3>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="font-semibold text-foreground">Status da loja</p>
              <p className="text-sm text-muted-foreground">{form.is_open ? "Sua loja está aberta" : "Sua loja está fechada"}</p>
            </div>
            <Switch checked={form.is_open} onCheckedChange={(v) => setForm({ ...form, is_open: v })} />
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
            <Label>Descrição</Label>
            <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>

          <div>
            <Label>WhatsApp</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
              <Label>Banner principal</Label>
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
            <a href={`/loja/${store.slug}`} target="_blank" className="text-primary font-medium hover:underline">/loja/{store.slug}</a>
          </p>
        </div>

        <Button variant="hero" onClick={handleSave} disabled={saving} size="lg">
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
};

export default StoreSettings;
