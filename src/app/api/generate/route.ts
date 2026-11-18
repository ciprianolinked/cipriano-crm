import { NextResponse } from "next/server";
import { analyzeBriefingNotes, buildInsights, maybePolishWithLLM, type Insight } from "@/lib/ai";
import { getSettings } from "@/lib/data";
import { calcTotals, defaultBriefing } from "@/lib/proposal/catalog";
import { DEFAULT_EXTRAS, applyExtras, extrasBreakdown, readExtras } from "@/lib/proposal/extras";
import { generateProposal } from "@/lib/proposal/generate";
import { validateMaintenancePlan } from "@/lib/proposal/maintenance-plan";
import { isProposalType, type Briefing, type ProposalItem } from "@/lib/proposal/types";

export const dynamic = "force-dynamic";

type PickedItem = Partial<ProposalItem>;

/** Itens do catálogo escolhidos no wizard: valida tipos e gera ids estáveis. */
function sanitizePicked(raw: unknown): ProposalItem[] {
  if (!Array.isArray(raw)) return [];
  const items: ProposalItem[] = [];
  raw.slice(0, 200).forEach((entry, index) => {
    const item = entry as PickedItem;
    const desc = String(item?.desc ?? "").trim().slice(0, 300);
    if (!desc) return;
    const qty = Number(item.qty);
    const price = Number(item.price);
    items.push({
      id: `cat-${Date.now().toString(36)}-${index}`,
      kind: item.kind === "servico" ? "servico" : "equipamento",
      desc,
      spec: String(item.spec ?? "").slice(0, 600),
      unit: String(item.unit ?? "un").trim().slice(0, 12) || "un",
      qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      price: Number.isFinite(price) && price >= 0 ? Math.round(price * 100) / 100 : 0,
    });
  });
  return items;
}

/** Linhas sugeridas pelo briefing que seriam duplicadas pelos adicionais (infraestrutura e mão de obra). */
const OVERLAPS_WITH_EXTRAS = new Set([
  "Infraestrutura de rede, rack e energia protegida",
  "Instalação, configuração e comissionamento",
]);

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
    itemsMode?: "briefing" | "catalog";
    catalogItems?: unknown;
    extras?: unknown;
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

  const picked = maintenance ? [] : sanitizePicked(body.catalogItems);
  const catalogOnly = !maintenance && body.itemsMode === "catalog";
  // Só com itens do catálogo, o texto do documento não pode citar quantidades do briefing que não existem na lista.
  const generationBriefing: Briefing = catalogOnly
    ? { ...briefing, cameras: 0, doors: 0, fenceMeters: 0, alarm: false, intercom: false }
    : briefing;

  const draft = generateProposal({ type, briefing: generationBriefing, clientName: String(body.clientName).trim(), contact: body.contact ?? "", clientEmail: body.clientEmail ?? "", site: body.site ?? "", validityDays: body.validityDays ?? settings.defaultValidityDays, artIncluded: maintenance ? false : body.artIncluded ?? type === "completa", discountPct: catalogOnly ? 0 : undefined, settings });

  const extras = maintenance ? null : (readExtras({ extras: body.extras ?? DEFAULT_EXTRAS }) ?? DEFAULT_EXTRAS);
  if (!maintenance && extras) {
    let items = catalogOnly ? picked : [...draft.items, ...picked];
    if (extras.enabled) items = items.filter((item) => !OVERLAPS_WITH_EXTRAS.has(item.desc));
    draft.items = applyExtras(items, extras);
    draft.briefing = { ...draft.briefing, extras } as Briefing;
    if (catalogOnly && picked.length) {
      const bullets = picked.map((item) => `• ${item.qty} ${item.unit} — ${item.desc}${item.spec ? ` (${item.spec})` : ""}`).join("\n");
      draft.sections = draft.sections.map((section) => (section.id === "escopo" ? { ...section, body: [bullets, section.body].filter(Boolean).join("\n") } : section));
    }
  }

  let aiNote = maintenance
    ? "Minuta estruturada de manutenção gerada com os valores, cobertura, visitas e prazos que você informou. Confira antes de enviar."
    : "Proposta estruturada com o briefing informado. Revise os itens e as condições antes de enviar.";
  if (body.polish) {
    const polished = await maybePolishWithLLM({ system: "Você é assistente de redação de propostas de segurança eletrônica. Reescreva somente o escopo em português técnico e claro, preservando todos os números, exclusões e limites. Não acrescente serviços, equipamentos ou promessas.", prompt: draft.sections.find((s) => s.id === "escopo")?.body ?? draft.sections[0].body });
    if (polished) { draft.sections = draft.sections.map((s) => s.id === "escopo" ? { ...s, body: polished } : s); aiNote = "Escopo refinado por IA. Revise a redação antes de enviar ao cliente."; }
    else aiNote += " IA generativa indisponível; a minuta estruturada foi preservada.";
  }
  const totals = calcTotals(draft.items, draft.discountPct);
  const insights: Insight[] = maintenance
    ? [{ tone: "info", title: "Mensalidade, não parcelamento", detail: "O valor unitário representa um mês de manutenção. A quantidade corresponde à vigência; peças e visitas adicionais seguem o escopo informado." }, { tone: "ok", title: "Contrato opcional", detail: "Se o cliente solicitar, gere uma minuta vinculada à proposta. Você pode editar tudo e só ativar após conferência e aceite." }]
    : buildInsights({ type, briefing, items: draft.items, sections: draft.sections, discountPct: draft.discountPct, totalCents: totals.totalCents, status: "novo", validityDays: draft.validityDays });

  if (!maintenance && extras?.enabled) {
    const breakdown = extrasBreakdown(draft.items.filter((item) => !item.auto), extras);
    if (extras.laborValue <= 0) {
      insights.unshift({ tone: "warn", title: "Mão de obra não informada", detail: "Informe o valor da mão de obra desta proposta em “Adicionais do projeto” — ela é calculada por proposta e não entra enquanto estiver zerada." });
    }
    if (breakdown.base <= 0) {
      insights.unshift({ tone: "warn", title: "Sem equipamentos para calcular os percentuais", detail: "Miscelâneas, infraestrutura e margem de segurança incidem sobre os equipamentos. Adicione itens do catálogo para que apareçam." });
    }
  }
  return NextResponse.json({ draft, totals, insights, aiNote });
}
