import { and, asc, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, appSettings, catalogItems, clients, proposals } from "@/db/schema";
import type { ActivityRow, CatalogRow, ClientRow, ProposalRow, SettingsRow } from "@/db/schema";
import { brand } from "@/lib/brand";

let bootstrapped: Promise<void> | null = null;

export async function getSettings(): Promise<SettingsRow> {
  const existing = await db.select().from(appSettings).limit(1);
  if (existing.length > 0) return existing[0];
  const inserted = await db
    .insert(appSettings)
    .values({
      id: "default",
      companyName: brand.name,
      legalName: brand.legalName,
      tagline: brand.tagline,
      director: brand.director,
      role: brand.role,
      phone: brand.phone,
      landline: brand.landline,
      email: brand.email,
      site: brand.site,
      address: brand.address,
      cnpj: brand.cnpj,
      crea: brand.crea,
      hours: brand.hours,
    })
    .onConflictDoNothing()
    .returning();
  if (inserted.length > 0) return inserted[0];
  const again = await db.select().from(appSettings).limit(1);
  return again[0];
}

async function seed() {
  const settings = await getSettings();

  if ((await db.select({ id: catalogItems.id }).from(catalogItems).limit(1)).length === 0) {
    const { catalogSeed, salePriceFromSupplier } = await import("@/lib/proposal/catalog");
    await db.insert(catalogItems).values(
      catalogSeed.map((c) => ({
        kind: c.kind,
        category: c.category,
        description: c.description,
        spec: c.spec,
        unit: c.unit,
        supplierPriceCents: c.supplierPriceCents,
        marginPct: c.marginPct,
        priceCents: salePriceFromSupplier(c.supplierPriceCents, c.marginPct),
      })),
    );
  }
}

export async function ensureBootstrap() {
  if (!bootstrapped) {
    bootstrapped = seed().catch((error) => {
      bootstrapped = null;
      throw error;
    });
  }
  await bootstrapped;
}

export async function getHighestProposalSequence(year: number = new Date().getFullYear()): Promise<number> {
  const prefix = `CTS-${year}-`;
  const allInYear = await db
    .select({ number: proposals.number })
    .from(proposals)
    .where(like(proposals.number, `${prefix}%`));
  let maxSeq = 0;
  for (const row of allInYear) {
    const match = row.number.match(/CTS-\d{4}-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (Number.isFinite(num) && num > maxSeq) maxSeq = num;
    }
  }
  return maxSeq;
}

export async function nextProposalNumber(): Promise<string> {
  const settings = await getSettings();
  const year = new Date().getFullYear();
  const maxSeq = await getHighestProposalSequence(year);
  const nextSeq = maxSeq + 1;
  await db
    .update(appSettings)
    .set({ proposalCounter: nextSeq, updatedAt: new Date() })
    .where(eq(appSettings.id, settings.id));
  return `CTS-${year}-${String(nextSeq).padStart(4, "0")}`;
}

export async function listClients(): Promise<ClientRow[]> {
  return db.select().from(clients).orderBy(asc(clients.name));
}

export async function listCatalog(): Promise<CatalogRow[]> {
  return db.select().from(catalogItems).orderBy(asc(catalogItems.kind), asc(catalogItems.category));
}

export async function listProposals(includeArchived = false): Promise<ProposalRow[]> {
  const rows = await db.select().from(proposals).orderBy(desc(proposals.updatedAt));
  return includeArchived ? rows : rows.filter((p) => !p.archived);
}

export async function getProposal(id: string): Promise<ProposalRow | null> {
  const rows = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listActivities(proposalId?: string): Promise<ActivityRow[]> {
  if (proposalId) {
    return db
      .select()
      .from(activities)
      .where(eq(activities.proposalId, proposalId))
      .orderBy(desc(activities.createdAt));
  }
  return db.select().from(activities).orderBy(desc(activities.createdAt));
}

export async function listOpenFollowUps(): Promise<ActivityRow[]> {
  return db
    .select()
    .from(activities)
    .where(and(eq(activities.kind, "seguimento"), isNull(activities.doneAt)))
    .orderBy(asc(activities.dueAt));
}

export async function dashboardStats() {
  await ensureBootstrap();
  const rows = await listProposals();
  const followUps = await listOpenFollowUps();
  const open = rows.filter((p) => p.status !== "ganho" && p.status !== "perdido");
  const won = rows.filter((p) => p.status === "ganho");
  const lost = rows.filter((p) => p.status === "perdido");
  const closed = won.length + lost.length;
  const pipelineCents = open.reduce((acc, p) => acc + p.totalCents, 0);
  const wonCents = won.reduce((acc, p) => acc + p.totalCents, 0);
  const winRate = closed > 0 ? Math.round((won.length / closed) * 100) : 0;
  const ticketCents = rows.length > 0 ? Math.round(rows.reduce((a, p) => a + p.totalCents, 0) / rows.length) : 0;
  const stale = open.filter((p) => Date.now() - new Date(p.updatedAt).getTime() > 5 * 86_400_000);
  const overdue = followUps.filter((f) => f.dueAt && new Date(f.dueAt).getTime() < Date.now());
  return {
    rows,
    open,
    won,
    lost,
    followUps,
    overdue,
    stale,
    pipelineCents,
    wonCents,
    winRate,
    ticketCents,
    closedCount: closed,
  };
}

export async function proposalWithClient(id: string) {
  const proposal = await getProposal(id);
  if (!proposal) return null;
  const acts = await listActivities(id);
  return { proposal, activities: acts };
}

export async function listRevisions(proposalId: string) {
  const proposal = await getProposal(proposalId);
  if (!proposal) return [];
  const groupId = proposal.revisionGroupId ?? proposalId;
  return db
    .select()
    .from(proposals)
    .where(or(eq(proposals.id, groupId), eq(proposals.revisionGroupId, groupId)))
    .orderBy(proposals.revision);
}

export async function upsertClientFollowUp(proposalId: string, note: string, dueAt: Date) {
  await db.insert(activities).values({ proposalId, kind: "seguimento", content: note, dueAt });
  await db
    .update(proposals)
    .set({ nextActionAt: dueAt, nextActionNote: note, updatedAt: new Date() })
    .where(eq(proposals.id, proposalId));
}

export async function touchProposal(id: string, patch: Partial<typeof proposals.$inferInsert>) {
  await db
    .update(proposals)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(proposals.id, id));
}

export async function archiveOldProposals() {
  const rows = await db.select().from(proposals).where(eq(proposals.archived, false));
  const old = rows.filter(
    (r) => (r.status === "ganho" || r.status === "perdido") && Date.now() - new Date(r.updatedAt).getTime() > 90 * 86_400_000,
  );
  if (old.length === 0) return 0;
  await db
    .update(proposals)
    .set({ archived: true })
    .where(sql`${proposals.id} in ${sql.raw(`(${old.map((o) => `'${o.id}'`).join(",")})`)}`);
  return old.length;
}
