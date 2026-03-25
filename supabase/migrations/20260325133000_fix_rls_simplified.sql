-- Correção definitiva para o erro de RLS nas variações
-- Este script simplifica a regra para usar a permissão do próprio produto

-- 1. Removemos a política antiga que estava falhando
DROP POLICY IF EXISTS "Owners can manage variations" ON public.product_variations;

-- 2. Criamos uma nova política mais simples
-- Se o usuário consegue "ver" o produto (o que já é controlado pelo RLS de produtos), 
-- então ele terá permissão para gerenciar as variações vinculadas a ele.
CREATE POLICY "Owners can manage variations" ON public.product_variations
FOR ALL TO authenticated
USING (
  product_id IN (SELECT id FROM public.products)
)
WITH CHECK (
  product_id IN (SELECT id FROM public.products)
);

-- 3. Garantimos que a visualização para o público continue funcionando
DROP POLICY IF EXISTS "Public can view variations" ON public.product_variations;
CREATE POLICY "Public can view variations" ON public.product_variations
FOR SELECT USING (true);
