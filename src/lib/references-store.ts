import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { referenceFiles, type ReferenceFileRow } from "@/db/schema";
import { ensureSchema } from "@/lib/db-migrations";
import { analyzeReferenceText, type ReferenceAnalysis } from "@/lib/references";

/** Shape consumed by ReferencePanel (never exposes the binary payload in listings). */
export type ReferenceFileDto = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  manualText: string | null;
  createdAt: string;
  analysis: ReferenceAnalysis | null;
  url: string;
  textPreview: string;
};

const publicColumns = {
  id: referenceFiles.id,
  fileName: referenceFiles.fileName,
  mimeType: referenceFiles.mimeType,
  sizeBytes: referenceFiles.sizeBytes,
  extractedText: referenceFiles.extractedText,
  manualText: referenceFiles.manualText,
  layoutRows: referenceFiles.layoutRows,
  analysis: referenceFiles.analysis,
  note: referenceFiles.note,
  createdAt: referenceFiles.createdAt,
};

type PublicRow = Omit<ReferenceFileRow, "data">;

/** The runtime migrations create the table when the manual SQL has not been run yet. */
export async function ensureReferenceTable(): Promise<void> {
  await ensureSchema();
}

export function toReferenceFile(row: PublicRow): ReferenceFileDto {
  const text = row.manualText?.trim() || row.extractedText || "";
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    note: row.note,
    manualText: row.manualText,
    createdAt: new Date(row.createdAt).toISOString(),
    analysis: row.analysis ?? null,
    url: `/api/references/${row.id}`,
    textPreview: text.slice(0, 3000),
  };
}

export async function listReferenceRows(): Promise<PublicRow[]> {
  return db.select(publicColumns).from(referenceFiles).orderBy(desc(referenceFiles.createdAt));
}

export async function countReferenceRows(): Promise<number> {
  const rows = await db.select({ id: referenceFiles.id }).from(referenceFiles);
  return rows.length;
}

export async function getReferenceRow(id: string): Promise<ReferenceFileRow | null> {
  const rows = await db.select().from(referenceFiles).where(eq(referenceFiles.id, id)).limit(1);
  return rows[0] ?? null;
}

export function analyzeStoredText(text: string, pages: number | null): ReferenceAnalysis {
  return analyzeReferenceText(text, pages);
}
