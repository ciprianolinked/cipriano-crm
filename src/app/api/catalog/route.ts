import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { catalogItems, catalogPriceRevisions } from "@/db/schema";
import { ensureBootstrap, listCatalog } from "@/lib/data";
import { salePriceFromSupplier } from "@/lib/proposal/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureBootstrap();
  return NextResponse.json({ items: await listCatalog() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;

  // Suporta um item único ou uma lista de itens extraídos por IA (anexo).
  const single = body.items === undefined;
  const rawItems = single ? [body] : (Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : []);

  if (!rawItems.length) {
    return NextResponse.json({ error: "Informe ao menos um item." }, { status: 400 });
  }

  const inserted = [];
  for (const item of rawItems) {
    const description = String(item.description ?? "").trim();
    if (!description) continue;
    const supplierPrice = Math.round((Number(item.supplierPrice ?? item.price ?? 0) || 0) * 100);
    const margin = Math.max(0, Math.min(100, Number(item.margin ?? item.marginPct ?? 30)));
    const priceCents = salePriceFromSupplier(supplierPrice, margin);
    const row = await db
      .insert(catalogItems)
      .values({
        kind: String(item.kind ?? "equipamento"),
        category: String(item.category ?? "CFTV"),
        description,
        spec: String(item.spec ?? ""),
        unit: String(item.unit ?? "un"),
        supplierPriceCents: supplierPrice,
        marginPct: margin,
        priceCents: priceCents,
      })
      .returning();
    inserted.push(row);
  }

  if (!inserted.length) {
    return NextResponse.json({ error: "Nenhum item válido para adicionar." }, { status: 400 });
  }
  return NextResponse.json({ items: inserted }, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
  const current = await db.select().from(catalogItems).where(eq(catalogItems.id, id)).limit(1);
  if (current.length === 0) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
  const cur = current[0];

  const supplierPrice =
    body.supplierPrice !== undefined
      ? Math.round((Number(body.supplierPrice ?? 0) || 0) * 100)
      : cur.supplierPriceCents;
  const margin =
    body.margin !== undefined || body.marginPct !== undefined
      ? Math.max(0, Math.min(100, Number(body.margin ?? body.marginPct ?? cur.marginPct)))
      : cur.marginPct;
  const priceCents = salePriceFromSupplier(supplierPrice, margin);

  const patch: Record<string, unknown> = { priceCents, supplierPriceCents: supplierPrice, marginPct: margin };
  if ("description" in body) patch.description = String(body.description);
  if ("spec" in body) patch.spec = String(body.spec);
  if ("kind" in body) patch.kind = String(body.kind);
  if ("category" in body) patch.category = String(body.category);
  if ("unit" in body) patch.unit = String(body.unit);
  if ("active" in body) patch.active = Boolean(body.active);

  const [row] = await db.update(catalogItems).set(patch).where(eq(catalogItems.id, id)).returning();
  return NextResponse.json({ item: row });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
  await db.delete(catalogItems).where(eq(catalogItems.id, id));
  return NextResponse.json({ ok: true });
}
