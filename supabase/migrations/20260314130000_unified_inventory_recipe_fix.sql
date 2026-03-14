-- Migration: unified_inventory_recipe_fix.sql
-- Description: Absolute fix for all inventory, recipe, and stock movement tables.

-- 1. Create inventory_items if missing
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT 'unidade',
    current_stock NUMERIC(12,3) DEFAULT 0,
    min_stock NUMERIC(12,3) DEFAULT 0,
    cost_per_unit NUMERIC(12,2) DEFAULT 0,
    unit_cost NUMERIC(12,2) DEFAULT 0,
    supplier TEXT DEFAULT '',
    supplier_contact TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist (in case table existed but was incomplete)
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS current_stock NUMERIC(12,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_stock NUMERIC(12,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS supplier TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS supplier_contact TEXT DEFAULT '';

-- 2. Create product_recipe_items if missing
CREATE TABLE IF NOT EXISTS public.product_recipe_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create stock_movements if missing
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('entry', 'exit', 'adjustment')),
    quantity NUMERIC(12,3) NOT NULL,
    cost NUMERIC(12,2) DEFAULT 0,
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure order_id exists
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;

-- 4. Enable RLS and Policies for all tables
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Drop existing to avoid conflicts
DROP POLICY IF EXISTS "Public inventory_items viewable" ON public.inventory_items;
DROP POLICY IF EXISTS "Admin inventory_items manage" ON public.inventory_items;
DROP POLICY IF EXISTS "Public product_recipe_items viewable" ON public.product_recipe_items;
DROP POLICY IF EXISTS "Admin product_recipe_items manage" ON public.product_recipe_items;
DROP POLICY IF EXISTS "Public stock_movements viewable" ON public.stock_movements;
DROP POLICY IF EXISTS "Admin stock_movements manage" ON public.stock_movements;

CREATE POLICY "Public inventory_items viewable" ON public.inventory_items FOR SELECT USING (true);
CREATE POLICY "Admin inventory_items manage" ON public.inventory_items FOR ALL USING (public.is_store_owner(store_id));

CREATE POLICY "Public product_recipe_items viewable" ON public.product_recipe_items FOR SELECT USING (true);
CREATE POLICY "Admin product_recipe_items manage" ON public.product_recipe_items FOR ALL USING (EXISTS (
    SELECT 1 FROM public.products p WHERE p.id = product_id AND public.is_store_owner(p.store_id)
)) WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p WHERE p.id = product_id AND public.is_store_owner(p.store_id)
));

CREATE POLICY "Public stock_movements viewable" ON public.stock_movements FOR SELECT USING (true);
CREATE POLICY "Admin stock_movements manage" ON public.stock_movements FOR ALL USING (public.is_store_owner(store_id));

-- 5. Final deduction trigger (consolidated and safe)
CREATE OR REPLACE FUNCTION public.deduct_recipe_stock()
RETURNS TRIGGER AS $$
DECLARE
    recipe_item RECORD;
    v_store_id UUID;
BEGIN
    -- Get store_id from order
    SELECT o.store_id INTO v_store_id FROM public.orders o WHERE o.id = NEW.order_id;

    FOR recipe_item IN
        SELECT pri.inventory_item_id, pri.quantity, COALESCE(ii.cost_per_unit, ii.unit_cost, 0) as cost_per_unit
        FROM public.product_recipe_items pri
        JOIN public.inventory_items ii ON ii.id = pri.inventory_item_id
        WHERE pri.product_id = NEW.product_id
    LOOP
        -- Reduce stock
        UPDATE public.inventory_items
        SET current_stock = current_stock - (recipe_item.quantity * NEW.quantity),
            updated_at = NOW()
        WHERE id = recipe_item.inventory_item_id;

        -- Record movement
        IF v_store_id IS NOT NULL THEN
            INSERT INTO public.stock_movements (store_id, inventory_item_id, order_id, type, quantity, cost, reference)
            VALUES (
                v_store_id,
                recipe_item.inventory_item_id,
                NEW.order_id,
                'exit',
                recipe_item.quantity * NEW.quantity,
                recipe_item.cost_per_unit * recipe_item.quantity * NEW.quantity,
                'Pedido #' || COALESCE((SELECT order_number FROM public.orders WHERE id = NEW.order_id)::TEXT, NEW.order_id::TEXT)
            );
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_order_item_inserted_recipe ON public.order_items;
CREATE TRIGGER on_order_item_inserted_recipe
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.deduct_recipe_stock();
