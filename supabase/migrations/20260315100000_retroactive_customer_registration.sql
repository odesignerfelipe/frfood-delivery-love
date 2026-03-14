-- Migration: retroactive_customer_registration_v2.sql
-- Description: Self-contained script to define the registration function and process all previous orders.

-- 1. Ensure the function exists with the correct signature
CREATE OR REPLACE FUNCTION public.register_customer_from_order(
    p_store_id UUID,
    p_name TEXT,
    p_phone TEXT,
    p_address TEXT,
    p_neighborhood TEXT,
    p_total_spent NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Sanitize phone: remove non-numeric characters
    p_phone := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');

    -- Skip if phone is empty or too short
    IF p_phone = '' OR length(p_phone) < 8 THEN
        RETURN;
    END IF;

    INSERT INTO public.customers (
        store_id, name, phone, address, neighborhood, 
        total_orders, total_spent, last_order_at, updated_at
    )
    VALUES (
        p_store_id, p_name, p_phone, p_address, p_neighborhood, 
        1, p_total_spent, NOW(), NOW()
    )
    ON CONFLICT (store_id, phone) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, public.customers.name),
        address = COALESCE(EXCLUDED.address, public.customers.address),
        neighborhood = COALESCE(EXCLUDED.neighborhood, public.customers.neighborhood),
        total_orders = public.customers.total_orders + 1,
        total_spent = public.customers.total_spent + EXCLUDED.total_spent,
        last_order_at = NOW(),
        updated_at = NOW();
END;
$$;

-- 2. Process all existing orders
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT 
            store_id, 
            customer_name, 
            customer_phone, 
            customer_address, 
            neighborhood, 
            total
        FROM public.orders 
        WHERE customer_phone IS NOT NULL 
          AND customer_phone != '00000000000'
          AND customer_name IS NOT NULL
        ORDER BY created_at ASC
    LOOP
        PERFORM public.register_customer_from_order(
            r.store_id::uuid,
            r.customer_name::text,
            r.customer_phone::text,
            r.customer_address::text,
            r.neighborhood::text,
            r.total::numeric
        );
    END LOOP;
END $$;
