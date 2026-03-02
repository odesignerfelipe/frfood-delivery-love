import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";

const DeliveryZones = () => {
  const { store } = useStore();
  const [zones, setZones] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ neighborhood: "", fee: 0, estimated_time: "" });

  const fetchZones = async () => {
    if (!store) return;
    const { data } = await supabase.from("delivery_zones").select("*").eq("store_id", store.id).order("neighborhood");
    setZones(data || []);
  };

  useEffect(() => { fetchZones(); }, [store]);

  const handleSave = async () => {
    if (!store || !form.neighborhood.trim()) return;
    if (editing) {
      await supabase.from("delivery_zones").update(form).eq("id", editing.id);
      toast.success("Zona atualizada!");
    } else {
      await supabase.from("delivery_zones").insert({ ...form, store_id: store.id });
      toast.success("Zona criada!");
    }
    setOpen(false);
    resetForm();
    fetchZones();
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ neighborhood: "", fee: 0, estimated_time: "" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta zona?")) return;
    await supabase.from("delivery_zones").delete().eq("id", id);
    toast.success("Zona excluída!");
    fetchZones();
  };

  const openEdit = (z: any) => {
    setEditing(z);
    setForm({ neighborhood: z.neighborhood, fee: z.fee, estimated_time: z.estimated_time || "" });
    setOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Taxas de Entrega</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" size="sm" onClick={resetForm}><Plus className="w-4 h-4 mr-1" /> Nova Zona</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar Zona" : "Nova Zona de Entrega"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Bairro</Label>
                <Input value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} placeholder="Ex: Centro" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Taxa (R$)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground font-medium">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      className="pl-9"
                      value={form.fee}
                      onChange={(e) => setForm({ ...form, fee: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Tempo estimado (Minutos)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      className="pr-12"
                      value={(form.estimated_time || "").replace(/\D/g, "")}
                      onChange={(e) => setForm({ ...form, estimated_time: e.target.value ? `${e.target.value} min` : "" })}
                      placeholder="Ex: 40"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">min</span>
                  </div>
                </div>
              </div>
              <Button variant="hero" onClick={handleSave} className="w-full">{editing ? "Salvar" : "Criar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {zones.length === 0 && <p className="text-muted-foreground text-center py-12">Nenhuma zona de entrega cadastrada.</p>}
        {zones.map((z) => (
          <div key={z.id} className="bg-card rounded-xl p-4 shadow-card border border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-primary" />
              <div>
                <p className="font-bold text-foreground">{z.neighborhood}</p>
                <p className="text-sm text-muted-foreground">R$ {z.fee.toFixed(2)} • {z.estimated_time || "Sem tempo estimado"}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => openEdit(z)}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(z.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeliveryZones;
