import { NextResponse } from "next/server";
import { processCompetitorFiles, MAX_COMPETITOR_FILES, MAX_FILE_SIZE_BYTES } from "@/lib/competitor";
import type { CompetitorFile } from "@/lib/proposal/types";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      files?: CompetitorFile[];
      clientName?: string;
    };

    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      return NextResponse.json(
        { error: "Envie pelo menos 1 arquivo de proposta do concorrente (até 6 arquivos)." },
        { status: 400 }
      );
    }

    if (body.files.length > MAX_COMPETITOR_FILES) {
      return NextResponse.json(
        { error: `O limite máximo é de ${MAX_COMPETITOR_FILES} arquivos por análise.` },
        { status: 400 }
      );
    }

    // Valida tamanho de cada arquivo
    for (const file of body.files) {
      if (!file.name || !file.base64) {
        return NextResponse.json(
          { error: "Arquivo corrompido ou sem conteúdo válido." },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `O arquivo ${file.name} excede o limite máximo de 10 MB.` },
          { status: 400 }
        );
      }
    }

    const analysis = await processCompetitorFiles(body.files, body.clientName);

    return NextResponse.json({
      success: true,
      analysis,
      filesProcessed: body.files.length,
    });
  } catch (error) {
    console.error("Erro na rota de análise de concorrente:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao processar os arquivos do concorrente. Tente novamente.",
      },
      { status: 500 }
    );
  }
}
