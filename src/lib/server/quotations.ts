import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, condominiums, quotations } from "@/db/schema";
import type { CondominiumRecord, QuotationRecord } from "@/lib/types";
import { nextProtocol, normalizeDraft } from "@/lib/quotation";

function toRecord(row: typeof quotations.$inferSelect): QuotationRecord {
  const draft = normalizeDraft({
    status: row.status,
    condominium: row.condominium,
    analysisDate: row.analysisDate,
    recipient: row.recipient,
    service: row.service,
    description: row.description,
    kind: row.kind,
    category: row.category,
    suppliers: row.suppliers,
    items: row.items,
    analysis: row.analysis,
    attachments: row.attachments,
  });
  return {
    ...draft,
    id: row.id,
    protocol: row.protocol,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listQuotations(): Promise<QuotationRecord[]> {
  const rows = await db.select().from(quotations).orderBy(desc(quotations.updatedAt));
  return rows.map(toRecord);
}

export async function getQuotation(id: string): Promise<QuotationRecord | null> {
  if (!isUuid(id)) return null;
  const rows = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
  if (rows.length === 0) return null;
  return toRecord(rows[0]);
}

export async function countQuotations(): Promise<number> {
  const result = await db.select({ count: sql<number>`count(*)::int` }).from(quotations);
  return result[0]?.count ?? 0;
}

export async function createQuotation(input: unknown): Promise<QuotationRecord> {
  const draft = normalizeDraft(input);
  const count = await countQuotations();
  const protocol = draft.protocol || nextProtocol(count);
  const [row] = await db
    .insert(quotations)
    .values({
      protocol,
      status: draft.status,
      condominium: draft.condominium,
      analysisDate: draft.analysisDate,
      recipient: draft.recipient,
      service: draft.service,
      description: draft.description,
      kind: draft.kind,
      category: draft.category,
      suppliers: draft.suppliers,
      items: draft.items,
      analysis: draft.analysis,
      attachments: draft.attachments,
    })
    .returning();

  await rememberCondominium(draft.condominium);
  return toRecord(row);
}

export async function updateQuotation(id: string, input: unknown): Promise<QuotationRecord | null> {
  if (!isUuid(id)) return null;
  const draft = normalizeDraft(input);
  const [row] = await db
    .update(quotations)
    .set({
      status: draft.status,
      condominium: draft.condominium,
      analysisDate: draft.analysisDate,
      recipient: draft.recipient,
      service: draft.service,
      description: draft.description,
      kind: draft.kind,
      category: draft.category,
      suppliers: draft.suppliers,
      items: draft.items,
      analysis: draft.analysis,
      attachments: draft.attachments,
      updatedAt: new Date(),
    })
    .where(eq(quotations.id, id))
    .returning();
  if (!row) return null;
  await rememberCondominium(draft.condominium);
  return toRecord(row);
}

export async function deleteQuotation(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = await db.delete(quotations).where(eq(quotations.id, id)).returning({ id: quotations.id });
  return rows.length > 0;
}

export async function listCondominiums(): Promise<CondominiumRecord[]> {
  const rows = await db.select().from(condominiums).orderBy(condominiums.name);
  return rows.map((row) => ({ id: row.id, name: row.name, city: row.city, manager: row.manager, contactEmail: row.contactEmail }));
}

export async function rememberCondominium(name: string): Promise<void> {
  const cleaned = name.trim();
  if (cleaned.length < 3) return;
  await db.insert(condominiums).values({ name: cleaned }).onConflictDoNothing();
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/* ------------------------- Configurações da IA ------------------------- */

const GEMINI_KEY_SETTING = "gemini_api_key";

export async function getSetting(key: string): Promise<string | null> {
  try {
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
    const value = rows[0]?.value?.trim() ?? "";
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value: value.trim(), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: value.trim(), updatedAt: new Date() },
    });
}

export async function deleteSetting(key: string): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, key));
}

/** Chave do Gemini: primeiro a configurada no painel, depois a variável de ambiente. */
export async function getGeminiKey(): Promise<{ key: string | null; source: "painel" | "ambiente" | null }> {
  const fromPanel = await getSetting(GEMINI_KEY_SETTING);
  if (fromPanel) return { key: fromPanel, source: "painel" };
  const fromEnv = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  if (fromEnv) return { key: fromEnv, source: "ambiente" };
  return { key: null, source: null };
}

export async function saveGeminiKey(key: string): Promise<void> {
  const cleaned = key.trim();
  if (cleaned.length < 10) {
    throw new Error("Essa chave parece incompleta. Copie a chave inteira gerada no Google AI Studio.");
  }
  await setSetting(GEMINI_KEY_SETTING, cleaned);
}

export async function removeGeminiKey(): Promise<void> {
  await deleteSetting(GEMINI_KEY_SETTING);
}

export function maskKey(key: string): string {
  const cleaned = key.trim();
  if (cleaned.length <= 8) return "••••";
  return `${cleaned.slice(0, 4)}••••${cleaned.slice(-4)}`;
}
