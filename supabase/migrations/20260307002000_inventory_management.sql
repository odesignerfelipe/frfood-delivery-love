-- Inventory Management & Reporting additions

-- 1. Add fields to products
ALTER TABLE public.products
ADD COLUMN manage_stock BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0;

-- 2. Trigger: Auto-close orders when a comanda is closed
CREATE OR REPLACE FUNCTION public.auto_complete_comanda_orders()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changes to 'closed'
  IF NEW.status = 'closed' AND OLD.status <> 'closed' THEN
    -- Update all orders linked to this comanda to 'delivered'
    UPDATE public.orders
    SET status = 'delivered',
        updated_at = now()
    WHERE comanda_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_comanda_closed
AFTER UPDATE ON public.comandas
FOR EACH ROW EXECUTE FUNCTION public.auto_complete_comanda_orders();

-- 3. Trigger: Deduct stock when an order item is inserted
CREATE OR REPLACE FUNCTION public.deduct_product_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_manage_stock BOOLEAN;
  v_current_stock INTEGER;
BEGIN
  -- Check if the product manages stock
  SELECT manage_stock, stock_quantity INTO v_manage_stock, v_current_stock
  FROM public.products
  WHERE id = NEW.product_id;

  -- If it manages stock, reduce the quantity
  IF v_manage_stock = true THEN
    -- Prevent negative stock, or let it go negative for tracking
    -- Here we will just deduct it
    UPDATE public.products
    SET stock_quantity = stock_quantity - NEW.quantity,
        updated_at = now()
    WHERE id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_order_item_inserted
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.deduct_product_stock();
