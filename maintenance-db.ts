import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { ipcaHistory, maintenanceContracts, maintenanceReadjusts } from "@/db/schema";
import { deriveContract, type DerivedContract, type IpcaRow } from "@/lib/maintenance";
import { compareIndexes, type IndexComparison, type IndexObservation } from "@/lib/indices";
import { getIndexObservations, saveIndexObservation, syncIndexesFromBcb } from "@/lib/indices-db";

export async function getIpcaHistory(): Promise<IpcaRow[]> {
  const rows = await getIndexObservations();
  return rows.filter((r) => r.indexName === "IPCA").map((r) => ({ month: r.month, pct: Math.round(r.percentMilli / 10), source: r.source }));
}

export async function getMaintenanceData(): Promise<{
  contracts: DerivedContract[];
  history: IpcaRow[];
  observations: IndexObservation[];
  comparison: IndexComparison;
  alerts: DerivedContract[];
  monthlyActiveCents: number;
}> {
  const [contracts, readjusts, observations] = await Promise.all([
    db.select().from(maintenanceContracts).where(eq(maintenanceContracts.contractKind, "manutencao")).orderBy(asc(maintenanceContracts.nextReadjustAt)),
    db.select().from(maintenanceReadjusts),
    getIndexObservations(),
  ]);
  const derived = contracts.map((c) => deriveContract(c, readjusts.filter((r) => r.contractId === c.id), observations));
  const alerts = derived.filter((d) => d.alert).sort((a, b) => a.daysToReadjust - b.daysToReadjust);
  return {
    contracts: derived,
    history: observations.filter((r) => r.indexName === "IPCA").map((r) => ({ month: r.month, pct: Math.round(r.percentMilli / 10), source: r.source })),
    observations,
    comparison: compareIndexes(observations),
    alerts,
    monthlyActiveCents: derived.filter((d) => d.status === "ativo").reduce((acc, d) => acc + d.monthlyCents, 0),
  };
}

/** Compatibilidade com o endpoint anterior: busca a série IPCA via SGS do BCB. */
export async function syncIpcaFromIbge(): Promise<{ added: number; error: string | null }> {
  const result = (await syncIndexesFromBcb()).find((r) => r.indexName === "IPCA");
  return { added: result?.saved ?? 0, error: result?.error ?? null };
}
export async function upsertIpcaMonth(month: string, pctHundredths: number, source = "manual") {
  return saveIndexObservation("IPCA", month, pctHundredths / 100, source);
}
export async function listRecentReadjusts(limit = 20) {
  const [rows, contracts] = await Promise.all([
    db.select().from(maintenanceReadjusts).orderBy(desc(maintenanceReadjusts.readjustAt)).limit(limit),
    db.select().from(maintenanceContracts),
  ]);
  const byId = new Map(contracts.map((c) => [c.id, c]));
  return rows.map((r) => ({
    id: r.id, contractId: r.contractId, clientName: byId.get(r.contractId)?.clientName ?? "—",
    title: byId.get(r.contractId)?.title ?? "—", readjustAt: r.readjustAt.toISOString(),
    oldMonthlyCents: r.oldMonthlyCents, newMonthlyCents: r.newMonthlyCents,
    ipcaPct: r.ipcaPct, percentMilli: r.percentMilli, indexName: r.indexName, source: r.source, note: r.note,
    periodStart: r.periodStart, periodEnd: r.periodEnd,
  }));
}
