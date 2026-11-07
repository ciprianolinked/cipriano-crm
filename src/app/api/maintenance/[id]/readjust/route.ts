import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { maintenanceContracts, maintenanceReadjusts } from "@/db/schema";
import { calculateIndex, contractualWindow, isOfficialIndex, parseManualPct } from "@/lib/indices";
import { getIndexObservations } from "@/lib/indices-db";
import { addMonths, daysUntil, nextReadjustDate } from "@/lib/maintenance";

export const dynamic = "force-dynamic";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { pct?: number | string; manualPct?: number | string; indexName?: string; note?: string; agreedChange?: boolean };
  const [contract] = await db.select().from(maintenanceContracts).where(eq(maintenanceContracts.id, id)).limit(1);
  if (!contract) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
  if (contract.contractKind !== "manutencao") return NextResponse.json({ error: "Reajuste recorrente é exclusivo de contratos de manutenção mensal." }, { status: 400 });
  if (contract.status !== "ativo") return NextResponse.json({ error: "Ative o contrato antes de aplicar um reajuste." }, { status: 400 });
  const due = nextReadjustDate(contract);
  if (daysUntil(due) > 0) return NextResponse.json({ error: "O reajuste ainda não venceu. A comparação é uma simulação; aplique a partir da data de aniversário." }, { status: 400 });
  const name = String(body.indexName ?? contract.indexName).trim().slice(0, 50) || contract.indexName;
  if (name === "OUTRO") return NextResponse.json({ error: "Informe o nome do outro índice." }, { status: 400 });
  if (name !== contract.indexName && !body.agreedChange) return NextResponse.json({ error: "A troca do índice exige confirmação de acordo com o cliente." }, { status: 400 });
  const win = contractualWindow(due);
  const manualInput = body.manualPct ?? body.pct;
  const manualProvided = manualInput !== undefined && String(manualInput).trim() !== "";
  let percent: number;
  let source: string;
  if (manualProvided) {
    const parsed = parseManualPct(manualInput);
    if (parsed === null) return NextResponse.json({ error: "Percentual manual inválido." }, { status: 400 });
    percent = parsed;
    source = "manual";
  } else {
    if (!isOfficialIndex(name)) return NextResponse.json({ error: "Para outro índice, informe o percentual acumulado manualmente." }, { status: 400 });
    const computed = calculateIndex(name, win.months, await getIndexObservations());
    if (computed.accumulatedPct === null) return NextResponse.json({ error: `Dados incompletos de ${name}: faltam ${computed.missingMonths.length} meses no período contratual. Atualize os índices ou informe um percentual manual.` }, { status: 400 });
    percent = computed.accumulatedPct;
    source = computed.source;
  }
  const oldCents = contract.monthlyCents;
  const newCents = Math.round(oldCents * (1 + percent / 100));
  const pctHundredths = Math.round(percent * 100);
  const updated = await db.transaction(async (tx) => {
    // A condição evita aplicar o mesmo aniversário duas vezes em cliques concorrentes.
    const [row] = await tx.update(maintenanceContracts).set({
      monthlyCents: newCents, lastReadjustAt: due, nextReadjustAt: addMonths(due, contract.cycleMonths),
      lastReadjustPct: pctHundredths, indexName: name, updatedAt: new Date(),
    }).where(and(
      eq(maintenanceContracts.id, id),
      eq(maintenanceContracts.monthlyCents, oldCents),
      contract.nextReadjustAt ? eq(maintenanceContracts.nextReadjustAt, due) : isNull(maintenanceContracts.nextReadjustAt),
    )).returning();
    if (!row) return null;
    await tx.insert(maintenanceReadjusts).values({ contractId: id, readjustAt: due, oldMonthlyCents: oldCents, newMonthlyCents: newCents, ipcaPct: pctHundredths, percentMilli: Math.round(percent * 1000), indexName: name, periodStart: win.start, periodEnd: win.end, source, note: String(body.note ?? "").trim() || null });
    return row;
  });
  if (!updated) return NextResponse.json({ error: "O contrato foi alterado. Atualize a página e confira o próximo ciclo." }, { status: 409 });
  return NextResponse.json({ contract: updated, oldCents, newCents, percent, source, period: win });
}
