import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { referenceFiles } from "@/db/schema";
import {
  ALLOWED_REFERENCE_TYPES,
  MAX_REFERENCE_BYTES,
  MAX_REFERENCE_FILES,
  analyzeReferenceText,
  extractReference,
} from "@/lib/references";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const summarySelect = {
  id: referenceFiles.id,
  fileName: referenceFiles.fileName,
  mimeType: referenceFiles.mimeType,
  sizeBytes: referenceFiles.sizeBytes,
  note: referenceFiles.note,
  manualText: referenceFiles.manualText,
  extractedText: referenceFiles.extractedText,
  analysis: referenceFiles.analysis,
  createdAt: referenceFiles.createdAt,
} as const;

export async function GET() {
  const rows = await db.select(summarySelect).from(referenceFiles).orderBy(desc(referenceFiles.createdAt));
  return NextResponse.json({
    maxFiles: MAX_REFERENCE_FILES,
    maxBytes: MAX_REFERENCE_BYTES,
    files: rows.map((row) => ({
      id: row.id,
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      note: row.note,
      manualText: row.manualText,
      analysis: row.analysis,
      createdAt: row.createdAt.toISOString(),
      url: `/api/references/${row.id}`,
      textPreview: (row.manualText || row.extractedText || "").slice(0, 3000),
    })),
  });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envie o arquivo como formulário multipart." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Selecione um arquivo." }, { status: 400 });
  if (!(ALLOWED_REFERENCE_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: "Formato não suportado. Envie PDF, PNG, JPG, WEBP ou TXT." }, { status: 400 });
  }
  if (file.size === 0) return NextResponse.json({ error: "O arquivo está vazio." }, { status: 400 });
  if (file.size > MAX_REFERENCE_BYTES) {
    return NextResponse.json(
      { error: "Arquivo acima de 4 MB. Comprima o PDF ou envie uma imagem menor." },
      { status: 413 },
    );
  }

  const note = String(form.get("note") ?? "").trim().slice(0, 1000);
  const bytes = Buffer.from(await file.arrayBuffer());
  const { text, pages } = await extractReference(bytes, file.type);
  const analysis = analyzeReferenceText(text, pages);

  try {
    const rows = await db.transaction(async (tx) => {
      const existing = await tx.select({ id: referenceFiles.id }).from(referenceFiles);
      if (existing.length >= MAX_REFERENCE_FILES) return null;
      return tx
        .insert(referenceFiles)
        .values({
          fileName: file.name.slice(0, 255),
          mimeType: file.type,
          sizeBytes: bytes.length,
          data: bytes,
          extractedText: text || null,
          analysis,
          note: note || null,
        })
        .returning(summarySelect);
    });

    if (!rows) {
      return NextResponse.json(
        { error: `Limite de ${MAX_REFERENCE_FILES} arquivos atingido. Exclua um antes de enviar outro.` },
        { status: 409 },
      );
    }

    const row = rows[0];
    return NextResponse.json(
      {
        file: {
          id: row.id,
          fileName: row.fileName,
          mimeType: row.mimeType,
          sizeBytes: row.sizeBytes,
          note: row.note,
          manualText: row.manualText,
          analysis: row.analysis,
          createdAt: row.createdAt.toISOString(),
          url: `/api/references/${row.id}`,
          textPreview: (row.extractedText || "").slice(0, 3000),
        },
        remaining: MAX_REFERENCE_FILES - 1,
      },
      { status: 201 },
    );
  } catch {
    console.error("[references] Falha ao salvar o arquivo de referência.");
    return NextResponse.json({ error: "Não foi possível salvar o arquivo. Tente novamente." }, { status: 500 });
  }
}
