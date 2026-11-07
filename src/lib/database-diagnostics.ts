import { getTableName, getTableColumns, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { db, DatabaseConfigurationError, getDatabaseConfigurationStatus, isNeonDatabase } from "@/db";
import * as schema from "@/db/schema";

export type DatabaseDiagnosticCode =
  | "ready" | "env_missing" | "env_invalid" | "auth_failed" | "database_not_found"
  | "unreachable" | "timeout" | "tls_error" | "schema_missing" | "schema_incomplete"
  | "permission_denied" | "read_only" | "connections_exhausted" | "database_error";

export type DatabaseDiagnostics = {
  ok: boolean;
  code: DatabaseDiagnosticCode;
  message: string;
  action: string;
  environment: { configured: boolean; valid: boolean; neon: boolean; pooled: boolean };
  connection: "not_tested" | "connected" | "failed";
  schema: { expectedTables: number; missingTables: string[]; missingColumnCount: number; checked: boolean };
  runtime: "vercel" | "local";
  checkedAt: string;
};

const tables = Object.values(schema).filter((value) => is(value, PgTable)) as PgTable[];
const requirements = tables.map((table) => ({
  name: getTableName(table),
  columns: Object.values(getTableColumns(table)).map((column) => column.name),
}));
const tableNames = requirements.map((table) => table.name);

function safeFailure(error: unknown): { code: DatabaseDiagnosticCode; pgCode?: string } {
  let current: unknown = error;
  const codes: string[] = [];
  const messages: string[] = [];
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth++) {
    if ("code" in current && typeof current.code === "string") codes.push(current.code);
    if ("message" in current && typeof current.message === "string") messages.push(current.message.toLowerCase());
    current = "cause" in current ? current.cause : undefined;
  }
  if (codes.some((code) => ["28P01", "28000"].includes(code))) return { code: "auth_failed", pgCode: codes.find((c) => c.startsWith("28")) };
  if (codes.includes("3D000")) return { code: "database_not_found", pgCode: "3D000" };
  if (codes.includes("42501")) return { code: "permission_denied", pgCode: "42501" };
  if (codes.includes("25006")) return { code: "read_only", pgCode: "25006" };
  if (codes.includes("53300")) return { code: "connections_exhausted", pgCode: "53300" };
  if (codes.some((code) => ["57014", "ETIMEDOUT", "ERR_SOCKET_CONNECTION_TIMEOUT"].includes(code))) return { code: "timeout" };
  if (codes.some((code) => ["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "EAI_AGAIN"].includes(code) || code.startsWith("08"))) return { code: "unreachable" };
  if (codes.some((code) => /CERT|SSL|TLS|ENDPOINT/.test(code))) return { code: "tls_error" };
  const message = messages.join(" ");
  if (/timeout exceeded|connection timeout|query timeout/.test(message)) return { code: "timeout" };
  if (/endpoint id|sni support|certificate|ssl connection|tls connection/.test(message)) return { code: "tls_error" };
  if (/connection terminated|connection refused|could not connect/.test(message)) return { code: "unreachable" };
  return { code: "database_error", pgCode: codes.find((code) => /^[0-9A-Z]{5}$/.test(code)) };
}

const instructions: Record<DatabaseDiagnosticCode, [string, string]> = {
  ready: ["Conexão e estrutura do banco verificadas.", "O aplicativo pode acessar os dados. Se acabou de configurar a Vercel, publique um novo deployment."],
  env_missing: ["A variável DATABASE_URL não está configurada.", "Na Vercel, adicione DATABASE_URL em Settings → Environment Variables para Production. Salve e faça um novo deploy."],
  env_invalid: ["DATABASE_URL não é uma conexão PostgreSQL válida.", "Copie novamente a string no botão Connect do Neon. Use a conexão pooled, sem aspas extras, e publique um novo deployment."],
  auth_failed: ["O Neon recusou as credenciais do banco.", "Confira usuário, senha e banco na string copiada do Neon. Se a senha foi alterada, atualize DATABASE_URL e faça um novo deploy."],
  database_not_found: ["O banco informado na conexão não foi encontrado.", "No Neon, confira o branch e o database selecionados. A conexão da Vercel deve apontar para esse mesmo banco."],
  unreachable: ["Não foi possível conectar ao servidor PostgreSQL.", "Confira se o projeto Neon está ativo e se a URL foi copiada integralmente. Para Vercel, prefira o host com -pooler."],
  timeout: ["A conexão ou consulta excedeu o tempo de espera.", "O compute do Neon pode estar retomando. Tente novamente e confira região, disponibilidade e limites do projeto."],
  tls_error: ["A conexão segura com o banco não pôde ser estabelecida.", "Use a string atual do Neon. O app usa TLS com validação de certificado e SNI; não desative a segurança SSL."],
  schema_missing: ["O banco está acessível, mas as tabelas do aplicativo ainda não existem.", "Abra o SQL Editor do Neon, selecione o mesmo branch e database da Vercel e execute /neon-setup.sql. Depois atualize esta página."],
  schema_incomplete: ["O banco existe, mas sua estrutura está incompleta ou desatualizada.", "Execute o SQL completo de preparação no mesmo database usado pela Vercel. Ele adiciona tabelas e campos sem apagar registros."],
  permission_denied: ["O usuário do banco não tem permissão para acessar a estrutura.", "Use o usuário proprietário informado pelo Neon ou solicite as permissões de leitura e escrita ao administrador."],
  read_only: ["A conexão está em modo somente leitura.", "Use a conexão do compute principal do Neon, não uma réplica ou branch somente leitura."],
  connections_exhausted: ["O limite de conexões do banco foi atingido.", "Use a conexão pooled (-pooler), aguarde a liberação e confira os limites de conexões no painel do Neon."],
  database_error: ["O banco retornou uma falha que precisa ser verificada.", "Consulte Vercel → Deployments → seu deployment → Runtime Logs. O diagnóstico público não exibe credenciais nem detalhes internos."],
};

export async function getDatabaseDiagnostics(): Promise<DatabaseDiagnostics> {
  const configuration = getDatabaseConfigurationStatus();
  let pooled = false;
  try { pooled = new URL(process.env.DATABASE_URL ?? "").hostname.includes("-pooler."); } catch { /* no URL disclosure */ }
  const result: DatabaseDiagnostics = {
    ok: false, code: "env_missing", message: "", action: "",
    environment: { configured: configuration !== "missing", valid: configuration === "ready", neon: isNeonDatabase(), pooled },
    connection: "not_tested",
    schema: { expectedTables: requirements.length, missingTables: tableNames, missingColumnCount: 0, checked: false },
    runtime: process.env.VERCEL ? "vercel" : "local",
    checkedAt: new Date().toISOString(),
  };
  const finish = (code: DatabaseDiagnosticCode) => {
    result.code = code;
    [result.message, result.action] = instructions[code];
    result.ok = code === "ready";
    return result;
  };
  if (configuration !== "ready") return finish(configuration === "missing" ? "env_missing" : "env_invalid");

  try {
    await db.execute(sql`select 1`);
    result.connection = "connected";
    const rows = await db.execute(sql`
      SELECT c.relname AS table_name, a.attname AS column_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
        AND a.attnum > 0 AND NOT a.attisdropped
        AND c.relname IN (${sql.join(tableNames.map((name) => sql`${name}`), sql`, `)})
    `);
    const present = new Set((rows.rows as { table_name: string; column_name: string }[]).map((row) => `${row.table_name}.${row.column_name}`));
    result.schema.missingTables = requirements.filter((table) => !present.has(`${table.name}.${table.columns[0]}`)).map((table) => table.name);
    result.schema.missingColumnCount = requirements.reduce((count, table) => count + table.columns.filter((column) => !present.has(`${table.name}.${column}`)).length, 0);
    result.schema.checked = true;
    if (result.schema.missingTables.length) return finish(result.schema.missingTables.length === requirements.length ? "schema_missing" : "schema_incomplete");
    if (result.schema.missingColumnCount) return finish("schema_incomplete");
    // A read-only probe also distinguishes missing privileges from missing tables.
    await db.execute(sql`SELECT 1 FROM public.app_settings LIMIT 1`);
    return finish("ready");
  } catch (error) {
    const failure = safeFailure(error);
    // Log only a non-sensitive classification, never SQL parameters or connection URLs.
    console.error("[database diagnostic]", { code: failure.code, pgCode: failure.pgCode });
    if (error instanceof DatabaseConfigurationError) return finish("env_missing");
    return finish(failure.code);
  }
}
