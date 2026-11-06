import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

function resolveDatabaseUrl() {
  const raw =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING;

  if (!raw) {
    throw new Error(
      "DATABASE_URL ausente. Na Vercel, cadastre DATABASE_URL com a string do Neon (a integração também pode criar POSTGRES_URL) e faça Redeploy.",
    );
  }

  // O parâmetro channel_binding quebra o driver pg e derruba todas as páginas na Vercel.
  return raw
    .replace(/([?&])channel_binding=[^&]*/g, "$1")
    .replace(/\?&/g, "?")
    .replace(/[?&]$/, "");
}

function createPool() {
  const connectionString = resolveDatabaseUrl();
  const local = /localhost|127\.0\.0\.1/.test(connectionString);
  return new Pool({
    connectionString,
    max: process.env.VERCEL ? 1 : 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 20_000,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsPostgresqlDb?: ReturnType<typeof drizzle>;
};

export const pool = globalForDb.__arenaNextJsPostgresqlPool ?? createPool();
export const db = globalForDb.__arenaNextJsPostgresqlDb ?? drizzle(pool);

globalForDb.__arenaNextJsPostgresqlPool = pool;
globalForDb.__arenaNextJsPostgresqlDb = db;
