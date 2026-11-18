import type { ProposalRow, SettingsRow } from "@/db/schema";
import { maybePolishWithLLM } from "@/lib/ai";
import type { DeliveryTermSection, ProposalItem } from "@/lib/proposal/types";

export type DeliveryTermDraft = {
  proposalId: string;
  proposalNumber: string;
  proposalRevision: number;
  clientId: string | null;
  clientName: string;
  contact: string;
  clientEmail: string;
  site: string;
  title: string;
  deliveryDate: string;
  status: "rascunho";
  items: ProposalItem[];
  sections: DeliveryTermSection[];
  generatedByAi: boolean;
};

/** Remove da entrega referências a serviço que a Cipriano não oferece. */
export function isMonitoringItem(item: ProposalItem): boolean {
  return /\bmonitoramento\b|\bmonitoring\b|\bNOC\b|\bronda virtual\b/i.test(
    `${item.desc} ${item.spec}`,
  );
}

export function deliveryItems(proposal: ProposalRow): ProposalItem[] {
  return proposal.items
    .filter((item) => !isMonitoringItem(item))
    .map((item) => ({ ...item }));
}

const isoToday = () => new Date().toISOString().slice(0, 10);

export function makeDeliveryTermDraft(
  proposal: ProposalRow,
  settings: SettingsRow,
): DeliveryTermDraft {
  const items = deliveryItems(proposal);
  const scope = proposal.sections.find((section) => section.id === "objeto" && section.enabled)?.body ??
    proposal.sections.find((section) => /escopo/i.test(section.title) && section.enabled)?.body ??
    proposal.sections.find((section) => section.enabled)?.body ??
    "Fornecimento e/ou serviços conforme proposta vinculada.";
  const itemLines = items.length
    ? items.map((item) => `• ${item.qty} ${item.unit} — ${item.desc}${item.spec ? ` (${item.spec})` : ""}`).join("\n")
    : "Nenhum item registrado na proposta vinculada.";
  const warranty = proposal.warranty || "Conforme condições da proposta vinculada.";

  const sections: DeliveryTermSection[] = [
    {
      id: "objeto",
      title: "1. Objeto e referência",
      body: `Este termo registra a entrega técnica dos equipamentos e/ou serviços vinculados à proposta ${proposal.number}, revisão ${proposal.revision}.\n\nObjeto de referência: ${scope}\n\nA data efetiva, os itens conferidos e as eventuais ressalvas devem ser confirmados e preenchidos pelas partes no ato da entrega.`,
    },
    {
      id: "itens",
      title: "2. Itens e serviços previstos",
      body: itemLines,
    },
    {
      id: "conferencia",
      title: "3. Conferência no local",
      body: "No ato da entrega, as partes conferem os itens, quantidades, estado aparente e identificação descritos neste termo. Registre no campo de pendências qualquer diferença, item não entregue, avaria ou serviço que ainda precise ser concluído. A assinatura confirma somente os itens efetivamente conferidos e as ressalvas expressamente registradas.",
    },
    {
      id: "testes",
      title: "4. Testes e orientação de uso",
      body: "Os testes executados, resultados observados e orientações repassadas ao responsável devem ser registrados abaixo, de acordo com o escopo contratado. Não marque como realizado um teste ou treinamento que não tenha ocorrido. Senhas e credenciais de acesso devem ser entregues por canal seguro, não neste documento.",
    },
    {
      id: "documentacao",
      title: "5. Documentação, garantia e suporte",
      body: `Documentos efetivamente entregues (manuais, projeto, ART, as-built e/ou registros de teste): preencher no ato.\n\nGarantia e condições de suporte: ${warranty}\n\nA vigência, exclusões e responsabilidades permanecem limitadas ao que consta na proposta ${proposal.number} e nos documentos contratuais assinados pelas partes. Este termo não cria uma obrigação de monitoramento, serviço recorrente ou cobertura que não esteja contratada.`,
    },
    {
      id: "pendencias",
      title: "6. Pendências e ressalvas",
      body: "Nenhuma pendência informada. Altere este texto para registrar o item, responsável e prazo combinado, ou confirme “Nenhuma” somente após a conferência.",
    },
    {
      id: "aceite",
      title: "7. Declaração de entrega e aceite",
      body: "As partes declaram que conferiram os itens e serviços indicados neste termo, ficando o aceite restrito ao que foi efetivamente entregue e às ressalvas registradas. A assinatura não altera preços, escopo, garantia ou demais condições da proposta e do contrato eventualmente firmado.\n\nEste documento deve ser assinado pelos representantes identificados abaixo, com a data e o local da entrega.",
    },
  ];

  return {
    proposalId: proposal.id,
    proposalNumber: proposal.number,
    proposalRevision: proposal.revision,
    clientId: proposal.clientId,
    clientName: proposal.clientName,
    contact: proposal.contact ?? "",
    clientEmail: proposal.clientEmail ?? "",
    site: proposal.site ?? "",
    title: "Termo de entrega e aceite técnico",
    deliveryDate: isoToday(),
    status: "rascunho",
    items,
    sections,
    generatedByAi: false,
  };
}

