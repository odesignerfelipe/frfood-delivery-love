-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create `tables` table
CREATE TABLE public.tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage tables" ON public.tables FOR ALL USING (public.is_store_owner(store_id));
CREATE POLICY "Public can view active tables" ON public.tables FOR SELECT USING (is_active = true);

CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON public.tables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Create `waiters` table
CREATE TABLE public.waiters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  login TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(store_id, login)
);

ALTER TABLE public.waiters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage waiters" ON public.waiters FOR ALL USING (public.is_store_owner(store_id));

-- Trigger to hash waiter passwords
CREATE OR REPLACE FUNCTION public.hash_waiter_password()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.password_hash <> OLD.password_hash THEN
    IF NEW.password_hash NOT LIKE '$2a$%' AND NEW.password_hash NOT LIKE '$2b$%' THEN
      NEW.password_hash = crypt(NEW.password_hash, gen_salt('bf'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hash_waiter_password_trigger
BEFORE INSERT OR UPDATE ON public.waiters
FOR EACH ROW EXECUTE FUNCTION public.hash_waiter_password();

-- Function to authenticate waiter securely
CREATE OR REPLACE FUNCTION public.authenticate_waiter(
  p_login TEXT, 
  p_password TEXT,
  p_store_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_waiter public.waiters;
BEGIN
  SELECT * INTO v_waiter
  FROM public.waiters
  WHERE store_id = p_store_id
    AND login = p_login 
    AND password_hash = crypt(p_password, password_hash) 
    AND is_active = true;
    
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true, 
      'waiter_id', v_waiter.id, 
      'name', v_waiter.name
    );
  ELSE
    RETURN jsonb_build_object('success', false);
  END IF;
END;
$$;

-- 3. Create `comandas` table
CREATE TABLE public.comandas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  waiter_id UUID REFERENCES public.waiters(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage comandas" ON public.comandas FOR ALL USING (public.is_store_owner(store_id));
CREATE POLICY "Public can view open comandas" ON public.comandas FOR SELECT USING (status = 'open');
CREATE POLICY "Anyone can create comandas" ON public.comandas FOR INSERT WITH CHECK (status = 'open');
CREATE POLICY "Anyone can update open comandas" ON public.comandas FOR UPDATE USING (status = 'open');

CREATE TRIGGER update_comandas_updated_at BEFORE UPDATE ON public.comandas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Alter `orders` table
ALTER TABLE public.orders
ADD COLUMN origin TEXT NOT NULL DEFAULT 'delivery',
ADD COLUMN comanda_id UUID REFERENCES public.comandas(id) ON DELETE SET NULL,
ADD COLUMN table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL,
ADD COLUMN waiter_id UUID REFERENCES public.waiters(id) ON DELETE SET NULL;

ALTER TABLE public.orders ALTER COLUMN customer_name DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN customer_phone DROP NOT NULL;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comandas;
