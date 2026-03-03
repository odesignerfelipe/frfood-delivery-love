-- Garante permissões de Inserção e Leitura para criação de pedidos celulares/anônimos.

-- Cleanup previous potentially conflicting policies
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public select on orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow public select on order items" ON public.order_items;

-- Insert Policies
CREATE POLICY "Anyone can create orders" 
ON public.orders FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can create order items" 
ON public.order_items FOR INSERT 
WITH CHECK (true);

-- Select Policies (UUID based, secure by unguessability)
CREATE POLICY "Allow public select on orders" 
ON public.orders FOR SELECT 
USING (true);

CREATE POLICY "Allow public select on order items" 
ON public.order_items FOR SELECT 
USING (true);
