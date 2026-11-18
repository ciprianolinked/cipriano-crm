import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { deliveryTerms } from "@/db/schema";
import { sanitizeDeliveryItems, sanitizeDeliverySections } from "@/lib/delivery-terms";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const rows = await db.select().from(deliveryTerms).where(eq(deliveryTerms.id, id)).limit(1);
  if (!rows[0]) return NextResponse.json({ error: "Termo de entrega não encontrado." }, { status: 404 });
  return NextResponse.json({ term: rows[0] });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const rows = await db.select().from(deliveryTerms).where(eq(deliveryTerms.id, id)).limit(1);
  if (!rows[0]) return NextResponse.json({ error: "Termo de entrega não encontrado." }, { status: 404 });

  const patch: Partial<typeof deliveryTerms.$inferInsert> = { updatedAt: new Date() };
  if ("clientName" in body) {
    const value = String(body.clientName ?? "").trim();
    if (!value) return NextResponse.json({ error: "Informe o cliente." }, { status: 400 });
    patch.clientName = value.slice(0, 300);
  }
  for (const key of ["contact", "clientEmail", "site"] as const) {
    if (key in body) {
      const value = String(body[key] ?? "").trim();
      patch[key] = value || null;
    }
  }
  if ("title" in body) {
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "Informe o título do termo." }, { status: 400 });
    patch.title = title.slice(0, 200);
  }
  if (typeof body.deliveryDate === "string") {
    const date = body.deliveryDate.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) {
      return NextResponse.json({ error: "Informe uma data de entrega válida." }, { status: 400 });
    }
    patch.deliveryDate = date;
  }
  if (typeof body.status === "string" && ["rascunho", "entregue", "aceito"].includes(body.status)) patch.status = body.status;
  if (Array.isArray(body.sections)) {
    const sections = sanitizeDeliverySections(body.sections);
    if (sections.length < 3) return NextResponse.json({ error: "O termo precisa de ao menos três blocos." }, { status: 400 });
    patch.sections = sections;
  }
  if (Array.isArray(body.items)) patch.items = sanitizeDeliveryItems(body.items);
  if (typeof body.generatedByAi === "boolean") patch.generatedByAi = body.generatedByAi;

  const [updated] = await db.update(deliveryTerms).set(patch).where(eq(deliveryTerms.id, id)).returning();
  return NextResponse.json({ term: updated });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const [deleted] = await db.delete(deliveryTerms).where(eq(deliveryTerms.id, id)).returning({ id: deliveryTerms.id });
  if (!deleted) return NextResponse.json({ error: "Termo de entrega não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
