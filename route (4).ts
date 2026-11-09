import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { ensureBootstrap, listClients } from "@/lib/data";
import { parseClientInput } from "@/lib/client-input";
import { normalizeDocument } from "@/lib/cnpj";

export const dynamic = "force-dynamic";
export async function GET() { await ensureBootstrap(); return NextResponse.json({ clients: await listClients() }); }
export async function POST(request: Request) {
  let values: ReturnType<typeof parseClientInput>;
  try { values = parseClientInput(await request.json()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Dados inválidos." }, { status: 400 }); }
  if (values.document) {
    const [existing] = await db.select({ id: clients.id }).from(clients).where(sql`upper(regexp_replace(${clients.document}, '[^a-zA-Z0-9]', '', 'g')) = ${normalizeDocument(values.document)}`).limit(1);
    if (existing) return NextResponse.json({ error: "Já existe um cliente com esse documento. Localize-o na lista para editar.", clientId: existing.id }, { status: 409 });
  }
  const [row] = await db.insert(clients).values({ ...values, name: values.name! }).returning();
  return NextResponse.json({ client: row }, { status: 201 });
}
