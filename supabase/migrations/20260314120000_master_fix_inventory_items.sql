-- Migration: master_fix_inventory_schema.sql
-- Description: Complete fix for inventory_items table schema to resolve all "column not found" errors.

-- 1. Create the table if it doesn't exist at all
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT 'unidade',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Force add every column required by the frontend
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS current_stock NUMERIC(12,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_stock NUMERIC(12,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS supplier TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS supplier_contact TEXT DEFAULT '';

-- 3. Sync cost columns to avoid data loss
UPDATE public.inventory_items 
SET cost_per_unit = unit_cost 
WHERE (cost_per_unit = 0 OR cost_per_unit IS NULL) AND unit_cost > 0;

UPDATE public.inventory_items 
SET unit_cost = cost_per_unit 
WHERE (unit_cost = 0 OR unit_cost IS NULL) AND cost_per_unit > 0;

-- 4. Enable RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- 5. Drop and recreate policies to ensure they are correct (Safe since they use store_id)
DROP POLICY IF EXISTS "Public inventory_items are viewable by everyone in store." ON public.inventory_items;
DROP POLICY IF EXISTS "Store owners can manage inventory_items." ON public.inventory_items;

CREATE POLICY "Public inventory_items are viewable by everyone in store." ON public.inventory_items FOR SELECT USING (true);
CREATE POLICY "Store owners can manage inventory_items." ON public.inventory_items FOR ALL USING (public.is_store_owner(store_id));

-- 6. Update the deduction trigger to be totally safe
CREATE OR REPLACE FUNCTION public.deduct_recipe_stock()
RETURNS TRIGGER AS $$
DECLARE
    recipe_item RECORD;
    v_store_id UUID;
BEGIN
    -- Only run if there is a recipe
    SELECT o.store_id INTO v_store_id FROM public.orders o WHERE o.id = NEW.order_id;

    FOR recipe_item IN
        SELECT pri.inventory_item_id, pri.quantity, COALESCE(ii.cost_per_unit, ii.unit_cost, 0) as cost_per_unit
        FROM public.product_recipe_items pri
        JOIN public.inventory_items ii ON ii.id = pri.inventory_item_id
        WHERE pri.product_id = NEW.product_id
    LOOP
        -- Deduct stock directly
        UPDATE public.inventory_items
        SET current_stock = current_stock - (recipe_item.quantity * NEW.quantity),
            updated_at = NOW()
        WHERE id = recipe_item.inventory_item_id;

        -- Log movement if stock_movements table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_movements') AND v_store_id IS NOT NULL THEN
            INSERT INTO public.stock_movements (store_id, inventory_item_id, type, quantity, cost, reference)
            VALUES (
                v_store_id, 
                recipe_item.inventory_item_id, 
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

-- Re-attach trigger if it's missing
DROP TRIGGER IF EXISTS on_order_item_inserted_recipe ON public.order_items;
CREATE TRIGGER on_order_item_inserted_recipe
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.deduct_recipe_stock();
