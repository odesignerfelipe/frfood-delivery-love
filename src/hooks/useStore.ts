import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

type Store = Tables<"stores">;

export const useStore = () => {
  const { user } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStore = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("stores")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();
    setStore(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchStore();
  }, [user]);

  const createStore = async (name: string, slug: string, phone: string) => {
    if (!user) return { error: "Not authenticated" };
    const { data, error } = await supabase
      .from("stores")
      .insert({ name, slug, phone, owner_id: user.id })
      .select()
      .single();
    if (data) setStore(data);
    return { data, error };
  };

  const updateStore = async (updates: Partial<Store>) => {
    if (!store) return { error: "No store" };
    const { data, error } = await supabase
      .from("stores")
      .update(updates)
      .eq("id", store.id)
      .select()
      .single();
    if (data) setStore(data);
    return { data, error };
  };

  return { store, loading, createStore, updateStore, refetch: fetchStore };
};
