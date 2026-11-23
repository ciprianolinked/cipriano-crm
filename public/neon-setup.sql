-- Cipriano Tech & Security | Preparação do PostgreSQL no Neon
-- Versão do schema: 2026-11-06
-- Execute no Neon Console → SQL Editor, selecionando o MESMO branch e
-- database usados na variável DATABASE_URL da Vercel.
-- O projeto/database e o usuário já são criados pelo painel do Neon.
-- Este script NÃO contém senhas, NÃO apaga dados e pode ser executado novamente.
-- Não executa DROP, DELETE ou TRUNCATE. Faça backup antes de alterar produção.
-- Compatível com PostgreSQL 14+ do Neon; gen_random_uuid() é nativo.

BEGIN;
-- Evita avisos "already exists, skipping" ao reaplicar sem alterar dados.
SET LOCAL client_min_messages = warning;

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  company text,
  contact_name text,
  email text,
  phone text,
  document text,
  address text,
  city text,
  state text,
  segment text,
  source text,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  number text NOT NULL,
  type text DEFAULT 'completa' NOT NULL,
  status text DEFAULT 'novo' NOT NULL,
  archived boolean DEFAULT false NOT NULL,
  revision integer DEFAULT 1 NOT NULL,
  parent_proposal_id uuid,
  revision_group_id uuid,
  client_id uuid,
  client_name text NOT NULL,
  contact text,
  client_email text,
  site text,
  issued_at timestamptz DEFAULT now() NOT NULL,
  validity_days integer DEFAULT 15 NOT NULL,
  discount_pct integer DEFAULT 0 NOT NULL,
  items jsonb DEFAULT '[]'::jsonb NOT NULL,
  sections jsonb DEFAULT '[]'::jsonb NOT NULL,
  payment_terms text,
  delivery_time text,
  warranty text,
  art_included boolean DEFAULT false NOT NULL,
  subtotal_cents integer DEFAULT 0 NOT NULL,
  total_cents integer DEFAULT 0 NOT NULL,
  briefing jsonb,
  next_action_at timestamptz,
  next_action_note text,
  sent_at timestamptz,
  closed_at timestamptz,
  loss_reason text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  proposal_id uuid NOT NULL,
  kind text DEFAULT 'nota' NOT NULL,
  content text NOT NULL,
  due_at timestamptz,
  done_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  kind text DEFAULT 'equipamento' NOT NULL,
  category text DEFAULT 'CFTV' NOT NULL,
  description text NOT NULL,
  spec text,
  unit text DEFAULT 'un' NOT NULL,
  supplier_price_cents integer DEFAULT 0 NOT NULL,
  margin_pct integer DEFAULT 30 NOT NULL,
  price_cents integer DEFAULT 0 NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Histórico de revisão de preços do fornecedor (justificativa de reajustes).
