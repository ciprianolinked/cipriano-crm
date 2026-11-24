import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, proposals, serviceOrders } from "@/db/schema";
import { ensureSchema } from "@/lib/db-migrations";
import { getSettings, nextProposalNumber } from "@/lib/data";
import { calcTotals } from "@/lib/proposal/catalog";
import { buildBudgetDraft, soPartsCents } from "@/lib/service-orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

/**
 * Gera o orçamento da OS como proposta comercial e grava o vínculo nos dois lados:
 * a OS guarda budgetProposalId/number e a proposta guarda briefing.osId/osNumber.
 * Sem `{ regenerate: true }`, reaproveita o orçamento existente (abrir para correção).
 */
export async function POST(request: Request, { params }: Context) {
  await ensureSchema();
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { regenerate?: boolean };

  const [os] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
  if (!os) return NextResponse.json({ error: "OS não encontrada." }, { status: 404 });

  // Reaproveita o orçamento já gerado: o usuário abre a proposta para corrigir.
  if (os.budgetProposalId && !body.regenerate) {
    const [existing] = await db.select().from(proposals).where(eq(proposals.id, os.budgetProposalId)).limit(1);
    if (existing) {
      return NextResponse.json({
        proposalId: existing.id,
        proposalNumber: existing.number,
        totalCents: existing.totalCents,
        reused: true,
        message: `A OS ${os.number} já possui o orçamento ${existing.number}. Abra a proposta para corrigir valores e textos.`,
      });
    }
  }

  const parts = soPartsCents(os);
  if (parts.totalCents <= 0) {
    return NextResponse.json(
      { error: "Inclua peças cobráveis ou mão de obra antes de gerar o orçamento." },
      { status: 400 },
    );
  }

  const settings = await getSettings();
  const draft = buildBudgetDraft(
    {
      id: os.id,
      number: os.number,
      kind: os.kind,
      clientName: os.clientName,
      contact: os.contact,
      email: os.email,
      phone: os.phone,
      site: os.site,
      description: os.description,
      diagnosis: os.diagnosis,
      solution: os.solution,
      items: os.items,
      laborCents: os.laborCents,
      notes: os.notes,
      technician: os.technician,
    },
    {
      defaultValidityDays: settings.defaultValidityDays,
      defaultPaymentTerms: settings.defaultPaymentTerms,
      defaultDeliveryTime: settings.defaultDeliveryTime,
      defaultWarranty: settings.defaultWarranty,
      companyName: settings.companyName,
      crea: settings.crea,
    },
  );

  const totals = calcTotals(draft.items, draft.discountPct);
  const number = await nextProposalNumber();

  // Correção de um orçamento já emitido: a nova versão mantém a família de revisões.
  let parentProposalId: string | null = null;
  let revisionGroupId: string | null = null;
  let revision = 1;
  if (os.budgetProposalId) {
    const [previous] = await db.select().from(proposals).where(eq(proposals.id, os.budgetProposalId)).limit(1);
    if (previous) {
      parentProposalId = previous.id;
      revisionGroupId = previous.revisionGroupId ?? previous.id;
      revision = previous.revision + 1;
    }
  }

  const [row] = await db
    .insert(proposals)
    .values({
      number,
      type: draft.type,
      status: "novo",
      clientId: os.clientId,
      clientName: draft.clientName,
      contact: draft.contact,
      clientEmail: draft.clientEmail,
      site: draft.site,
      validityDays: draft.validityDays,
      discountPct: draft.discountPct,
      items: draft.items,
      sections: draft.sections,
      paymentTerms: draft.paymentTerms,
      deliveryTime: draft.deliveryTime,
      warranty: draft.warranty,
      artIncluded: false,
      subtotalCents: totals.subtotalCents,
      totalCents: totals.totalCents,
      briefing: draft.briefing as unknown as Record<string, unknown>,
      nextActionAt: new Date(),
      nextActionNote: `Orçamento da OS ${os.number}: revisar e enviar ao cliente.`,
      parentProposalId,
      revisionGroupId,
      revision,
    })
    .returning();

  await db
    .update(serviceOrders)
    .set({
      budgetProposalId: row.id,
      budgetProposalNumber: row.number,
      budgetTotalCents: totals.totalCents,
      budgetIssuedAt: new Date(),
      status: os.status === "aguardando_orcamento" || os.status === "aberta" ? "aguardando_aprovacao" : os.status,
      updatedAt: new Date(),
    })
    .where(eq(serviceOrders.id, os.id));

  await db.insert(activities).values({
    proposalId: row.id,
    kind: "sistema",
    content: `Orçamento ${number} gerado pela OS ${os.number}${parentProposalId ? ` (correção de ${os.budgetProposalNumber})` : ""}.`,
    doneAt: new Date(),
  });

  return NextResponse.json(
    {
      proposalId: row.id,
      proposalNumber: row.number,
      totalCents: totals.totalCents,
      reused: false,
      message: parentProposalId
        ? `Nova versão ${number} do orçamento vinculado à OS ${os.number}.`
        : `Orçamento ${number} gerado e vinculado à OS ${os.number}.`,
    },
    { status: 201 },
  );
}

/** Remove apenas o vínculo com o orçamento atual (a proposta é preservada). */
export async function DELETE(_request: Request, { params }: Context) {
  await ensureSchema();
  const { id } = await params;
  await db
    .update(serviceOrders)
    .set({ budgetProposalId: null, budgetTotalCents: 0, budgetIssuedAt: null, updatedAt: new Date() })
    .where(eq(serviceOrders.id, id));
  return NextResponse.json({ ok: true });
}
