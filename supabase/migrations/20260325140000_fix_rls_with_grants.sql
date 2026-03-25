-- Solução Definitiva para o Erro de Permissão (RLS)
-- Adicionando permissões de execução e simplificando a lógica

-- 1. Recriar a função com permissão explícita
CREATE OR REPLACE FUNCTION public.is_product_owner(_product_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = _product_id AND s.owner_id = auth.uid()
  )
$$;

-- Importante: Garantir que o usuário autenticado possa EXECUTAR a função
GRANT EXECUTE ON FUNCTION public.is_product_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_store_owner(UUID) TO authenticated;

-- 2. Limpar e recriar políticas de variações
DROP POLICY IF EXISTS "Owners can manage variations" ON public.product_variations;
DROP POLICY IF EXISTS "Public can view variations" ON public.product_variations;

CREATE POLICY "Owners can manage variations" ON public.product_variations
FOR ALL TO authenticated
USING (public.is_product_owner(product_id))
WITH CHECK (public.is_product_owner(product_id));

CREATE POLICY "Public can view variations" ON public.product_variations
FOR SELECT USING (true);

-- 3. Limpar e recriar políticas de categorias
DROP POLICY IF EXISTS "Owners can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Public can view active categories" ON public.categories;

CREATE POLICY "Owners can manage categories" ON public.categories
FOR ALL TO authenticated
USING (public.is_store_owner(store_id))
WITH CHECK (public.is_store_owner(store_id));

CREATE POLICY "Public can view active categories" ON public.categories
FOR SELECT USING (true);
