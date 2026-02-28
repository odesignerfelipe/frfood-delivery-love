import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

const Products = () => {
  const { store } = useStore();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: 0,
    category_id: "",
    is_active: true,
    image_url: "",
  });

  const fetchAll = async () => {
    if (!store) return;
    const [p, c] = await Promise.all([
      supabase.from("products").select("*, categories(name)").eq("store_id", store.id).order("sort_order"),
      supabase.from("categories").select("*").eq("store_id", store.id).order("sort_order"),
    ]);
    setProducts(p.data || []);
    setCategories(c.data || []);
  };

  useEffect(() => { fetchAll(); }, [store]);

  const handleSave = async () => {
    if (!store || !form.name.trim()) return;
    const payload = {
      name: form.name,
      description: form.description,
      price: form.price,
      category_id: form.category_id || null,
      is_active: form.is_active,
      image_url: form.image_url,
      store_id: store.id,
    };

    if (editing) {
      const { store_id, ...updatePayload } = payload;
      await supabase.from("products").update(updatePayload).eq("id", editing.id);
      toast.success("Produto atualizado!");
    } else {
      await supabase.from("products").insert({ ...payload, sort_order: products.length });
      toast.success("Produto criado!");
    }
    setOpen(false);
    resetForm();
    fetchAll();
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ name: "", description: "", price: 0, category_id: "", is_active: true, image_url: "" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    await supabase.from("products").delete().eq("id", id);
    toast.success("Produto excluído!");
    fetchAll();
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || "",
      price: p.price,
      category_id: p.category_id || "",
      is_active: p.is_active,
      image_url: p.image_url || "",
    });
    setOpen(true);
  };

  const openNew = () => {
    resetForm();
    setOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !store) return;
    const path = `${store.id}/products/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("store-assets").upload(path, file);
    if (error) {
      toast.error("Erro ao enviar imagem");
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("store-assets").getPublicUrl(path);
    setForm({ ...form, image_url: publicUrl });
    toast.success("Imagem enviada!");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Produtos</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" size="sm" onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" /> Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Pizza Margherita" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Preço (R$)</Label>
                  <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Imagem do produto</Label>
                <Input type="file" accept="image/*" onChange={handleImageUpload} />
                {form.image_url && (
                  <img src={form.image_url} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded-lg" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>
              <Button variant="hero" onClick={handleSave} className="w-full">
                {editing ? "Salvar" : "Criar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.length === 0 && (
          <p className="text-muted-foreground text-center py-12 col-span-full">Nenhum produto cadastrado ainda.</p>
        )}
        {products.map((p) => (
          <div key={p.id} className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
            {p.image_url && (
              <img src={p.image_url} alt={p.name} className="w-full h-40 object-cover" />
            )}
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-foreground">{p.name}</h3>
                  <p className="text-sm text-muted-foreground">{(p as any).categories?.name || "Sem categoria"}</p>
                </div>
                <span className="text-primary font-bold">R$ {p.price.toFixed(2)}</span>
              </div>
              {!p.is_active && <span className="text-xs text-destructive font-medium">Inativo</span>}
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                  <Pencil className="w-3 h-3 mr-1" /> Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Products;
