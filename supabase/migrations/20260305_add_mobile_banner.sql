-- Migration: Add mobile banner URL to stores table
-- Date: 2026-03-05

BEGIN;

-- Add banner_mobile_url column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'stores'
        AND column_name = 'banner_mobile_url'
    ) THEN
        ALTER TABLE public.stores
        ADD COLUMN banner_mobile_url text;
    END IF;
END $$;

COMMENT ON COLUMN public.stores.banner_mobile_url IS 'URL to the mobile-specific banner image for the store';

COMMIT;
