import { NextResponse } from "next/server";
import { extractQuotation, validateUploads, type ExtractionHints, type UploadInput } from "@/lib/ai";
import { createAiAnalysisStream } from "@/lib/server/analysis-stream";
import type { AiAnalysisPhase } from "@/lib/ai-stream";
import { ACCEPTED_UPLOAD_TYPES, MAX_FILES, MAX_FILE_BYTES } from "@/lib/constants";

export const runtime = "nodejs";
// Fluid Compute permite uma espera maior sem interromper análises de vários PDFs.
// O limite do Gemini é menor (210s), reservando tempo para entregar a resposta.
export const maxDuration = 240;

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let files: UploadInput[] = [];
    let text = "";
    let hints: ExtractionHints = {};
    let searchProducts = false;
    const rejected: string[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const entries = form.getAll("files").filter((entry): entry is File => entry instanceof File);
      text = String(form.get("text") ?? "");
      searchProducts = String(form.get("webSearch") ?? "") === "1";
      const rawHints = String(form.get("hints") ?? "");
      if (rawHints) {
        try {
          hints = JSON.parse(rawHints) as ExtractionHints;
        } catch {
          hints = {};
        }
      }

      if (entries.length > MAX_FILES) rejected.push(`Apenas ${MAX_FILES} arquivos são processados por vez.`);
      const accepted: UploadInput[] = [];
      for (const file of entries.slice(0, MAX_FILES)) {
        const allowed = ACCEPTED_UPLOAD_TYPES.includes(file.type) || file.type.startsWith("image/");
        if (!allowed) {
          rejected.push(`${file.name}: formato não suportado (use PDF, JPG, PNG ou WEBP).`);
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          rejected.push(`${file.name}: excede 15 MB.`);
          continue;
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        accepted.push({ name: file.name, type: file.type || "application/pdf", size: file.size, base64: buffer.toString("base64") });
      }
      files = accepted;
    } else {
      const payload = (await request.json()) as {
        files?: unknown;
        text?: unknown;
        hints?: unknown;
        webSearch?: unknown;
      };
      files = validateUploads(payload.files);
      text = typeof payload.text === "string" ? payload.text : "";
      hints = (payload.hints ?? {}) as ExtractionHints;
      searchProducts = payload.webSearch === true;
    }

    if (files.length === 0 && !text.trim()) {
      return NextResponse.json(
        { error: rejected[0] ?? "Envie ao menos um arquivo PDF/imagem ou cole o texto da cotação para a análise." },
        { status: 400 },
      );
    }

    // Não produzir um mapa parcial se algum arquivo não pôde ser processado.
    if (rejected.length > 0) {
      return NextResponse.json({ error: rejected.join(" ") }, { status: 400 });
    }

    async function runAnalysis(signal: AbortSignal, onPhase?: (phase: AiAnalysisPhase) => void) {
      return extractQuotation({ files, text, hints, signal, onPhase, searchProducts });
    }

    if (new URL(request.url).searchParams.get("stream") === "1") {
      return new Response(createAiAnalysisStream(runAnalysis, { signal: request.signal }), {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-store, no-transform",
          "X-Accel-Buffering": "no",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    // Mantém a resposta JSON para integrações existentes.
    return NextResponse.json(await runAnalysis(request.signal));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível analisar os documentos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
