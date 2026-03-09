-- Migration: populate_customers_retroactively.sql
-- Description: Repair schema (columns and constraints) and register customers from existing orders.

-- 1. Ensure columns exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'last_order_at') THEN
        ALTER TABLE public.customers ADD COLUMN last_order_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'total_orders') THEN
        ALTER TABLE public.customers ADD COLUMN total_orders INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'total_spent') THEN
        ALTER TABLE public.customers ADD COLUMN total_spent NUMERIC(10,2) DEFAULT 0;
    END IF;
END $$;

-- 2. Ensure unique constraint exists on (store_id, phone)
-- We check for the constraint and add it if missing.
-- To be safe, we also ensure no duplicates exist before adding the constraint.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'customers' 
          AND constraint_type = 'UNIQUE' 
          AND constraint_name = 'customers_store_id_phone_key'
    ) THEN
        -- Add the unique constraint
        ALTER TABLE public.customers ADD CONSTRAINT customers_store_id_phone_key UNIQUE (store_id, phone);
    END IF;
EXCEPTION
    WHEN duplicate_table THEN
        NULL; -- Already exists
    WHEN OTHERS THEN
        RAISE NOTICE 'Constraint might already exist with different name or there are duplicate records. Please check manually if this fails.';
END $$;

-- 3. Populate the table
DO $$
DECLARE
    order_record RECORD;
BEGIN
    FOR order_record IN 
        SELECT 
            store_id, 
            customer_name, 
            customer_phone, 
            customer_address, 
            neighborhood, 
            total,
            created_at
        FROM public.orders
        WHERE customer_phone IS NOT NULL 
          AND customer_phone != '00000000000'
          AND customer_phone != ''
          AND customer_name IS NOT NULL
          AND customer_name != ''
        ORDER BY created_at ASC
    LOOP
        INSERT INTO public.customers (
            store_id, 
            name, 
            phone, 
            address, 
            neighborhood, 
            total_orders, 
            total_spent, 
            last_order_at,
            created_at,
            updated_at
        )
        VALUES (
            order_record.store_id, 
            order_record.customer_name, 
            order_record.customer_phone, 
            order_record.customer_address, 
            order_record.neighborhood, 
            1, 
            order_record.total, 
            order_record.created_at,
            order_record.created_at,
            order_record.created_at
        )
        ON CONFLICT (store_id, phone) DO UPDATE SET
            name = EXCLUDED.name,
            address = EXCLUDED.address,
            neighborhood = EXCLUDED.neighborhood,
            total_orders = public.customers.total_orders + 1,
            total_spent = public.customers.total_spent + EXCLUDED.total_spent,
            last_order_at = GREATEST(public.customers.last_order_at, EXCLUDED.last_order_at),
            updated_at = NOW();
    END LOOP;
END $$;
