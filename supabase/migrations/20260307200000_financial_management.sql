-- 1. Categorias Financeiras
CREATE TABLE IF NOT EXISTS public.financial_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('entry', 'exit')), -- 'entry' (receita), 'exit' (despesa)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Movimentações Financeiras (Contas a Pagar/Receber e Caixa)
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('entry', 'exit')),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    due_date DATE,
    paid_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    payment_method VARCHAR(50), 
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financial categories viewable by store owner" ON public.financial_categories FOR ALL USING (public.is_store_owner(store_id));
CREATE POLICY "Financial transactions viewable by store owner" ON public.financial_transactions FOR ALL USING (public.is_store_owner(store_id));

-- Trigger para registrar venda automaticamente no financeiro
CREATE OR REPLACE FUNCTION public.sync_order_to_financial()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND NEW.status = 'delivered' AND OLD.status != 'delivered') OR 
       (TG_OP = 'INSERT' AND NEW.delivery_type = 'table' AND NEW.status = 'confirmed') THEN
        
        INSERT INTO public.financial_transactions (store_id, order_id, type, amount, description, status, paid_at)
        VALUES (NEW.store_id, NEW.id, 'entry', NEW.total, 'Venda Pedido #' || NEW.order_number, 'paid', NOW());
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sync_order_to_financial
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_order_to_financial();
