-- ==========================================
-- Migration: Create Platform Updates & Tutorials
-- ==========================================

CREATE TABLE IF NOT EXISTS public.platform_updates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('update', 'tutorial')),
    title TEXT NOT NULL,
    content TEXT,
    image_url TEXT,
    video_url TEXT,
    author TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.platform_updates ENABLE ROW LEVEL SECURITY;

-- Politicas de leitura e escrita
CREATE POLICY "Public can view platform updates" 
    ON public.platform_updates FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert platform updates" 
    ON public.platform_updates FOR INSERT 
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update platform updates" 
    ON public.platform_updates FOR UPDATE 
    USING (public.is_admin());

CREATE POLICY "Admins can delete platform updates" 
    ON public.platform_updates FOR DELETE 
    USING (public.is_admin());

-- Trigger para updated_at
CREATE TRIGGER update_platform_updates_updated_at 
    BEFORE UPDATE ON public.platform_updates 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_updates;
