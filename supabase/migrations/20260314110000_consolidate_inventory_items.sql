-- Migration: consolidate_inventory_items.sql
-- Description: Ensures all required columns for inventory_items exist and adds supplier_contact.

-- 1. Ensure columns exist in inventory_items
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS supplier_contact TEXT DEFAULT '';

-- 2. Synchronize cost columns if one is missing data
UPDATE public.inventory_items 
SET cost_per_unit = unit_cost 
WHERE cost_per_unit = 0 AND unit_cost > 0;

UPDATE public.inventory_items 
SET unit_cost = cost_per_unit 
WHERE unit_cost = 0 AND cost_per_unit > 0;

-- 3. Update the deduct_recipe_stock trigger function to be more resilient
CREATE OR REPLACE FUNCTION public.deduct_recipe_stock()
RETURNS TRIGGER AS $$
DECLARE
    recipe_item RECORD;
    v_store_id UUID;
BEGIN
    -- Get the store_id from the order
    SELECT o.store_id INTO v_store_id
    FROM public.orders o
    WHERE o.id = NEW.order_id;

    FOR recipe_item IN
        SELECT pri.inventory_item_id, pri.quantity, COALESCE(ii.cost_per_unit, ii.unit_cost, 0) as cost_per_unit
        FROM public.product_recipe_items pri
        JOIN public.inventory_items ii ON ii.id = pri.inventory_item_id
        WHERE pri.product_id = NEW.product_id
    LOOP
        -- Deduct stock
        UPDATE public.inventory_items
        SET current_stock = current_stock - (recipe_item.quantity * NEW.quantity),
            updated_at = NOW()
        WHERE id = recipe_item.inventory_item_id;

        -- Log the movement
        IF v_store_id IS NOT NULL THEN
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
