import { brl } from "@/lib/brand";
import { defaultBriefing } from "@/lib/proposal/catalog";
import { paymentTermsText } from "@/lib/proposal/value-block";
import type { ProposalDraft, ProposalItem, ProposalSection } from "@/lib/proposal/types";
import type { ServiceOrderItem } from "@/db/schema";

export type ServiceOrderKind = "instalacao" | "preventiva" | "corretiva" | "vistoria" | "orcamento";
export type ServiceOrderStatus =
  | "aberta"
  | "agendada"
  | "em_execucao"
  | "aguardando_orcamento"
  | "aguardando_aprovacao"
  | "concluida"
  | "cancelada";
export type ServiceOrderPriority = "baixa" | "normal" | "alta" | "urgente";

export const OS_KINDS: { id: ServiceOrderKind; label: string; hint: string }[] = [
  { id: "corretiva", label: "Corretiva", hint: "Falha relatada pelo cliente" },
  { id: "preventiva", label: "Preventiva", hint: "Rotina programada" },
  { id: "instalacao", label: "Instalação", hint: "Execução de projeto vendido" },
  { id: "vistoria", label: "Vistoria", hint: "Diagnóstico sem execução" },
  { id: "orcamento", label: "Orçamento", hint: "Levantamento para propor preço" },
];

export const OS_STATUSES: { id: ServiceOrderStatus; label: string; hint: string; tone: string }[] = [
  { id: "aberta", label: "Aberta", hint: "Recebida, aguardando agendamento", tone: "!border-steel/60 !text-steel" },
  { id: "agendada", label: "Agendada", hint: "Data e técnico definidos", tone: "!border-network/60 !text-network" },
  { id: "em_execucao", label: "Em execução", hint: "Técnico em campo", tone: "!border-amber/60 !text-amber" },
  { id: "aguardando_orcamento", label: "Aguardando orçamento", hint: "Precisa de proposta antes de executar", tone: "!border-amber/60 !text-amber" },
  { id: "aguardando_aprovacao", label: "Aguardando aprovação", hint: "Orçamento enviado ao cliente", tone: "!border-signal/60 !text-signal" },
  { id: "concluida", label: "Concluída", hint: "Executada e conferida", tone: "!border-armed/60 !text-armed" },
  { id: "cancelada", label: "Cancelada", hint: "Sem execução", tone: "!border-alarm/50 !text-alarm" },
];

export const OS_PRIORITIES: { id: ServiceOrderPriority; label: string; tone: string }[] = [
  { id: "baixa", label: "Baixa", tone: "!border-steel/50 !text-steel" },
  { id: "normal", label: "Normal", tone: "!border-network/50 !text-network" },
  { id: "alta", label: "Alta", tone: "!border-amber/60 !text-amber" },
  { id: "urgente", label: "Urgente", tone: "!border-alarm/60 !text-alarm" },
];

export const osKindLabel = (kind: string) => OS_KINDS.find((k) => k.id === kind)?.label ?? kind;
export const osStatus = (status: string) => OS_STATUSES.find((s) => s.id === status) ?? OS_STATUSES[0];
export const osPriority = (priority: string) => OS_PRIORITIES.find((p) => p.id === priority) ?? OS_PRIORITIES[1];
export const OPEN_OS_STATUSES: ServiceOrderStatus[] = [
  "aberta",
  "agendada",
  "em_execucao",
  "aguardando_orcamento",
  "aguardando_aprovacao",
];

export function itemsTotalCents(items: ServiceOrderItem[] | undefined | null): number {
  return (items ?? []).reduce(
    (sum, item) => sum + (item.billable === false ? 0 : Math.max(0, Math.round(Number(item.priceCents) || 0)) * Math.max(0, Number(item.qty) || 0)),
    0,
  );
}

export function soPartsCents(os: { items?: ServiceOrderItem[] | null; laborCents?: number | null }) {
  const parts = itemsTotalCents(os.items);
  const labor = Math.max(0, Math.round(Number(os.laborCents) || 0));
  return { partsCents: parts, laborCents: labor, totalCents: parts + labor };
}

export const soTotalCents = (os: Parameters<typeof soPartsCents>[0]) => soPartsCents(os).totalCents;

