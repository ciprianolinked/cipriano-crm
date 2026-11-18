import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { deliveryTerms, type DeliveryTermItem } from "@/db/schema";
import { ensureSchema } from "@/lib/db-migrations";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

function serialize(row: typeof deliveryTerms.$inferSelect) {
  return {
    ...row,
    deliveryDate: row.deliveryDate ? row.deliveryDate.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(_request: Request, { params }: Context) {
  await ensureSchema();
  const { id } = await params;
  const [row] = await db.select().from(deliveryTerms).where(eq(deliveryTerms.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "Termo não encontrado." }, { status: 404 });
  return NextResponse.json({ term: serialize(row) });
}

export async function PATCH(request: Request, { params }: Context) {
  await ensureSchema();
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  for (const key of [
    "clientName",
    "site",
    "technician",
    "receiverName",
    "receiverDoc",
    "intro",
    "scopeSummary",
    "tests",
    "pendencies",
    "warranty",
    "observations",
    "status",
  ]) {
    if (key in body) patch[key] = body[key] === null ? null : String(body[key] ?? "");
  }
  if ("deliveryDate" in body) {
    patch.deliveryDate = body.deliveryDate ? new Date(String(body.deliveryDate)) : null;
  }
  if (Array.isArray(body.items)) {
    patch.items = (body.items as Record<string, unknown>[]).map((item, index) => ({
      id: String(item.id ?? `dt-${index}`),
      desc: String(item.desc ?? ""),
      spec: String(item.spec ?? ""),
      unit: String(item.unit ?? "un"),
      qty: Math.max(0, Number(item.qty ?? 0) || 0),
      checked: Boolean(item.checked),
      serial: String(item.serial ?? ""),
      obs: String(item.obs ?? ""),
    })) as DeliveryTermItem[];
  }

  const [row] = await db.update(deliveryTerms).set(patch).where(eq(deliveryTerms.id, id)).returning();
  if (!row) return NextResponse.json({ error: "Termo não encontrado." }, { status: 404 });
  return NextResponse.json({ term: serialize(row) });
}

export async function DELETE(_request: Request, { params }: Context) {
  await ensureSchema();
  const { id } = await params;
  await db.delete(deliveryTerms).where(eq(deliveryTerms.id, id));
  return NextResponse.json({ ok: true });
}
