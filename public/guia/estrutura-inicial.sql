-- Gerencial | Mapa de Cotação
-- Estrutura inicial para um banco PostgreSQL NOVO no Neon.
-- Não insere exemplos nem apaga dados. Tabelas existentes não são alteradas.
-- Este arquivo corresponde às tabelas definidas em src/db/schema.ts.

BEGIN;

CREATE TABLE IF NOT EXISTS "condominiums" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL CONSTRAINT "condominiums_name_unique" UNIQUE,
  "city" text,
  "manager" text,
  "contact_email" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "quotations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "protocol" text NOT NULL,
  "status" text NOT NULL DEFAULT 'em_analise',
  "condominium" text NOT NULL DEFAULT '',
  "analysis_date" date NOT NULL,
  "recipient" text NOT NULL DEFAULT '',
  "service" text NOT NULL DEFAULT '',
  "description" text NOT NULL DEFAULT '',
  "kind" text NOT NULL DEFAULT 'servico',
  "category" text NOT NULL DEFAULT 'Manutenção predial',
  "suppliers" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "items" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "analysis" jsonb NOT NULL DEFAULT '{"summary":"","recommendation":"","notes":""}'::jsonb,
  "attachments" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "quotations_date_idx" ON "quotations" ("analysis_date");

CREATE TABLE IF NOT EXISTS "app_settings" (
  "key" text PRIMARY KEY,
  "value" text NOT NULL DEFAULT '',
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

COMMIT;
