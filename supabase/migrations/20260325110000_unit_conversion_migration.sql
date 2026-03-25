-- 1. Add measurement_unit to product_recipe_items
ALTER TABLE public.product_recipe_items 
ADD COLUMN IF NOT EXISTS measurement_unit VARCHAR(20);

-- 2. Create the unit conversion function
CREATE OR REPLACE FUNCTION public.convert_unit(qty NUMERIC, from_unit TEXT, to_unit TEXT)
RETURNS NUMERIC AS $$
DECLARE
    f TEXT;
    t TEXT;
BEGIN
    IF from_unit IS NULL OR to_unit IS NULL OR from_unit = '' OR to_unit = '' THEN 
        RETURN qty; 
    END IF;
    
    f := lower(trim(from_unit));
    t := lower(trim(to_unit));
    
    IF f = t THEN 
        RETURN qty; 
    END IF;
    
    -- Weight Conversions
    IF f = 'g' AND t = 'kg' THEN RETURN qty / 1000.0; END IF;
    IF f = 'kg' AND t = 'g' THEN RETURN qty * 1000.0; END IF;
    IF f = 'mg' AND t = 'g' THEN RETURN qty / 1000.0; END IF;
    IF f = 'g' AND t = 'mg' THEN RETURN qty * 1000.0; END IF;
    
    -- Volume Conversions
    IF f = 'ml' AND (t = 'l' OR t = 'lt') THEN RETURN qty / 1000.0; END IF;
    IF (f = 'l' OR f = 'lt') AND t = 'ml' THEN RETURN qty * 1000.0; END IF;
    
    RETURN qty;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Update the stock deduction trigger to use unit conversion
CREATE OR REPLACE FUNCTION public.deduct_order_stock()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    recipe_item RECORD;
    v_store_id UUID;
    v_variation JSONB;
    v_selected JSONB;
    v_recipe_opt JSONB;
    v_cost NUMERIC;
    v_converted_qty NUMERIC;
BEGIN
    -- Only trigger when status changes to 'ready_for_pickup' or 'delivered'
    IF NEW.status IN ('ready_for_pickup', 'delivered') AND OLD.status NOT IN ('ready_for_pickup', 'delivered') THEN
        v_store_id := NEW.store_id;

        -- Loop through all items in the completed order
        FOR item IN SELECT * FROM public.order_items WHERE order_id = NEW.id
        LOOP
            -- 1. Deduct base product recipe
            FOR recipe_item IN
                SELECT 
                    pri.inventory_item_id, 
                    pri.quantity, 
                    pri.measurement_unit as recipe_unit,
                    ii.unit as inv_unit,
                    COALESCE(ii.cost_per_unit, ii.unit_cost, 0) as cost_per_unit
                FROM public.product_recipe_items pri
                JOIN public.inventory_items ii ON ii.id = pri.inventory_item_id
                WHERE pri.product_id = item.product_id
            LOOP
                -- Convert quantity if units differ
                v_converted_qty := public.convert_unit(recipe_item.quantity, recipe_item.recipe_unit, recipe_item.inv_unit);
                v_cost := COALESCE(recipe_item.cost_per_unit, 0);

                UPDATE public.inventory_items
                SET current_stock = current_stock - (v_converted_qty * item.quantity),
                    updated_at = NOW()
                WHERE id = recipe_item.inventory_item_id;

                INSERT INTO public.stock_movements (store_id, inventory_item_id, order_id, type, quantity, cost, reference)
                VALUES (v_store_id, recipe_item.inventory_item_id, NEW.id, 'exit', v_converted_qty * item.quantity, v_cost * v_converted_qty * item.quantity, 'Pedido #' || COALESCE(NEW.order_number::TEXT, NEW.id::TEXT));
            END LOOP;

            -- 2. Deduct variation recipes (read directly from the order_item's JSON variations)
            IF item.variations IS NOT NULL AND jsonb_typeof(item.variations) = 'array' THEN
                FOR v_variation IN SELECT * FROM jsonb_array_elements(item.variations)
                LOOP
                    IF v_variation->'selected' IS NOT NULL AND jsonb_typeof(v_variation->'selected') = 'array' THEN
                        FOR v_selected IN SELECT * FROM jsonb_array_elements(v_variation->'selected')
                        LOOP
                            -- The recipe array was embedded into the order item variation object during checkout
                            IF v_selected->'recipe' IS NOT NULL AND jsonb_typeof(v_selected->'recipe') = 'array' THEN
                                FOR v_recipe_opt IN SELECT * FROM jsonb_array_elements(v_selected->'recipe')
                                LOOP
                                    -- v_recipe_opt contains inventory_item_id, quantity, and optionally measurement_unit
                                    -- Using inline query to perform conversion against the inventory_items.unit column
                                    UPDATE public.inventory_items
                                    SET current_stock = current_stock - (public.convert_unit((v_recipe_opt->>'quantity')::NUMERIC, v_recipe_opt->>'measurement_unit', unit) * item.quantity),
                                        updated_at = NOW()
                                    WHERE id = (v_recipe_opt->>'inventory_item_id')::UUID;

                                    -- Insert a stock movement record for the variation item
                                    INSERT INTO public.stock_movements (store_id, inventory_item_id, order_id, type, quantity, cost, reference)
                                    SELECT 
                                        v_store_id, 
                                        (v_recipe_opt->>'inventory_item_id')::UUID, 
                                        NEW.id, 
                                        'exit', 
                                        public.convert_unit((v_recipe_opt->>'quantity')::NUMERIC, v_recipe_opt->>'measurement_unit', unit) * item.quantity, 
                                        COALESCE(COALESCE(cost_per_unit, unit_cost), 0) * public.convert_unit((v_recipe_opt->>'quantity')::NUMERIC, v_recipe_opt->>'measurement_unit', unit) * item.quantity, 
                                        'Pedido (Var: ' || (v_selected->>'name') || ') #' || COALESCE(NEW.order_number::TEXT, NEW.id::TEXT)
                                    FROM public.inventory_items 
                                    WHERE id = (v_recipe_opt->>'inventory_item_id')::UUID;
                                END LOOP;
                            END IF;
                        END LOOP;
                    END IF;
                END LOOP;
            END IF;

        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
