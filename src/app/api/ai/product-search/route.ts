import { NextResponse } from "next/server";
import { getAiConfig } from "@/lib/ai";
import { searchProductsOnline } from "@/lib/server/product-search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { items?: unknown; condominium?: unknown };
    const items = Array.isArray(payload.items)
      ? payload.items.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 2).slice(0, 12)
      : [];
    if (items.length === 0) {
      return NextResponse.json({ error: "Descreva ao menos um item para pesquisar." }, { status: 400 });
    }
    const config = await getAiConfig();
    if (!config.geminiKey) {
      return NextResponse.json(
        { error: "A pesquisa online usa o Google Search do Gemini. Configure a chave em “Configurar IA” para usá-la." },
        { status: 400 },
      );
    }
    const output = await searchProductsOnline({
      descriptions: items,
      apiKey: config.geminiKey,
      model: config.model,
      hint: typeof payload.condominium === "string" ? payload.condominium.slice(0, 200) : undefined,
      signal: request.signal,
    });
    return NextResponse.json({
      results: output.results,
      warnings: output.warnings,
      provider: `Google Gemini · ${config.model}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível pesquisar os produtos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
