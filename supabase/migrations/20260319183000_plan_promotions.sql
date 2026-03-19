-- Migration: plan_promotions.sql
-- Add promotional pricing fields to platform_settings

ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS promo_monthly_price TEXT DEFAULT '';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS promo_yearly_price TEXT DEFAULT '';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS promo_active BOOLEAN DEFAULT false;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS promo_label TEXT DEFAULT 'Promoção';
