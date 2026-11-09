import { NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { parseClientInput } from "@/lib/client-input";
import { normalizeDocument } from "@/lib/cnpj";

export const dynamic = "force-dynamic";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let values: ReturnType<typeof parseClientInput>;
  try { values = parseClientInput(await request.json(), true); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Dados inválidos." }, { status: 400 }); }
  if (values.document) {
    const [existing] = await db.select({ id: clients.id }).from(clients).where(and(ne(clients.id, id), sql`upper(regexp_replace(${clients.document}, '[^a-zA-Z0-9]', '', 'g')) = ${normalizeDocument(values.document)}`)).limit(1);
    if (existing) return NextResponse.json({ error: "Já existe outro cliente com esse documento." }, { status: 409 });
  }
  const [row] = await db.update(clients).set({ ...values, name: values.name ?? undefined, updatedAt: new Date() }).where(eq(clients.id, id)).returning();
  if (!row) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  return NextResponse.json({ client: row });
}
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(clients).where(eq(clients.id, id));
  return NextResponse.json({ ok: true });
}
