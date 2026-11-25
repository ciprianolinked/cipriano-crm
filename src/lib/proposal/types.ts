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
  /** Disciplina/escopo do item (CFTV IP, Controle de Acesso...). */
  scope?: string;
  /** Item calculado automaticamente (ex.: custos indiretos sobre equipamentos). */
  auto?: "indirect";
  /** Preço de custo unitário antes da margem de segurança (equipamentos). Interno. */
  basePrice?: number;
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
  /** Cabeçalho próprio para tabelas de resumo por escopo. */
  columns?: string[];
  locked?: boolean;
};

/** Todos os textos do bloco VALOR são editáveis por proposta. Campos vazios usam o padrão. */
export type ValueBlockConfig = {
  primaryLabel?: string;
  primaryNote?: string;
  resumoLabel?: string;
  subtotalLabel?: string;
  discountLabel?: string;
  installmentLabel?: string;
  /** Parcelamento sem juros no cartão: 1 a 60 vezes. */
  installments?: number;
  /** Rótulo do total à vista (ex.: "Total à vista / 1x"). */
  totalLabel?: string;
  /** Percentual de entrada na assinatura (0 a 100). O restante é pago na entrega técnica. */
  entryPct?: number;
  paymentTitle?: string;
  entryLabel?: string;
  balanceLabel?: string;
  cardLabel?: string;
  paymentLabel?: string;
  deadlineLabel?: string;
  warrantyLabel?: string;
  validityLabel?: string;
};

/** Opção de comodato: equipamentos cedidos ao cliente mediante mensalidade. */
export type ComodatoConfig = {
  enabled: boolean;
  termMonths: number;
  /** null = mensalidade automática (valor dos equipamentos ÷ prazo). */
  monthlyCents: number | null;
  /** Valor para aquisição dos equipamentos ao final do prazo (opcional). */
  residualCents: number;
};

export type MaintenancePlan = {
  preventive: boolean;
  corrective: boolean;
  visitsPerMonth: number;
  correctiveVisitsPerMonth: number;
  responseHours: number;
  serviceHours: string;
  coveredEquipment: string;
  partsCoverage: string;
  monthlyPrice: number;
  termMonths: number;
  dueDay: number;
  startDate: string;
  indexName: string;
};

export type Briefing = {
  purpose?: "projeto" | "manutencao_mensal";
  maintenancePlan?: MaintenancePlan;
  wantsContract?: boolean;
  segment: string;
  cameras: number;
  doors: number;
  fenceMeters: number;
  /** @deprecated A empresa não oferece monitoramento 24h. Mantido por compatibilidade; sempre falso em novas propostas. */
  monitoring: boolean;
  alarm: boolean;
  intercom: boolean;
  network: boolean;
  maintenance: boolean;
  notes: string;
  priority: "prazo" | "orcamento" | "tecnica" | "seguranca";
  /** Percentual de miscelâneas e fixadores sobre equipamentos (padrão: 8%) */
  miscPct?: number;
  /** Percentual de infraestrutura seca e eletrodutos sobre equipamentos (padrão: 10%) */
  infraPct?: number;
  /** Margem de segurança técnica e contingência sobre equipamentos (padrão: 5%) */
  marginPct?: number;
  /** Valor específico de mão de obra para a proposta (em Reais) */
  laborValue?: number;
  /** Título/cabeçalho personalizado da proposta (opcional) */
  customKicker?: string;
  /** Textos e parcelamento do bloco VALOR (editáveis direto no documento) */
  valueBlock?: ValueBlockConfig;
  /** Versão comodato (opcional) */
  comodato?: ComodatoConfig;
  /** Itens gerados automaticamente pelos custos indiretos (recalculados ao mudar equipamentos) */
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
  installments: number;
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
