import { NextResponse } from "next/server";
import { db } from "@/db";
import { referenceFiles } from "@/db/schema";
import {
  ALLOWED_REFERENCE_TYPES,
  MAX_REFERENCE_BYTES,
  MAX_REFERENCE_FILES,
  extractReference,
} from "@/lib/references";
import {
  analyzeStoredText,
  countReferenceRows,
  ensureReferenceTable,
  listReferenceRows,
  toReferenceFile,
} from "@/lib/references-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

function safeName(name: string): string {
  return name.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 180) || "referencia";
}

export async function GET() {
  try {
    await ensureReferenceTable();
    const rows = await listReferenceRows();
    return json({ files: rows.map(toReferenceFile) });
  } catch (error) {
    console.error("[references] Falha ao listar:", (error as Error)?.message);
    return json({ error: "Não foi possível carregar os arquivos de referência. Confira /api/health." }, 503);
  }
}

export async function POST(request: Request) {
  try {
    await ensureReferenceTable();
    if ((await countReferenceRows()) >= MAX_REFERENCE_FILES) {
      return json({ error: `Limite de ${MAX_REFERENCE_FILES} arquivos atingido. Exclua um antes de enviar outro.` }, 400);
    }

    const form = await request.formData().catch(() => null);
    const candidate = form?.get("file");
    if (!candidate || typeof candidate === "string") return json({ error: "Envie um arquivo no campo \"file\"." }, 400);

    const file = candidate as File;
    const mimeType = (file.type || "").toLowerCase();
    const fileName = safeName(file.name || "referencia");
    if (!(ALLOWED_REFERENCE_TYPES as readonly string[]).includes(mimeType)) {
      return json({ error: "Formato não aceito. Use PDF, PNG, JPG, WEBP, TXT, MD ou CSV." }, 415);
    }
    if (file.size > MAX_REFERENCE_BYTES) {
      return json({ error: "Arquivo maior que 4 MB. Reduza o arquivo antes de enviar." }, 413);
    }
    if (file.size === 0) return json({ error: "O arquivo está vazio." }, 400);

    const bytes = Buffer.from(await file.arrayBuffer());
    const extracted = await extractReference(bytes, mimeType);
    const analysis = analyzeStoredText(extracted.text, extracted.pages);

    const [row] = await db
      .insert(referenceFiles)
      .values({
        fileName,
        mimeType,
        sizeBytes: bytes.length,
        data: bytes,
        extractedText: extracted.text.slice(0, 200000) || null,
        layoutRows: extracted.layoutRows.length ? extracted.layoutRows.slice(0, 400) : null,
        analysis,
      })
      .returning();

    return json({ file: toReferenceFile(row) }, 201);
  } catch (error) {
    console.error("[references] Falha no upload:", (error as Error)?.message);
    return json({ error: "Não foi possível salvar o arquivo. Confira /api/health e tente novamente." }, 503);
  }
}
