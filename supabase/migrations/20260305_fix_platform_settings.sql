-- Add missing platform_settings columns for full landing page configuration
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS hero_title text DEFAULT 'O melhor sistema para o seu Delivery',
  ADD COLUMN IF NOT EXISTS hero_subtitle text DEFAULT 'Receba pedidos ilimitados direto no seu WhatsApp. Sem comissões, sem taxas ocultas.',
  ADD COLUMN IF NOT EXISTS hero_button_text text DEFAULT 'Começar agora',
  ADD COLUMN IF NOT EXISTS hero_image_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS hero_bg_type text DEFAULT 'gradient',
  ADD COLUMN IF NOT EXISTS hero_bg_color text DEFAULT 'from-orange-500 to-orange-600',
  ADD COLUMN IF NOT EXISTS value jsonb DEFAULT '{}'::jsonb;

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access
DROP POLICY IF EXISTS "Public can read platform_settings" ON public.platform_settings;
CREATE POLICY "Public can read platform_settings" ON public.platform_settings FOR SELECT USING (true);

-- Allow authenticated admin update (profile role = admin)
DROP POLICY IF EXISTS "Admins can update platform_settings" ON public.platform_settings;
CREATE POLICY "Admins can update platform_settings" ON public.platform_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
);
