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
import { Plus, Pencil, Trash2, AlertTriangle, GripVertical } from "lucide-react";

type VariationOption = { name: string; price: number };
type Variation = {
  id?: string;
  name: string;
  required: boolean;
  max_selections: number;
  options: VariationOption[];
  sort_order: number;
};

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
    promotional_price: 0,
    category_id: "",
    serves_people: 0,
    is_active: true,
    is_sold_out: false,
    image_url: "",
  });
  const [variations, setVariations] = useState<Variation[]>([]);

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

  const fetchVariations = async (productId: string) => {
    const { data } = await supabase
      .from("product_variations")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order");
    return (data || []).map((v: any) => ({
      id: v.id,
      name: v.name,
      required: v.required,
      max_selections: v.max_selections,
      options: v.options || [],
      sort_order: v.sort_order,
    }));
  };

  const handleSave = async () => {
    if (!store || !form.name.trim()) return;
    const payload = {
      name: form.name,
      description: form.description,
      price: form.price,
      promotional_price: form.promotional_price || null,
      serves_people: form.serves_people || null,
      category_id: form.category_id || null,
      is_active: form.is_active,
      is_sold_out: form.is_sold_out,
      image_url: form.image_url,
      store_id: store.id,
    };

    let productId = editing?.id;

    if (editing) {
      const { store_id, ...updatePayload } = payload;
      await supabase.from("products").update(updatePayload).eq("id", editing.id);
      toast.success("Produto atualizado!");
    } else {
      const { data } = await supabase.from("products").insert({ ...payload, sort_order: products.length }).select("id").single();
      if (data) productId = data.id;
      toast.success("Produto criado!");
    }

    // Save variations
    if (productId) {
      // Delete removed variations
      if (editing) {
        const existingIds = variations.filter(v => v.id).map(v => v.id);
        const { data: currentVars } = await supabase.from("product_variations").select("id").eq("product_id", productId);
        const toDelete = (currentVars || []).filter((cv: any) => !existingIds.includes(cv.id));
        if (toDelete.length > 0) {
          await supabase.from("product_variations").delete().in("id", toDelete.map((d: any) => d.id));
        }
      }

      // Upsert variations
      for (let i = 0; i < variations.length; i++) {
        const v = variations[i];
        const varPayload = {
          product_id: productId,
          name: v.name,
          required: v.required,
          max_selections: v.max_selections,
          options: v.options,
          sort_order: i,
        };
        if (v.id) {
          await supabase.from("product_variations").update(varPayload).eq("id", v.id);
        } else {
          await supabase.from("product_variations").insert(varPayload);
        }
      }
    }

    setOpen(false);
    resetForm();
    fetchAll();
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ name: "", description: "", price: 0, promotional_price: 0, serves_people: 0, category_id: "", is_active: true, is_sold_out: false, image_url: "" });
    setVariations([]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    await supabase.from("products").delete().eq("id", id);
    toast.success("Produto excluído!");
    fetchAll();
  };

  const openEdit = async (p: any) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || "",
      price: p.price,
      promotional_price: p.promotional_price || 0,
      serves_people: p.serves_people || 0,
      category_id: p.category_id || "",
      is_active: p.is_active,
      is_sold_out: p.is_sold_out || false,
      image_url: p.image_url || "",
    });
    const vars = await fetchVariations(p.id);
    setVariations(vars);
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

  const toggleSoldOut = async (product: any) => {
    const newVal = !product.is_sold_out;
    await supabase.from("products").update({ is_sold_out: newVal }).eq("id", product.id);
    toast.success(newVal ? "Produto marcado como esgotado" : "Produto disponível novamente");
    fetchAll();
  };

  // Variation helpers
  const addVariation = () => {
    setVariations([...variations, { name: "", required: false, max_selections: 1, options: [{ name: "", price: 0 }], sort_order: variations.length }]);
  };

  const updateVariation = (index: number, field: string, value: any) => {
    const updated = [...variations];
    (updated[index] as any)[field] = value;
    setVariations(updated);
  };

  const removeVariation = (index: number) => {
    setVariations(variations.filter((_, i) => i !== index));
  };

  const addOption = (varIndex: number) => {
    const updated = [...variations];
    updated[varIndex].options.push({ name: "", price: 0 });
    setVariations(updated);
  };

  const updateOption = (varIndex: number, optIndex: number, field: string, value: any) => {
    const updated = [...variations];
    (updated[varIndex].options[optIndex] as any)[field] = value;
    setVariations(updated);
  };

  const removeOption = (varIndex: number, optIndex: number) => {
    const updated = [...variations];
    updated[varIndex].options = updated[varIndex].options.filter((_, i) => i !== optIndex);
    setVariations(updated);
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  <Label>Preço Promocional (R$)</Label>
                  <Input type="number" step="0.01" value={form.promotional_price} onChange={(e) => setForm({ ...form, promotional_price: parseFloat(e.target.value) || 0 })} placeholder="0.00 (Opcional)" />
                </div>
                <div className="col-span-2">
                  <Label>Serve quantas pessoas? (Opcional)</Label>
                  <Input type="number" step="1" value={form.serves_people || ""} onChange={(e) => setForm({ ...form, serves_people: parseInt(e.target.value) || 0 })} placeholder="Ex: 2" />
                </div>
                <div className="col-span-2">
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
              <div className="flex items-center justify-between">
                <div>
                  <Label>Esgotado</Label>
                  <p className="text-xs text-muted-foreground">Quando ativado, exibe mensagem de indisponibilidade na loja</p>
                </div>
                <Switch checked={form.is_sold_out} onCheckedChange={(v) => setForm({ ...form, is_sold_out: v })} />
              </div>

              {/* Variations Section */}
              <div className="border-t border-border pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <Label className="text-base font-bold">Variações e Opcionais</Label>
                    <p className="text-xs text-muted-foreground">Ex: Tipo de carne, Molhos, Maionese</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={addVariation}>
                    <Plus className="w-3 h-3 mr-1" /> Grupo
                  </Button>
                </div>

                <div className="space-y-4">
                  {variations.map((v, vi) => (
                    <div key={vi} className="bg-muted/50 rounded-xl p-4 space-y-3 border border-border/50">
                      <div className="flex items-center gap-2">
                        <Input
                          value={v.name}
                          onChange={(e) => updateVariation(vi, "name", e.target.value)}
                          placeholder="Nome do grupo (ex: Tipo de Carne)"
                          className="flex-1 font-medium"
                        />
                        <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => removeVariation(vi)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Switch checked={v.required} onCheckedChange={(val) => updateVariation(vi, "required", val)} />
                          <span className="text-muted-foreground">Obrigatório</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-muted-foreground whitespace-nowrap">Máx. seleções:</Label>
                          <Input
                            type="number"
                            min={1}
                            value={v.max_selections}
                            onChange={(e) => updateVariation(vi, "max_selections", parseInt(e.target.value) || 1)}
                            className="w-16 h-8 text-center"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground">Opções</Label>
                        {v.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <Input
                              value={opt.name}
                              onChange={(e) => updateOption(vi, oi, "name", e.target.value)}
                              placeholder="Nome da opção"
                              className="flex-1 h-8 text-sm"
                            />
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">R$</span>
                              <Input
                                type="number"
                                step="0.01"
                                value={opt.price}
                                onChange={(e) => updateOption(vi, oi, "price", parseFloat(e.target.value) || 0)}
                                className="w-20 h-8 text-sm"
                                placeholder="0.00"
                              />
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeOption(vi, oi)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addOption(vi)}>
                          <Plus className="w-3 h-3 mr-1" /> Adicionar opção
                        </Button>
                      </div>
                    </div>
                  ))}
                  {variations.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-xl">
                      Nenhuma variação cadastrada. Clique em "+ Grupo" para adicionar opções como tipo de carne, molhos, etc.
                    </p>
                  )}
                </div>
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
          <div key={p.id} className={`bg-card rounded-xl shadow-card border border-border/50 overflow-hidden ${p.is_sold_out ? "opacity-70" : ""}`}>
            {p.image_url && (
              <div className="relative">
                <img src={p.image_url} alt={p.name} className={`w-full h-40 object-cover ${p.is_sold_out ? "grayscale" : ""}`} />
                {p.is_sold_out && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Esgotado
                    </span>
                  </div>
                )}
              </div>
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
              {p.is_sold_out && !p.image_url && (
                <span className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3" /> Esgotado
                </span>
              )}
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                  <Pencil className="w-3 h-3 mr-1" /> Editar
                </Button>
                <Button
                  variant={p.is_sold_out ? "default" : "ghost"}
                  size="sm"
                  onClick={() => toggleSoldOut(p)}
                  className={p.is_sold_out ? "bg-green-600 hover:bg-green-700 text-white" : "text-orange-600"}
                >
                  {p.is_sold_out ? "Disponibilizar" : "Esgotar"}
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
