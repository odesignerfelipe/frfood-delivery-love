import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@12.1.1?target=deno&no-check'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
    apiVersion: '2022-11-15',
    httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        )

        // Get the session or user object
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Missing Authorization header')

        const token = authHeader.replace('Bearer ', '')
        const { data } = await supabaseClient.auth.getUser(token)
        const user = data.user

        if (!user) throw new Error('AuthError: User not found')

        const body = await req.json()
        const { store_id, plan } = body
        const email = user.email

        // Retrieve price ID based on plan (monthly or yearly only — no free plan)
        const priceId = plan === 'monthly'
            ? Deno.env.get('STRIPE_PRICE_ID_MONTHLY')
            : Deno.env.get('STRIPE_PRICE_ID_YEARLY')

        if (!priceId) {
            throw new Error(`Price ID not configured for plan: ${plan}. Configure STRIPE_PRICE_ID_MONTHLY and STRIPE_PRICE_ID_YEARLY as Supabase secrets.`)
        }

        // Build the origin for redirect URLs
        const origin = req.headers.get('origin') || 'https://frfood.com.br'

        const session = await stripe.checkout.sessions.create({
            // Let Stripe show all available payment methods configured in the Dashboard
            // This automatically includes Card, PIX, Boleto if enabled in your Stripe Dashboard
            payment_method_types: undefined,
            billing_address_collection: 'required',
            customer_email: email,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            // After payment success, redirect to create-store page
            success_url: `${origin}/create-store?payment=success`,
            cancel_url: `${origin}/checkout`,
            metadata: {
                store_id: store_id || '',
                user_id: user.id,
                plan: plan
            }
        })

        return new Response(
            JSON.stringify({ url: session.url }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('stripe-checkout error:', message)
        return new Response(
            JSON.stringify({ error: message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
