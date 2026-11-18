import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { deliveryTerms, proposals } from "@/db/schema";
import { sanitizeDeliveryItems, sanitizeDeliverySections } from "@/lib/delivery-terms";

export const dynamic = "force-dynamic";
const DELIVERY_NUMBER_LOCK = 727_003;

export async function GET() {
  const rows = await db.select().from(deliveryTerms).orderBy(desc(deliveryTerms.createdAt));
  return NextResponse.json({ terms: rows });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const proposalId = String(body.proposalId ?? "");
  const proposalRows = proposalId
    ? await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1)
    : [];
  const proposal = proposalRows[0];
  if (!proposal) return NextResponse.json({ error: "Proposta vinculada não encontrada." }, { status: 404 });
  if (proposal.status !== "ganho") {
    return NextResponse.json({ error: "A proposta precisa estar marcada como ganha." }, { status: 409 });
  }

  const existing = await db.select({ id: deliveryTerms.id, number: deliveryTerms.number })
    .from(deliveryTerms).where(eq(deliveryTerms.proposalId, proposalId)).limit(1);
  if (existing[0]) return NextResponse.json({ error: "Já existe um termo de entrega para esta proposta.", term: existing[0] }, { status: 409 });

  const sections = sanitizeDeliverySections(body.sections);
  if (sections.length < 3) return NextResponse.json({ error: "Gere ou inclua ao menos três blocos no termo." }, { status: 400 });
  const deliveryDate = String(body.deliveryDate ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) || Number.isNaN(Date.parse(`${deliveryDate}T12:00:00Z`))) {
    return NextResponse.json({ error: "Informe uma data de entrega válida." }, { status: 400 });
  }

  const row = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${DELIVERY_NUMBER_LOCK})`);
    const all = await tx.select({ number: deliveryTerms.number }).from(deliveryTerms);
    const year = new Date().getFullYear();
    let highest = 0;
    for (const item of all) {
      const match = /^TDE-\d{4}-(\d+)/.exec(item.number);
      if (match) highest = Math.max(highest, Number(match[1]));
    }
    const number = `TDE-${year}-${String(highest + 1).padStart(4, "0")}`;
    const items = sanitizeDeliveryItems(body.items ?? proposal.items);
    const [created] = await tx.insert(deliveryTerms).values({
      number,
      proposalId,
      proposalNumber: proposal.number,
      proposalRevision: proposal.revision,
      clientId: proposal.clientId,
      clientName: String(body.clientName ?? proposal.clientName).trim().slice(0, 300),
      contact: String(body.contact ?? proposal.contact ?? "").trim().slice(0, 200) || null,
      clientEmail: String(body.clientEmail ?? proposal.clientEmail ?? "").trim().slice(0, 300) || null,
      site: String(body.site ?? proposal.site ?? "").trim().slice(0, 500) || null,
      title: String(body.title ?? "Termo de entrega e aceite técnico").trim().slice(0, 200),
      deliveryDate,
      status: "rascunho",
      items,
      sections,
      generatedByAi: body.generatedByAi === true,
    }).returning();
    return created;
  });
  return NextResponse.json({ term: row }, { status: 201 });
}
