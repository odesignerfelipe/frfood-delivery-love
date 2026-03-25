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
import { Plus, Pencil, Trash2, AlertTriangle, GripVertical, BookOpen, X, Copy } from "lucide-react";

type VariationOption = { name: string; price: number; recipe?: any[] };
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
    manage_stock: false,
    stock_quantity: 0,
    recipe: [] as any[],
  });
  const [variations, setVariations] = useState<Variation[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recipeProduct, setRecipeProduct] = useState<any>(null);
  const [recipeItems, setRecipeItems] = useState<any[]>([]);
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);

  const [optionRecipeOpen, setOptionRecipeOpen] = useState(false);
  const [optionRecipeGroupIndex, setOptionRecipeGroupIndex] = useState<number | null>(null);
  const [optionRecipeOptionIndex, setOptionRecipeOptionIndex] = useState<number | null>(null);
  const [optionRecipeItems, setOptionRecipeItems] = useState<any[]>([]);

  const [newIngredientOpen, setNewIngredientOpen] = useState(false);
  const [newIngredientForm, setNewIngredientForm] = useState({ name: "", unit: "kg", cost_per_unit: 0 });

  const handleCreateIngredient = async () => {
    if (!store) return;
    try {
      const { data, error } = await supabase.from("inventory_items").insert({
        store_id: store.id,
        current_stock: 0,
        ...newIngredientForm
      }).select().single();
      
      if (error) throw error;
      
      setInventoryItems(prev => [...prev, data]);
      setNewIngredientOpen(false);
      setNewIngredientForm({ name: "", unit: "kg", cost_per_unit: 0 });
      toast.success("Insumo criado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao criar insumo: " + err.message);
    }
  };

  const fetchAll = async () => {
    if (!store) return;
    const [p, c, i] = await Promise.all([
      supabase.from("products").select("*, categories(name)").eq("store_id", store.id).order("sort_order"),
      supabase.from("categories").select("*").eq("store_id", store.id).order("sort_order"),
      supabase.from("inventory_items").select("*").eq("store_id", store.id).order("name"),
    ]);
    setProducts(p.data || []);
    setCategories(c.data || []);
    setInventoryItems(i.data || []);
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
      manage_stock: form.manage_stock,
      stock_quantity: form.manage_stock ? form.stock_quantity : 0,
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

    // Save recipe items after product is saved/updated
    if (productId) {
      try {
        await supabase.from("product_recipe_items").delete().eq("product_id", productId);
        const toInsert = form.recipe
          .filter((ri: any) => ri.inventory_item_id)
          .map((ri: any) => ({
            product_id: productId,
            inventory_item_id: ri.inventory_item_id,
            quantity: ri.quantity,
            measurement_unit: ri.measurement_unit || null
          }));
        if (toInsert.length > 0) {
          await supabase.from("product_recipe_items").insert(toInsert);
        }
      } catch (err: any) {
        console.error("Error saving recipe:", err);
      }
    }
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ name: "", description: "", price: 0, promotional_price: 0, serves_people: 0, category_id: "", is_active: true, is_sold_out: false, image_url: "", manage_stock: false, stock_quantity: 0, recipe: [] });
    setVariations([]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    await supabase.from("products").delete().eq("id", id);
    toast.success("Produto excluído!");
    fetchAll();
  };

  const handleDuplicate = async (p: any) => {
    if (!store) return;
    const toastId = toast.loading("Duplicando produto...");
    
    try {
      // 1. Duplicate base product
      const { id, created_at, updated_at, categories, ...productData } = p;
      const { data: newProduct, error: prodErr } = await supabase
        .from("products")
        .insert({
          ...productData,
          name: `${productData.name} (Cópia)`,
          is_active: false,
          sort_order: products.length
        })
        .select("id")
        .single();
        
      if (prodErr) throw prodErr;
      const newId = newProduct.id;

      // 2. Duplicate recipe
      const { data: recipeData } = await supabase.from("product_recipe_items").select("*").eq("product_id", p.id);
      if (recipeData && recipeData.length > 0) {
        const newRecipe = recipeData.map(({ id, created_at, product_id, ...rest }) => ({
          ...rest,
          product_id: newId
        }));
        await supabase.from("product_recipe_items").insert(newRecipe);
      }

      // 3. Duplicate variations
      const { data: varsData } = await supabase.from("product_variations").select("*").eq("product_id", p.id);
      if (varsData && varsData.length > 0) {
        const newVars = varsData.map(({ id, created_at, product_id, ...rest }) => ({
          ...rest,
          product_id: newId
        }));
        await supabase.from("product_variations").insert(newVars);
      }

      toast.success("Produto duplicado com sucesso!", { id: toastId });
      fetchAll();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao duplicar: " + err.message, { id: toastId });
    }
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
      manage_stock: p.manage_stock || false,
      stock_quantity: p.stock_quantity || 0,
      image_url: p.image_url || "",
      recipe: [],
    });

    const { data: recipeData } = await supabase.from("product_recipe_items").select("*").eq("product_id", p.id);
    setForm(prev => ({ ...prev, recipe: recipeData || [] }));

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

  const openOptionRecipe = (varIndex: number, optIndex: number) => {
    setOptionRecipeGroupIndex(varIndex);
    setOptionRecipeOptionIndex(optIndex);
    const existingRecipe = variations[varIndex].options[optIndex].recipe || [];
    setOptionRecipeItems([...existingRecipe]);
    setOptionRecipeOpen(true);
  };

  const addOptionRecipeItem = () => {
    setOptionRecipeItems([...optionRecipeItems, { inventory_item_id: "", quantity: 1 }]);
  };

  const removeOptionRecipeItem = (index: number) => {
    setOptionRecipeItems(optionRecipeItems.filter((_, i) => i !== index));
  };

  const handleSaveOptionRecipe = () => {
    if (optionRecipeGroupIndex === null || optionRecipeOptionIndex === null) return;
    const updatedVariations = [...variations];
    updatedVariations[optionRecipeGroupIndex].options[optionRecipeOptionIndex].recipe = optionRecipeItems.filter(ri => ri.inventory_item_id && ri.quantity > 0);
    setVariations(updatedVariations);
    setOptionRecipeOpen(false);
    toast.success("Receita da opção salva!");
  };

  // Recipe helpers
  const openRecipe = async (p: any) => {
    setRecipeProduct(p);
    const { data } = await supabase
      .from("product_recipe_items")
      .select("*, inventory_items(*)")
      .eq("product_id", p.id);

    setRecipeItems((data || []).map(r => ({
      id: r.id,
      inventory_item_id: r.inventory_item_id,
      quantity: r.quantity,
      measurement_unit: r.measurement_unit
    })));
    setRecipeOpen(true);
  };

  const addRecipeItem = () => {
    setRecipeItems([...recipeItems, { inventory_item_id: "", quantity: 1 }]);
  };

  const removeRecipeItem = (index: number) => {
    setRecipeItems(recipeItems.filter((_, i) => i !== index));
  };

  const handleSaveRecipe = async () => {
    if (!recipeProduct) return;
    setIsSavingRecipe(true);

    try {
      // Delete old
      await supabase.from("product_recipe_items").delete().eq("product_id", recipeProduct.id);

      // Insert new
      const toInsert = recipeItems
        .filter(ri => ri.inventory_item_id)
        .map(ri => ({
          product_id: recipeProduct.id,
          inventory_item_id: ri.inventory_item_id,
          quantity: ri.quantity,
          measurement_unit: ri.measurement_unit || null
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from("product_recipe_items").insert(toInsert);
        if (error) throw error;
      }

      toast.success("Ficha técnica salva!");
      setRecipeOpen(false);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setIsSavingRecipe(false);
    }
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

              <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-bold">Gerenciar Estoque</Label>
                    <p className="text-xs text-muted-foreground">Reduz o estoque a cada venda e esgota o item automaticamente</p>
                  </div>
                  <Switch checked={form.manage_stock} onCheckedChange={(v) => setForm({ ...form, manage_stock: v })} />
                </div>
                {form.manage_stock && (
                  <div className="pt-2">
                    <Label>Quantidade em Estoque</Label>
                    <Input
                      type="number"
                      step="1"
                      value={form.stock_quantity || 0}
                      onChange={(e) => setForm({ ...form, stock_quantity: parseInt(e.target.value) || 0 })}
                      className="max-w-[150px]"
                    />
                  </div>
                )}
              </div>

              <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-bold">Ficha Técnica (Receita)</Label>
                    <p className="text-xs text-muted-foreground">Selecione os insumos que compõem este produto</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setForm(prev => ({ ...prev, recipe: [...prev.recipe, { inventory_item_id: "", quantity: 1 }] }))}>
                    <Plus className="w-3 h-3 mr-1" /> Insumo
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.recipe.map((ri, ii) => (
                    <div key={ii} className="flex gap-2 items-center">
                      <Select
                        value={ri.inventory_item_id}
                        onValueChange={v => {
                          const updated = [...form.recipe];
                          updated[ii].inventory_item_id = v;
                          setForm({ ...form, recipe: updated });
                        }}
                      >
                        <SelectTrigger className="flex-1 h-8"><SelectValue placeholder="Insumo..." /></SelectTrigger>
                        <SelectContent>
                          {inventoryItems.map(inv => (
                            <SelectItem key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        className="w-20 h-8"
                        value={ri.quantity}
                        onChange={e => {
                          const updated = [...form.recipe];
                          updated[ii].quantity = parseFloat(e.target.value) || 0;
                          setForm({ ...form, recipe: updated });
                        }}
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setForm(prev => ({ ...prev, recipe: prev.recipe.filter((_, i) => i !== ii) }))}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {form.recipe.length === 0 && <p className="text-[10px] text-muted-foreground text-center">Nenhum insumo vinculado</p>}
                </div>
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
                            <Button variant="outline" size="sm" className="h-8 px-2 shrink-0 text-xs flex items-center gap-1" onClick={() => openOptionRecipe(vi, oi)}>
                              <BookOpen className="w-3 h-3" />
                              <span className="hidden md:inline">Receita</span>
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

        {/* Recipe Modal */}
        <Dialog open={recipeOpen} onOpenChange={setRecipeOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Ficha Técnica: {recipeProduct?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <p className="text-xs text-muted-foreground bg-muted p-2 rounded border border-border">
                Defina os ingredientes que compõem este produto. O estoque será deduzido automaticamente a cada venda.
              </p>

              <div className="flex justify-between items-center bg-muted/30 p-2 rounded">
                <span className="text-sm font-medium">Lista de Insumos</span>
                <Button variant="outline" size="sm" onClick={() => setNewIngredientOpen(true)} className="h-8 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Novo Insumo
                </Button>
              </div>

              <div className="space-y-3">
                {recipeItems.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <Select
                        value={item.inventory_item_id}
                        onValueChange={v => {
                          const updated = [...recipeItems];
                          updated[index].inventory_item_id = v;
                          setRecipeItems(updated);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Insumo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {inventoryItems.map(inv => (
                            <SelectItem key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-20">
                      <Input
                        type="number"
                        step="0.001"
                        value={item.quantity}
                        onChange={e => {
                          const updated = [...recipeItems];
                          updated[index].quantity = parseFloat(e.target.value) || 0;
                          setRecipeItems(updated);
                        }}
                        placeholder="Qtd"
                      />
                    </div>
                    <div className="w-20">
                      <Select
                        value={item.measurement_unit || ""}
                        onValueChange={v => {
                          const updated = [...recipeItems];
                          updated[index].measurement_unit = v;
                          setRecipeItems(updated);
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Unid." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="g">g</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="ml">ml</SelectItem>
                          <SelectItem value="l">l</SelectItem>
                          <SelectItem value="un">un</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 text-destructive h-8 w-8" onClick={() => removeRecipeItem(index)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button variant="outline" className="w-full border-dashed" onClick={addRecipeItem}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Insumo
              </Button>

              <Button className="w-full" onClick={handleSaveRecipe} disabled={isSavingRecipe}>
                {isSavingRecipe ? "Salvando..." : "Salvar Ficha Técnica"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Option Recipe Modal */}
        <Dialog open={optionRecipeOpen} onOpenChange={setOptionRecipeOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Ficha Técnica (Variação)</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <p className="text-xs text-muted-foreground bg-muted p-2 rounded border border-border">
                Defina os insumos deduzidos quando esta opção for escolhida.
              </p>

              <div className="flex justify-between items-center bg-muted/30 p-2 rounded">
                <span className="text-sm font-medium">Lista de Insumos</span>
                <Button variant="outline" size="sm" onClick={() => setNewIngredientOpen(true)} className="h-8 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Novo Insumo
                </Button>
              </div>

              <div className="space-y-3">
                {optionRecipeItems.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <Select
                        value={item.inventory_item_id}
                        onValueChange={v => {
                          const updated = [...optionRecipeItems];
                          updated[index].inventory_item_id = v;
                          setOptionRecipeItems(updated);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Insumo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {inventoryItems.map(inv => (
                            <SelectItem key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-20">
                      <Input
                        type="number"
                        step="0.001"
                        value={item.quantity}
                        onChange={e => {
                          const updated = [...optionRecipeItems];
                          updated[index].quantity = parseFloat(e.target.value) || 0;
                          setOptionRecipeItems(updated);
                        }}
                        placeholder="Qtd"
                      />
                    </div>
                    <div className="w-20">
                      <Select
                        value={item.measurement_unit || ""}
                        onValueChange={v => {
                          const updated = [...optionRecipeItems];
                          updated[index].measurement_unit = v;
                          setOptionRecipeItems(updated);
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Unid." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="g">g</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="ml">ml</SelectItem>
                          <SelectItem value="l">l</SelectItem>
                          <SelectItem value="un">un</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 text-destructive h-8 w-8" onClick={() => removeOptionRecipeItem(index)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button variant="outline" className="w-full border-dashed" onClick={addOptionRecipeItem}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Insumo
              </Button>

              <Button variant="hero" onClick={handleSaveOptionRecipe} className="w-full">
                Salvar Receita
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* New Ingredient Modal */}
        <Dialog open={newIngredientOpen} onOpenChange={setNewIngredientOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Novo Insumo Rápido</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome do Insumo</Label>
                <Input value={newIngredientForm.name} onChange={e => setNewIngredientForm({...newIngredientForm, name: e.target.value})} placeholder="Ex: Manteiga" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unidade Base (Estoque)</Label>
                  <Select value={newIngredientForm.unit} onValueChange={v => setNewIngredientForm({...newIngredientForm, unit: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Quilograma (kg)</SelectItem>
                      <SelectItem value="g">Grama (g)</SelectItem>
                      <SelectItem value="l">Litro (l)</SelectItem>
                      <SelectItem value="ml">Mililitro (ml)</SelectItem>
                      <SelectItem value="un">Unidade (un)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Custo Unitário (R$)</Label>
                  <Input type="number" step="0.01" value={newIngredientForm.cost_per_unit || ""} onChange={e => setNewIngredientForm({...newIngredientForm, cost_per_unit: parseFloat(e.target.value) || 0})} placeholder="0.00" />
                </div>
              </div>
              <Button className="w-full" onClick={handleCreateIngredient}>
                Salvar Insumo
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
              {p.manage_stock && !p.is_sold_out && (
                <span className="text-xs text-blue-600 font-medium mt-1 block">
                  Estoque: {Math.floor(p.stock_quantity)} un
                </span>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                  <Pencil className="w-3 h-3 mr-1" /> Editar
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDuplicate(p)}>
                  <Copy className="w-3 h-3 mr-1" /> Duplicar
                </Button>
                <Button variant="outline" size="sm" onClick={() => openRecipe(p)} className="border-primary/50 text-primary">
                  <BookOpen className="w-3 h-3 mr-1" /> Ficha Téc.
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
