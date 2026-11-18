import { getDatabaseDiagnostics } from "@/lib/database-diagnostics";
import { ensureSchema } from "@/lib/db-migrations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // Idempotent: adds missing tables/columns without ever deleting data.
  await ensureSchema();
  const diagnostics = await getDatabaseDiagnostics();
  return Response.json(diagnostics, {
    status: diagnostics.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
  });
}
