import { NextResponse } from "next/server";
import { localSectionDraft, maybePolishWithLLM } from "@/lib/ai";
import { defaultBriefing } from "@/lib/proposal/catalog";
import type { Briefing } from "@/lib/proposal/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    clientName?: string;
    briefing?: Briefing;
    context?: string;
  };
  const title = String(body.title ?? "Considerações").trim();
  const clientName = String(body.clientName ?? "").trim();
  const briefing = body.briefing ?? defaultBriefing;
  const local = localSectionDraft(title, briefing, clientName);

  const polished = await maybePolishWithLLM({
    system:
      "Você escreve blocos de proposta comercial da Cipriano Tech & Security (segurança eletrônica IP). Português do Brasil, tom técnico e calmo, bullets objetivos, números antes de adjetivos, sem superlativos. Responda apenas com o texto final do bloco.",
    prompt: `Bloco: ${title}\nCliente: ${clientName || "a definir"}\nSegmento: ${briefing.segment}\nEscopo: ${briefing.cameras} câmeras, ${briefing.doors} portas, ${briefing.fenceMeters} m de cerca, alarme ${briefing.alarm ? "sim" : "não"}, monitoramento ${briefing.monitoring ? "sim" : "não"}.\nContexto adicional: ${body.context ?? "nenhum"}\n\nRascunho base:\n${local}`,
  });

  return NextResponse.json({
    body: polished ?? local,
    source: polished ? "llm" : "motor-local",
  });
}
