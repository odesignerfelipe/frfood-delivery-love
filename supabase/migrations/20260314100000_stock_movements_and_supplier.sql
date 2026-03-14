-- Migration: stock_movements_and_supplier.sql
-- Adds supplier field to inventory_items and creates stock_movements table for full traceability.

-- 1. Add supplier column to inventory_items
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS supplier TEXT DEFAULT '';

-- 2. Create stock_movements table
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('entry', 'exit', 'adjustment')),
    quantity DECIMAL(10,3) NOT NULL,
    cost DECIMAL(10,2) DEFAULT 0,
    reference TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for stock_movements
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public stock_movements are viewable by everyone." ON public.stock_movements FOR SELECT USING (true);
CREATE POLICY "Store owners can manage stock_movements." ON public.stock_movements FOR ALL USING (public.is_store_owner(store_id));
CREATE POLICY "Anyone can insert stock_movements." ON public.stock_movements FOR INSERT WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_store ON public.stock_movements(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON public.stock_movements(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON public.stock_movements(created_at DESC);

-- 3. Update deduct_recipe_stock trigger to also log movements
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
        SELECT pri.inventory_item_id, pri.quantity, ii.cost_per_unit
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
        INSERT INTO public.stock_movements (store_id, inventory_item_id, type, quantity, cost, reference)
        VALUES (
            v_store_id,
            recipe_item.inventory_item_id,
            'exit',
            recipe_item.quantity * NEW.quantity,
            recipe_item.cost_per_unit * recipe_item.quantity * NEW.quantity,
            'Pedido #' || COALESCE((SELECT order_number FROM public.orders WHERE id = NEW.order_id)::TEXT, NEW.order_id::TEXT)
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
