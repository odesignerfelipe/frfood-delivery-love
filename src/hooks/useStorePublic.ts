import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useStorePublic = (slug?: string) => {
    const [store, setStore] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!slug) {
            setLoading(false);
            return;
        }

        const fetchStore = async () => {
            try {
                const { data, error } = await supabase
                    .from("stores")
                    .select("*")
                    .eq("slug", slug)
                    .maybeSingle();

                if (error) throw error;
                setStore(data);
            } catch (err: any) {
                console.error("Error fetching public store:", err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchStore();
    }, [slug]);

    return { store, loading, error };
};
