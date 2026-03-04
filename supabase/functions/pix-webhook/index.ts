import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0'

serve(async (req) => {
    // Mercado Pago sends webhooks as POST
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 })
    }

    try {
        const MP_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
        if (!MP_TOKEN) throw new Error('MERCADOPAGO_ACCESS_TOKEN not configured')

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const body = await req.json()
        console.log('PIX Webhook received:', JSON.stringify(body))

        // Mercado Pago sends different notification types
        // We care about "payment" type
        if (body.type !== 'payment' && body.action !== 'payment.updated') {
            return new Response(JSON.stringify({ received: true }), { status: 200 })
        }

        const paymentId = body.data?.id
        if (!paymentId) {
            return new Response(JSON.stringify({ received: true }), { status: 200 })
        }

        // Verify payment status with Mercado Pago
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { 'Authorization': `Bearer ${MP_TOKEN}` },
        })

        if (!mpRes.ok) {
            console.error('Failed to verify payment with MP')
            return new Response('Error verifying payment', { status: 500 })
        }

        const payment = await mpRes.json()
        console.log('Payment status:', payment.status, 'ID:', paymentId)

        if (payment.status === 'approved') {
            // Update pix_payments table
            const { data: pixPayment, error: fetchError } = await supabase
                .from('pix_payments')
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                })
                .eq('mp_payment_id', String(paymentId))
                .select('user_id, plan')
                .single()

            if (fetchError) {
                console.error('Error updating pix_payment:', fetchError)
            }

            if (pixPayment) {
                console.log(`PIX Payment confirmed for user ${pixPayment.user_id}, plan: ${pixPayment.plan}`)
            }
        } else if (payment.status === 'cancelled' || payment.status === 'rejected') {
            await supabase
                .from('pix_payments')
                .update({ status: 'cancelled' })
                .eq('mp_payment_id', String(paymentId))
        }

        return new Response(JSON.stringify({ received: true }), { status: 200 })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('pix-webhook error:', message)
        return new Response(JSON.stringify({ error: message }), { status: 500 })
    }
})
