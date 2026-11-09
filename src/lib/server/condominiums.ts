import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { condominiums, quotations } from "@/db/schema";
import type { CondominiumRecord } from "@/lib/types";
import { isUuid } from "@/lib/server/quotations";

const condominiumSchema = z.object({
  name: z.string().trim().min(3, "Informe um nome com pelo menos 3 caracteres.").max(200, "Nome muito longo."),
  city: z.string().trim().max(120).optional().default(""),
  manager: z.string().trim().max(160).optional().default(""),
  contactEmail: z.union([z.email("Informe um e-mail válido."), z.literal("")]).optional().default(""),
});

function parseInput(input: unknown) {
  const result = condominiumSchema.safeParse(input);
  if (!result.success) throw new Error(result.error.issues[0]?.message || "Confira os dados do condomínio.");
  return result.data;
}

function toRecord(row: typeof condominiums.$inferSelect): CondominiumRecord {
  return { id: row.id, name: row.name, city: row.city, manager: row.manager, contactEmail: row.contactEmail };
}

export async function createCondominium(input: unknown): Promise<CondominiumRecord> {
  const data = parseInput(input);
  const [row] = await db.insert(condominiums).values({
    name: data.name,
    city: data.city || null,
    manager: data.manager || null,
    contactEmail: data.contactEmail || null,
  }).returning();
  return toRecord(row);
}

export async function updateCondominium(id: string, input: unknown): Promise<CondominiumRecord | null> {
  if (!isUuid(id)) return null;
  const data = parseInput(input);
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(condominiums).where(eq(condominiums.id, id)).limit(1);
    if (!existing) return null;
    const [row] = await tx.update(condominiums).set({
      name: data.name,
      city: data.city || null,
      manager: data.manager || null,
      contactEmail: data.contactEmail || null,
    }).where(eq(condominiums.id, id)).returning();
    // Os mapas atuais usam o nome; renomeie-os na mesma transação, sem alterar valores.
    if (existing.name !== data.name) {
      await tx.update(quotations).set({ condominium: data.name, updatedAt: new Date() })
        .where(eq(quotations.condominium, existing.name));
    }
    return toRecord(row);
  });
}

export async function deleteCondominium(id: string): Promise<"deleted" | "not_found" | "has_quotations"> {
  if (!isUuid(id)) return "not_found";
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(condominiums).where(eq(condominiums.id, id)).limit(1);
    if (!existing) return "not_found";
    const [count] = await tx.select({ value: sql<number>`count(*)::int` }).from(quotations)
      .where(eq(quotations.condominium, existing.name));
    if ((count?.value ?? 0) > 0) return "has_quotations";
    await tx.delete(condominiums).where(eq(condominiums.id, id));
    return "deleted";
  });
}

export function condominiumError(error: unknown): string {
  const cause = error as { code?: string; cause?: { code?: string }; message?: string } | null;
  if (cause?.code === "23505" || cause?.cause?.code === "23505") return "Já existe um condomínio com esse nome.";
  return error instanceof Error ? error.message : "Não foi possível salvar o condomínio.";
}
