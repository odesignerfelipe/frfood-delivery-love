-- Migration: register_customer_rpc.sql
-- Description: Create a security definer function to handle customer registration from orders safely.

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
SECURITY DEFINER -- Runs with superuser privileges
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.customers (
        store_id, 
        name, 
        phone, 
        address, 
        neighborhood, 
        total_orders, 
        total_spent, 
        last_order_at, 
        updated_at
    )
    VALUES (
        p_store_id, 
        p_name, 
        p_phone, 
        p_address, 
        p_neighborhood, 
        1, 
        p_total_spent, 
        NOW(), 
        NOW()
    )
    ON CONFLICT (store_id, phone) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        neighborhood = EXCLUDED.neighborhood,
        total_orders = public.customers.total_orders + 1,
        total_spent = public.customers.total_spent + EXCLUDED.total_spent,
        last_order_at = NOW(),
        updated_at = NOW();
END;
$$;

-- Grant execution to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.register_customer_from_order(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_customer_from_order(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC) TO anon;
