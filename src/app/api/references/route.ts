import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { referenceFiles } from "@/db/schema";
import { withReferenceSchema } from "@/lib/db-migrations";
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

const fail = (message: string, status = 500) =>
  NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

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
  try {
    const rows = await withReferenceSchema(() =>
      db.select(summarySelect).from(referenceFiles).orderBy(desc(referenceFiles.createdAt)),
    );
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
  } catch (error) {
    console.error("[references] GET falhou:", (error as Error)?.message);
    return fail(
      "Não foi possível carregar os arquivos de referência. Abra /diagnostico e confirme se a tabela reference_files existe no banco.",
    );
  }
}

export async function POST(request: Request) {
  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail("Envie o arquivo como formulário multipart.", 400);
    }

    const file = form.get("file");
    if (!(file instanceof File)) return fail("Selecione um arquivo.", 400);
    if (!(ALLOWED_REFERENCE_TYPES as readonly string[]).includes(file.type)) {
      return fail("Formato não suportado. Envie PDF, PNG, JPG, WEBP, TXT ou CSV.", 400);
    }
    if (file.size === 0) return fail("O arquivo está vazio.", 400);
    if (file.size > MAX_REFERENCE_BYTES) {
      return fail("Arquivo acima de 4 MB. Comprima o PDF ou envie uma imagem menor.", 413);
    }

    const note = String(form.get("note") ?? "").trim().slice(0, 1000);
    const bytes = Buffer.from(await file.arrayBuffer());
    const { text, pages, layoutRows } = await extractReference(bytes, file.type);
    const analysis = { ...analyzeReferenceText(text, pages), layoutRows: layoutRows.slice(0, 900) };

    const rows = await withReferenceSchema(() => db.transaction(async (tx) => {
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
          layoutRows: layoutRows.length ? layoutRows.slice(0, 900) : null,
          analysis,
          note: note || null,
        })
        .returning(summarySelect);
    }));

    if (!rows) {
      return fail(`Limite de ${MAX_REFERENCE_FILES} arquivos atingido. Exclua um antes de enviar outro.`, 409);
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
  } catch (error) {
    console.error("[references] POST falhou:", (error as Error)?.message);
    return fail(
      "Não foi possível salvar o arquivo de concorrente. Confirme a estrutura do banco em /diagnostico e tente novamente.",
    );
  }
}
