/** SQL idempotente para colar no SQL Editor do Neon. Pode ser executado mais de uma vez. */
export const neonSchemaSql = `-- Cipriano Tech & Security
-- Cole este script no SQL Editor do Neon e clique em Run.
-- Ele cria o banco do app e também completa colunas de versões anteriores.
-- Pode ser executado mais de uma vez sem apagar dados.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL,
  type text NOT NULL DEFAULT 'completa',
  status text NOT NULL DEFAULT 'novo',
  archived boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1,
  parent_proposal_id uuid,
  revision_group_id uuid,
  client_id uuid,
  client_name text NOT NULL,
  contact text,
  client_email text,
  site text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  validity_days integer NOT NULL DEFAULT 15,
  discount_pct integer NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  payment_terms text,
  delivery_time text,
  warranty text,
  art_included boolean NOT NULL DEFAULT false,
  subtotal_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  briefing jsonb,
  next_action_at timestamptz,
  next_action_note text,
  sent_at timestamptz,
  closed_at timestamptz,
  loss_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'nota',
  content text NOT NULL,
  due_at timestamptz,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'equipamento',
  category text NOT NULL DEFAULT 'CFTV',
  description text NOT NULL,
  spec text,
  unit text NOT NULL DEFAULT 'un',
  supplier_price_cents integer NOT NULL DEFAULT 0,
  margin_pct integer NOT NULL DEFAULT 30,
  price_cents integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  client_name text NOT NULL,
  title text NOT NULL,
  description text,
  proposal_id uuid,
  proposal_number text,
  proposal_revision integer,
  proposal_snapshot jsonb,
  contract_text text NOT NULL DEFAULT '',
  document_revision integer NOT NULL DEFAULT 1,
  generation_source text NOT NULL DEFAULT 'modelo',
  monthly_cents integer NOT NULL DEFAULT 0,
  start_date timestamptz NOT NULL DEFAULT now(),
  cycle_months integer NOT NULL DEFAULT 12,
  index_name text NOT NULL DEFAULT 'IPCA',
  status text NOT NULL DEFAULT 'ativo',
  last_readjust_at timestamptz,
  next_readjust_at timestamptz,
  last_readjust_pct integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_readjusts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL,
  readjust_at timestamptz NOT NULL DEFAULT now(),
  old_monthly_cents integer NOT NULL DEFAULT 0,
  new_monthly_cents integer NOT NULL DEFAULT 0,
  ipca_pct integer NOT NULL DEFAULT 0,
  percent_milli integer,
  index_name text NOT NULL DEFAULT 'IPCA',
  period_start text,
  period_end text,
  source text NOT NULL DEFAULT 'ipca',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ipca_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL UNIQUE,
  pct integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS economic_index_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  index_name text NOT NULL,
  month text NOT NULL,
  percent_milli integer NOT NULL,
  source text NOT NULL DEFAULT 'bcb',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS economic_index_month_unique
  ON economic_index_values (index_name, month);

CREATE TABLE IF NOT EXISTS maintenance_document_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL,
  revision integer NOT NULL,
  body text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  id text PRIMARY KEY DEFAULT 'default',
  company_name text NOT NULL DEFAULT 'Cipriano Tech & Security',
  legal_name text NOT NULL DEFAULT 'Cipriano Tecnologia e Segurança Eletrônica LTDA',
  tagline text NOT NULL DEFAULT 'Segurança eletrônica IP · Projetos, instalação e monitoramento',
  director text NOT NULL DEFAULT 'Gabriel Cipriano',
  role text NOT NULL DEFAULT 'Diretor Técnico',
  phone text NOT NULL DEFAULT '+55 (12) 99701-1890',
  landline text NOT NULL DEFAULT '+55 (12) 99701-1890',
  email text NOT NULL DEFAULT 'gabriel.ciprianotech@gmail.com',
  site text NOT NULL DEFAULT 'ciprianotech.com.br',
  address text NOT NULL DEFAULT 'Alameda Raul Roldão da Costa, 183 - Vila Betania, São José dos Campos - SP, 12245-484',
  cnpj text NOT NULL DEFAULT '69.978.603/0001-69',
  crea text NOT NULL DEFAULT 'CREA-SP 5071138295-SP',
  hours text NOT NULL DEFAULT 'NOC 24h · Comercial seg–sex 8h–18h',
  default_validity_days integer NOT NULL DEFAULT 15,
  default_payment_terms text NOT NULL DEFAULT '40% de entrada na assinatura · 60% na entrega técnica (ou 12× no cartão corporativo)',
  default_delivery_time text NOT NULL DEFAULT '12 dias úteis após aceite e liberação da obra',
  default_warranty text NOT NULL DEFAULT '24 meses equipamentos · 12 meses mão de obra',
  proposal_counter integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Completa instalações antigas sem apagar dados.
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS parent_proposal_id uuid;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS revision_group_id uuid;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS supplier_price_cents integer NOT NULL DEFAULT 0;
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS margin_pct integer NOT NULL DEFAULT 30;
ALTER TABLE maintenance_contracts ADD COLUMN IF NOT EXISTS proposal_id uuid;
ALTER TABLE maintenance_contracts ADD COLUMN IF NOT EXISTS proposal_number text;
ALTER TABLE maintenance_contracts ADD COLUMN IF NOT EXISTS proposal_revision integer;
ALTER TABLE maintenance_contracts ADD COLUMN IF NOT EXISTS proposal_snapshot jsonb;
ALTER TABLE maintenance_contracts ADD COLUMN IF NOT EXISTS contract_text text NOT NULL DEFAULT '';
ALTER TABLE maintenance_contracts ADD COLUMN IF NOT EXISTS document_revision integer NOT NULL DEFAULT 1;
ALTER TABLE maintenance_contracts ADD COLUMN IF NOT EXISTS generation_source text NOT NULL DEFAULT 'modelo';
ALTER TABLE maintenance_readjusts ADD COLUMN IF NOT EXISTS percent_milli integer;
ALTER TABLE maintenance_readjusts ADD COLUMN IF NOT EXISTS index_name text NOT NULL DEFAULT 'IPCA';
ALTER TABLE maintenance_readjusts ADD COLUMN IF NOT EXISTS period_start text;
ALTER TABLE maintenance_readjusts ADD COLUMN IF NOT EXISTS period_end text;

INSERT INTO app_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- Conferência: deve listar as 10 tabelas do app.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;`;
