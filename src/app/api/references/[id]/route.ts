import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { referenceFiles } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Serve o arquivo original para leitura no navegador, sem indexar em buscadores. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  const [row] = await db
    .select({
      fileName: referenceFiles.fileName,
      mimeType: referenceFiles.mimeType,
      data: referenceFiles.data,
    })
    .from(referenceFiles)
    .where(eq(referenceFiles.id, id))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });

  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(row.fileName)}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  const body = (await request.json().catch(() => ({}))) as { note?: string };
  const note = String(body.note ?? "").trim().slice(0, 1000);
  const [row] = await db
    .update(referenceFiles)
    .set({ note: note || null })
    .where(eq(referenceFiles.id, id))
    .returning({ id: referenceFiles.id });
  if (!row) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true, note: note || null });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  const rows = await db.delete(referenceFiles).where(eq(referenceFiles.id, id)).returning({ id: referenceFiles.id });
  if (rows.length === 0) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
