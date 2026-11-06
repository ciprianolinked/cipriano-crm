import type { MaintenanceContractRow, MaintenanceReadjustRow } from "@/db/schema";
import { calculateIndex, compareIndexes, contractualWindow, isOfficialIndex, type IndexComparison, type IndexObservation } from "@/lib/indices";

export type IpcaRow = { id?: string; month: string; pct: number; source?: string | null };
export type ReadjustInput = Pick<MaintenanceReadjustRow, "id" | "readjustAt" | "oldMonthlyCents" | "newMonthlyCents" | "ipcaPct" | "percentMilli" | "indexName" | "source" | "note">;
export type ReadjustInfo = {
  id: string;
  readjustAt: string;
  oldMonthlyCents: number;
  newMonthlyCents: number;
  ipcaPct: number;
  percentMilli: number | null;
  indexName: string;
  source: string;
  note: string | null;
};
export type DerivedContract = {
  id: string;
  clientId: string | null;
  clientName: string;
  title: string;
  description: string | null;
  proposalId: string | null;
  proposalNumber: string | null;
  proposalRevision: number | null;
  documentRevision: number;
  hasDocument: boolean;
  generationSource: string;
  monthlyCents: number;
  startDate: string;
  cycleMonths: number;
  indexName: string;
  status: string;
  lastReadjustAt: string | null;
  nextReadjustAt: string;
  lastReadjustPct: number;
  daysToReadjust: number;
  alert: boolean;
  overdue: boolean;
  accumulatedPct: number;
  accumulatedMissing: number;
  accumulatedTotal: number;
  ipcaComplete: boolean;
  indexComplete: boolean;
  projectedCents: number | null;
  comparison: IndexComparison;
  readjusts: ReadjustInfo[];
};

export const addMonths = (date: Date, months: number): Date => {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
};
export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
export const monthKeyFromId = (id: string) => {
  const digits = id.replace(/\D/g, "");
  return digits.length >= 6 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}` : "";
};
export function monthRange(from: Date, to: Date): string[] {
  const out: string[] = [];
  let cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor <= end && out.length < 120) { out.push(monthKey(cursor)); cursor = addMonths(cursor, 1); }
  return out;
}
/** Compatibilidade com registros antigos: acumulação composta. */
export function accumulatedIpca(from: Date, to: Date, history: IpcaRow[]) {
  const months = monthRange(from, to);
  const result = calculateIndex("IPCA", months, history.map((h) => ({ indexName: "IPCA", month: h.month, percentMilli: h.pct * 10, source: h.source ?? "manual" })));
  return { pct: Math.round((result.accumulatedPct ?? 0) * 100), missing: result.missingMonths.length, total: months.length, missingMonths: result.missingMonths };
}
export function projectedValue(baseCents: number, pctHundredths: number) { return Math.round(baseCents * (1 + pctHundredths / 10000)); }
export const daysUntil = (d: Date) => {
  const now = new Date();
  return Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86_400_000);
};
export const formatPct = (hundredths: number) => `${(hundredths / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
export const parsePercentToHundredths = (value: number | string) => {
  if (String(value).trim() === "") return null;
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  return Number.isFinite(n) && n > -100 && n <= 1000 ? Math.round(n * 100) : null;
};
export const nextReadjustDate = (c: { startDate: Date | string; cycleMonths: number; nextReadjustAt: Date | string | null }) =>
  c.nextReadjustAt ? new Date(c.nextReadjustAt) : addMonths(new Date(c.startDate), c.cycleMonths);

export function deriveContract(c: MaintenanceContractRow, readjusts: ReadjustInput[], observations: IndexObservation[]): DerivedContract {
  const start = new Date(c.startDate);
  const next = nextReadjustDate(c);
  const days = daysUntil(next);
  const window = contractualWindow(next);
  const actual = isOfficialIndex(c.indexName) ? calculateIndex(c.indexName, window.months, observations) : null;
  const complete = actual?.accumulatedPct !== null && actual?.accumulatedPct !== undefined;
  const pct = complete ? actual!.accumulatedPct! : 0;
  return {
    id: c.id, clientId: c.clientId, clientName: c.clientName, title: c.title, description: c.description,
    proposalId: c.proposalId, proposalNumber: c.proposalNumber, proposalRevision: c.proposalRevision,
    documentRevision: c.documentRevision, hasDocument: Boolean(c.contractText), generationSource: c.generationSource,
    monthlyCents: c.monthlyCents, startDate: start.toISOString(), cycleMonths: c.cycleMonths,
    indexName: c.indexName, status: c.status,
    lastReadjustAt: c.lastReadjustAt?.toISOString() ?? null, nextReadjustAt: next.toISOString(), lastReadjustPct: c.lastReadjustPct,
    daysToReadjust: days, overdue: days < 0, alert: c.status === "ativo" && days <= 30,
    accumulatedPct: Math.round(pct * 100), accumulatedMissing: actual?.missingMonths.length ?? 12, accumulatedTotal: 12,
    ipcaComplete: complete, indexComplete: complete,
    projectedCents: complete ? Math.round(c.monthlyCents * (1 + pct / 100)) : null,
    comparison: compareIndexes(observations, next),
    readjusts: readjusts.map((r) => ({ ...r, readjustAt: new Date(r.readjustAt).toISOString() })).sort((a, b) => b.readjustAt.localeCompare(a.readjustAt)),
  };
}
export type ContractRowLike = MaintenanceContractRow;
export const formatMonthLabel = (month: string) => {
  const [y, m] = month.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(m) - 1] ?? m}/${y.slice(2)}`;
};
