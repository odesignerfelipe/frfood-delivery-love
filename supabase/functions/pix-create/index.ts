import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PRICES: Record<string, number> = {
    monthly: 149.90,
    yearly: 1498.80,
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const MP_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
        if (!MP_TOKEN) {
            throw new Error('MERCADOPAGO_ACCESS_TOKEN not configured in Supabase secrets')
        }

        // Auth - get user from token
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Missing Authorization header')

        const supabaseAuth = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        )
        const token = authHeader.replace('Bearer ', '')
        const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token)

        if (authError || !authData.user) {
            throw new Error('User not authenticated: ' + (authError?.message || 'no user'))
        }
        const user = authData.user

        const body = await req.json()
        const plan = body.plan as string
        if (!plan || !PRICES[plan]) {
            throw new Error('Invalid plan. Must be "monthly" or "yearly". Received: ' + plan)
        }

        const amount = PRICES[plan]
        const description = plan === 'monthly'
            ? 'FRFood - Plano Mensal'
            : 'FRFood - Plano Anual'

        console.log(`Creating PIX payment: user=${user.id}, plan=${plan}, amount=${amount}`)

        // Create PIX payment on Mercado Pago with timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout

        let mpRes: Response
        try {
            mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
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
                }),
                signal: controller.signal,
            })
        } catch (fetchError: any) {
            clearTimeout(timeoutId)
            if (fetchError.name === 'AbortError') {
                throw new Error('Timeout: Mercado Pago não respondeu em 15 segundos')
            }
            throw new Error('Falha na conexão com Mercado Pago: ' + fetchError.message)
        }
        clearTimeout(timeoutId)

        const mpText = await mpRes.text()
        console.log(`MP Response status: ${mpRes.status}`)
        console.log(`MP Response body: ${mpText.substring(0, 500)}`)

        if (!mpRes.ok) {
            let errorMsg = `Mercado Pago error (${mpRes.status})`
            try {
                const mpError = JSON.parse(mpText)
                errorMsg = mpError.message || mpError.error || errorMsg
            } catch { }
            throw new Error(errorMsg)
        }

        const mpData = JSON.parse(mpText)
        const pixInfo = mpData.point_of_interaction?.transaction_data

        if (!pixInfo) {
            console.error('MP data without PIX info:', mpText.substring(0, 300))
            throw new Error('Mercado Pago não retornou dados do PIX. Status: ' + mpData.status)
        }

        // Save to database
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const expiresAt = new Date()
        expiresAt.setMinutes(expiresAt.getMinutes() + 30)

        await supabase
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

        console.log(`PIX payment created successfully: mp_id=${mpData.id}`)

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
    } catch (error: unknown) {
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
