import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    console.log("Recebida payload de webhook da Store:", JSON.stringify(payload))

    const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN')
    const CLOUDFLARE_ZONE_ID = Deno.env.get('CLOUDFLARE_ZONE_ID')
    const SERVER_VPS_IP = Deno.env.get('SERVER_VPS_IP')

    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID || !SERVER_VPS_IP) {
      throw new Error("Missing Cloudflare or VPS credentials in Supabase Edge Secrets.")
    }

    const headers = {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json'
    }

    // CREATE (INSERT)
    if (payload.type === 'INSERT' && payload.table === 'stores') {
      const storeSlug = payload.record.slug
      console.log(`Nova loja criada: ${storeSlug}. Criando DNS...`)

      const cfResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'A',
          name: storeSlug,
          content: SERVER_VPS_IP,
          ttl: 1,
          proxied: true,
          comment: `Auto-generated for store ID ${payload.record.id}`
        })
      })

      const cfResult = await cfResponse.json()
      if (!cfResponse.ok || !cfResult.success) throw new Error(JSON.stringify(cfResult.errors))

      return new Response(JSON.stringify({ status: 'success' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // UPDATE (Alteração de Slug)
    if (payload.type === 'UPDATE' && payload.table === 'stores') {
      const oldSlug = payload.old_record.slug
      const newSlug = payload.record.slug

      if (oldSlug !== newSlug) {
        console.log(`Loja alterou domínio de ${oldSlug} para ${newSlug}. Atualizando Cloudflare...`)

        // 1. Procurar o DNS record antigo pelo nome
        const oldDomain = `${oldSlug}.frfood.com.br`
        const searchRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records?name=${oldDomain}&type=A`, {
          method: 'GET',
          headers
        })
        const searchData = await searchRes.json()

        // 2. Se encontrou, apaga o antigo
        if (searchData.success && searchData.result.length > 0) {
          const recordId = searchData.result[0].id
          await fetch(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${recordId}`, {
            method: 'DELETE',
            headers
          })
          console.log(`Registro antigo ${oldSlug} deletado com sucesso.`)
        }

        // 3. Cria o NOVO apontamento
        const createRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            type: 'A',
            name: newSlug,
            content: SERVER_VPS_IP,
            ttl: 1,
            proxied: true,
            comment: `Auto-updated for store ID ${payload.record.id}`
          })
        })
        const createData = await createRes.json()
        if (!createRes.ok || !createData.success) throw new Error(JSON.stringify(createData.errors))

        return new Response(JSON.stringify({ status: 'success', message: 'DNS updated' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    return new Response(JSON.stringify({ message: "Ignored" }), { headers: corsHeaders })
  } catch (error) {
    console.error("Function Error Edge:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