CREATE TABLE IF NOT EXISTS public.catalog_price_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  item_id uuid NOT NULL,
  item_description text NOT NULL,
  old_supplier_cents integer DEFAULT 0 NOT NULL,
  new_supplier_cents integer DEFAULT 0 NOT NULL,
  old_sale_cents integer DEFAULT 0 NOT NULL,
  new_sale_cents integer DEFAULT 0 NOT NULL,
  margin_pct integer DEFAULT 0 NOT NULL,
  note text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.maintenance_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  client_id uuid,
  client_name text NOT NULL,
  title text NOT NULL,
  description text,
  proposal_id uuid,
  proposal_number text,
  proposal_revision integer,
  proposal_snapshot jsonb,
  contract_text text DEFAULT '' NOT NULL,
  document_revision integer DEFAULT 1 NOT NULL,
  generation_source text DEFAULT 'modelo' NOT NULL,
  monthly_cents integer DEFAULT 0 NOT NULL,
  start_date timestamptz DEFAULT now() NOT NULL,
  cycle_months integer DEFAULT 12 NOT NULL,
  index_name text DEFAULT 'IPCA' NOT NULL,
  status text DEFAULT 'ativo' NOT NULL,
  last_readjust_at timestamptz,
  next_readjust_at timestamptz,
  last_readjust_pct integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.maintenance_readjusts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  contract_id uuid NOT NULL,
  readjust_at timestamptz DEFAULT now() NOT NULL,
  old_monthly_cents integer DEFAULT 0 NOT NULL,
  new_monthly_cents integer DEFAULT 0 NOT NULL,
  ipca_pct integer DEFAULT 0 NOT NULL,
  percent_milli integer,
  index_name text DEFAULT 'IPCA' NOT NULL,
  period_start text,
  period_end text,
  source text DEFAULT 'ipca' NOT NULL,
  note text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.maintenance_document_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  contract_id uuid NOT NULL,
  revision integer NOT NULL,
  body text NOT NULL,
  note text DEFAULT '' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ipca_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  month text NOT NULL,
  pct integer DEFAULT 0 NOT NULL,
  source text DEFAULT 'manual' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.economic_index_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  index_name text NOT NULL,
  month text NOT NULL,
  percent_milli integer NOT NULL,
  source text DEFAULT 'bcb' NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Propostas de concorrente enviadas como referência de precificação (máx. 6).
-- bytea preserva o arquivo original entre deploys; não guarda dados de clientes do painel.
CREATE TABLE IF NOT EXISTS public.reference_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  data bytea NOT NULL,
  extracted_text text,
  manual_text text,
  layout_rows jsonb,
  analysis jsonb,
  note text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.delivery_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  proposal_id uuid,
  term_number text NOT NULL,
  client_name text NOT NULL,
  site text,
  delivery_date timestamptz,
  technician text DEFAULT '' NOT NULL,
  receiver_name text DEFAULT '' NOT NULL,
  receiver_doc text DEFAULT '' NOT NULL,
  items jsonb DEFAULT '[]'::jsonb NOT NULL,
  intro text DEFAULT '' NOT NULL,
  scope_summary text DEFAULT '' NOT NULL,
  tests text DEFAULT '' NOT NULL,
  pendencies text DEFAULT '' NOT NULL,
  warranty text DEFAULT '' NOT NULL,
  observations text DEFAULT '' NOT NULL,
  status text DEFAULT 'rascunho' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Ordens de serviço (campo) e o orçamento gerado a partir delas.
CREATE TABLE IF NOT EXISTS public.service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  number text NOT NULL,
  kind text NOT NULL DEFAULT 'corretiva',
  status text NOT NULL DEFAULT 'aberta',
  priority text NOT NULL DEFAULT 'normal',
  client_id uuid,
  client_name text NOT NULL,
  contact text,
  phone text,
  email text,
  site text,
  description text DEFAULT '' NOT NULL,
  diagnosis text DEFAULT '' NOT NULL,
  solution text DEFAULT '' NOT NULL,
  technician text DEFAULT '' NOT NULL,
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  labor_cents integer DEFAULT 0 NOT NULL,
  travel_cents integer DEFAULT 0 NOT NULL,
  items jsonb DEFAULT '[]'::jsonb NOT NULL,
  notes text DEFAULT '' NOT NULL,
  client_signature text DEFAULT '' NOT NULL,
  origin_proposal_id uuid,
  origin_proposal_number text,
  budget_proposal_id uuid,
  budget_proposal_number text,
  budget_total_cents integer DEFAULT 0 NOT NULL,
  budget_issued_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS service_orders_status_idx ON public.service_orders (status, scheduled_at);

