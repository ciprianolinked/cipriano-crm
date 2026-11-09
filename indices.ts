export const INDEXES = [
  { id: "IPCA", name: "IPCA", publisher: "IBGE", series: 433, description: "Inflação ampla ao consumidor" },
  { id: "IGP-M", name: "IGP-M", publisher: "FGV", series: 189, description: "Preços de mercado, indústria e construção" },
  { id: "INPC", name: "INPC", publisher: "IBGE", series: 188, description: "Inflação ao consumidor" },
] as const;

export type IndexName = (typeof INDEXES)[number]["id"];
export type IndexObservation = { indexName: string; month: string; percentMilli: number; source: string };
export type IndexResult = {
  indexName: IndexName;
  publisher: string;
  accumulatedPct: number | null;
  missingMonths: string[];
  source: string;
};
export type IndexComparison = {
  periodStart: string;
  periodEnd: string;
  contractualStart: string;
  contractualEnd: string;
  provisional: boolean;
  lowest: IndexName | null;
  results: IndexResult[];
};

export const isOfficialIndex = (name: string): name is IndexName =>
  INDEXES.some((i) => i.id === name);

export function monthOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, offset: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + offset, 1));
  return monthOf(date);
}

export function monthsEndingAt(endMonth: string, count = 12): string[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(endMonth, i - count + 1));
}

/** Acúmulo composto, não soma de percentuais mensais. */
export function calculateIndex(
  name: IndexName,
  months: string[],
  observations: IndexObservation[],
): IndexResult {
  const index = INDEXES.find((i) => i.id === name)!;
  const map = new Map(observations.filter((o) => o.indexName === name).map((o) => [o.month, o]));
  const missingMonths = months.filter((month) => !map.has(month));
  const sources = new Set(months.map((m) => map.get(m)?.source).filter(Boolean));
  let factor = 1;
  for (const month of months) {
    const value = map.get(month);
    if (value) factor *= 1 + value.percentMilli / 100000;
  }
  return {
    indexName: name,
    publisher: index.publisher,
    accumulatedPct: missingMonths.length === 0 && months.length > 0 ? Math.round((factor - 1) * 100000) / 1000 : null,
    missingMonths,
    source: sources.size === 0 ? "sem dados" : sources.has("manual") ? "BCB / lançamento manual" : "BCB / SGS",
  };
}

/** Janela contratual: 12 meses encerrados no mês anterior ao aniversário. */
export function contractualWindow(nextReadjustAt: Date | string) {
  const end = shiftMonth(monthOf(new Date(nextReadjustAt)), -1);
  return { start: shiftMonth(end, -11), end, months: monthsEndingAt(end) };
}

/**
 * Compara índices sempre na mesma janela. Se a janela contratual ainda não foi publicada,
 * usa o período mais recente de 12 meses completo para TODOS os índices como prévia.
 */
export function compareIndexes(observations: IndexObservation[], nextReadjustAt?: Date | string): IndexComparison {
  const contractual = nextReadjustAt
    ? contractualWindow(nextReadjustAt)
    : (() => {
        const end = shiftMonth(monthOf(new Date()), -1);
        return { start: shiftMonth(end, -11), end, months: monthsEndingAt(end) };
      })();
  const exact = INDEXES.map((i) => calculateIndex(i.id, contractual.months, observations));
  let months = contractual.months;
  let results = exact;
  let provisional = false;

  if (exact.some((r) => r.accumulatedPct === null)) {
    // Nunca comparar dados futuros ou mais recentes do que o fim da janela contratual.
    const latestAllowed = [contractual.end, shiftMonth(monthOf(new Date()), -1)].sort()[0];
    for (let offset = 0; offset < 36; offset++) {
      const end = shiftMonth(latestAllowed, -offset);
      const candidate = monthsEndingAt(end);
      const computed = INDEXES.map((i) => calculateIndex(i.id, candidate, observations));
      if (computed.every((r) => r.accumulatedPct !== null)) {
        months = candidate;
        results = computed;
        provisional = end !== contractual.end;
        break;
      }
    }
  }

  const comparable = results.filter((r) => r.accumulatedPct !== null);
  const lowest =
    comparable.length >= 2
      ? [...comparable].sort((a, b) => a.accumulatedPct! - b.accumulatedPct!)[0].indexName
      : null;

  return {
    periodStart: months[0],
    periodEnd: months[months.length - 1],
    contractualStart: contractual.start,
    contractualEnd: contractual.end,
    provisional,
    lowest,
    results,
  };
}

export function formatIndexPct(value: number | null): string {
  return value === null ? "Indisponível" : `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}%`;
}

export function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  return `${m}/${y}`;
}

export function parseManualPct(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) && n > -100 && n <= 1000 ? n : null;
}
