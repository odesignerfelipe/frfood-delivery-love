-- Add store_layout column to stores table
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS store_layout TEXT NOT NULL DEFAULT 'default';

-- Set toppizza to use the Anota AI layout
UPDATE public.stores
SET store_layout = 'anotaai'
WHERE slug = 'toppizza';
