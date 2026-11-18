import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { referenceFiles } from "@/db/schema";
import {
  analyzeStoredText,
  ensureReferenceTable,
  getReferenceRow,
  toReferenceFile,
} from "@/lib/references-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

/** Serves the original bytes so the user can open the competitor document again. */
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  try {
    await ensureReferenceTable();
    const row = await getReferenceRow(id);
    if (!row) return json({ error: "Arquivo não encontrado." }, 404);
    const attachment = new URL(request.url).searchParams.get("download") === "1";
    const safe = row.fileName.replace(/["\\\r\n]/g, "_");
    return new Response(new Uint8Array(row.data), {
      headers: {
        "Content-Type": row.mimeType || "application/octet-stream",
        "Content-Length": String(row.sizeBytes),
        "Content-Disposition": `${attachment ? "attachment" : "inline"}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[references] Falha ao abrir:", (error as Error)?.message);
    return json({ error: "Não foi possível abrir o arquivo." }, 503);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  try {
    await ensureReferenceTable();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const current = await getReferenceRow(id);
    if (!current) return json({ error: "Arquivo não encontrado." }, 404);

    const patch: Partial<typeof referenceFiles.$inferInsert> = {};
    if ("note" in body) patch.note = String(body.note ?? "").trim().slice(0, 2000) || null;
    if ("manualText" in body) {
      const manual = String(body.manualText ?? "").replace(/\r/g, "").slice(0, 200000) || null;
      patch.manualText = manual;
      patch.analysis = analyzeStoredText(manual ?? "", current.analysis?.pages ?? null);
    }
    if (!Object.keys(patch).length) return json({ error: "Nada para atualizar." }, 400);

    const [row] = await db.update(referenceFiles).set(patch).where(eq(referenceFiles.id, id)).returning();
    return json({ file: toReferenceFile(row) });
  } catch (error) {
    console.error("[references] Falha ao atualizar:", (error as Error)?.message);
    return json({ error: "Não foi possível salvar a alteração." }, 503);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  try {
    await ensureReferenceTable();
    await db.delete(referenceFiles).where(eq(referenceFiles.id, id));
    return json({ ok: true });
  } catch (error) {
    console.error("[references] Falha ao excluir:", (error as Error)?.message);
    return json({ error: "Não foi possível excluir o arquivo." }, 503);
  }
}
