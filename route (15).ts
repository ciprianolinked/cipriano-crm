import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { maintenanceContracts, maintenanceDocumentRevisions, maintenanceReadjusts } from "@/db/schema";
import { addMonths } from "@/lib/maintenance";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db.select().from(maintenanceContracts).where(eq(maintenanceContracts.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
  return NextResponse.json({ contract: row });
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const [current] = await db.select().from(maintenanceContracts).where(eq(maintenanceContracts.id, id)).limit(1);
  if (!current) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
  const maintenance = current.contractKind === "manutencao";
  const patch: Partial<typeof maintenanceContracts.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.clientName === "string" && body.clientName.trim()) patch.clientName = body.clientName.trim();
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();
  if (typeof body.description === "string") patch.description = body.description.trim() || null;
  if (typeof body.status === "string" && ["rascunho", "ativo", "suspenso"].includes(body.status)) patch.status = body.status;
  if (maintenance && typeof body.indexName === "string" && body.indexName.trim()) {
    const name = body.indexName.trim().slice(0, 50);
    if (name === "OUTRO") return NextResponse.json({ error: "Informe o nome do índice." }, { status: 400 });
    if (current.status === "ativo" && name !== current.indexName && body.agreedChange !== true) return NextResponse.json({ error: "Confirme o acordo com o cliente para trocar o índice." }, { status: 400 });
    patch.indexName = name;
  }
  const amount = maintenance ? body.monthlyValue : body.contractValue;
  if (amount !== undefined) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount > 10_000_000) return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
    if (maintenance) patch.monthlyCents = Math.round(amount * 100);
    else patch.contractValueCents = Math.round(amount * 100);
  }
  const currentAmount = maintenance ? patch.monthlyCents ?? current.monthlyCents : patch.contractValueCents ?? current.contractValueCents;
  if (body.status === "ativo" && currentAmount <= 0) return NextResponse.json({ error: "Defina o valor do contrato antes de ativar." }, { status: 400 });
  if (typeof body.startDate === "string" && body.startDate) {
    const date = new Date(`${body.startDate.slice(0, 10)}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "Data inválida." }, { status: 400 });
    patch.startDate = date;
    if (maintenance && !current.lastReadjustAt) patch.nextReadjustAt = addMonths(date, current.cycleMonths);
  }
  const newText = typeof body.contractText === "string" ? body.contractText : undefined;
  if (newText !== undefined && newText.length > 60000) return NextResponse.json({ error: "Texto muito longo." }, { status: 400 });
  const textChanged = newText !== undefined && newText !== current.contractText;
  if (textChanged) {
    patch.contractText = newText;
    patch.documentRevision = current.documentRevision + 1;
    patch.generationSource = body.generationSource === "ia" ? "ia" : "manual";
  }
  const row = await db.transaction(async (tx) => {
    const [updated] = await tx.update(maintenanceContracts).set(patch).where(and(eq(maintenanceContracts.id, id), eq(maintenanceContracts.documentRevision, current.documentRevision))).returning();
    if (!updated) return null;
    if (textChanged) await tx.insert(maintenanceDocumentRevisions).values({ contractId: id, revision: current.documentRevision, body: current.contractText, note: typeof body.revisionNote === "string" ? body.revisionNote.slice(0, 500) : "Versão anterior ao salvamento" });
    return updated;
  });
  if (!row) return NextResponse.json({ error: "O contrato mudou durante a edição. Atualize a página e confira antes de salvar." }, { status: 409 });
  return NextResponse.json({ contract: row });
}
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.transaction(async (tx) => {
    await tx.delete(maintenanceDocumentRevisions).where(eq(maintenanceDocumentRevisions.contractId, id));
    await tx.delete(maintenanceReadjusts).where(eq(maintenanceReadjusts.contractId, id));
    await tx.delete(maintenanceContracts).where(eq(maintenanceContracts.id, id));
  });
  return NextResponse.json({ ok: true });
}
