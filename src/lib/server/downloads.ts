import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { pdfExports } from "@/db/schema";

export type PdfExportRecord = {
  id: string;
  fileName: string;
  kind: string;
  protocol: string | null;
  condominium: string | null;
  sizeBytes: number;
  createdAt: string;
};

let exportsTablePromise: Promise<void> | null = null;

/**
 * Publicações na Vercel não executam drizzle-kit automaticamente. Esta proteção
 * cria somente a tabela de histórico de downloads caso ela ainda não exista,
 * sem tocar em mapas, condomínios ou dados já cadastrados.
 */
async function ensurePdfExportsTable(): Promise<void> {
  await db.execute(sql`
    create table if not exists pdf_exports (
      id uuid primary key default gen_random_uuid(),
      file_name text not null,
      kind text not null default 'mapa',
      reference_id uuid,
      protocol text,
      condominium text,
      period_start date,
      period_end date,
      size_bytes integer not null default 0,
      created_at timestamp with time zone not null default now()
    )
  `);
  await db.execute(sql`create index if not exists pdf_exports_created_at_idx on pdf_exports (created_at desc)`);
}

function ensureExportsTable(): Promise<void> {
  exportsTablePromise ??= ensurePdfExportsTable().catch((error) => {
    exportsTablePromise = null;
    throw error;
  });
  return exportsTablePromise;
}

/** Registra o nome do arquivo entregue ao usuário a cada download. */
export async function recordPdfExport(input: {
  fileName: string;
  kind: "mapa" | "indicadores";
  sizeBytes: number;
  referenceId?: string | null;
  protocol?: string | null;
  condominium?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
}): Promise<PdfExportRecord> {
  await ensureExportsTable();
  const [row] = await db.insert(pdfExports).values({
    fileName: input.fileName.slice(0, 200),
    kind: input.kind,
    sizeBytes: Math.max(0, Math.round(input.sizeBytes)),
    referenceId: input.referenceId ?? null,
    protocol: input.protocol ?? null,
    condominium: input.condominium ?? null,
    periodStart: input.periodStart ?? null,
    periodEnd: input.periodEnd ?? null,
  }).returning();
  return toRecord(row);
}

export async function listPdfExports(limit = 10): Promise<PdfExportRecord[]> {
  await ensureExportsTable();
  const rows = await db.select().from(pdfExports).orderBy(desc(pdfExports.createdAt)).limit(limit);
  return rows.map(toRecord);
}

export async function listPdfExportsForQuotation(quotationId: string): Promise<PdfExportRecord[]> {
  await ensureExportsTable();
  const rows = await db.select().from(pdfExports)
    .where(eq(pdfExports.referenceId, quotationId))
    .orderBy(desc(pdfExports.createdAt))
    .limit(10);
  return rows.map(toRecord);
}

function toRecord(row: typeof pdfExports.$inferSelect): PdfExportRecord {
  return {
    id: row.id,
    fileName: row.fileName,
    kind: row.kind,
    protocol: row.protocol,
    condominium: row.condominium,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
  };
}
