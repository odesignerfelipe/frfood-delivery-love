
-- Add new columns to stores table
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS segment text DEFAULT '';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS avg_prep_time integer DEFAULT 30;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS avg_delivery_time integer DEFAULT 40;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS delivery_radius numeric DEFAULT 5;

-- Create trigger for handle_new_user if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$$;
