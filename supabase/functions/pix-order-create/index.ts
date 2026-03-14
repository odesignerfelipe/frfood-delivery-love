import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const MP_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
        if (!MP_TOKEN) {
            throw new Error('MERCADOPAGO_ACCESS_TOKEN not configured')
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const body = await req.json()
        const {
            store_id,
            order_id,
            comanda_id,
            amount,
            split_index = 1,
            split_total = 1,
            description = 'Pagamento PIX',
            payer_email
        } = body

        if (!store_id || !amount || amount <= 0) {
            throw new Error('store_id and positive amount are required')
        }

        // Build description with context
        const fullDescription = split_total > 1
            ? `${description} (${split_index}/${split_total})`
            : description

        const idempotencyKey = `${store_id}-${comanda_id || order_id || 'direct'}-${split_index}-${Date.now()}`

        console.log(`Creating PIX order payment: store=${store_id}, amount=${amount}, split=${split_index}/${split_total}`)

        // Create PIX payment on Mercado Pago
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        let mpRes: Response
        try {
            mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${MP_TOKEN}`,
                    'X-Idempotency-Key': idempotencyKey,
                },
                body: JSON.stringify({
                    transaction_amount: Number(amount),
                    description: fullDescription,
                    payment_method_id: 'pix',
                    payer: {
                        email: payer_email || 'cliente@frfood.com.br',
                    },
                }),
                signal: controller.signal,
            })
        } catch (fetchError: any) {
            clearTimeout(timeoutId)
            if (fetchError.name === 'AbortError') {
                throw new Error('Timeout: Mercado Pago não respondeu em 15s')
            }
            throw new Error('Falha na conexão com Mercado Pago: ' + fetchError.message)
        }
        clearTimeout(timeoutId)

        const mpText = await mpRes.text()
        console.log(`MP Response status: ${mpRes.status}`)

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
            throw new Error('Mercado Pago não retornou dados do PIX. Status: ' + mpData.status)
        }

        const expiresAt = new Date()
        expiresAt.setMinutes(expiresAt.getMinutes() + 30)

        // Save to order_payments
        const paymentRecord: any = {
            store_id,
            payment_method: 'pix',
            amount: Number(amount),
            status: 'pending',
            external_id: String(mpData.id),
            mp_payment_id: String(mpData.id),
            pix_qr_code: pixInfo.qr_code_base64 || '',
            pix_copia_cola: pixInfo.qr_code || '',
            split_index,
            split_total,
            expires_at: expiresAt.toISOString(),
        }

        if (order_id) paymentRecord.order_id = order_id
        if (comanda_id) paymentRecord.comanda_id = comanda_id

        const { data: savedPayment, error: saveError } = await supabase
            .from('order_payments')
            .insert(paymentRecord)
            .select('id')
            .single()

        if (saveError) {
            console.error('Error saving payment:', saveError)
            throw new Error('Erro ao salvar pagamento: ' + saveError.message)
        }

        console.log(`PIX order payment created: mp_id=${mpData.id}, db_id=${savedPayment.id}`)

        return new Response(
            JSON.stringify({
                payment_id: savedPayment.id,
                mp_payment_id: String(mpData.id),
                qr_code: pixInfo.qr_code || '',
                qr_code_base64: pixInfo.qr_code_base64 || '',
                amount: Number(amount),
                split_index,
                split_total,
                expires_at: expiresAt.toISOString(),
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('pix-order-create error:', message)
        return new Response(
            JSON.stringify({ error: message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
