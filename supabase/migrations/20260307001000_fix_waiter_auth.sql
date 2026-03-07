-- Fix for waiter password hashing and authentication using extensions schema explicitly

CREATE OR REPLACE FUNCTION public.hash_waiter_password()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.password_hash <> OLD.password_hash THEN
    IF NEW.password_hash NOT LIKE '$2a$%' AND NEW.password_hash NOT LIKE '$2b$%' THEN
      NEW.password_hash = extensions.crypt(NEW.password_hash, extensions.gen_salt('bf'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.authenticate_waiter(
  p_login TEXT, 
  p_password TEXT,
  p_store_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_waiter public.waiters;
BEGIN
  SELECT * INTO v_waiter
  FROM public.waiters
  WHERE store_id = p_store_id
    AND login = p_login 
    AND password_hash = extensions.crypt(p_password, password_hash) 
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
