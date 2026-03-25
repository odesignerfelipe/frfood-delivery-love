import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

const Categories = () => {
  const { store } = useStore();
  const [categories, setCategories] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");

  const fetch = async () => {
    if (!store) return;
    const { data } = await supabase.from("categories").select("*").eq("store_id", store.id).order("sort_order");
    setCategories(data || []);
  };

  useEffect(() => { fetch(); }, [store]);

  const handleSave = async () => {
    if (!store || !name.trim()) return;
    
    try {
      if (editing) {
        const { error } = await supabase.from("categories").update({ name }).eq("id", editing.id);
        if (error) throw error;
        toast.success("Categoria atualizada!");
      } else {
        const { error } = await supabase.from("categories").insert({ name, store_id: store.id, sort_order: categories.length });
        if (error) throw error;
        toast.success("Categoria criada!");
      }
      setOpen(false);
      setName("");
      setEditing(null);
      fetch();
    } catch (err: any) {
      console.error("Error saving category:", err);
      toast.error("Erro ao salvar categoria: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta categoria?")) return;
    await supabase.from("categories").delete().eq("id", id);
    toast.success("Categoria excluída!");
    fetch();
  };

  const openEdit = (cat: any) => {
    setEditing(cat);
    setName(cat.name);
    setOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setName("");
    setOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Categorias</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" size="sm" onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" /> Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pizzas" />
              </div>
              <Button variant="hero" onClick={handleSave} className="w-full">
                {editing ? "Salvar" : "Criar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {categories.length === 0 && (
          <p className="text-muted-foreground text-center py-12">Nenhuma categoria criada ainda.</p>
        )}
        {categories.map((cat) => (
          <div key={cat.id} className="bg-card rounded-xl p-4 shadow-card border border-border/50 flex items-center justify-between">
            <span className="font-medium text-foreground">{cat.name}</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Categories;
