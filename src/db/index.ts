import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

export class DatabaseConfigurationError extends Error {
  readonly code = "DATABASE_NOT_CONFIGURED";
  constructor() {
    super("DATABASE_URL não configurada neste ambiente.");
    this.name = "DatabaseConfigurationError";
  }
}

type DatabaseCache = {
  pool?: Pool;
  db?: NodePgDatabase;
  fingerprint?: string;
};
const globalForDb = globalThis as typeof globalThis & { __ciprianoDatabase?: DatabaseCache };
const cache = (globalForDb.__ciprianoDatabase ??= {});

/** Validate without ever including credentials in an error message. */
export function getDatabaseConfigurationStatus(): "ready" | "missing" | "invalid" {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) return "missing";
  try {
    const url = new URL(value);
    return ["postgresql:", "postgres:"].includes(url.protocol) && url.hostname && url.pathname.length > 1
      ? "ready"
      : "invalid";
  } catch {
    return "invalid";
  }
}

export function isNeonDatabase(): boolean {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

function createDatabase(): NodePgDatabase {
  const raw = process.env.DATABASE_URL?.trim();
  if (getDatabaseConfigurationStatus() !== "ready" || !raw) throw new DatabaseConfigurationError();
  const url = new URL(raw);
  const neon = url.hostname.endsWith(".neon.tech");
  const explicitSsl = ["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode") ?? "");
  const secureConnection = neon || explicitSsl || process.env.PGSSLMODE === "require";

  // pg replaces explicit SSL options when these query parameters are present.
  // Keep the original environment secret untouched; normalize only the driver URL.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat"]) {
    url.searchParams.delete(key);
  }

  const fingerprint = `${url.toString()}|${process.env.PGSSLROOTCERT ?? ""}`;
  if (cache.db && cache.fingerprint === fingerprint) return cache.db;

  const config: PoolConfig = {
    connectionString: url.toString(),
    max: 3,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 15_000,
    allowExitOnIdle: true,
    application_name: "cipriano-tech-security",
  };
  if (secureConnection) {
    config.ssl = {
      rejectUnauthorized: true,
      servername: url.hostname,
      ...(process.env.PGSSLROOTCERT ? { ca: process.env.PGSSLROOTCERT } : {}),
    };
  }

  // Never log connection strings or the underlying driver error (it may contain one).
  const previous = cache.pool;
  const pool = new Pool(config);
  pool.on("error", () => {
    // The next query reports a safe, actionable error; idle sockets may be recycled by Neon.
  });
  cache.pool = pool;
  cache.db = drizzle(pool);
  cache.fingerprint = fingerprint;
  if (previous) void previous.end().catch(() => undefined);
  return cache.db;
}

/** Lazy initialization lets the publishing guide load even before DATABASE_URL exists. */
export const db = new Proxy({} as NodePgDatabase, {
  get(_target, property) {
    const database = createDatabase();
    const value = Reflect.get(database, property, database);
    return typeof value === "function" ? value.bind(database) : value;
  },
});

// Backwards-compatible export. It is initialized on first use, not at module import.
export const pool = new Proxy({} as Pool, {
  get(_target, property) {
    createDatabase();
    const value = Reflect.get(cache.pool!, property, cache.pool);
    return typeof value === "function" ? value.bind(cache.pool) : value;
  },
});
