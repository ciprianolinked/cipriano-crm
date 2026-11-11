import { sql } from "drizzle-orm";
import { db } from "@/db";

type SchemaState = { at: number; ok: boolean; promise: Promise<boolean> | null };

const globalForSchema = globalThis as typeof globalThis & {
  __ciprianoReferenceSchema?: SchemaState;
};
const state: SchemaState = (globalForSchema.__ciprianoReferenceSchema ??= {
  at: 0,
  ok: false,
  promise: null,
});

const TTL_MS = 5 * 60 * 1000;

/**
 * Cria/atualiza a tabela de concorrentes de forma idempotente. Nunca apaga dados.
 * Isso evita HTTP 500 quando o deploy chega antes da execução manual do SQL no Neon.
 */
async function migrate(): Promise<boolean> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reference_files (
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
      )
    `);
    await db.execute(sql`ALTER TABLE reference_files ADD COLUMN IF NOT EXISTS manual_text text`);
    await db.execute(sql`ALTER TABLE reference_files ADD COLUMN IF NOT EXISTS layout_rows jsonb`);
    await db.execute(sql`ALTER TABLE reference_files ADD COLUMN IF NOT EXISTS extracted_text text`);
    await db.execute(sql`ALTER TABLE reference_files ADD COLUMN IF NOT EXISTS analysis jsonb`);
    return true;
  } catch (error) {
    console.error("[references] Não foi possível preparar a tabela:", (error as Error)?.message);
    return false;
  }
}

export function ensureReferenceSchema(force = false): Promise<boolean> {
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

/** Detecta coluna ausente (PostgreSQL 42703). */
export function isUndefinedColumn(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    const code = (current as { code?: string }).code;
    if (code === "42703") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Executa a consulta e, se o banco reclamar de coluna ausente, recria a estrutura
 * e repete uma única vez. Assim a API se recupera sem intervenção manual.
 */
export async function withReferenceSchema<T>(run: () => Promise<T>): Promise<T> {
  await ensureReferenceSchema();
  try {
    return await run();
  } catch (error) {
    if (!isUndefinedColumn(error)) throw error;
    await ensureReferenceSchema(true);
    return run();
  }
}
