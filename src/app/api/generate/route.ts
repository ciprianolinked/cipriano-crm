import { NextResponse } from "next/server";
import { analyzeBriefingNotes, buildInsights, maybePolishWithLLM } from "@/lib/ai";
import { getSettings } from "@/lib/data";
import { calcTotals, defaultBriefing } from "@/lib/proposal/catalog";
import { defaultGeneratorSettings, generateProposal } from "@/lib/proposal/generate";
import { isProposalType, type Briefing, type ProposalType } from "@/lib/proposal/types";

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
  };

  const settings = await getSettings();
  const type: ProposalType = body.type && isProposalType(body.type) ? body.type : "completa";
  const briefing: Briefing = {
    ...defaultBriefing,
    ...body.briefing,
    notes: body.briefing?.notes ?? "",
  };
  const rawNotes = body.briefing?.rawNotes ?? briefing.notes;
  const enriched = rawNotes.trim()
    ? analyzeBriefingNotes(rawNotes, briefing)
    : briefing;

  const draft = generateProposal({
    type,
    briefing: enriched,
    clientName: body.clientName ?? "",
    contact: body.contact ?? "",
    clientEmail: body.clientEmail ?? "",
    site: body.site ?? "",
    validityDays: body.validityDays ?? settings.defaultValidityDays,
    artIncluded: body.artIncluded ?? type === "completa",
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

  let aiNote = "Motor Cipriano: 8 regras técnicas, catálogo de 15 itens e biblioteca de cláusulas aplicadas.";
  if (body.polish) {
    const polished = await maybePolishWithLLM({
      system:
        "Você é engenheiro de segurança eletrônica da Cipriano Tech & Security. Reescreva o bloco de escopo em português técnico, objetivo, sem superlativos, mantendo bullets e números exatos. Máximo 180 palavras.",
      prompt: draft.sections.find((s) => s.id === "escopo")?.body ?? draft.sections[0].body,
    });
    if (polished) {
      draft.sections = draft.sections.map((s) =>
        s.id === "escopo" ? { ...s, body: polished } : s,
      );
      aiNote = "Escopo refinado por IA generativa (LLM conectado ao servidor).";
    } else {
      aiNote = `${aiNote} Aperfeiçoamento por LLM indisponível: configure OPENAI_API_KEY para ativar a reescrita generativa.`;
    }
  }

  const totals = calcTotals(draft.items, draft.discountPct);
  const insights = buildInsights({
    type: draft.type,
    briefing: enriched,
    items: draft.items,
    sections: draft.sections,
    discountPct: draft.discountPct,
    totalCents: totals.totalCents,
    status: "novo",
    validityDays: draft.validityDays,
  });

  return NextResponse.json({
    draft,
    totals,
    insights,
    aiNote,
    brand: defaultGeneratorSettings,
  });
}
