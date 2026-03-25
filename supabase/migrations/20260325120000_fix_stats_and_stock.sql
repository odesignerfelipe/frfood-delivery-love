-- 1. Fix the get_store_stats RPC
CREATE OR REPLACE FUNCTION public.get_store_stats(store_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_products_count int;
  v_orders_count int;
  v_today_orders int;
  v_today_revenue decimal(10,2);
BEGIN
  -- Total products
  SELECT count(*) INTO v_products_count
  FROM public.products
  WHERE products.store_id = $1 AND is_active = true;

  -- Total orders (all time)
  SELECT count(*) INTO v_orders_count
  FROM public.orders
  WHERE orders.store_id = $1;

  -- Today's orders
  SELECT count(*) INTO v_today_orders
  FROM public.orders
  WHERE orders.store_id = $1 
    AND created_at >= CURRENT_DATE;

  -- Today's revenue
  SELECT COALESCE(sum(total), 0) INTO v_today_revenue
  FROM public.orders
  WHERE orders.store_id = $1 
    AND created_at >= CURRENT_DATE
    AND status IN ('delivered', 'completed', 'ready');

  RETURN json_build_object(
    'products', v_products_count,
    'orders', v_orders_count,
    'todayOrders', v_today_orders,
    'revenue', v_today_revenue
  );
END;
$$;

-- 2. Drop the automatic per-order financial sync trigger to prevent double-posting
DROP TRIGGER IF EXISTS tr_sync_order_to_financial ON public.orders;

-- 3. Correct the stock deduction trigger to use the correct status strings ('ready', 'delivered', 'completed')
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
    -- Only trigger when status changes to 'ready', 'completed', or 'delivered'
    IF NEW.status IN ('ready', 'completed', 'delivered') AND OLD.status NOT IN ('ready', 'completed', 'delivered') THEN
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
                    COALESCE(ii.cost_per_unit, 0) as cost_per_unit
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
                                        COALESCE(cost_per_unit, 0) * public.convert_unit((v_recipe_opt->>'quantity')::NUMERIC, v_recipe_opt->>'measurement_unit', unit) * item.quantity, 
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

-- 4. Create an RPC to cleanly close the day and post ALL financial records at once
CREATE OR REPLACE FUNCTION public.close_daily_financials(p_store_id uuid, p_session_id uuid, p_withdrawal decimal)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_sales_total DECIMAL(10,2);
  v_sales_count INT;
  v_costs_total DECIMAL(10,2);
BEGIN
  -- 1. Calculate and Insert Daily Sales (Incomes)
  SELECT COALESCE(SUM(total), 0), COUNT(*) 
  INTO v_sales_total, v_sales_count
  FROM public.orders
  WHERE store_id = p_store_id 
    AND created_at >= v_today
    AND status IN ('delivered', 'completed', 'ready');

  IF v_sales_total > 0 THEN
      INSERT INTO public.financial_transactions (store_id, type, amount, description, status, paid_at, due_date, payment_method)
      VALUES (
          p_store_id, 'entry', v_sales_total, 
          'Vendas do Dia (' || to_char(v_today, 'DD/MM/YYYY') || ') — ' || v_sales_count || ' pedido(s)', 
          'paid', NOW(), v_today, 'diversos'
      );
  END IF;

  -- 2. Calculate and Insert Daily Ingredient Costs (Expenses)
  -- Sum the cost of all stock movements of type 'exit' related to today's orders
  SELECT COALESCE(SUM(sm.cost), 0)
  INTO v_costs_total
  FROM public.stock_movements sm
  JOIN public.orders o ON sm.order_id = o.id
  WHERE sm.store_id = p_store_id 
    AND sm.type = 'exit' 
    AND o.created_at >= v_today;

  IF v_costs_total > 0 THEN
      INSERT INTO public.financial_transactions (store_id, type, amount, description, status, paid_at, due_date, payment_method)
      VALUES (
          p_store_id, 'exit', v_costs_total, 
          'Custo Total Consolidado de Insumos (' || to_char(v_today, 'DD/MM/YYYY') || ')', 
          'paid', NOW(), v_today, 'N/A'
      );
  END IF;

  -- 3. Record Withdrawal if applicable
  IF p_withdrawal > 0 THEN
      INSERT INTO public.financial_transactions (store_id, type, amount, description, status, paid_at, due_date, payment_method)
      VALUES (
          p_store_id, 'exit', p_withdrawal, 
          'Fechamento de Caixa / Sangria', 
          'paid', NOW(), v_today, 'dinheiro'
      );
  END IF;

  RETURN json_build_object(
      'success', true,
      'sales', v_sales_total,
      'costs', v_costs_total,
      'withdrawal', p_withdrawal
  );
END;
$$;
