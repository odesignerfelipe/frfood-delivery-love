-- Fix RLS for product variations
-- Ensure the function is robust and handles auth.uid() correctly

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

-- Drop and recreate the policy to be more explicit
DROP POLICY IF EXISTS "Owners can manage variations" ON public.product_variations;

CREATE POLICY "Owners can manage variations" ON public.product_variations
FOR ALL TO authenticated
USING (public.is_product_owner(product_id))
WITH CHECK (public.is_product_owner(product_id));

-- Fix for Categories
DROP POLICY IF EXISTS "Owners can manage categories" ON public.categories;
CREATE POLICY "Owners can manage categories" ON public.categories
FOR ALL TO authenticated
USING (public.is_store_owner(store_id))
WITH CHECK (public.is_store_owner(store_id));

-- Also fix categories RLS just in case
DROP POLICY IF EXISTS "Owners can manage categories" ON public.categories;
CREATE POLICY "Owners can manage categories" ON public.categories
FOR ALL TO authenticated
USING (public.is_store_owner(store_id))
WITH CHECK (public.is_store_owner(store_id));
