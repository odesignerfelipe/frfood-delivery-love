import { useState } from "react";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const StoreSettings = () => {
  const { store, updateStore } = useStore();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: store?.name || "",
    description: store?.description || "",
    phone: store?.phone || "",
    address: store?.address || "",
    city: store?.city || "",
    state: store?.state || "",
    is_open: store?.is_open || false,
    delivery_enabled: store?.delivery_enabled || true,
    pickup_enabled: store?.pickup_enabled || false,
    min_order_value: store?.min_order_value || 0,
  });

  const handleSave = async () => {
    setSaving(true);
    const { error } = await updateStore(form);
    if (error) {
      toast.error("Erro ao salvar");
    } else {
      toast.success("Loja atualizada!");
    }
    setSaving(false);
  };

  if (!store) return null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Configurações da Loja</h2>

      <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-6 max-w-2xl">
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div>
            <p className="font-semibold text-foreground">Status da loja</p>
            <p className="text-sm text-muted-foreground">
              {form.is_open ? "Sua loja está aberta e recebendo pedidos" : "Sua loja está fechada"}
            </p>
          </div>
          <Switch checked={form.is_open} onCheckedChange={(v) => setForm({ ...form, is_open: v })} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Nome da loja</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>WhatsApp</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>

        <div>
          <Label>Descrição</Label>
          <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label>Endereço</Label>
            <Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div>
            <Label>Estado</Label>
            <Input value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </div>
        </div>

        <div>
          <Label>Pedido mínimo (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.min_order_value}
            onChange={(e) => setForm({ ...form, min_order_value: parseFloat(e.target.value) || 0 })}
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div>
            <p className="font-medium text-foreground">Entrega</p>
          </div>
          <Switch checked={form.delivery_enabled} onCheckedChange={(v: boolean) => setForm({ ...form, delivery_enabled: v as true })} />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div>
            <p className="font-medium text-foreground">Retirada no local</p>
          </div>
          <Switch checked={form.pickup_enabled} onCheckedChange={(v) => setForm({ ...form, pickup_enabled: v })} />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <p className="text-sm text-muted-foreground">
            Link da sua loja:{" "}
            <a href={`/loja/${store.slug}`} target="_blank" className="text-primary font-medium hover:underline">
              /loja/{store.slug}
            </a>
          </p>
        </div>

        <Button variant="hero" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
};

export default StoreSettings;
