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
        const authHeader = req.headers.get('Authorization')!
        const token = authHeader.replace('Bearer ', '')
        const { data } = await supabaseClient.auth.getUser(token)
        const user = data.user

        if (!user) throw new Error('AuthError: User not found')

        const { store_id, plan } = await req.json()
        const email = user.email

        // Retrieve price ID based on plan (monthly or yearly only — no free plan)
        const priceId = plan === 'monthly'
            ? Deno.env.get('STRIPE_PRICE_ID_MONTHLY')
            : Deno.env.get('STRIPE_PRICE_ID_YEARLY')

        if (!priceId) {
            throw new Error(`Price ID not configured for plan ${plan}. Set STRIPE_PRICE_ID_MONTHLY and STRIPE_PRICE_ID_YEARLY in secrets.`)
        }

        const session = await stripe.checkout.sessions.create({
            // Enable all relevant payment methods
            payment_method_types: ['card'],
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
            success_url: `${req.headers.get('origin')}/create-store?payment=success`,
            cancel_url: `${req.headers.get('origin')}/checkout`,
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
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
