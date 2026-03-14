-- Migration: customer_registration_trigger.sql
-- Description: Automatically register or update a customer when an order is placed.

CREATE OR REPLACE FUNCTION public.handle_order_customer_registration()
RETURNS TRIGGER AS $$
BEGIN
    -- Only register if there is a valid phone number
    IF NEW.customer_phone IS NOT NULL AND NEW.customer_phone != '00000000000' THEN
        PERFORM public.register_customer_from_order(
            NEW.store_id,
            NEW.customer_name,
            NEW.customer_phone,
            NEW.customer_address,
            NEW.neighborhood,
            NEW.total
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run after a new order is inserted
DROP TRIGGER IF EXISTS tr_register_customer_on_order ON public.orders;
CREATE TRIGGER tr_register_customer_on_order
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_order_customer_registration();
