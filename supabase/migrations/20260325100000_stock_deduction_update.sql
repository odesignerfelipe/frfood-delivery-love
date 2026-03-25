-- Drop the old trigger that deducted stock immediately on order creation
DROP TRIGGER IF EXISTS on_order_item_inserted_recipe ON public.order_items;

-- Create function that handles stock deduction when an order is completed
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
BEGIN
    -- Only trigger when status changes to 'ready_for_pickup' or 'delivered'
    IF NEW.status IN ('ready_for_pickup', 'delivered') AND OLD.status NOT IN ('ready_for_pickup', 'delivered') THEN
        v_store_id := NEW.store_id;

        -- Loop through all items in the completed order
        FOR item IN SELECT * FROM public.order_items WHERE order_id = NEW.id
        LOOP
            -- 1. Deduct base product recipe
            FOR recipe_item IN
                SELECT pri.inventory_item_id, pri.quantity, COALESCE(ii.cost_per_unit, ii.unit_cost, 0) as cost_per_unit
                FROM public.product_recipe_items pri
                JOIN public.inventory_items ii ON ii.id = pri.inventory_item_id
                WHERE pri.product_id = item.product_id
            LOOP
                -- Ensure cost is numeric
                v_cost := COALESCE(recipe_item.cost_per_unit, 0);

                UPDATE public.inventory_items
                SET current_stock = current_stock - (recipe_item.quantity * item.quantity),
                    updated_at = NOW()
                WHERE id = recipe_item.inventory_item_id;

                INSERT INTO public.stock_movements (store_id, inventory_item_id, order_id, type, quantity, cost, reference)
                VALUES (v_store_id, recipe_item.inventory_item_id, NEW.id, 'exit', recipe_item.quantity * item.quantity, v_cost * recipe_item.quantity * item.quantity, 'Pedido #' || COALESCE(NEW.order_number::TEXT, NEW.id::TEXT));
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
                                    -- v_recipe_opt contains inventory_item_id and quantity
                                    UPDATE public.inventory_items
                                    SET current_stock = current_stock - ((v_recipe_opt->>'quantity')::NUMERIC * item.quantity),
                                        updated_at = NOW()
                                    WHERE id = (v_recipe_opt->>'inventory_item_id')::UUID;

                                    -- Insert a stock movement record for the variation item
                                    INSERT INTO public.stock_movements (store_id, inventory_item_id, order_id, type, quantity, cost, reference)
                                    SELECT 
                                        v_store_id, 
                                        (v_recipe_opt->>'inventory_item_id')::UUID, 
                                        NEW.id, 
                                        'exit', 
                                        (v_recipe_opt->>'quantity')::NUMERIC * item.quantity, 
                                        COALESCE(COALESCE(cost_per_unit, unit_cost), 0) * (v_recipe_opt->>'quantity')::NUMERIC * item.quantity, 
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

-- Recreate trigger on the orders table
DROP TRIGGER IF EXISTS on_order_status_completed_deduct_stock ON public.orders;
CREATE TRIGGER on_order_status_completed_deduct_stock
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.deduct_order_stock();