CREATE TABLE IF NOT EXISTS public.app_settings (
  id text PRIMARY KEY DEFAULT 'default' NOT NULL,
  company_name text DEFAULT 'Cipriano Tech & Security' NOT NULL,
  legal_name text DEFAULT 'Cipriano Tecnologia e Segurança Eletrônica LTDA' NOT NULL,
  tagline text DEFAULT 'Segurança eletrônica IP · Projetos, instalação e manutenção' NOT NULL,
  director text DEFAULT 'Gabriel Cipriano' NOT NULL,
  role text DEFAULT 'Diretor Técnico' NOT NULL,
  phone text DEFAULT '+55 (12) 99701-1890' NOT NULL,
  landline text DEFAULT '+55 (12) 99701-1890' NOT NULL,
  email text DEFAULT 'gabriel.ciprianotech@gmail.com' NOT NULL,
  site text DEFAULT 'ciprianotech.com.br' NOT NULL,
  address text DEFAULT 'Alameda Raul Roldão da Costa, 183 - Vila Betania, São José dos Campos - SP, 12245-484' NOT NULL,
  cnpj text DEFAULT '69.978.603/0001-69' NOT NULL,
  crea text DEFAULT 'CREA-SP 5071138295-SP' NOT NULL,
  hours text DEFAULT 'Comercial seg–sex 8h–18h · Suporte técnico sob contrato' NOT NULL,
  default_validity_days integer DEFAULT 15 NOT NULL,
  default_payment_terms text DEFAULT '40% de entrada na assinatura · 60% na entrega técnica (ou 12× no cartão corporativo)' NOT NULL,
  default_delivery_time text DEFAULT '12 dias úteis após aceite e liberação da obra' NOT NULL,
  default_warranty text DEFAULT '24 meses equipamentos · 12 meses mão de obra' NOT NULL,
  proposal_counter integer DEFAULT 0 NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Modalidade de contrato: 'manutencao' é recorrente; 'proposta' é fornecimento/serviço.
ALTER TABLE public.maintenance_contracts ADD COLUMN IF NOT EXISTS contract_kind text DEFAULT 'manutencao' NOT NULL;
ALTER TABLE public.maintenance_contracts ADD COLUMN IF NOT EXISTS contract_value_cents integer DEFAULT 0 NOT NULL;
-- Transcrição manual de propostas de concorrente sem camada de texto.
ALTER TABLE public.reference_files ADD COLUMN IF NOT EXISTS manual_text text;
ALTER TABLE public.reference_files ADD COLUMN IF NOT EXISTS layout_rows jsonb;

-- Complementa instalações antigas. ADD COLUMN IF NOT EXISTS não recria
-- nem sobrescreve uma coluna existente. Todos os campos novos têm default
-- ou aceitam NULL, para preservar os registros já cadastrados.
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS revision integer DEFAULT 1 NOT NULL;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS parent_proposal_id uuid;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS revision_group_id uuid;
ALTER TABLE public.catalog_items ADD COLUMN IF NOT EXISTS supplier_price_cents integer DEFAULT 0 NOT NULL;
ALTER TABLE public.catalog_items ADD COLUMN IF NOT EXISTS margin_pct integer DEFAULT 30 NOT NULL;
ALTER TABLE public.maintenance_contracts ADD COLUMN IF NOT EXISTS proposal_id uuid;
ALTER TABLE public.maintenance_contracts ADD COLUMN IF NOT EXISTS proposal_number text;
ALTER TABLE public.maintenance_contracts ADD COLUMN IF NOT EXISTS proposal_revision integer;
ALTER TABLE public.maintenance_contracts ADD COLUMN IF NOT EXISTS proposal_snapshot jsonb;
ALTER TABLE public.maintenance_contracts ADD COLUMN IF NOT EXISTS contract_text text DEFAULT '' NOT NULL;
ALTER TABLE public.maintenance_contracts ADD COLUMN IF NOT EXISTS document_revision integer DEFAULT 1 NOT NULL;
ALTER TABLE public.maintenance_contracts ADD COLUMN IF NOT EXISTS generation_source text DEFAULT 'modelo' NOT NULL;
ALTER TABLE public.maintenance_readjusts ADD COLUMN IF NOT EXISTS percent_milli integer;
ALTER TABLE public.maintenance_readjusts ADD COLUMN IF NOT EXISTS index_name text DEFAULT 'IPCA' NOT NULL;
ALTER TABLE public.maintenance_readjusts ADD COLUMN IF NOT EXISTS period_start text;
ALTER TABLE public.maintenance_readjusts ADD COLUMN IF NOT EXISTS period_end text;

-- Restrições também idempotentes (não dependem de nomes automáticos).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ipca_history'::regclass
      AND conname = 'ipca_history_month_unique'
  ) THEN
    ALTER TABLE public.ipca_history
      ADD CONSTRAINT ipca_history_month_unique UNIQUE (month);
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS economic_index_month_unique
  ON public.economic_index_values USING btree (index_name, month);

