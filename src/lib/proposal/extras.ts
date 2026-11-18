import type { AutoItemKey, ProposalItem } from "@/lib/proposal/types";

/**
 * Adicionais presentes em toda proposta de projeto/produtos/serviços (exceto manutenção mensal):
 * miscelâneas, infraestrutura e margem de segurança (percentuais sobre os equipamentos)
 * e mão de obra (valor definido proposta a proposta).
 */
export type ProposalExtras = {
  enabled: boolean;
  miscPct: number;
  infraPct: number;
  safetyPct: number;
  laborValue: number;
};

/** Valores iniciais sugeridos; o último usado numa proposta é reaproveitado na próxima. */
export const DEFAULT_EXTRAS: ProposalExtras = {
  enabled: true,
  miscPct: 3,
  infraPct: 5,
  safetyPct: 5,
  laborValue: 0,
};

export const AUTO_KEYS: AutoItemKey[] = ["misc", "infra", "safety", "labor"];

const TEMPLATES: Record<AutoItemKey, { kind: ProposalItem["kind"]; desc: string; spec: string; unit: string }> = {
  misc: {
    kind: "equipamento",
    desc: "Miscelâneas",
    spec: "Conectores, abraçadeiras, fixadores, fitas e demais materiais de consumo",
    unit: "vb",
  },
  infra: {
    kind: "equipamento",
    desc: "Infraestrutura",
    spec: "Eletrodutos, canaletas, caixas de passagem, suportes e acessórios de instalação",
    unit: "vb",
  },
  safety: {
    kind: "equipamento",
    desc: "Margem de segurança",
    spec: "Reserva técnica para variações de preço e imprevistos de execução",
    unit: "vb",
  },
  labor: {
    kind: "servico",
    desc: "Mão de obra",
    spec: "Instalação, configuração, comissionamento e testes de aceite",
    unit: "vb",
  },
};

export const AUTO_LABEL: Record<AutoItemKey, string> = {
  misc: "Miscelâneas",
  infra: "Infraestrutura",
  safety: "Margem de segurança",
  labor: "Mão de obra",
};

export const isAutoItem = (item: ProposalItem) => Boolean(item.auto);

/** Normaliza o objeto salvo no briefing (aceita valores ausentes ou inválidos). */
export function readExtras(briefing: unknown): ProposalExtras | null {
  if (!briefing || typeof briefing !== "object") return null;
  const raw = (briefing as { extras?: unknown }).extras;
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<Record<keyof ProposalExtras, unknown>>;
  const num = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    enabled: value.enabled !== false,
    miscPct: Math.min(100, num(value.miscPct, DEFAULT_EXTRAS.miscPct)),
    infraPct: Math.min(100, num(value.infraPct, DEFAULT_EXTRAS.infraPct)),
    safetyPct: Math.min(100, num(value.safetyPct, DEFAULT_EXTRAS.safetyPct)),
    laborValue: Math.min(100_000_000, num(value.laborValue, 0)),
  };
}

/** Base de cálculo: equipamentos "reais" da proposta, sem os próprios adicionais. */
export function equipmentBase(items: ProposalItem[]): number {
  return items
    .filter((item) => item.kind === "equipamento" && !item.auto)
    .reduce((sum, item) => sum + Math.max(0, item.qty) * item.price, 0);
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

/** Valor (R$) de cada adicional para o conjunto atual de itens. */
export function extrasBreakdown(items: ProposalItem[], extras: ProposalExtras) {
  const base = equipmentBase(items);
  const pctValue = (pct: number) => roundMoney((base * pct) / 100);
  return {
    base,
    misc: pctValue(extras.miscPct),
    infra: pctValue(extras.infraPct),
    safety: pctValue(extras.safetyPct),
    labor: roundMoney(extras.laborValue),
  };
}

/**
 * Recalcula os adicionais e devolve a lista final de itens.
 * - Remove os itens automáticos antigos, preservando descrição/especificação/unidade editadas.
 * - Só cria linha quando o percentual (ou o valor da mão de obra) for maior que zero.
 * - Com `enabled: false` os adicionais são removidos.
 */
export function applyExtras(items: ProposalItem[], extras: ProposalExtras | null): ProposalItem[] {
  const previous = new Map<AutoItemKey, ProposalItem>();
  for (const item of items) if (item.auto) previous.set(item.auto, item);
  const regular = items.filter((item) => !item.auto);
  if (!extras || !extras.enabled) return regular;

  const breakdown = extrasBreakdown(regular, extras);
  const next: ProposalItem[] = [];
  const push = (key: AutoItemKey, price: number, pct?: number) => {
    if (!(price > 0)) return;
    const old = previous.get(key);
    const tpl = TEMPLATES[key];
    next.push({
      id: old?.id ?? `auto-${key}`,
      kind: tpl.kind,
      desc: old?.desc?.trim() ? old.desc : tpl.desc,
      spec: old ? old.spec : tpl.spec,
      unit: old?.unit?.trim() ? old.unit : tpl.unit,
      qty: 1,
      price,
      auto: key,
      ...(pct !== undefined ? { pct } : {}),
    });
  };
  push("misc", breakdown.misc, extras.miscPct);
  push("infra", breakdown.infra, extras.infraPct);
  push("safety", breakdown.safety, extras.safetyPct);
  push("labor", breakdown.labor);
  return [...regular, ...next];
}

/** Rótulo curto exibido ao lado do item automático (ex.: "3% sobre equipamentos"). */
export function autoItemNote(item: ProposalItem): string {
  if (!item.auto || item.auto === "labor") return "";
  return item.pct ? `${String(item.pct).replace(".", ",")}% sobre o valor dos equipamentos` : "";
}

export const AUTO_GROUP_LABEL = "Complementos do projeto";
