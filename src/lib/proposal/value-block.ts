import { brl } from "@/lib/brand";
import type { ValueBlockConfig } from "@/lib/proposal/types";

export const MIN_INSTALLMENTS = 1;
export const MAX_INSTALLMENTS = 60;
export const DEFAULT_INSTALLMENTS = 3;
export const DEFAULT_ENTRY_PCT = 40;

export function clampInstallments(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < MIN_INSTALLMENTS) return DEFAULT_INSTALLMENTS;
  return Math.min(MAX_INSTALLMENTS, n);
}

export function clampEntryPct(value: unknown): number {
  if (value === undefined || value === null || value === "") return DEFAULT_ENTRY_PCT;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_ENTRY_PCT;
  return Math.min(100, Math.max(0, n));
}

export type ResolvedValueBlock = {
  primaryLabel: string;
  primaryNote: string;
  resumoLabel: string;
  subtotalLabel: string;
  discountLabel: string;
  installmentLabel: string;
  totalLabel: string;
  paymentTitle: string;
  entryLabel: string;
  balanceLabel: string;
  cardLabel: string;
  paymentLabel: string;
  deadlineLabel: string;
  warrantyLabel: string;
  validityLabel: string;
  installments: number;
  entryPct: number;
};

const text = (value: unknown, fallback: string) => {
  const s = String(value ?? "").trim();
  return s || fallback;
};

/** Itens no singular quando há apenas um: "1 item", "2 itens". */
export function itemCountLabel(count: number): string {
  return count === 1 ? "1 item" : `${count} itens`;
}

/**
 * Texto das condições de pagamento a partir da entrada (%) e do parcelamento.
 * É o mesmo texto que vai para "Condições comerciais", garantindo consistência.
 */
export function paymentTermsText(entryPct: number, installments: number): string {
  const entry = clampEntryPct(entryPct);
  const n = clampInstallments(installments);
  const card = n === 1 ? "pagamento à vista no cartão corporativo" : `${n}× no cartão corporativo sem juros`;
  if (entry >= 100) return "100% na assinatura";
  if (entry <= 0) return `100% na entrega técnica (ou ${card})`;
  return `${entry}% de entrada na assinatura · ${100 - entry}% na entrega técnica (ou ${card})`;
}

/**
 * Linhas de condições de pagamento (rótulo / valor), calculadas do total.
 * Usadas no documento, no PDF e no resumo do editor.
 */
export function paymentRows(
  block: Pick<ResolvedValueBlock, "entryLabel" | "balanceLabel" | "cardLabel" | "installments" | "entryPct">,
  totalCents: number,
): [string, string][] {
  const entry = clampEntryPct(block.entryPct);
  const rows: [string, string][] = [];
  const entryCents = Math.round((totalCents * entry) / 100);
  if (entry >= 100) {
    rows.push([`${block.entryLabel} · 100%`, `${brl(totalCents / 100)} na assinatura`]);
  } else if (entry <= 0) {
    rows.push([`${block.balanceLabel} · 100%`, `${brl(totalCents / 100)} na entrega técnica`]);
  } else {
    rows.push([`${block.entryLabel} · ${entry}%`, `${brl(entryCents / 100)} na assinatura`]);
    rows.push([`${block.balanceLabel} · ${100 - entry}%`, `${brl((totalCents - entryCents) / 100)} na entrega técnica`]);
  }
  return rows;
}

/**
 * Resolve os textos do bloco VALOR. O que foi personalizado no documento prevalece;
 * o restante usa o padrão da casa. Funciona com o briefing tipado ou com o jsonb do banco.
 */
export function resolveValueBlock(input: {
  briefing?: Record<string, unknown> | { valueBlock?: ValueBlockConfig } | null;
  maintenance: boolean;
  itemCount: number;
  discountPct: number;
  months?: number;
}): ResolvedValueBlock {
  const raw = (input.briefing as { valueBlock?: ValueBlockConfig } | null | undefined)?.valueBlock ?? {};
  const discountNote = input.discountPct > 0 ? ` · desconto comercial de ${input.discountPct}% já aplicado` : "";
  const defaultNote = input.maintenance
    ? `${input.months ?? 12} meses de vigência${discountNote}`
    : `${itemCountLabel(input.itemCount)}${discountNote}`;
  const installments = clampInstallments(raw.installments ?? DEFAULT_INSTALLMENTS);
  return {
    primaryLabel: text(raw.primaryLabel, input.maintenance ? "Mensalidade da manutenção" : "Investimento total"),
    primaryNote: text(raw.primaryNote, defaultNote),
    resumoLabel: text(raw.resumoLabel, "Resumo"),
    subtotalLabel: text(raw.subtotalLabel, "Subtotal"),
    discountLabel: text(raw.discountLabel, "Desconto"),
    installmentLabel: text(raw.installmentLabel, "sem juros"),
    totalLabel: text(raw.totalLabel, input.maintenance ? "Total do período" : "Total à vista / 1x"),
    paymentTitle: text(raw.paymentTitle, "Condições de pagamento"),
    entryLabel: text(raw.entryLabel, "Entrada"),
    balanceLabel: text(raw.balanceLabel, "Saldo"),
    cardLabel: text(raw.cardLabel, "Cartão corporativo"),
    paymentLabel: text(raw.paymentLabel, "Pagamento"),
    deadlineLabel: text(raw.deadlineLabel, "Prazo"),
    warrantyLabel: text(raw.warrantyLabel, "Garantia"),
    validityLabel: text(raw.validityLabel, "Validade"),
    installments,
    entryPct: clampEntryPct(raw.entryPct),
  };
}
