-- Tabela para configurações de impressoras térmicas (QZ Tray)
CREATE TABLE IF NOT EXISTS public.printer_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- Nome amigável (ex: Impressora Cozinha)
    identifier VARCHAR(255) NOT NULL, -- Nome real da impressora no Windows/OS
    type VARCHAR(20) NOT NULL CHECK (type IN ('kitchen', 'bar', 'cashier')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, type) -- Apenas uma impressora ativa por tipo por loja (simplificação)
);

-- RLS
ALTER TABLE public.printer_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Printer settings viewable by store owner" ON public.printer_settings FOR ALL USING (public.is_store_owner(store_id));
