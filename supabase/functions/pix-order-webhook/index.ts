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
        console.log('PIX Order Webhook received:', JSON.stringify(body))

        // We care about payment notifications
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
            console.error('Failed to verify payment with MP:', mpRes.status)
            return new Response('Error verifying payment', { status: 500 })
        }

        const payment = await mpRes.json()
        console.log('Payment status:', payment.status, 'ID:', paymentId, 'Amount:', payment.transaction_amount)

        const mpPaymentIdStr = String(paymentId)

        if (payment.status === 'approved') {
            // Update order_payments table
            const { data: orderPayment, error: fetchError } = await supabase
                .from('order_payments')
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                })
                .eq('mp_payment_id', mpPaymentIdStr)
                .select('id, store_id, order_id, comanda_id, split_index, split_total, amount')
                .single()

            if (fetchError) {
                console.error('Error updating order_payment:', fetchError)
                // Try with external_id as fallback
                const { data: fallback, error: fallbackErr } = await supabase
                    .from('order_payments')
                    .update({
                        status: 'paid',
                        paid_at: new Date().toISOString(),
                    })
                    .eq('external_id', mpPaymentIdStr)
                    .select('id, store_id, order_id, comanda_id, split_index, split_total, amount')
                    .single()

                if (fallbackErr) {
                    console.error('Fallback update also failed:', fallbackErr)
                    return new Response(JSON.stringify({ received: true, warning: 'payment not found in DB' }), { status: 200 })
                }

                if (fallback) {
                    await checkAndFinalizeComanda(supabase, fallback)
                }
            } else if (orderPayment) {
                console.log(`PIX Order Payment confirmed: id=${orderPayment.id}, comanda=${orderPayment.comanda_id}`)
                await checkAndFinalizeComanda(supabase, orderPayment)
            }
        } else if (payment.status === 'cancelled' || payment.status === 'rejected') {
            await supabase
                .from('order_payments')
                .update({ status: 'failed' })
                .eq('mp_payment_id', mpPaymentIdStr)
        }

        return new Response(JSON.stringify({ received: true }), { status: 200 })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('pix-order-webhook error:', message)
        return new Response(JSON.stringify({ error: message }), { status: 500 })
    }
})

/**
 * Check if all split payments for a comanda are paid.
 * If so, close the comanda and free the table.
 */
async function checkAndFinalizeComanda(supabase: any, payment: any) {
    if (!payment.comanda_id) return

    // Check if all splits are paid
    const { data: allPayments } = await supabase
        .from('order_payments')
        .select('id, status, split_index, amount')
        .eq('comanda_id', payment.comanda_id)
        .order('split_index')

    if (!allPayments || allPayments.length === 0) return

    const allPaid = allPayments.every((p: any) => p.status === 'paid')
    const totalPaid = allPayments.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + Number(p.amount), 0)

    console.log(`Comanda ${payment.comanda_id}: ${allPayments.filter((p: any) => p.status === 'paid').length}/${allPayments.length} payments done, total=${totalPaid}`)

    if (allPaid) {
        console.log(`All payments received for comanda ${payment.comanda_id}. Auto-closing...`)

        // Close comanda
        const { error: comandaError } = await supabase
            .from('comandas')
            .update({
                status: 'closed',
                total: totalPaid,
                payment_method: 'pix',
            })
            .eq('id', payment.comanda_id)

        if (comandaError) {
            console.error('Error closing comanda:', comandaError)
            return
        }

        // Free up the table
        const { data: comanda } = await supabase
            .from('comandas')
            .select('table_id')
            .eq('id', payment.comanda_id)
            .single()

        if (comanda?.table_id) {
            await supabase
                .from('tables')
                .update({ status: 'available', current_comanda_id: null })
                .eq('id', comanda.table_id)
        }

        // Record financial transaction
        if (payment.store_id) {
            await supabase.from('financial_transactions').insert({
                store_id: payment.store_id,
                description: `PIX Automático - Comanda`,
                amount: totalPaid,
                type: 'entry',
                status: 'paid',
                paid_at: new Date().toISOString(),
                due_date: new Date().toISOString().split('T')[0],
                payment_method: 'pix'
            })
        }
    }
}
