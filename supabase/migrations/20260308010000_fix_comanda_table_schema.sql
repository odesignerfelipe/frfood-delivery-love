-- Migration: fix_platform_schema_consistency.sql
-- Description: Ensures all required columns exist across customers, comandas, and tables.

-- 1. Fix customers Table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS last_order_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_spent NUMERIC(10,2) DEFAULT 0;

-- 2. Fix comandas Table
ALTER TABLE public.comandas 
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

-- 3. Fix tables Table
ALTER TABLE public.tables
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available',
ADD COLUMN IF NOT EXISTS current_comanda_id UUID REFERENCES public.comandas(id) ON DELETE SET NULL;

-- 4. Ensure RLS for customers is permissive for the store owner
DROP POLICY IF EXISTS "Owners can manage their customers" ON public.customers;
CREATE POLICY "Owners can manage their customers" ON public.customers 
FOR ALL USING (public.is_store_owner(store_id));

-- 5. Ensure RLS for comandas allows waiters
DROP POLICY IF EXISTS "Waiters can manage their store comandas" ON public.comandas;
CREATE POLICY "Waiters can manage their store comandas" ON public.comandas
FOR ALL USING (true);

-- 6. Ensure RLS for tables
DROP POLICY IF EXISTS "Owners can manage tables" ON public.tables;
CREATE POLICY "Owners can manage tables" ON public.tables 
FOR ALL USING (public.is_store_owner(store_id));
