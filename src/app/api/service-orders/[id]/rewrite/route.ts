import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceOrders } from "@/db/schema";
import { ensureSchema } from "@/lib/db-migrations";
import { normalizeOsText, OS_TEXT_FIELDS, OS_TEXT_LABELS, readOsTexts } from "@/lib/os-rewrite";
import { OsRewriteError, rewriteOsTexts } from "@/lib/os-rewrite-ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const json = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

/** Draft in, suggested text out. No database writes and no reliance on saved text. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return json({ error: "Identificador de OS inválido.", code: "invalid_id" }, 400);
  }
  if (Number(request.headers.get("content-length") ?? 0) > 128000) {
    return json({ error: "O texto enviado excede o limite de revisão.", code: "input_too_large" }, 413);
  }
  const body: unknown = await request.json().catch(() => null);
  let source;
  try {
    source = readOsTexts(body && typeof body === "object" && "blocks" in body ? body.blocks : null);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Envie os textos atuais da OS.", code: "invalid_draft" }, 400);
  }
  if (OS_TEXT_FIELDS.every((key) => !source[key].trim())) {
    return json({ error: "Escreva a solicitação, o diagnóstico ou a solução antes de pedir a revisão.", code: "empty_draft" }, 400);
  }
  try {
    await ensureSchema();
    // Only the record identity and context are read. The text comes from the live editor.
    const [os] = await db.select({ id: serviceOrders.id, kind: serviceOrders.kind, status: serviceOrders.status })
      .from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
    if (!os) return json({ error: "OS não encontrada.", code: "not_found" }, 404);
    const context = body && typeof body === "object" && "context" in body ? body.context : null;
    const kind = context && typeof context === "object" && "kind" in context && typeof context.kind === "string" ? context.kind.slice(0, 60) : os.kind;
    const status = context && typeof context === "object" && "status" in context && typeof context.status === "string" ? context.status.slice(0, 60) : os.status;
    const blocks = await rewriteOsTexts(source, { kind, status });
    const changed = OS_TEXT_FIELDS.filter((key) => normalizeOsText(blocks[key]) !== normalizeOsText(source[key]));
    return json({
      blocks, changed, source: "llm",
      message: changed.length
        ? `Revisão concluída: ${changed.map((key) => OS_TEXT_LABELS[key]).join(", ")}. Confira as alterações e salve a OS.`
        : "A IA devolveu o mesmo texto. Nenhuma alteração foi aplicada; a versão atual foi mantida.",
    });
  } catch (error) {
    if (error instanceof OsRewriteError) return json({ error: error.message, code: error.code }, error.status);
    console.error("[os/rewrite] Não foi possível concluir a revisão.");
    return json({ error: "Não foi possível revisar a OS agora. Seus textos foram preservados.", code: "rewrite_failed" }, 503);
  }
}
