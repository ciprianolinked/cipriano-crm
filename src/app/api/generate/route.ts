import { NextResponse } from "next/server";
import { analyzeBriefingNotes, buildInsights, maybePolishWithLLM } from "@/lib/ai";
import { getSettings } from "@/lib/data";
import { calcTotals, defaultBriefing } from "@/lib/proposal/catalog";
import { generateProposal } from "@/lib/proposal/generate";
import { validateMaintenancePlan } from "@/lib/proposal/maintenance-plan";
import { isProposalType, type Briefing, type ProposalItem } from "@/lib/proposal/types";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const body = (await request.json()) as {
    type?: string;
    briefing?: Partial<Briefing> & { rawNotes?: string };
    clientName?: string;
    contact?: string;
    clientEmail?: string;
    site?: string;
    validityDays?: number;
    artIncluded?: boolean;
    polish?: boolean;
    miscPct?: number;
    laborPrice?: number;
    customItems?: ProposalItem[];
  };
  if (!String(body.clientName ?? "").trim()) return NextResponse.json({ error: "Informe o nome do cliente." }, { status: 400 });
  const settings = await getSettings();
  const type = body.type && isProposalType(body.type) ? body.type : "completa";
  let briefing: Briefing = { ...defaultBriefing, ...body.briefing, notes: body.briefing?.notes ?? "" };
  const maintenance = briefing.purpose === "manutencao_mensal";
  if (maintenance) {
    try { briefing = { ...briefing, maintenance: true, maintenancePlan: validateMaintenancePlan(briefing.maintenancePlan) }; }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Confira os dados da manutenção." }, { status: 400 }); }
  } else {
    const rawNotes = body.briefing?.rawNotes ?? briefing.notes;
    if (rawNotes.trim()) briefing = analyzeBriefingNotes(rawNotes, briefing);
  }
  const draft = generateProposal({
    type,
    briefing,
    clientName: String(body.clientName).trim(),
    contact: body.contact ?? "",
    clientEmail: body.clientEmail ?? "",
    site: body.site ?? "",
    validityDays: body.validityDays ?? settings.defaultValidityDays,
    artIncluded: maintenance ? false : body.artIncluded ?? type === "completa",
    miscPct: body.miscPct,
    laborPrice: body.laborPrice,
    customItems: body.customItems,
    settings,
  });
  let aiNote = maintenance
    ? "Minuta estruturada de manutenção gerada com os valores, cobertura, visitas e prazos que você informou. Confira antes de enviar."
    : "Proposta estruturada com o briefing informado. Revise os itens e as condições antes de enviar.";
  if (body.polish) {
    const polished = await maybePolishWithLLM({ system: "Você é assistente de redação de propostas de segurança eletrônica. Reescreva somente o escopo em português técnico e claro, preservando todos os números, exclusões e limites. Não acrescente serviços, equipamentos ou promessas.", prompt: draft.sections.find((s) => s.id === "escopo")?.body ?? draft.sections[0].body });
    if (polished) { draft.sections = draft.sections.map((s) => s.id === "escopo" ? { ...s, body: polished } : s); aiNote = "Escopo refinado por IA. Revise a redação antes de enviar ao cliente."; }
    else aiNote += " IA generativa indisponível; a minuta estruturada foi preservada.";
  }
  const totals = calcTotals(draft.items, draft.discountPct);
  const insights = maintenance ? [{ tone: "info" as const, title: "Mensalidade, não parcelamento", detail: "O valor unitário representa um mês de manutenção. A quantidade corresponde à vigência; peças e visitas adicionais seguem o escopo informado." }, { tone: "ok" as const, title: "Contrato opcional", detail: "Se o cliente solicitar, gere uma minuta vinculada à proposta. Você pode editar tudo e só ativar após conferência e aceite." }] : buildInsights({ type, briefing, items: draft.items, sections: draft.sections, discountPct: draft.discountPct, totalCents: totals.totalCents, status: "novo", validityDays: draft.validityDays });
  return NextResponse.json({ draft, totals, insights, aiNote });
}
