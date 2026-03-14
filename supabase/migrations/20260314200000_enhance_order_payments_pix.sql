-- Migration: Enhance order_payments for dynamic PIX with Mercado Pago
-- Adds fields for: comanda linking, split payments, QR code data, MP integration

-- Add comanda_id for linking payments to table bills
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS comanda_id UUID REFERENCES public.comandas(id) ON DELETE SET NULL;

-- Split payment tracking
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS split_index INT DEFAULT 1;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS split_total INT DEFAULT 1;

-- Mercado Pago PIX data
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS pix_qr_code TEXT DEFAULT '';
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS pix_copia_cola TEXT DEFAULT '';
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.order_payments ADD COLUMN IF NOT EXISTS mp_payment_id TEXT DEFAULT '';

-- Make order_id nullable (for comanda-only payments without specific order)
ALTER TABLE public.order_payments ALTER COLUMN order_id DROP NOT NULL;

-- Allow anyone to update order_payments (for realtime webhook updates)
DROP POLICY IF EXISTS "Store owners can update order_payments." ON public.order_payments;
CREATE POLICY "Anyone can update order_payments." ON public.order_payments FOR UPDATE USING (true);

-- Index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_order_payments_mp_id ON public.order_payments(mp_payment_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_comanda ON public.order_payments(comanda_id);
