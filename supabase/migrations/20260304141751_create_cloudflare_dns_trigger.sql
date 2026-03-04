-- Cria a trigger para chamar a Edge Function de Cloudflare ao registrar ou atualizar nova Loja

-- Drop previous if exists
DROP TRIGGER IF EXISTS tr_cloudflare_dns_domain_creation ON public.stores;
DROP FUNCTION IF EXISTS public.fn_call_cloudflare_dns_edge;

-- Envia Request via extensão pg_net com o ID e slug da store recém-criada
CREATE OR REPLACE FUNCTION public.fn_call_cloudflare_dns_edge()
RETURNS TRIGGER AS $$
BEGIN
  -- We assume pg_net extension is enabled, which is standard in Supabase
  PERFORM net.http_post(
      url:='https://npuxeoyiriabpbdgveml.supabase.co/functions/v1/cloudflare-dns',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('request.env.supabase_anon_key', true) || '"}',
      body:=json_build_object(
          'type', TG_OP,
          'table', TG_TABLE_NAME,
          'schema', TG_TABLE_SCHEMA,
          'record', row_to_json(NEW),
          'old_record', row_to_json(OLD)
      )::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Em caso de falha da request, não derruba a inserção da Loja no db
  RAISE WARNING 'Falha ao notificar servidor DNS da Cloudflare sobre a criação da Loja: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ativar Trigger em cada Row insert ou update de slug de Stores
CREATE TRIGGER tr_cloudflare_dns_domain_creation
AFTER INSERT OR UPDATE OF slug ON public.stores
FOR EACH ROW
EXECUTE FUNCTION public.fn_call_cloudflare_dns_edge();
