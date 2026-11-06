export type ProposalType = "simples" | "completa" | "produtos_servicos";

export type ProposalStage = "novo" | "enviada" | "negociacao" | "ganho" | "perdido";

export type ItemKind = "equipamento" | "servico";

export type ProposalItem = {
  id: string;
  kind: ItemKind;
  desc: string;
  spec: string;
  unit: string;
  qty: number;
  price: number;
};

export type SectionKind = "text" | "table" | "items" | "totals" | "terms";

export type SectionTableRow = { label: string; cipriano: string; client: string };

export type ProposalSection = {
  id: string;
  title: string;
  body: string;
  enabled: boolean;
  kind?: SectionKind;
  rows?: SectionTableRow[];
  locked?: boolean;
};

export type Briefing = {
  segment: string;
  cameras: number;
  doors: number;
  fenceMeters: number;
  monitoring: boolean;
  alarm: boolean;
  intercom: boolean;
  network: boolean;
  maintenance: boolean;
  notes: string;
  priority: "prazo" | "orcamento" | "tecnica" | "seguranca";
};

export type ProposalDraft = {
  type: ProposalType;
  clientName: string;
  contact: string;
  clientEmail: string;
  site: string;
  validityDays: number;
  discountPct: number;
  items: ProposalItem[];
  sections: ProposalSection[];
  paymentTerms: string;
  deliveryTime: string;
  warranty: string;
  artIncluded: boolean;
  briefing: Briefing;
};

export type Totals = {
  subtotalCents: number;
  offCents: number;
  totalCents: number;
  installmentCents: number;
};

export const STAGES: { id: ProposalStage; label: string; hint: string; accent: string }[] = [
  { id: "novo", label: "Novo / qualificação", hint: "Briefing recebido, proposta em elaboração", accent: "#7D93AD" },
  { id: "enviada", label: "Proposta enviada", hint: "Aguardando primeiro feedback", accent: "#2F80FF" },
  { id: "negociacao", label: "Em negociação", hint: "Ajustes, visita técnica e follow-up ativo", accent: "#FFB020" },
  { id: "ganho", label: "Ganho", hint: "Aceite assinado e obra liberada", accent: "#35E39A" },
  { id: "perdido", label: "Perdido", hint: "Registre o motivo para aprender com ele", accent: "#FF3B5C" },
];

export const PROPOSAL_TYPES: {
  id: ProposalType;
  label: string;
  short: string;
  description: string;
  pages: string;
}[] = [
  {
    id: "simples",
    label: "Proposta simples",
    short: "Simples",
    description: "Uma página objetiva: objeto, escopo resumido, investimento e condições. Para visitas rápidas e decisão imediata.",
    pages: "1–2 páginas · 5 blocos",
  },
  {
    id: "completa",
    label: "Proposta completa",
    short: "Completa",
    description: "Memorial técnico com 19 blocos: objeto, empresa, escopo, layout, normas, aterramento, matriz de responsabilidade, ART, garantia e confidencialidade.",
    pages: "6–10 páginas · 19 blocos",
  },
  {
    id: "produtos_servicos",
    label: "Somente produtos / serviços",
    short: "Produtos & serviços",
    description: "Orçamento enxuto de itens: quantidade, especificação, preço unitário e total. Ideal para reposição, avulsa ou venda de serviço.",
    pages: "1 página · tabela de itens",
  },
];

export function isProposalType(value: string): value is ProposalType {
  return value === "simples" || value === "completa" || value === "produtos_servicos";
}

export function isStage(value: string): value is ProposalStage {
  return STAGES.some((s) => s.id === value);
}
