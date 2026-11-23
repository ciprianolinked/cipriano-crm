import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, proposals, serviceOrders, type ServiceOrderItem } from "@/db/schema";
import { ensureSchema } from "@/lib/db-migrations";
import { ensureBootstrap } from "@/lib/data";
import {
  nextServiceOrderNumber,
  OS_KINDS,
  OS_PRIORITIES,
  OS_STATUSES,
  soPartsCents,
} from "@/lib/service-orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const kindIds = OS_KINDS.map((k) => k.id);
const statusIds = OS_STATUSES.map((s) => s.id);
const priorityIds = OS_PRIORITIES.map((p) => p.id);

const iso = (value: unknown): Date | null => {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
};

function parseItems(value: unknown): ServiceOrderItem[] {
  if (!Array.isArray(value)) return [];
  return (value as Record<string, unknown>[]).map((item, index) => ({
    id: String(item.id ?? `it-${index}-${Math.random().toString(36).slice(2, 7)}`),
    desc: String(item.desc ?? "").slice(0, 400),
    spec: String(item.spec ?? "").slice(0, 400),
    unit: String(item.unit ?? "un").slice(0, 20),
    qty: Math.max(0, Number(item.qty ?? 0) || 0),
    priceCents: Math.max(0, Math.round(Number(item.priceCents ?? 0) || 0)),
    scope: String(item.scope ?? "").slice(0, 120),
    billable: item.billable !== false,
    checked: Boolean(item.checked),
    obs: String(item.obs ?? "").slice(0, 400),
  }));
}

export async function GET(request: Request) {
  await ensureSchema();
  await ensureBootstrap();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const rows = status
    ? await db.select().from(serviceOrders).where(eq(serviceOrders.status, status)).orderBy(desc(serviceOrders.createdAt))
    : await db.select().from(serviceOrders).orderBy(desc(serviceOrders.createdAt));
  return NextResponse.json(
    { serviceOrders: rows },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  await ensureSchema();
  await ensureBootstrap();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const description = String(body.description ?? "").trim();
  let clientName = String(body.clientName ?? "").trim();
  let clientId = body.clientId ? String(body.clientId) : null;
  let contact = String(body.contact ?? "").trim();
  let email = String(body.email ?? "").trim();
  let site = String(body.site ?? "").trim();
  let originProposalId: string | null = null;
  let originProposalNumber: string | null = null;
  let items = parseItems(body.items);

  // OS criada a partir de uma proposta: herda cliente, local e itens para conferência.
  if (body.originProposalId) {
    const [p] = await db.select().from(proposals).where(eq(proposals.id, String(body.originProposalId))).limit(1);
    if (!p) return NextResponse.json({ error: "Proposta de origem não encontrada." }, { status: 404 });
    originProposalId = p.id;
    originProposalNumber = p.number;
    clientId = clientId ?? p.clientId;
    clientName = clientName || p.clientName;
    contact = contact || (p.contact ?? "");
    email = email || (p.clientEmail ?? "");
    site = site || (p.site ?? "");
    if (!items.length) {
      items = p.items.map((item, index) => ({
        id: `prop-${index}-${Math.random().toString(36).slice(2, 7)}`,
        desc: item.desc,
        spec: item.spec,
        unit: item.unit,
        qty: item.qty,
        priceCents: Math.round(item.price * 100),
        scope: item.scope ?? "",
        billable: false,
        checked: false,
        obs: "",
      }));
    }
  }

  if (!clientName) return NextResponse.json({ error: "Informe o cliente." }, { status: 400 });
  if (!description && !items.length) {
    return NextResponse.json({ error: "Descreva o serviço ou inclua ao menos uma peça/material." }, { status: 400 });
  }

  if (clientId) {
    const [c] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!c) clientId = null;
  }

  const existing = await db.select({ number: serviceOrders.number }).from(serviceOrders);
  const number = nextServiceOrderNumber(existing.map((r) => r.number));
  const kind = kindIds.includes(String(body.kind) as (typeof kindIds)[number]) ? String(body.kind) : "corretiva";
  const status = statusIds.includes(String(body.status) as (typeof statusIds)[number]) ? String(body.status) : "aberta";
  const priority = priorityIds.includes(String(body.priority) as (typeof priorityIds)[number]) ? String(body.priority) : "normal";
  const laborCents = Math.max(0, Math.round(Number(body.laborCents ?? 0) || 0));
  const travelCents = Math.max(0, Math.round(Number(body.travelCents ?? 0) || 0));

  const [row] = await db
    .insert(serviceOrders)
    .values({
      number,
      kind,
      status,
      priority,
      clientId,
      clientName,
      contact: contact || null,
      phone: String(body.phone ?? "").trim() || null,
      email: email || null,
      site: site || null,
      description,
      diagnosis: String(body.diagnosis ?? "").trim(),
      solution: String(body.solution ?? "").trim(),
      technician: String(body.technician ?? "").trim(),
      scheduledAt: iso(body.scheduledAt),
      laborCents,
      travelCents,
      items,
      notes: String(body.notes ?? "").trim(),
      clientSignature: String(body.clientSignature ?? "").trim(),
      originProposalId,
      originProposalNumber,
    })
    .returning();

  return NextResponse.json(
    { serviceOrder: row, totalCents: soPartsCents(row).totalCents },
    { status: 201 },
  );
}
