-- Migration: Add payment tracking to orders
-- This allows manual confirmation of payments (PIX, Cash, etc.)

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Update existing orders that were already closed in comandas or have paid transactions
-- This is a heuristic update for better historical data
UPDATE public.orders o
SET is_paid = true,
    paid_at = o.created_at
FROM public.comandas c
WHERE o.comanda_id = c.id AND c.status = 'closed' AND o.is_paid = false;

-- Policy adjustment: Ensure store owners can update orders, including the new columns
DROP POLICY IF EXISTS "Owners can manage orders" ON public.orders;
CREATE POLICY "Owners can manage orders" ON public.orders
    FOR ALL
    USING (public.is_store_owner(store_id));

-- Add explicit update policy if needed (usually FOR ALL covers it, but for clarity)
-- The "Owners can manage orders" policy already exists in the base migration, 
-- we are ensuring it covers the new columns as well.
