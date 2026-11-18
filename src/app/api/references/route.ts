import { NextResponse } from "next/server";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { referenceFiles } from "@/db/schema";
import { ensureSchema } from "@/lib/db-migrations";
import {
  ALLOWED_REFERENCE_TYPES,
  MAX_REFERENCE_BYTES,
  MAX_REFERENCE_FILES,
  analyzeReferenceText,
  extractReference,
} from "@/lib/references";

export const dynamic = "force-dynamic";

function resolveMimeType(file: File): string {
  if ((ALLOWED_REFERENCE_TYPES as readonly string[]).includes(file.type)) {
    return file.type;
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";
  return file.type || "application/octet-stream";
}

function serializeReference(row: {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  manualText: string | null;
  extractedText: string | null;
  createdAt: Date;
  analysis: ReturnType<typeof analyzeReferenceText> | null;
}) {
  const effectiveText = row.manualText?.trim() || row.extractedText?.trim() || "";
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    note: row.note,
    manualText: row.manualText,
    createdAt: row.createdAt.toISOString(),
    analysis: row.analysis,
    url: `/api/references/${row.id}/file`,
    textPreview: effectiveText.slice(0, 3000),
  };
}

export async function GET() {
  await ensureSchema();
  const rows = await db
    .select({
      id: referenceFiles.id,
      fileName: referenceFiles.fileName,
      mimeType: referenceFiles.mimeType,
      sizeBytes: referenceFiles.sizeBytes,
      note: referenceFiles.note,
      manualText: referenceFiles.manualText,
      extractedText: referenceFiles.extractedText,
      createdAt: referenceFiles.createdAt,
      analysis: referenceFiles.analysis,
    })
    .from(referenceFiles)
    .orderBy(desc(referenceFiles.createdAt));

  return NextResponse.json({ files: rows.map(serializeReference) });
}

export async function POST(request: Request) {
  await ensureSchema();
  const form = await request.formData();
  const entry = form.get("file");
  if (!(entry instanceof File)) {
    return NextResponse.json({ error: "Selecione um arquivo válido." }, { status: 400 });
  }
  if (entry.size <= 0) {
    return NextResponse.json({ error: "O arquivo enviado está vazio." }, { status: 400 });
  }
  if (entry.size > MAX_REFERENCE_BYTES) {
    return NextResponse.json(
      { error: "O arquivo excede o limite de 4 MB por envio." },
      { status: 413 },
    );
  }

  const mimeType = resolveMimeType(entry);
  if (!(ALLOWED_REFERENCE_TYPES as readonly string[]).includes(mimeType)) {
    return NextResponse.json(
      { error: "Formato não suportado. Use PDF, PNG, JPG, WEBP, TXT ou CSV." },
      { status: 400 },
    );
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(referenceFiles);
  if (count >= MAX_REFERENCE_FILES) {
    return NextResponse.json(
      { error: `Limite de ${MAX_REFERENCE_FILES} arquivos atingido. Exclua um antes de enviar outro.` },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await entry.arrayBuffer());
  const extracted = await extractReference(bytes, mimeType);
  const analysis = {
    ...analyzeReferenceText(extracted.text, extracted.pages),
    layoutRows: extracted.layoutRows,
  };

  const [created] = await db
    .insert(referenceFiles)
    .values({
      fileName: entry.name.slice(0, 220),
      mimeType,
      sizeBytes: entry.size,
      data: bytes,
      extractedText: extracted.text || null,
      layoutRows: extracted.layoutRows.length ? extracted.layoutRows : null,
      analysis,
    })
    .returning({
      id: referenceFiles.id,
      fileName: referenceFiles.fileName,
      mimeType: referenceFiles.mimeType,
      sizeBytes: referenceFiles.sizeBytes,
      note: referenceFiles.note,
      manualText: referenceFiles.manualText,
      extractedText: referenceFiles.extractedText,
      createdAt: referenceFiles.createdAt,
      analysis: referenceFiles.analysis,
    });

  return NextResponse.json({ file: serializeReference(created) }, { status: 201 });
}
