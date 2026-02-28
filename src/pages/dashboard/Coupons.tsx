import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";

const Coupons = () => {
  const { store } = useStore();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    code: "",
    discount_type: "percentage",
    discount_value: 0,
    min_order_value: 0,
    max_uses: null as number | null,
    is_active: true,
  });

  const fetchCoupons = async () => {
    if (!store) return;
    const { data } = await supabase.from("coupons").select("*").eq("store_id", store.id).order("created_at", { ascending: false });
    setCoupons(data || []);
  };

  useEffect(() => { fetchCoupons(); }, [store]);

  const handleSave = async () => {
    if (!store || !form.code.trim()) return;
    const payload = { ...form, code: form.code.toUpperCase(), store_id: store.id };

    if (editing) {
      const { store_id, ...up } = payload;
      await supabase.from("coupons").update(up).eq("id", editing.id);
      toast.success("Cupom atualizado!");
    } else {
      await supabase.from("coupons").insert(payload);
      toast.success("Cupom criado!");
    }
    setOpen(false);
    resetForm();
    fetchCoupons();
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ code: "", discount_type: "percentage", discount_value: 0, min_order_value: 0, max_uses: null, is_active: true });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este cupom?")) return;
    await supabase.from("coupons").delete().eq("id", id);
    toast.success("Cupom excluído!");
    fetchCoupons();
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({ code: c.code, discount_type: c.discount_type, discount_value: c.discount_value, min_order_value: c.min_order_value || 0, max_uses: c.max_uses, is_active: c.is_active });
    setOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Cupons</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" size="sm" onClick={resetForm}><Plus className="w-4 h-4 mr-1" /> Novo Cupom</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar Cupom" : "Novo Cupom"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Código</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Ex: PROMO10" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                      <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor do desconto</Label>
                  <Input type="number" step="0.01" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Pedido mínimo (R$)</Label>
                  <Input type="number" step="0.01" value={form.min_order_value} onChange={(e) => setForm({ ...form, min_order_value: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Máximo de usos</Label>
                  <Input type="number" value={form.max_uses ?? ""} onChange={(e) => setForm({ ...form, max_uses: e.target.value ? parseInt(e.target.value) : null })} placeholder="Ilimitado" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>
              <Button variant="hero" onClick={handleSave} className="w-full">{editing ? "Salvar" : "Criar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {coupons.length === 0 && <p className="text-muted-foreground text-center py-12">Nenhum cupom criado ainda.</p>}
        {coupons.map((c) => (
          <div key={c.id} className="bg-card rounded-xl p-4 shadow-card border border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Tag className="w-5 h-5 text-primary" />
              <div>
                <p className="font-bold text-foreground">{c.code}</p>
                <p className="text-sm text-muted-foreground">
                  {c.discount_type === "percentage" ? `${c.discount_value}%` : `R$ ${c.discount_value.toFixed(2)}`} de desconto
                  {c.min_order_value > 0 && ` • Mín. R$ ${c.min_order_value.toFixed(2)}`}
                  {` • ${c.current_uses}${c.max_uses ? `/${c.max_uses}` : ""} usos`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Coupons;
