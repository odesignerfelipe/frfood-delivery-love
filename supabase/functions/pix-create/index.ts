import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PRICES = {
    monthly: 149.90,
    yearly: 1498.80, // 12x 124.90
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const MP_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
        if (!MP_TOKEN) throw new Error('MERCADOPAGO_ACCESS_TOKEN not configured')

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Auth
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Missing Authorization header')

        const supabaseAuth = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        )
        const token = authHeader.replace('Bearer ', '')
        const { data: authData } = await supabaseAuth.auth.getUser(token)
        const user = authData.user
        if (!user) throw new Error('User not authenticated')

        const { plan } = await req.json()
        if (!plan || !PRICES[plan]) throw new Error('Invalid plan. Must be "monthly" or "yearly".')

        const amount = PRICES[plan]
        const description = plan === 'monthly'
            ? 'FRFood - Plano Mensal'
            : 'FRFood - Plano Anual'

        // Create PIX payment on Mercado Pago
        const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MP_TOKEN}`,
                'X-Idempotency-Key': `${user.id}-${plan}-${Date.now()}`,
            },
            body: JSON.stringify({
                transaction_amount: amount,
                description: description,
                payment_method_id: 'pix',
                payer: {
                    email: user.email,
                },
                notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/pix-webhook`,
            }),
        })

        const mpData = await mpRes.json()

        if (!mpRes.ok) {
            console.error('MP Error:', JSON.stringify(mpData))
            throw new Error(mpData.message || `Mercado Pago error (${mpRes.status})`)
        }

        const pixInfo = mpData.point_of_interaction?.transaction_data
        if (!pixInfo) {
            throw new Error('Mercado Pago não retornou dados do PIX. Verifique o Access Token.')
        }

        // Save to database
        const expiresAt = new Date()
        expiresAt.setMinutes(expiresAt.getMinutes() + 30) // 30 min to pay

        const { error: dbError } = await supabase
            .from('pix_payments')
            .insert({
                user_id: user.id,
                plan: plan,
                amount: amount,
                mp_payment_id: String(mpData.id),
                status: 'pending',
                pix_qr_code: pixInfo.qr_code || '',
                pix_qr_code_base64: pixInfo.qr_code_base64 || '',
                pix_copia_cola: pixInfo.qr_code || '',
                expires_at: expiresAt.toISOString(),
            })

        if (dbError) {
            console.error('DB Error:', dbError)
            // Don't fail - payment was created on MP
        }

        return new Response(
            JSON.stringify({
                payment_id: String(mpData.id),
                qr_code: pixInfo.qr_code || '',
                qr_code_base64: pixInfo.qr_code_base64 || '',
                amount: amount,
                expires_at: expiresAt.toISOString(),
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('pix-create error:', message)
        return new Response(
            JSON.stringify({ error: message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
