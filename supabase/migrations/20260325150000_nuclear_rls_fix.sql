-- NUCLEAR FIX: RLS com Subquery Direta (Sem dependência de funções customizadas)
-- Este script remove as funções e usa consultas diretas nas políticas.

-- 1. Removemos todas as políticas problemáticas
DROP POLICY IF EXISTS "Owners can manage variations" ON public.product_variations;
DROP POLICY IF EXISTS "Owners can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Owners can manage products" ON public.products;
DROP POLICY IF EXISTS "Owners can manage their stores" ON public.stores;

-- 2. Política para STORES (A base de tudo)
-- Garante que o usuário autenticado só gerencia lojas onde ele é o dono
CREATE POLICY "Owners can manage their stores" ON public.stores
FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- 3. Política para CATEGORIES
-- Usa subquery direta para verificar o dono da loja
CREATE POLICY "Owners can manage categories" ON public.categories
FOR ALL TO authenticated
USING (
  store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
)
WITH CHECK (
  store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
);

-- 4. Política para PRODUCTS
-- Usa subquery direta para verificar o dono da loja
CREATE POLICY "Owners can manage products" ON public.products
FOR ALL TO authenticated
USING (
  store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
)
WITH CHECK (
  store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
);

-- 5. Política para PRODUCT_VARIATIONS
-- Usa subquery em cascata via produtos -> loja
CREATE POLICY "Owners can manage variations" ON public.product_variations
FOR ALL TO authenticated
USING (
  product_id IN (
    SELECT id FROM public.products 
    WHERE store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
  )
)
WITH CHECK (
  product_id IN (
    SELECT id FROM public.products 
    WHERE store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
  )
);

-- 6. Políticas de visualização pública (essenciais para o site funcionar)
DROP POLICY IF EXISTS "Public can view open stores" ON public.stores;
CREATE POLICY "Public can view open stores" ON public.stores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view active categories" ON public.categories;
CREATE POLICY "Public can view active categories" ON public.categories FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Public can view active products" ON public.products;
CREATE POLICY "Public can view active products" ON public.products FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Public can view variations" ON public.product_variations;
CREATE POLICY "Public can view variations" ON public.product_variations FOR SELECT USING (true);

-- 7. IMPORTANTE: Conceder permissões para os roles do Supabase
GRANT ALL ON public.stores TO authenticated;
GRANT ALL ON public.categories TO authenticated;
GRANT ALL ON public.products TO authenticated;
GRANT ALL ON public.product_variations TO authenticated;
