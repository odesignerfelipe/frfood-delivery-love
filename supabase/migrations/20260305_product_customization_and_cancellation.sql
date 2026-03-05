-- ==========================================
-- FRFood: Product Sold-Out + Order Cancellation Reason
-- ==========================================

-- 1. Add is_sold_out column to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_sold_out BOOLEAN NOT NULL DEFAULT false;

-- 2. Add cancellation_reason column to orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT '';

-- 3. Allow public to read order_items by order_id (needed for OrderStatus page)
-- Drop existing restrictive policy if it blocks anonymous reads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_items' AND policyname = 'Public can view order items by order id'
  ) THEN
    CREATE POLICY "Public can view order items by order id"
    ON public.order_items FOR SELECT
    USING (true);
  END IF;
END $$;

-- 4. Allow public to read orders by id (needed for OrderStatus page)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders' AND policyname = 'Public can view orders by id'
  ) THEN
    CREATE POLICY "Public can view orders by id"
    ON public.orders FOR SELECT
    USING (true);
  END IF;
END $$;
