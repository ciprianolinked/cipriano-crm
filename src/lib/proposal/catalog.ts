import type { Briefing, ProposalItem, ProposalType, Totals } from "@/lib/proposal/types";

export type CatalogSeed = {
  kind: "equipamento" | "servico";
  category: string;
  description: string;
  spec: string;
  unit: string;
  supplierPriceCents: number; // o que você paga ao fornecedor
  marginPct: number; // BDI / markup de venda (%)
};

export const defaultBriefing: Briefing = {
  segment: "Condomínio residencial",
  cameras: 8,
  doors: 2,
  fenceMeters: 60,
  monitoring: true,
  alarm: false,
  intercom: false,
  network: true,
  maintenance: false,
  notes: "",
  priority: "seguranca",
};

export const SEGMENTS = [
  "Condomínio residencial",
  "Condomínio comercial",
  "Indústria / galpão",
  "Varejo / loja",
  "Escritório / clínica",
  "Escola",
  "Residência de alto padrão",
  "Obra / canteiro",
  "Outro",
];

export const PRIORITIES: { id: Briefing["priority"]; label: string; hint: string }[] = [
  { id: "seguranca", label: "Reduzir risco / invasão", hint: "Foco em perímetro, analítico e resposta rápida" },
  { id: "prazo", label: "Prazo curto", hint: "Kit padronizado e cronograma enxuto" },
  { id: "orcamento", label: "Orçamento apertado", hint: "Prioriza fases e reaproveita infraestrutura" },
  { id: "tecnica", label: "Exigência técnica / norma", hint: "Projeto, ART e documentação as-built" },
];

/** Preço de venda = preço do fornecedor + BDI/markup (margem de lucro). */
export function salePriceFromSupplier(supplierPriceCents: number, marginPct: number): number {
  const margin = Math.max(0, Math.min(100, marginPct));
  return Math.round(supplierPriceCents * (1 + margin / 100));
}

export const catalogSeed: CatalogSeed[] = [
  {
    kind: "equipamento",
    category: "CFTV",
    description: "Câmera IP Bullet 4K ColorVu",
    spec: "Hikvision DS-2CD2087 · PoE · IR 40 m · IP67 · lente 2.8 mm",
    unit: "un",
    supplierPriceCents: 0,
    marginPct: 30,
  },
  {
    kind: "equipamento",
    category: "CFTV",
    description: "Câmera IP Dome 4K antivandalismo",
    spec: "IK10 · PoE · WDR 120 dB · áudio bidirecional",
    unit: "un",
    supplierPriceCents: 0,
    marginPct: 30,
  },
  {
    kind: "equipamento",
    category: "CFTV",
    description: "NVR 16 canais com 8 TB",
    spec: 'Rack 19" · RAID 1 · retenção de 30 dias · gravação 4K',
    unit: "un",
    supplierPriceCents: 0,
    marginPct: 30,
  },
  {
    kind: "equipamento",
    category: "CFTV",
    description: "HD de vigilância 8 TB (expansão)",
    spec: "Purple · 24/7 · gravação contínua",
    unit: "un",
    supplierPriceCents: 0,
    marginPct: 30,
  },
  {
    kind: "equipamento",
    category: "Acesso",
    description: "Controle de acesso biométrico facial",
    spec: "Facial + RFID · fechadura eletroímã 150 kgf · botoeira e sensor",
    unit: "porta",
    supplierPriceCents: 0,
    marginPct: 30,
  },
  {
    kind: "equipamento",
    category: "Perímetro",
    description: "Cerca elétrica perimetral",
    spec: "6 fios de aço inox 0,9 mm · central monitorada · sinalização a cada 3 m",
    unit: "m",
    supplierPriceCents: 0,
    marginPct: 35,
  },
  {
    kind: "equipamento",
    category: "Alarme",
    description: "Central de alarme monitorado",
    spec: "Painel híbrido · sensores IVP · sirene 110 dB · bateria 12 h",
    unit: "vb",
    supplierPriceCents: 0,
    marginPct: 30,
  },
  {
    kind: "equipamento",
    category: "Interfonia",
    description: "Interfonia IP com vídeo",
    spec: "Posto externo SIP · integração com fechadura e app do morador",
    unit: "vb",
    supplierPriceCents: 0,
    marginPct: 30,
  },
  {
    kind: "equipamento",
    category: "Rede",
    description: "Infraestrutura de rede, rack e energia protegida",
    spec: "Cat6 blindado · switch PoE gerenciável 24p · nobreak 1,5 kVA · aterramento e DPS",
    unit: "vb",
    supplierPriceCents: 0,
    marginPct: 30,
  },
  {
    kind: "equipamento",
    category: "Energia",
    description: "Aterramento e proteção elétrica",
    spec: "Malha de terra dedicada · DPS · DR · barramento equipotencial",
    unit: "vb",
    supplierPriceCents: 0,
    marginPct: 30,
  },
  {
    kind: "servico",
    category: "Instalação",
    description: "Instalação, configuração e comissionamento",
    spec: "Fixação, lançamento de cabos, ponteiras, configuração de software e testes",
    unit: "ponto",
    supplierPriceCents: 0,
    marginPct: 100,
  },
  {
    kind: "servico",
    category: "Projeto",
    description: "Projeto executivo, ART e as-built",
    spec: "Planta de pontos e topologia, memorial descritivo, ART CREA-SP e as-built",
    unit: "vb",
    supplierPriceCents: 0,
    marginPct: 100,
  },
  {
    kind: "servico",
    category: "Treinamento",
    description: "Treinamento operacional da equipe",
    spec: "4 h presencial · manual do operador · gravação da sessão",
    unit: "turma",
    supplierPriceCents: 0,
    marginPct: 100,
  },
  {
    kind: "servico",
    category: "Monitoramento",
    description: "Monitoramento NOC 24h",
    spec: "Verificação de imagem, ronda virtual e SLA de atendimento em 4 h",
    unit: "mês",
    supplierPriceCents: 0,
    marginPct: 100,
  },
  {
    kind: "servico",
    category: "Manutenção",
    description: "Manutenção preventiva e corretiva",
    spec: "Preventiva mensal, limpeza de lentes, reaperto, firmware e baterias",
    unit: "mês",
    supplierPriceCents: 0,
    marginPct: 100,
  },
];

export const roundCents = (reais: number) => Math.round(reais * 100);

export function calcTotals(items: ProposalItem[], discountPct: number): Totals {
  const subtotalCents = items.reduce((acc, item) => acc + roundCents(item.price) * Math.max(0, item.qty), 0);
  const offCents = Math.round((subtotalCents * Math.min(100, Math.max(0, discountPct))) / 100);
  const totalCents = subtotalCents - offCents;
  return {
    subtotalCents,
    offCents,
    totalCents,
    installmentCents: totalCents > 0 ? Math.round(totalCents / 12) : 0,
  };
}

export function suggestDiscount(briefing: Briefing, type: ProposalType): number {
  const load = briefing.cameras + briefing.doors * 2 + Math.round(briefing.fenceMeters / 20);
  if (type === "produtos_servicos") return load >= 12 ? 5 : 0;
  if (load >= 16) return 10;
  if (load >= 10) return 7;
  if (load >= 5) return 5;
  return 3;
}

export const typeLabels: Record<ProposalType, string> = {
  simples: "Proposta comercial",
  completa: "Proposta comercial completa",
  produtos_servicos: "Orçamento de produtos e serviços",
};
