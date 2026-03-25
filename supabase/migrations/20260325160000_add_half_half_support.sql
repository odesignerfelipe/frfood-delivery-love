-- Adicionando suporte a Meio a Meio com preço do maior valor
ALTER TABLE public.product_variations ADD COLUMN IF NOT EXISTS is_half_half BOOLEAN DEFAULT false;

-- Comentário para documentação interna
COMMENT ON COLUMN public.product_variations.is_half_half IS 'Se verdadeiro, o preço do grupo será o maior valor entre as opções selecionadas (útil para pizzas Meio a Meio).';
