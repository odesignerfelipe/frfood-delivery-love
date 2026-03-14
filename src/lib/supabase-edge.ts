import { supabase } from "@/integrations/supabase/client";

interface EdgeCallParams {
    functionName: string;
    body: any;
}

/**
 * Ultra-resilient call to Supabase Edge Functions.
 * Implements 4 failover stages to circumvent network blocks (CORS, Ad-blockers, Firewalls).
 */
export const ultraResilientInvoke = async ({ functionName, body }: EdgeCallParams) => {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!baseUrl || !key) {
        throw new Error("Supabase configuration missing (URL or Key).");
    }

    const tryFetch = async (headers: any, label: string, urlOverride?: string, contentType = 'application/json') => {
        console.log(`[EdgeInvoke] ${label}: Attempting...`);
        const url = urlOverride || `${baseUrl}/functions/v1/${functionName}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const fetchHeaders: any = { ...headers };
            if (contentType) {
                fetchHeaders['Content-Type'] = contentType;
            }

            const res = await fetch(url, {
                method: 'POST',
                headers: fetchHeaders,
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
                const txt = await res.text();
                throw new Error(txt || `Status ${res.status}`);
            }
            return await res.json();
        } catch (err: any) {
            clearTimeout(timeoutId);
            throw err;
        }
    };

    // --- STAGE 1: Official SDK ---
    try {
        console.log("[EdgeInvoke] Stage 1: Official Invoke");
        const { data, error } = await supabase.functions.invoke(functionName, { body });
        if (!error) return data;
        console.warn("[EdgeInvoke] Stage 1 failed:", error);
    } catch (e) { console.warn("[EdgeInvoke] Stage 1 exception:", e); }

    await new Promise(r => setTimeout(r, 800));

    // --- STAGE 2: Fetch with Auth ---
    try {
        return await tryFetch({ 'apikey': key, 'Authorization': `Bearer ${key}` }, "Stage 2 (Auth)");
    } catch (e) { console.warn("[EdgeInvoke] Stage 2 failed:", e); }

    await new Promise(r => setTimeout(r, 800));

    // --- STAGE 3: Fetch Naked (No Auth Header) ---
    try {
        return await tryFetch({ 'apikey': key }, "Stage 3 (Naked Header)");
    } catch (e) { console.warn("[EdgeInvoke] Stage 3 failed:", e); }

    await new Promise(r => setTimeout(r, 800));

    // --- STAGE 4: Bypass (Query Param) ---
    try {
        return await tryFetch({}, "Stage 4 (Query Param Bypass)", `${baseUrl}/functions/v1/${functionName}?apikey=${key}`);
    } catch (e: any) { console.warn("[EdgeInvoke] Stage 4 failed:", e); }

    await new Promise(r => setTimeout(r, 800));

    // --- STAGE 5: Ultra No-Preflight (text/plain + Query Param) ---
    // This avoids the OPTIONS request entirely by using a "simple" content-type
    try {
        return await tryFetch({}, "Stage 5 (No-Preflight Bypass)", `${baseUrl}/functions/v1/${functionName}?apikey=${key}`, "text/plain");
    } catch (e: any) {
        console.error("[EdgeInvoke] Stage 5 failed:", e);
        const isNetworkError = e.message?.toLowerCase().includes("failed to fetch") || e.name === "AbortError" || !e.message;
        if (isNetworkError) {
            throw new Error("Erro de conexão (Load failed). Tente usar outro navegador ou conexão de internet (Ex: dados móveis). Alguns bloqueadores de anúncios impedem esta ação.");
        }
        throw e;
    }
};