export function nextServiceOrderNumber(existing: string[]): string {
  const year = new Date().getFullYear();
  const re = new RegExp(`^OS-${year}-(\\d{1,6})$`);
  let max = 0;
  for (const n of existing) {
    const m = String(n ?? "").match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `OS-${year}-${String(max + 1).padStart(4, "0")}`;
}

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export type ServiceOrderForBudget = {
  id: string;
  number: string;
  kind: string;
  clientName: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  site: string | null;
  description: string;
  diagnosis: string;
  solution: string;
  items: ServiceOrderItem[];
  laborCents: number;
  notes: string;
  technician: string;
};

export type BudgetSettings = {
  defaultValidityDays: number;
  defaultPaymentTerms: string;
  defaultDeliveryTime: string;
  defaultWarranty: string;
  companyName: string;
  crea: string;
};

/**
 * Monta a proposta de orçamento a partir da OS: peças e materiais (itens marcados como
 * cobráveis) + mão de obra. O briefing guarda os vínculos osId/osNumber,
 * permitindo voltar da proposta para a OS e corrigir o orçamento.
 */
export function buildBudgetDraft(os: ServiceOrderForBudget, settings: BudgetSettings): ProposalDraft {
  const items: ProposalItem[] = [
    ...os.items
      .filter((item) => item.billable !== false && (Number(item.qty) || 0) > 0)
      .map((item, index) => ({
        id: uid(`os-${index}`),
        kind: "equipamento" as const,
        desc: item.desc,
        spec: [item.spec, item.obs].filter(Boolean).join(" · "),
        unit: item.unit || "un",
        qty: Math.max(0, Number(item.qty) || 0),
        price: Math.max(0, Math.round(Number(item.priceCents) || 0)) / 100,
        scope: item.scope || "Peças e materiais",
      })),
  ];
  if (os.laborCents > 0) {
    items.push({
      id: uid("os-labor"),
      kind: "servico",
      desc: `Mão de obra técnica — ${osKindLabel(os.kind).toLowerCase()}`,
      spec: os.technician ? `Execução por ${os.technician}` : "Serviço técnico em campo",
      unit: "vb",
      qty: 1,
      price: os.laborCents / 100,
      scope: "Serviços técnicos",
    });
  }

  const problem = os.description.trim() || "serviço técnico solicitado pelo cliente";
  const diagnosis = os.diagnosis.trim();
  const solution = os.solution.trim();
  const parts = os.items
    .filter((i) => i.billable !== false && i.qty > 0)
    .map((i) => `• ${i.qty} ${i.unit} — ${i.desc}${i.spec ? ` (${i.spec})` : ""} · ${brl((i.priceCents * i.qty) / 100)}`)
    .join("\n");
  const total = soPartsCents(os).totalCents;

  const sections: ProposalSection[] = [
    {
      id: "objeto",
      title: "Objeto",
      enabled: true,
      kind: "text",
      body: `Orçamento complementar referente à ordem de serviço ${os.number} (${osKindLabel(os.kind).toLowerCase()}), para atendimento de ${os.clientName}${os.site ? ` em ${os.site}` : ""}.\n\nSolicitação registrada: ${problem}.`,
    },
    {
      id: "diagnostico",
      title: "Diagnóstico e solução proposta",
      enabled: true,
      kind: "text",
      body: `${diagnosis ? `Diagnóstico técnico:\n${diagnosis}\n\n` : ""}${solution ? `Solução proposta:\n${solution}` : "Solução proposta conforme levantamento em campo, com substituição das peças relacionadas e testes de funcionamento após a execução."}`,
    },
    {
      id: "escopo",
      title: "Peças, materiais e serviços",
      enabled: true,
      kind: "items",
      body: parts || "Itens conforme lista abaixo.",
    },
    {
      id: "valor",
      title: "Valor do orçamento",
      enabled: true,
      kind: "totals",
      locked: true,
      body: `Valor total de ${brl(total / 100)}, com peças e mão de obra discriminados. Orçamento vinculado à OS ${os.number} e sujeito à aprovação do cliente antes da execução.`,
    },
    {
      id: "condicoes",
      title: "Condições comerciais",
      enabled: true,
      kind: "terms",
      body: [
        `• Pagamento: ${settings.defaultPaymentTerms}`,
        `• Execução: ${settings.defaultDeliveryTime}, contados da aprovação deste orçamento`,
        `• Garantia: ${settings.defaultWarranty}`,
        `• Aprovação: responda este orçamento por escrito autorizando a execução da OS ${os.number}`,
        "• Horas técnicas adicionais: R$ 140,00/hora por profissional, com aprovação prévia por e-mail",
      ].join("\n"),
    },
    {
      id: "observacoes",
      title: "Observações",
      enabled: true,
      kind: "text",
      body:
        os.notes.trim() ||
        "Peças não previstas nesta lista, obras civis, pontos elétricos novos e intervenções de terceiros dependem de orçamento complementar. Equipamentos fora de garantia só são substituídos após aprovação.",
    },
    {
      id: "aceite",
      title: "Aceite",
      enabled: true,
      kind: "text",
      body: `A aprovação deste orçamento autoriza a execução dos serviços na ordem de serviço ${os.number}. O aceite pode ser formalizado por assinatura deste documento, e-mail de concordância ou aprovação no painel.`,
    },
  ];

  return {
    type: "produtos_servicos",
    clientName: os.clientName,
    contact: os.contact ?? "",
    clientEmail: os.email ?? "",
    site: os.site ?? "",
    validityDays: settings.defaultValidityDays,
    discountPct: 0,
    items,
    sections,
    paymentTerms: paymentTermsText(40, 12),
    deliveryTime: settings.defaultDeliveryTime,
    warranty: settings.defaultWarranty,
    artIncluded: false,
    briefing: {
      ...defaultBriefing,
      purpose: "projeto",
      monitoring: false,
      notes: `Orçamento gerado pela OS ${os.number}.`,
      osId: os.id,
      osNumber: os.number,
      valueBlock: { installments: 12, entryPct: 40 },
    } as ProposalDraft["briefing"],
  };
}

/** Resumo das OS para os indicadores do topo da lista. */
export function serviceOrderStats(rows: {
  status: string;
  kind: string;
  items: ServiceOrderItem[] | null;
  laborCents: number;
  budgetTotalCents: number;
  scheduledAt: Date | string | null;
}[]) {
  const open = rows.filter((r) => OPEN_OS_STATUSES.includes(r.status as ServiceOrderStatus));
  const inField = rows.filter((r) => r.status === "em_execucao");
  const waitingBudget = rows.filter((r) => r.status === "aguardando_orcamento");
  const waitingApproval = rows.filter((r) => r.status === "aguardando_aprovacao");
  const done = rows.filter((r) => r.status === "concluida");
  const openValue = open.reduce((sum, r) => sum + soPartsCents(r).totalCents, 0);
  const budgetValue = rows.reduce((sum, r) => sum + Math.max(0, r.budgetTotalCents || 0), 0);
  return {
    total: rows.length,
    open: open.length,
    inField: inField.length,
    waitingBudget: waitingBudget.length,
    waitingApproval: waitingApproval.length,
    done: done.length,
    openValueCents: openValue,
    budgetValueCents: budgetValue,
  };
}
