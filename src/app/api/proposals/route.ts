import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, proposals } from "@/db/schema";
import { ensureBootstrap, nextProposalNumber } from "@/lib/data";
import { calcTotals, defaultBriefing } from "@/lib/proposal/catalog";
import { generateProposal } from "@/lib/proposal/generate";
import { validateMaintenancePlan } from "@/lib/proposal/maintenance-plan";
import { isProposalType, type Briefing, type ProposalDraft } from "@/lib/proposal/types";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureBootstrap();
  const rows = await db.select().from(proposals).orderBy(proposals.updatedAt);
  return NextResponse.json({ proposals: rows });
}

export async function POST(request: Request) {
  await ensureBootstrap();
  const body = (await request.json()) as {
    type?: string;
    draft?: ProposalDraft;
    briefing?: Briefing;
    clientId?: string | null;
    clientName?: string;
    contact?: string;
    clientEmail?: string;
    site?: string;
    validityDays?: number;
    discountPct?: number;
    artIncluded?: boolean;
    status?: string;
    followUpDays?: number;
  };

  const type = body.type && isProposalType(body.type) ? body.type : "completa";
  const { getSettings } = await import("@/lib/data");
  const settings = await getSettings();

  const incomingBriefing = body.draft?.briefing ?? body.briefing;
  if (incomingBriefing?.purpose === "manutencao_mensal") {
    try { incomingBriefing.maintenancePlan = validateMaintenancePlan(incomingBriefing.maintenancePlan); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Dados de manutenção inválidos." }, { status: 400 }); }
  }

  let draft: ProposalDraft;
  if (body.draft) {
    draft = body.draft;
  } else {
    draft = generateProposal({
      type,
      briefing: body.briefing ?? defaultBriefing,
      clientName: body.clientName ?? "",
      contact: body.contact ?? "",
      clientEmail: body.clientEmail ?? "",
      site: body.site ?? "",
      validityDays: body.validityDays,
      discountPct: body.discountPct,
      artIncluded: body.artIncluded,
      settings: {
        defaultValidityDays: settings.defaultValidityDays,
        defaultPaymentTerms: settings.defaultPaymentTerms,
        defaultDeliveryTime: settings.defaultDeliveryTime,
        defaultWarranty: settings.defaultWarranty,
        companyName: settings.companyName,
        legalName: settings.legalName,
        director: settings.director,
        role: settings.role,
        crea: settings.crea,
        cnpj: settings.cnpj,
      },
    });
  }

  if (!draft.clientName.trim()) {
    return NextResponse.json({ error: "Informe o nome do cliente." }, { status: 400 });
  }

  const totals = calcTotals(draft.items, draft.discountPct);
  const number = await nextProposalNumber();
  const status = body.status ?? "novo";
  const followUpDays = body.followUpDays ?? 2;
  const nextActionAt = status === "novo" ? new Date() : new Date(Date.now() + followUpDays * 86_400_000);

  const [row] = await db
    .insert(proposals)
    .values({
      number,
      type: draft.type,
      status,
      clientId: body.clientId ?? null,
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
      artIncluded: draft.artIncluded,
      subtotalCents: totals.subtotalCents,
      totalCents: totals.totalCents,
      briefing: draft.briefing as unknown as Record<string, unknown>,
      nextActionAt,
      nextActionNote:
        status === "novo"
          ? "Revisar proposta e enviar ao cliente hoje."
          : `Follow-up D+${followUpDays}: confirmar recebimento e perguntar quem decide.`,
      sentAt: status === "enviada" || status === "negociacao" ? new Date() : null,
    })
    .returning();

  await db.insert(activities).values({
    proposalId: row.id,
    kind: "sistema",
    content: `Proposta ${number} gerada pelo motor Cipriano (${type}).`,
    doneAt: new Date(),
  });

  if (status !== "novo") {
    await db.insert(activities).values({
      proposalId: row.id,
      kind: "seguimento",
      content: `Follow-up D+${followUpDays}: confirmar recebimento da proposta ${number}.`,
      dueAt: nextActionAt,
    });
  }

  return NextResponse.json({ proposal: row }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
  await db.delete(proposals).where(eq(proposals.id, id));
  return NextResponse.json({ ok: true });
}
