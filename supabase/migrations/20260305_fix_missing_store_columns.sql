-- Migration: Fix missing store columns and ensure settings persistence
-- Date: 2026-03-05

BEGIN;

-- 1. Add status_mode column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'status_mode'
    ) THEN
        ALTER TABLE public.stores ADD COLUMN status_mode text DEFAULT 'auto';
    END IF;
END $$;

-- 2. Add audio_notifications column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'audio_notifications'
    ) THEN
        ALTER TABLE public.stores ADD COLUMN audio_notifications boolean DEFAULT true;
    END IF;
END $$;

-- 3. Add pix_key column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'pix_key'
    ) THEN
        ALTER TABLE public.stores ADD COLUMN pix_key text DEFAULT '';
    END IF;
END $$;

-- 4. Ensure banner_mobile_url column (re-check)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'banner_mobile_url'
    ) THEN
        ALTER TABLE public.stores ADD COLUMN banner_mobile_url text;
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.stores.status_mode IS 'Store status mode: auto (schedule), manual_open (always open), manual_closed (always closed)';
COMMENT ON COLUMN public.stores.audio_notifications IS 'Whether the store owner wants sound alerts for new orders';
COMMENT ON COLUMN public.stores.pix_key IS 'Store PIX key for customer payments';
COMMENT ON COLUMN public.stores.banner_mobile_url IS 'URL to the mobile-optimized banner image';

COMMIT;