function parseAiSections(raw: string, fallback: DeliveryTermSection[]): DeliveryTermSection[] | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const value = JSON.parse(cleaned) as { sections?: unknown } | unknown;
    const source = Array.isArray(value)
      ? value
      : value && typeof value === "object" && Array.isArray((value as { sections?: unknown }).sections)
        ? (value as { sections: unknown[] }).sections
        : null;
    if (!source || source.length !== fallback.length) return null;
    const sections: DeliveryTermSection[] = source.map((entry, index) => {
      const row = entry as { title?: unknown; body?: unknown; id?: unknown };
      const title = typeof row.title === "string" ? row.title.trim().slice(0, 160) : "";
      const body = typeof row.body === "string" ? row.body.trim().slice(0, 8000) : "";
      if (!title || body.length < 20) throw new Error("Resposta incompleta da IA");
      return { id: fallback[index].id, title, body };
    });
    return sections;
  } catch {
    return null;
  }
}

/** Gera um termo profissional a partir do snapshot da proposta; usa IA somente no servidor. */
export async function generateDeliveryTerm(
  proposal: ProposalRow,
  settings: SettingsRow,
): Promise<DeliveryTermDraft> {
  const draft = makeDeliveryTermDraft(proposal, settings);
  const system = [
    "Você é um redator técnico brasileiro especializado em termos de entrega de sistemas eletrônicos de segurança.",
    "Reescreva os blocos fornecidos em português claro, formal, objetivo e juridicamente prudente.",
    "Responda SOMENTE JSON válido no formato {\"sections\":[{\"title\":\"...\",\"body\":\"...\"}]}.",
    "Mantenha exatamente o mesmo número e ordem dos blocos. Não altere os ids (eles não serão usados), quantidades, nomes de equipamentos, datas, valores ou dados das partes.",
    "Não invente entregas, instalações, testes realizados, garantias, prazos, assinaturas ou fatos. Use linguagem condicional e deixe claro o que deve ser confirmado no ato.",
    "Não inclua monitoramento, NOC, vigilância ou serviços que não constem no escopo. Não transforme o termo em contrato nem crie obrigações comerciais novas.",
    "Mantenha textos entre colchetes e campos de conferência editáveis. Cada body deve ser uma string; escape quebras de linha como \\n dentro do JSON.",
  ].join(" ");
  const prompt = JSON.stringify({
    company: { name: settings.companyName, legalName: settings.legalName, cnpj: settings.cnpj, crea: settings.crea, address: settings.address },
    proposal: {
      number: proposal.number,
      revision: proposal.revision,
      client: proposal.clientName,
      contact: proposal.contact,
      site: proposal.site,
      items: draft.items.map((item) => ({ qty: item.qty, unit: item.unit, description: item.desc, specification: item.spec })),
      conditions: { warranty: proposal.warranty, payment: proposal.paymentTerms, delivery: proposal.deliveryTime },
    },
    sections: draft.sections,
  });
  const result = await maybePolishWithLLM({ system, prompt });
  const polished = result ? parseAiSections(result, draft.sections) : null;
  return polished ? { ...draft, sections: polished, generatedByAi: true } : draft;
}

/** Sanitiza blocos editados pelo usuário antes de persistir. */
export function sanitizeDeliverySections(value: unknown): DeliveryTermSection[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const title = String(row.title ?? "").trim().slice(0, 160);
    const body = String(row.body ?? "").trim().slice(0, 8000);
    if (!title) return [];
    return [{ id: String(row.id ?? `bloco-${index + 1}`).slice(0, 80), title, body }];
  });
}

export function sanitizeDeliveryItems(value: unknown): ProposalItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 200).flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const desc = String(row.desc ?? "").trim().slice(0, 300);
    if (!desc) return [];
    const qty = Number(row.qty);
    const price = Number(row.price);
    const kind = row.kind === "servico" ? "servico" : "equipamento";
    return [{
      id: String(row.id ?? `item-${index + 1}`).slice(0, 100),
      kind,
      desc,
      spec: String(row.spec ?? "").slice(0, 600),
      unit: String(row.unit ?? "un").trim().slice(0, 20) || "un",
      qty: Number.isFinite(qty) ? Math.max(0, qty) : 0,
      price: Number.isFinite(price) ? Math.max(0, price) : 0,
      ...(typeof row.scope === "string" ? { scope: row.scope.slice(0, 100) } : {}),
    }];
  });
}
