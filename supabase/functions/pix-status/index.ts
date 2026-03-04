import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const MP_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
        if (!MP_TOKEN) throw new Error('MERCADOPAGO_ACCESS_TOKEN not configured')

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

        const { payment_id } = await req.json()
        if (!payment_id) throw new Error('Missing payment_id')

        // Check status directly with Mercado Pago
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
            headers: { 'Authorization': `Bearer ${MP_TOKEN}` },
        })

        if (!mpRes.ok) {
            throw new Error(`Failed to check payment status (${mpRes.status})`)
        }

        const payment = await mpRes.json()

        let status = 'pending'
        if (payment.status === 'approved') status = 'paid'
        else if (payment.status === 'cancelled' || payment.status === 'rejected') status = 'cancelled'
        else if (payment.status === 'expired') status = 'expired'

        // If paid, also update our database
        if (status === 'paid') {
            const supabase = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            )
            await supabase
                .from('pix_payments')
                .update({ status: 'paid', paid_at: new Date().toISOString() })
                .eq('mp_payment_id', String(payment_id))
                .eq('status', 'pending')
        }

        return new Response(
            JSON.stringify({ status, mp_status: payment.status }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return new Response(
            JSON.stringify({ error: message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
