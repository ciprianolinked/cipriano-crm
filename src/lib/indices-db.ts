import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { economicIndexValues, ipcaHistory } from "@/db/schema";
import { INDEXES, isOfficialIndex, type IndexObservation } from "@/lib/indices";

export async function getIndexObservations(): Promise<IndexObservation[]> {
  const [rows, legacy] = await Promise.all([
    db.select().from(economicIndexValues).orderBy(asc(economicIndexValues.month)),
    db.select().from(ipcaHistory).orderBy(asc(ipcaHistory.month)),
  ]);
  const combined = new Map<string, IndexObservation>();
  for (const row of legacy) {
    combined.set(`IPCA:${row.month}`, { indexName: "IPCA", month: row.month, percentMilli: row.pct * 10, source: row.source });
  }
  for (const row of rows) {
    combined.set(`${row.indexName}:${row.month}`, {
      indexName: row.indexName,
      month: row.month,
      percentMilli: row.percentMilli,
      source: row.source,
    });
  }
  return Array.from(combined.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export async function saveIndexObservation(indexName: string, month: string, pct: number, source = "manual") {
  if (!isOfficialIndex(indexName) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Índice ou mês inválido.");
  if (!Number.isFinite(pct) || pct <= -100 || pct > 1000) throw new Error("Percentual inválido.");
  const [row] = await db
    .insert(economicIndexValues)
    .values({ indexName, month, percentMilli: Math.round(pct * 1000), source })
    .onConflictDoUpdate({
      target: [economicIndexValues.indexName, economicIndexValues.month],
      set: { percentMilli: Math.round(pct * 1000), source, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function syncIndexesFromBcb() {
  const [existing, legacyManual] = await Promise.all([
    db.select().from(economicIndexValues).where(eq(economicIndexValues.source, "manual")),
    db.select().from(ipcaHistory).where(eq(ipcaHistory.source, "manual")),
  ]);
  const manualKeys = new Set([
    ...existing.map((r) => `${r.indexName}:${r.month}`),
    ...legacyManual.map((r) => `IPCA:${r.month}`),
  ]);
  const results = await Promise.all(
    INDEXES.map(async (index) => {
      try {
        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear() - 5, now.getUTCMonth(), 1));
        const formatDate = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
        const query = new URLSearchParams({ formato: "json", dataInicial: formatDate(start), dataFinal: formatDate(now) });
        const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${index.series}/dados?${query}`;
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error("resposta inválida");
        let saved = 0;
        let valid = 0;
        for (const item of data as { data?: string; valor?: string }[]) {
          const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(item.data ?? ""));
          const pct = Number(String(item.valor ?? "").replace(",", "."));
          if (!match || !Number.isFinite(pct) || pct <= -100 || pct > 1000) continue;
          const month = `${match[3]}-${match[2]}`;
          valid++;
          if (manualKeys.has(`${index.id}:${month}`)) continue;
          await saveIndexObservation(index.id, month, pct, "bcb");
          saved++;
        }
        if (!valid) throw new Error("nenhuma observação válida");
        return { indexName: index.id, saved, error: null as string | null };
      } catch (error) {
        return { indexName: index.id, saved: 0, error: error instanceof Error ? error.message : "indisponível" };
      }
    }),
  );
  return results;
}
