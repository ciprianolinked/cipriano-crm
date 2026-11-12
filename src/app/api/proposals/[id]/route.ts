import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { activities, proposals } from "@/db/schema";
import { deleteProposalFamily } from "@/lib/proposal/delete";
import { calcTotals } from "@/lib/proposal/catalog";
import { isProposalType, isStage, type ProposalItem, type ProposalSection } from "@/lib/proposal/types";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  if (rows.length === 0) return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  return NextResponse.json({ proposal: rows[0] });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  const strings = [
    "clientName",
    "contact",
    "clientEmail",
    "site",
    "paymentTerms",
    "deliveryTime",
    "warranty",
    "lossReason",
    "nextActionNote",
    "status",
  ] as const;

  for (const key of strings) {
    if (key in body) patch[key] = body[key] === null ? null : String(body[key] ?? "");
  }

  if ("type" in body && typeof body.type === "string" && isProposalType(body.type)) patch.type = body.type;
  if ("status" in body && typeof body.status === "string" && isStage(body.status)) {
    patch.status = body.status;
    if (body.status === "enviada" || body.status === "negociacao") {
      const existing = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
      if (existing[0] && !existing[0].sentAt) patch.sentAt = new Date();
      const openFollow = await db
        .select()
        .from(activities)
        .where(and(eq(activities.proposalId, id), eq(activities.kind, "seguimento"), isNull(activities.doneAt)))
        .limit(1);
      if (openFollow.length === 0) {
        const dueAt = new Date(Date.now() + 2 * 86_400_000);
        await db.insert(activities).values({
          proposalId: id,
          kind: "seguimento",
          content: "Follow-up D+2: confirmar recebimento da proposta e identificar o decisor.",
          dueAt,
        });
        patch.nextActionAt = dueAt;
        patch.nextActionNote = "Follow-up D+2: confirmar recebimento e identificar o decisor.";
      }
    }
    if (body.status === "ganho" || body.status === "perdido") patch.closedAt = new Date();
    if (body.status === "ganho" || body.status === "perdido") {
      await db
        .update(activities)
        .set({ doneAt: new Date() })
        .where(and(eq(activities.proposalId, id), eq(activities.kind, "seguimento"), isNull(activities.doneAt)));
      patch.nextActionAt = null;
      patch.nextActionNote = null;
    }
  }

  if (typeof body.archived === "boolean") patch.archived = body.archived;
  if (typeof body.artIncluded === "boolean") patch.artIncluded = body.artIncluded;
  if (typeof body.validityDays === "number") patch.validityDays = Math.max(1, Math.round(body.validityDays));
  if (body.nextActionAt === null) patch.nextActionAt = null;
  else if (typeof body.nextActionAt === "string" && body.nextActionAt) patch.nextActionAt = new Date(body.nextActionAt);
  if ("clientId" in body) patch.clientId = body.clientId || null;
  if ("number" in body && typeof body.number === "string" && body.number.trim()) {
    patch.number = body.number.trim();
  }
  if ("issuedAt" in body && (typeof body.issuedAt === "string" || typeof body.issuedAt === "number" || body.issuedAt instanceof Date)) {
    const parsed = new Date(body.issuedAt);
    if (!Number.isNaN(parsed.getTime())) patch.issuedAt = parsed;
  }

  const existing = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  if (existing.length === 0) return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  const current = existing[0];

  const items = Array.isArray(body.items) ? (body.items as ProposalItem[]) : current.items;
  const sections = Array.isArray(body.sections) ? (body.sections as ProposalSection[]) : current.sections;
  const discountPct =
    typeof body.discountPct === "number" ? Math.min(100, Math.max(0, Math.round(body.discountPct))) : current.discountPct;

  if (Array.isArray(body.items) || typeof body.discountPct === "number") {
    const totals = calcTotals(items, discountPct);
    patch.items = items;
    patch.discountPct = discountPct;
    patch.subtotalCents = totals.subtotalCents;
    patch.totalCents = totals.totalCents;
  }
  if (Array.isArray(body.sections)) patch.sections = sections;
  if (body.briefing && typeof body.briefing === "object") patch.briefing = body.briefing;

  const [row] = await db.update(proposals).set(patch).where(eq(proposals.id, id)).returning();

  if (body.status && body.status !== current.status) {
    const labels: Record<string, string> = {
      novo: "Novo / qualificação",
      enviada: "Proposta enviada",
      negociacao: "Em negociação",
      ganho: "Ganho",
      perdido: "Perdido",
    };
    await db.insert(activities).values({
      proposalId: id,
      kind: "mudanca_etapa",
      content: `Etapa alterada de “${labels[current.status] ?? current.status}” para “${labels[String(body.status)] ?? body.status}”.`,
      doneAt: new Date(),
    });
  }

  return NextResponse.json({ proposal: row });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await deleteProposalFamily(id);
  if (!result) return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true, ...result, preservedContracts: true });
}
