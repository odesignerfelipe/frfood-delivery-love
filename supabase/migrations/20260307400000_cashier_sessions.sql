-- Migration: cashier_sessions.sql
-- Description: Table for opening and closing the cashier register.

CREATE TABLE IF NOT EXISTS public.cashier_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    opening_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    closing_balance DECIMAL(10,2),
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.cashier_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage their own cashier_sessions" 
ON public.cashier_sessions 
FOR ALL 
USING (public.is_store_owner(store_id));

-- Trigger for updated_at
CREATE TRIGGER tr_cashier_sessions_updated_at
BEFORE UPDATE ON public.cashier_sessions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
