-- Tabela para registrar pagamentos PIX via Mercado Pago
CREATE TABLE IF NOT EXISTS public.pix_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  amount decimal(10,2) NOT NULL,
  mp_payment_id text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  pix_qr_code text,
  pix_qr_code_base64 text,
  pix_copia_cola text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.pix_payments ENABLE ROW LEVEL SECURITY;

-- Usuário pode ver seus próprios pagamentos
CREATE POLICY "Users can view own pix payments" ON public.pix_payments
  FOR SELECT USING (auth.uid() = user_id);

-- Usuário pode criar seus próprios pagamentos
CREATE POLICY "Users can create own pix payments" ON public.pix_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role pode atualizar (para webhook)
CREATE POLICY "Service role can update pix payments" ON public.pix_payments
  FOR UPDATE USING (true);
