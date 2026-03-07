-- Migration: fix_financial_and_inventory_schema.sql
-- Description: Add missing columns to financial_transactions and inventory_items to match frontend usage.

-- Fix financial_transactions
ALTER TABLE public.financial_transactions 
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly'));

-- Fix inventory_items
-- Reports.tsx uses unit_cost, but migration used cost_per_unit. 
-- We'll add unit_cost as an alias or simply add the column if missing.
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(10,2) DEFAULT 0;

-- Sync existing data if cost_per_unit has values
UPDATE public.inventory_items 
SET unit_cost = cost_per_unit 
WHERE unit_cost = 0 AND cost_per_unit > 0;
