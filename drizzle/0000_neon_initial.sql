CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"kind" text DEFAULT 'nota' NOT NULL,
	"content" text NOT NULL,
	"due_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"company_name" text DEFAULT 'Cipriano Tech & Security' NOT NULL,
	"legal_name" text DEFAULT 'Cipriano Tecnologia e Segurança Eletrônica LTDA' NOT NULL,
	"tagline" text DEFAULT 'Segurança eletrônica IP · Projetos, instalação e monitoramento' NOT NULL,
	"director" text DEFAULT 'Gabriel Cipriano' NOT NULL,
	"role" text DEFAULT 'Diretor Técnico' NOT NULL,
	"phone" text DEFAULT '+55 (12) 99701-1890' NOT NULL,
	"landline" text DEFAULT '+55 (12) 99701-1890' NOT NULL,
	"email" text DEFAULT 'gabriel.ciprianotech@gmail.com' NOT NULL,
	"site" text DEFAULT 'ciprianotech.com.br' NOT NULL,
	"address" text DEFAULT 'Alameda Raul Roldão da Costa, 183 - Vila Betania, São José dos Campos - SP, 12245-484' NOT NULL,
	"cnpj" text DEFAULT '69.978.603/0001-69' NOT NULL,
	"crea" text DEFAULT 'CREA-SP 5071138295-SP' NOT NULL,
	"hours" text DEFAULT 'NOC 24h · Comercial seg–sex 8h–18h' NOT NULL,
	"default_validity_days" integer DEFAULT 15 NOT NULL,
	"default_payment_terms" text DEFAULT '40% de entrada na assinatura · 60% na entrega técnica (ou 12× no cartão corporativo)' NOT NULL,
	"default_delivery_time" text DEFAULT '12 dias úteis após aceite e liberação da obra' NOT NULL,
	"default_warranty" text DEFAULT '24 meses equipamentos · 12 meses mão de obra' NOT NULL,
	"proposal_counter" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text DEFAULT 'equipamento' NOT NULL,
	"category" text DEFAULT 'CFTV' NOT NULL,
	"description" text NOT NULL,
	"spec" text,
	"unit" text DEFAULT 'un' NOT NULL,
	"supplier_price_cents" integer DEFAULT 0 NOT NULL,
	"margin_pct" integer DEFAULT 30 NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"company" text,
	"contact_name" text,
	"email" text,
	"phone" text,
	"document" text,
	"address" text,
	"city" text,
	"state" text,
	"segment" text,
	"source" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "economic_index_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"index_name" text NOT NULL,
	"month" text NOT NULL,
	"percent_milli" integer NOT NULL,
	"source" text DEFAULT 'bcb' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ipca_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" text NOT NULL,
	"pct" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ipca_history_month_unique" UNIQUE("month")
);
--> statement-breakpoint
CREATE TABLE "maintenance_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"client_name" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"proposal_id" uuid,
	"proposal_number" text,
	"proposal_revision" integer,
	"proposal_snapshot" jsonb,
	"contract_text" text DEFAULT '' NOT NULL,
	"document_revision" integer DEFAULT 1 NOT NULL,
	"generation_source" text DEFAULT 'modelo' NOT NULL,
	"monthly_cents" integer DEFAULT 0 NOT NULL,
	"start_date" timestamp with time zone DEFAULT now() NOT NULL,
	"cycle_months" integer DEFAULT 12 NOT NULL,
	"index_name" text DEFAULT 'IPCA' NOT NULL,
	"status" text DEFAULT 'ativo' NOT NULL,
	"last_readjust_at" timestamp with time zone,
	"next_readjust_at" timestamp with time zone,
	"last_readjust_pct" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_document_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"body" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_readjusts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"readjust_at" timestamp with time zone DEFAULT now() NOT NULL,
	"old_monthly_cents" integer DEFAULT 0 NOT NULL,
	"new_monthly_cents" integer DEFAULT 0 NOT NULL,
	"ipca_pct" integer DEFAULT 0 NOT NULL,
	"percent_milli" integer,
	"index_name" text DEFAULT 'IPCA' NOT NULL,
	"period_start" text,
	"period_end" text,
	"source" text DEFAULT 'ipca' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"type" text DEFAULT 'completa' NOT NULL,
	"status" text DEFAULT 'novo' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"parent_proposal_id" uuid,
	"revision_group_id" uuid,
	"client_id" uuid,
	"client_name" text NOT NULL,
	"contact" text,
	"client_email" text,
	"site" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"validity_days" integer DEFAULT 15 NOT NULL,
	"discount_pct" integer DEFAULT 0 NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payment_terms" text,
	"delivery_time" text,
	"warranty" text,
	"art_included" boolean DEFAULT false NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"briefing" jsonb,
	"next_action_at" timestamp with time zone,
	"next_action_note" text,
	"sent_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"loss_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "economic_index_month_unique" ON "economic_index_values" USING btree ("index_name","month");