-- Cria somente a identidade padrão, se ainda não existir.
-- Não insere clientes, propostas ou contratos de exemplo.
-- O catálogo técnico é inicializado pelo app, sem preços de fornecedor inventados.
INSERT INTO public.app_settings (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- A empresa não oferece monitoramento 24h: atualiza apenas linhas que ainda
-- têm os textos antigos padrão, sem tocar em personalizações do usuário.
UPDATE public.app_settings
SET tagline = 'Segurança eletrônica IP · Projetos, instalação e manutenção',
    updated_at = now()
WHERE tagline = 'Segurança eletrônica IP · Projetos, instalação e monitoramento';
UPDATE public.app_settings
SET hours = 'Comercial seg–sex 8h–18h · Suporte técnico sob contrato',
    updated_at = now()
WHERE hours = 'NOC 24h · Comercial seg–sex 8h–18h';

-- Monitoramento 24h foi removido do escopo comercial. Sem apagar nada:
-- 1) o item de catálogo fica inativo (não aparece mais nas propostas);
-- 2) nas propostas salvas, as linhas desse serviço saem dos itens e os totais são recalculados.
UPDATE public.catalog_items
SET active = false
WHERE active = true
  AND description ~* '(monitoramento.*noc|noc\s*24|monitoramento\s*24)';

UPDATE public.proposals p
SET subtotal_cents = r.sub_cents,
    total_cents = ROUND(r.sub_cents * (100 - p.discount_pct) / 100.0)::int,
    updated_at = now()
FROM (
  SELECT p2.id,
         COALESCE(SUM(ROUND((e->>'price')::numeric * 100) * GREATEST((e->>'qty')::numeric, 0)), 0)::int AS sub_cents
  FROM public.proposals p2
  LEFT JOIN LATERAL jsonb_array_elements(p2.items) e
    ON NOT (COALESCE(e->>'desc', '') ~* '(monitoramento.*noc|noc\s*24|monitoramento\s*24)')
  WHERE p2.items::text ~* '(monitoramento.*noc|noc\s*24|monitoramento\s*24)'
  GROUP BY p2.id
) r
WHERE r.id = p.id;

UPDATE public.proposals p
SET items = COALESCE((
      SELECT jsonb_agg(e)
      FROM jsonb_array_elements(p.items) e
      WHERE NOT (COALESCE(e->>'desc', '') ~* '(monitoramento.*noc|noc\s*24|monitoramento\s*24)')
    ), '[]'::jsonb),
    updated_at = now()
WHERE p.items::text ~* '(monitoramento.*noc|noc\s*24|monitoramento\s*24)';

COMMIT;

-- Confirmação: o resultado deve ser 14 no database selecionado.
SELECT count(*) AS tabelas_do_aplicativo, current_database() AS database_atual
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'clients', 'proposals', 'activities', 'catalog_items',
    'catalog_price_revisions', 'maintenance_contracts',
    'maintenance_readjusts', 'maintenance_document_revisions',
    'ipca_history', 'economic_index_values', 'reference_files',
    'delivery_terms', 'service_orders', 'app_settings'
  );
