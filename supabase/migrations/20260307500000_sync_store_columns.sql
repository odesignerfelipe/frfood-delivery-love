-- Migration: sync_store_columns.sql
-- Description: Add missing columns to the stores table to support newer frontend features.

ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS consumo_local_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS razao_social TEXT,
ADD COLUMN IF NOT EXISTS cnpj TEXT,
ADD COLUMN IF NOT EXISTS display_name_type TEXT NOT NULL DEFAULT 'name' CHECK (display_name_type IN ('name', 'razao_social')),
ADD COLUMN IF NOT EXISTS banner_mobile_url TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS segment TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS avg_prep_time INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS avg_delivery_time INTEGER NOT NULL DEFAULT 40,
ADD COLUMN IF NOT EXISTS delivery_radius NUMERIC(10,2) NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS status_mode TEXT NOT NULL DEFAULT 'auto' CHECK (status_mode IN ('auto', 'manual_open', 'manual_closed')),
ADD COLUMN IF NOT EXISTS audio_notifications BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS pix_key TEXT DEFAULT '';

-- Update existing records if necessary
-- (Default values already handle new columns)
