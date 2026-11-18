import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { referenceFiles } from "@/db/schema";
import { ensureSchema } from "@/lib/db-migrations";
import { analyzeReferenceText } from "@/lib/references";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await ensureSchema();
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    note?: string;
    manualText?: string;
  };

  const existingRows = await db
    .select({
      id: referenceFiles.id,
      extractedText: referenceFiles.extractedText,
      manualText: referenceFiles.manualText,
      layoutRows: referenceFiles.layoutRows,
      analysis: referenceFiles.analysis,
    })
    .from(referenceFiles)
    .where(eq(referenceFiles.id, id))
    .limit(1);

  const existing = existingRows[0];
  if (!existing) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  const patch: Partial<typeof referenceFiles.$inferInsert> = {};
  if (body.note !== undefined) {
    patch.note = String(body.note).trim() || null;
  }
  if (body.manualText !== undefined) {
    const manual = String(body.manualText).replace(/\r/g, "").trim();
    patch.manualText = manual || null;
    const sourceText = manual || existing.extractedText || "";
    patch.analysis = {
      ...analyzeReferenceText(sourceText, existing.analysis?.pages ?? null),
      layoutRows: existing.layoutRows ?? undefined,
    };
  }

  await db.update(referenceFiles).set(patch).where(eq(referenceFiles.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await ensureSchema();
  const { id } = await context.params;
  await db.delete(referenceFiles).where(eq(referenceFiles.id, id));
  return NextResponse.json({ ok: true });
}
