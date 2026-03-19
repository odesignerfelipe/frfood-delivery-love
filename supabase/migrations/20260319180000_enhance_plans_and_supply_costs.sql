-- Migration: enhance_plans_and_supply_costs.sql
-- 1. Add plan_price and plan_expires_at to stores
-- 2. Auto-create "Insumos / Custo de Produção" financial category for all stores
-- 3. Update sync_order_to_financial() to link production costs to that category
-- 4. Ensure stock_movements.notes column exists

-- =========================================
-- 1. Plan enhancements on stores table
-- =========================================
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS plan_price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;

-- =========================================
-- 2. Ensure stock_movements.notes exists
-- =========================================
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- =========================================
-- 3. Auto-create "Insumos / Custo de Produção" category for all stores
-- =========================================
INSERT INTO public.financial_categories (store_id, name, type)
SELECT s.id, 'Insumos / Custo de Produção', 'exit'
FROM public.stores s
WHERE NOT EXISTS (
    SELECT 1 FROM public.financial_categories fc
    WHERE fc.store_id = s.id AND fc.name = 'Insumos / Custo de Produção' AND fc.type = 'exit'
);

-- Also auto-create "Vendas" category for entry
INSERT INTO public.financial_categories (store_id, name, type)
SELECT s.id, 'Vendas', 'entry'
FROM public.stores s
WHERE NOT EXISTS (
    SELECT 1 FROM public.financial_categories fc
    WHERE fc.store_id = s.id AND fc.name = 'Vendas' AND fc.type = 'entry'
);

-- =========================================
-- 4. Updated sync_order_to_financial trigger
--    Now links revenue to "Vendas" and costs to "Insumos / Custo de Produção"
-- =========================================
CREATE OR REPLACE FUNCTION public.sync_order_to_financial()
RETURNS TRIGGER AS $$
DECLARE
    v_production_cost DECIMAL(10,2);
    v_cost_category_id UUID;
    v_sales_category_id UUID;
BEGIN
    IF (TG_OP = 'UPDATE' AND NEW.status = 'delivered' AND OLD.status != 'delivered') OR
       (TG_OP = 'INSERT' AND NEW.delivery_type = 'table' AND NEW.status = 'confirmed') THEN

        -- Find the categories
        SELECT id INTO v_sales_category_id
        FROM public.financial_categories
        WHERE store_id = NEW.store_id AND name = 'Vendas' AND type = 'entry'
        LIMIT 1;

        SELECT id INTO v_cost_category_id
        FROM public.financial_categories
        WHERE store_id = NEW.store_id AND name = 'Insumos / Custo de Produção' AND type = 'exit'
        LIMIT 1;

        -- 1. Register Revenue (Entry)
        INSERT INTO public.financial_transactions (store_id, order_id, type, amount, description, status, paid_at, due_date, category_id)
        VALUES (NEW.store_id, NEW.id, 'entry', NEW.total, 'Venda Pedido #' || NEW.order_number, 'paid', NOW(), CURRENT_DATE, v_sales_category_id);

        -- 2. Calculate and Register Production Cost (Exit)
        SELECT COALESCE(SUM(cost), 0) INTO v_production_cost
        FROM public.stock_movements
        WHERE order_id = NEW.id;

        IF v_production_cost > 0 THEN
            INSERT INTO public.financial_transactions (store_id, order_id, type, amount, description, status, paid_at, due_date, category_id)
            VALUES (NEW.store_id, NEW.id, 'exit', v_production_cost, 'Custo de Produção - Pedido #' || NEW.order_number, 'paid', NOW(), CURRENT_DATE, v_cost_category_id);
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger (DROP IF EXISTS + CREATE to avoid conflicts)
DROP TRIGGER IF EXISTS tr_sync_order_to_financial ON public.orders;
CREATE TRIGGER tr_sync_order_to_financial
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_order_to_financial();

-- =========================================
-- 5. Auto-create categories for future stores
-- =========================================
CREATE OR REPLACE FUNCTION public.auto_create_store_categories()
RETURNS TRIGGER AS $$
BEGIN
    -- Create default financial categories for the new store
    INSERT INTO public.financial_categories (store_id, name, type) VALUES
        (NEW.id, 'Vendas', 'entry'),
        (NEW.id, 'Insumos / Custo de Produção', 'exit');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_auto_create_store_categories ON public.stores;
CREATE TRIGGER tr_auto_create_store_categories
AFTER INSERT ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.auto_create_store_categories();
