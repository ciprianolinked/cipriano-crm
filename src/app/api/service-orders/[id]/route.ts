import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceOrders, type ServiceOrderItem } from "@/db/schema";
import { ensureSchema } from "@/lib/db-migrations";
import { OS_KINDS, OS_PRIORITIES, OS_STATUSES, soPartsCents } from "@/lib/service-orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

const kindIds = OS_KINDS.map((k) => k.id);
const statusIds = OS_STATUSES.map((s) => s.id);
const priorityIds = OS_PRIORITIES.map((p) => p.id);

const iso = (value: unknown): Date | null => {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
};

const TEXT_FIELDS = [
  "clientName",
  "contact",
  "phone",
  "email",
  "site",
  "description",
  "diagnosis",
  "solution",
  "technician",
  "notes",
  "clientSignature",
] as const;

export async function GET(_request: Request, { params }: Context) {
  await ensureSchema();
  const { id } = await params;
  const [row] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "OS não encontrada." }, { status: 404 });
  return NextResponse.json({ serviceOrder: row });
}

export async function PATCH(request: Request, { params }: Context) {
  await ensureSchema();
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const [current] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
  if (!current) return NextResponse.json({ error: "OS não encontrada." }, { status: 404 });

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  for (const key of TEXT_FIELDS) {
    if (key in body) patch[key] = String(body[key] ?? "");
  }
  if ("clientName" in body && !String(body.clientName ?? "").trim()) {
    return NextResponse.json({ error: "O cliente não pode ficar vazio." }, { status: 400 });
  }
  if ("clientId" in body) patch.clientId = body.clientId ? String(body.clientId) : null;
  if ("kind" in body && kindIds.includes(String(body.kind) as (typeof kindIds)[number])) patch.kind = String(body.kind);
  if ("status" in body && statusIds.includes(String(body.status) as (typeof statusIds)[number])) {
    const status = String(body.status);
    patch.status = status;
    // Datas acompanham o andamento, sem sobrescrever quando já registradas.
    if (status === "em_execucao" && !current.startedAt) patch.startedAt = new Date();
    if (status === "concluida") {
      if (!current.startedAt) patch.startedAt = new Date();
      patch.finishedAt = current.finishedAt ?? new Date();
    }
    if (status === "aberta" || status === "agendada") {
      patch.startedAt = null;
      patch.finishedAt = null;
    }
  }
  if ("priority" in body && priorityIds.includes(String(body.priority) as (typeof priorityIds)[number])) {
    patch.priority = String(body.priority);
  }
  for (const key of ["scheduledAt", "startedAt", "finishedAt"] as const) {
    if (key in body) patch[key] = iso(body[key]);
  }
  for (const key of ["laborCents", "travelCents"] as const) {
    if (key in body) patch[key] = Math.max(0, Math.round(Number(body[key] ?? 0) || 0));
  }
  if (Array.isArray(body.items)) {
    patch.items = (body.items as Record<string, unknown>[]).map((item, index) => ({
      id: String(item.id ?? `it-${index}`),
      desc: String(item.desc ?? "").slice(0, 400),
      spec: String(item.spec ?? "").slice(0, 400),
      unit: String(item.unit ?? "un").slice(0, 20),
      qty: Math.max(0, Number(item.qty ?? 0) || 0),
      priceCents: Math.max(0, Math.round(Number(item.priceCents ?? 0) || 0)),
      scope: String(item.scope ?? "").slice(0, 120),
      billable: item.billable !== false,
      checked: Boolean(item.checked),
      obs: String(item.obs ?? "").slice(0, 400),
    })) as ServiceOrderItem[];
  }
  if ("originProposalId" in body) {
    patch.originProposalId = body.originProposalId ? String(body.originProposalId) : null;
    patch.originProposalNumber = body.originProposalNumber ? String(body.originProposalNumber) : null;
  }

  const [row] = await db.update(serviceOrders).set(patch).where(eq(serviceOrders.id, id)).returning();
  return NextResponse.json({ serviceOrder: row, totalCents: soPartsCents(row).totalCents });
}

export async function DELETE(_request: Request, { params }: Context) {
  await ensureSchema();
  const { id } = await params;
  const [current] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
  if (!current) return NextResponse.json({ error: "OS não encontrada." }, { status: 404 });
  // A proposta de orçamento é preservada: só o vínculo é removido.
  await db.delete(serviceOrders).where(eq(serviceOrders.id, id));
  return NextResponse.json({
    ok: true,
    preservedBudgetProposal: current.budgetProposalNumber ?? null,
    preservedOriginProposal: current.originProposalNumber ?? null,
  });
}
