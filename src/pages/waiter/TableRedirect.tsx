import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const TableRedirect = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        const handleRedirect = async () => {
            if (!id) {
                navigate("/");
                return;
            }

            try {
                // Find the table and its store
                const { data: table, error } = await supabase
                    .from("tables")
                    .select("*, stores(slug)")
                    .eq("id", id)
                    .single();

                if (error || !table) {
                    toast.error("Mesa não encontrada ou inativa.");
                    navigate("/");
                    return;
                }

                // Save table session in local storage
                localStorage.setItem(`frfood_table_${table.store_id}`, JSON.stringify({
                    table_id: table.id,
                    table_name: table.name,
                    timestamp: new Date().getTime()
                }));

                toast.success(`Bem-vindo! Você está na ${table.name}`);

                // Redirect to the store catalog
                // Assuming stores(slug) is available as table.stores.slug
                const storeSlug = (table.stores as any)?.slug;
                if (storeSlug) {
                    navigate(`/loja/${storeSlug}`);
                } else {
                    // If accessing via subdomain
                    navigate("/");
                }

            } catch (err) {
                console.error(err);
                toast.error("Erro ao processar o QR Code.");
                navigate("/");
            }
        };

        handleRedirect();
    }, [id, navigate]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <h2 className="text-xl font-bold">Abrindo o cardápio da sua mesa...</h2>
        </div>
    );
};

export default TableRedirect;
