import { sql } from "drizzle-orm";
import { db } from "@/db";

type SchemaState = { at: number; ok: boolean; promise: Promise<boolean> | null };

const globalForSchema = globalThis as typeof globalThis & {
  __ciprianoSchema?: SchemaState;
};
const state: SchemaState = (globalForSchema.__ciprianoSchema ??= {
  at: 0,
  ok: false,
  promise: null,
});

const TTL_MS = 5 * 60 * 1000;

const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS catalog_price_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    item_description text NOT NULL,
    old_supplier_cents integer NOT NULL DEFAULT 0,
    new_supplier_cents integer NOT NULL DEFAULT 0,
    old_sale_cents integer NOT NULL DEFAULT 0,
    new_sale_cents integer NOT NULL DEFAULT 0,
    margin_pct integer NOT NULL DEFAULT 0,
    note text,
    created_at timestamptz DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS maintenance_contracts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid,
    client_name text NOT NULL,
    title text NOT NULL,
    description text,
    contract_kind text NOT NULL DEFAULT 'manutencao',
    contract_value_cents integer NOT NULL DEFAULT 0,
    proposal_id uuid,
    proposal_number text,
    proposal_revision integer,
    proposal_snapshot jsonb,
    contract_text text NOT NULL DEFAULT '',
    document_revision integer NOT NULL DEFAULT 1,
    generation_source text NOT NULL DEFAULT 'modelo',
    monthly_cents integer NOT NULL DEFAULT 0,
    start_date timestamptz DEFAULT now() NOT NULL,
    cycle_months integer NOT NULL DEFAULT 12,
    index_name text NOT NULL DEFAULT 'IPCA',
    status text NOT NULL DEFAULT 'ativo',
    last_readjust_at timestamptz,
    next_readjust_at timestamptz,
    last_readjust_pct integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS maintenance_readjusts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    contract_id uuid NOT NULL,
    readjust_at timestamptz DEFAULT now() NOT NULL,
    old_monthly_cents integer NOT NULL DEFAULT 0,
    new_monthly_cents integer NOT NULL DEFAULT 0,
    ipca_pct integer NOT NULL DEFAULT 0,
    percent_milli integer,
    index_name text NOT NULL DEFAULT 'IPCA',
    period_start text,
    period_end text,
    source text NOT NULL DEFAULT 'ipca',
    note text,
    created_at timestamptz DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS maintenance_document_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    contract_id uuid NOT NULL,
    revision integer NOT NULL,
    body text NOT NULL,
    note text NOT NULL DEFAULT '',
    created_at timestamptz DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS reference_files (
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
  )`,
  `ALTER TABLE reference_files ADD COLUMN IF NOT EXISTS manual_text text`,
  `ALTER TABLE reference_files ADD COLUMN IF NOT EXISTS layout_rows jsonb`,
  `ALTER TABLE maintenance_contracts ADD COLUMN IF NOT EXISTS contract_kind text DEFAULT 'manutencao' NOT NULL`,
  `ALTER TABLE maintenance_contracts ADD COLUMN IF NOT EXISTS contract_value_cents integer DEFAULT 0 NOT NULL`,
];

/**
 * Cria as novas tabelas de forma idempotente, caso o deploy chegue antes da
 * execução manual do SQL. Nunca apaga dados.
 */
async function migrate(): Promise<boolean> {
  try {
    for (const sqlStatement of MIGRATIONS) {
      await db.execute(sql.raw(sqlStatement));
    }
    return true;
  } catch (error) {
    console.error("[schema] Não foi possível preparar as tabelas:", (error as Error)?.message);
    return false;
  }
}

export function ensureSchema(force = false): Promise<boolean> {
  const fresh = state.ok && Date.now() - state.at < TTL_MS;
  if (!force && fresh) return Promise.resolve(true);
  if (!state.promise) {
    state.promise = migrate()
      .then((ok) => {
        state.ok = ok;
        state.at = Date.now();
        state.promise = null;
        return ok;
      })
      .catch(() => {
        state.promise = null;
        return false;
      });
  }
  return state.promise;
}
