import { NextResponse } from "next/server";
import { getAiConfig } from "@/lib/ai";
import { getGeminiKey, maskKey } from "@/lib/server/quotations";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getAiConfig();
  const { key } = await getGeminiKey();
  return NextResponse.json({
    connected: config.provider !== "none",
    provider: config.provider,
    model: config.model,
    source: config.source,
    free: config.free,
    maskedKey: key && config.provider === "gemini" ? maskKey(key) : null,
    label:
      config.provider === "none"
        ? "IA não ativada — configure grátis"
        : config.provider === "gemini"
          ? `Google Gemini · ${config.source === "painel" ? "chave do painel" : "chave do ambiente"}`
          : `OpenAI · ${config.model}`,
    setupUrl: "/configuracoes",
    guideUrl: "/ajuda/ia",
    // As funções da Vercel aceitam até 4,5 MB por requisição. Reservamos
    // margem para os campos e cabeçalhos do formulário multipart.
    maxTotalUploadBytes: process.env.VERCEL === "1" ? 4 * 1024 * 1024 : null,
    accepts: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  });
}
