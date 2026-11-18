import { tx, readDocTexts } from "@/lib/proposal/doc-text";

const DEFAULT_INSTALLMENTS = 12;

export function getPaymentInstallments(briefing: unknown): number {
  if (!briefing || typeof briefing !== "object") return DEFAULT_INSTALLMENTS;
  const value = Number((briefing as { paymentInstallments?: unknown }).paymentInstallments);
  return Number.isInteger(value) && value >= 1 && value <= 60 ? value : DEFAULT_INSTALLMENTS;
}

export function installmentAmount(totalCents: number, installments: number): number {
  const safe = Math.min(60, Math.max(1, Math.round(installments || DEFAULT_INSTALLMENTS)));
  return Math.round(totalCents / safe);
}

export function paymentLabel(briefing: unknown): string {
  const installments = getPaymentInstallments(briefing);
  const texts = readDocTexts(briefing);
  return tx(texts, "miniFinal", `${installments}× de`);
}

export function parseInstallments(label: string): number | null {
  const match = label.trim().match(/^(\d{1,2})\s*(?:x|×)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value >= 1 && value <= 60 ? value : null;
}
