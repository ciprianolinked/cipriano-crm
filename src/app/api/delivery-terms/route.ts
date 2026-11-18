import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { deliveryTerms, proposals, type DeliveryTermItem } from "@/db/schema";
import { ensureSchema } from "@/lib/db-migrations";
import { getSettings } from "@/lib/data";
import {
  buildDeliveryTermDraft,
  nextTermNumber,
  polishDeliveryTermWithAI,
} from "@/lib/delivery-term";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function serialize(row: typeof deliveryTerms.$inferSelect) {
  return {
    ...row,
    deliveryDate: row.deliveryDate ? row.deliveryDate.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  await ensureSchema();
  const { searchParams } = new URL(request.url);
  const proposalId = searchParams.get("proposalId");
  const rows = proposalId
    ? await db
        .select()
        .from(deliveryTerms)
        .where(eq(deliveryTerms.proposalId, proposalId))
        .orderBy(desc(deliveryTerms.createdAt))
    : await db.select().from(deliveryTerms).orderBy(desc(deliveryTerms.createdAt));
  return NextResponse.json({ terms: rows.map(serialize) });
}

export async function POST(request: Request) {
  await ensureSchema();
  const body = (await request.json().catch(() => ({}))) as {
    proposalId?: string;
    polish?: boolean;
  };
  const proposalId = String(body.proposalId ?? "").trim();
  if (!proposalId) return NextResponse.json({ error: "Informe a proposta de origem." }, { status: 400 });

  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!proposal) return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });

  const settings = await getSettings();
  const existing = await db.select({ termNumber: deliveryTerms.termNumber }).from(deliveryTerms);
  const draft = buildDeliveryTermDraft(
    {
      id: proposal.id,
      number: proposal.number,
      type: proposal.type,
      clientName: proposal.clientName,
      contact: proposal.contact,
      site: proposal.site,
      totalCents: proposal.totalCents,
      warranty: proposal.warranty,
      deliveryTime: proposal.deliveryTime,
      items: proposal.items,
    },
    {
      companyName: settings.companyName,
      legalName: settings.legalName,
      director: settings.director,
      role: settings.role,
      phone: settings.phone,
      email: settings.email,
      site: settings.site,
      address: settings.address,
      cnpj: settings.cnpj,
      crea: settings.crea,
    },
    nextTermNumber(existing.map((r) => r.termNumber)),
  );

  let aiNote = "Minuta estruturada a partir da proposta. Revise cada campo antes de assinar.";
  if (body.polish !== false) {
    const polished = await polishDeliveryTermWithAI(draft, {
      id: proposal.id,
      number: proposal.number,
      type: proposal.type,
      clientName: proposal.clientName,
      contact: proposal.contact,
      site: proposal.site,
      totalCents: proposal.totalCents,
      warranty: proposal.warranty,
      deliveryTime: proposal.deliveryTime,
      items: proposal.items,
    });
    if (polished) {
      draft.intro = polished.intro;
      draft.scopeSummary = polished.scopeSummary;
      draft.tests = polished.tests;
      aiNote = "Redação refinada por IA a partir dos dados da proposta. Confira números e escopo antes de assinar.";
    } else {
      aiNote += " IA generativa indisponível no momento; a minuta estruturada foi preservada.";
    }
  }

  const [row] = await db
    .insert(deliveryTerms)
    .values({
      proposalId: proposal.id,
      termNumber: draft.termNumber,
      clientName: draft.clientName,
      site: draft.site,
      deliveryDate: new Date(),
      technician: draft.technician,
      receiverName: draft.receiverName,
      receiverDoc: draft.receiverDoc,
      items: draft.items as DeliveryTermItem[],
      intro: draft.intro,
      scopeSummary: draft.scopeSummary,
      tests: draft.tests,
      pendencies: draft.pendencies,
      warranty: draft.warranty,
      observations: draft.observations,
      status: "rascunho",
    })
    .returning();

  return NextResponse.json({ term: serialize(row), aiNote }, { status: 201 });
}
