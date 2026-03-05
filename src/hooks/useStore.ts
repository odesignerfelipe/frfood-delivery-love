import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

type Store = Tables<"stores">;

export const useStore = (impersonateStoreId?: string) => {
  const { user } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  // Read impersonate from URL if not explicitly provided as an argument
  const effectiveImpersonateId =
    impersonateStoreId ||
    new URLSearchParams(window.location.search).get("impersonate") ||
    undefined;

  const fetchStore = async () => {
    if (!user) return;

    let query = supabase.from("stores").select("*");

    if (effectiveImpersonateId) {
      query = query.eq("id", effectiveImpersonateId);
    } else {
      query = query.eq("owner_id", user.id);
    }

    const { data } = await query.maybeSingle();
    setStore(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchStore();
  }, [user, effectiveImpersonateId]);

  useEffect(() => {
    if (!store?.id) return;
    const channel = supabase
      .channel(`admin-store-sync-${store.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "stores", filter: `id=eq.${store.id}` },
        (payload: any) => {
          setStore((prev: any) => ({ ...prev, ...payload.new }));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [store?.id]);

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
