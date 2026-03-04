-- Expandir platform_settings com campos editáveis para a Landing Page completa

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS favicon_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS site_name text DEFAULT 'FRFood',
  ADD COLUMN IF NOT EXISTS navbar_button_text text DEFAULT 'Criar conta',
  ADD COLUMN IF NOT EXISTS hero_badge_text text DEFAULT 'Plataforma completa de delivery',
  ADD COLUMN IF NOT EXISTS hero_stats jsonb DEFAULT '[{"value":"5.000+","label":"Restaurantes"},{"value":"1M+","label":"Pedidos/mês"},{"value":"0%","label":"Taxa por pedido"}]'::jsonb,
  ADD COLUMN IF NOT EXISTS pricing_title text DEFAULT 'Planos simples e transparentes',
  ADD COLUMN IF NOT EXISTS pricing_subtitle text DEFAULT 'Todos os recursos inclusos em qualquer plano. Sem taxa por pedido.',
  ADD COLUMN IF NOT EXISTS monthly_price text DEFAULT '149,90',
  ADD COLUMN IF NOT EXISTS yearly_price text DEFAULT '124,90',
  ADD COLUMN IF NOT EXISTS cta_title text DEFAULT 'Pronto para vender mais?',
  ADD COLUMN IF NOT EXISTS cta_subtitle text DEFAULT 'Comece agora e tenha seu delivery online funcionando em minutos. Sem taxa por pedido, sem complicação.',
  ADD COLUMN IF NOT EXISTS cta_button_text text DEFAULT 'Criar minha loja agora',
  ADD COLUMN IF NOT EXISTS footer_text text DEFAULT '',
  ADD COLUMN IF NOT EXISTS faq_items jsonb DEFAULT '[{"q":"Preciso ter conhecimento técnico para usar a plataforma?","a":"Não! A FRFood foi pensada para ser simples. Você configura seu catálogo em minutos e começa a receber pedidos pelo WhatsApp."},{"q":"Existe taxa por pedido?","a":"Absolutamente não. Você paga apenas a mensalidade fixa e recebe pedidos ilimitados sem nenhuma taxa adicional."},{"q":"Como funciona a integração com WhatsApp?","a":"Quando seu cliente finaliza o pedido no catálogo, ele é enviado automaticamente para o WhatsApp do seu restaurante com todos os detalhes."},{"q":"Posso cancelar a qualquer momento?","a":"Sim! Não há fidelidade. Você pode cancelar seu plano mensal quando quiser, sem multas ou taxas."},{"q":"Como configuro as taxas de entrega por bairro?","a":"No painel administrativo, você cadastra os bairros de atendimento e define o valor da taxa de entrega para cada um individualmente."}]'::jsonb,
  ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#f97316';
