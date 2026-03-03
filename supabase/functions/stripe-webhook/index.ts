import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@12.1.1?target=deno&no-check'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
    apiVersion: '2022-11-15',
    httpClient: Stripe.createFetchHttpClient(),
})

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') as string

serve(async (req) => {
    const signature = req.headers.get('Stripe-Signature')

    if (!signature) {
        return new Response('No signature', { status: 400 })
    }

    const body = await req.text()
    let event

    try {
        event = stripe.webhooks.constructEvent(body, signature, endpointSecret)
    } catch (err) {
        console.error(`Webhook signature verification failed: ${err.message}`)
        return new Response(`Webhook Error: ${err.message}`, { status: 400 })
    }

    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object
                const userId = session.metadata?.user_id

                // Find user store or update status
                if (userId) {
                    const { error } = await supabaseClient
                        .from('stores')
                        .update({ plan_status: 'active' })
                        .eq('owner_id', userId)

                    if (error) throw error
                }
                break
            }

            case 'customer.subscription.deleted':
            case 'customer.subscription.updated': {
                const subscription = event.data.object
                const status = subscription.status
                const customerId = subscription.customer

                // If you store the customerId on the stores/users table, you would query it here:
                // For simplicity, Assuming the metadata from checkout session is carried over or user_id mapped:
                // Here we just handle the scenario where we map it when completed 
                // Note: For a robust system, you'd map customer_id in Supabase upon checkout complete.

                break
            }
        }

        return new Response(JSON.stringify({ received: true }), { status: 200 })
    } catch (err) {
        console.error(`Error processing webhook: ${err.message}`)
        return new Response(`Error: ${err.message}`, { status: 500 })
    }
})
