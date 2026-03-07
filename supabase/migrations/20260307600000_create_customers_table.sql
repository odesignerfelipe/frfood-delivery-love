-- Migration: create_customers_table.sql
-- Description: Create the customers table to store customer data from orders.

CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    neighborhood TEXT,
    total_orders INTEGER DEFAULT 0,
    total_spent NUMERIC(10,2) DEFAULT 0,
    last_order_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, phone)
);

-- RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their customers" 
ON public.customers 
FOR ALL 
USING (public.is_store_owner(store_id));

CREATE POLICY "Anyone can insert customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_customers_updated_at 
BEFORE UPDATE ON public.customers 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
