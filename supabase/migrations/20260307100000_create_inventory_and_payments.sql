-- Migrations for Advanced Inventory (Ficha Técnica) and Payments (Split PIX/Cash)
-- Desc: Creates tables for raw ingredients, product recipes, and partial payments.

-- 1. Tabela de Insumos (Matéria-prima)
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit VARCHAR(20) NOT NULL, -- 'kg', 'g', 'l', 'ml', 'unidade'
    current_stock DECIMAL(10,3) DEFAULT 0,
    min_stock DECIMAL(10,3) DEFAULT 0,
    cost_per_unit DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para inventory_items
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public inventory_items are viewable by everyone in store." ON public.inventory_items FOR SELECT USING (true);
CREATE POLICY "Store owners can manage inventory_items." ON public.inventory_items FOR ALL USING (public.is_store_owner(store_id));

-- 2. Tabela Ficha Técnica (Relacionamento Produto <-> Insumo)
CREATE TABLE IF NOT EXISTS public.product_recipe_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
    quantity DECIMAL(10,3) NOT NULL, -- Quantidade do insumo usada neste produto
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, inventory_item_id)
);

-- RLS para product_recipe_items
ALTER TABLE public.product_recipe_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public product_recipe_items are viewable by everyone in store." ON public.product_recipe_items FOR SELECT USING (true);
CREATE POLICY "Store owners can manage product_recipe_items." ON public.product_recipe_items FOR ALL USING (public.is_product_owner(product_id));

-- 3. Tabela de Pagamentos das Comandas/Pedidos (Split PIX, Dinheiro, etc)
CREATE TABLE IF NOT EXISTS public.order_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    payment_method VARCHAR(50) NOT NULL, -- 'pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'cartao_pendente_caixa'
    amount DECIMAL(10,2) NOT NULL,
    amount_tendered DECIMAL(10,2), -- Valor entregue em dinheiro para calcular troco
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'failed'
    external_id TEXT, -- ID do PIX gerado (Asaas/Stripe)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

-- RLS para order_payments
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public order_payments are viewable by everyone." ON public.order_payments FOR SELECT USING (true);
CREATE POLICY "Anyone can insert order_payments." ON public.order_payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Store owners can update order_payments." ON public.order_payments FOR UPDATE USING (public.is_store_owner(store_id));
CREATE POLICY "Store owners can delete order_payments." ON public.order_payments FOR DELETE USING (public.is_order_owner(store_id));

-- 4. Função para dar baixa automática nos insumos via receita
CREATE OR REPLACE FUNCTION public.deduct_recipe_stock()
RETURNS TRIGGER AS $$
DECLARE
    recipe_item RECORD;
BEGIN
    -- Only deduct if the order is confirmed/preparing/delivered (depending on your logic, let's do it on insert of order item for now to match current logic)
    FOR recipe_item IN 
        SELECT inventory_item_id, quantity 
        FROM public.product_recipe_items 
        WHERE product_id = NEW.product_id
    LOOP
        UPDATE public.inventory_items
        SET current_stock = current_stock - (recipe_item.quantity * NEW.quantity),
            updated_at = NOW()
        WHERE id = recipe_item.inventory_item_id;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para deduzir insumos ao adicionar item ao pedido
CREATE TRIGGER on_order_item_inserted_recipe
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.deduct_recipe_stock();
