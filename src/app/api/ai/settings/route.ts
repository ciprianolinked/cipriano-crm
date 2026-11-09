import { NextResponse } from "next/server";
import { getAiConfig, testGeminiKey } from "@/lib/ai";
import {
  getGeminiKey,
  maskKey,
  removeGeminiKey,
  saveGeminiKey,
} from "@/lib/server/quotations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const config = await getAiConfig();
  const { key, source } = await getGeminiKey();
  return NextResponse.json({
    connected: config.provider !== "none",
    provider: config.provider,
    model: config.model,
    source,
    maskedKey: key ? maskKey(key) : null,
    fromPanel: source === "painel",
    fromEnv: source === "ambiente",
  });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { key?: unknown; test?: unknown };
    const key = typeof payload.key === "string" ? payload.key.trim() : "";
    if (!key) {
      return NextResponse.json({ error: "Cole a chave do Gemini para salvar." }, { status: 400 });
    }
    if (payload.test) {
      await testGeminiKey(key);
    }
    await saveGeminiKey(key);
    return NextResponse.json({ ok: true, maskedKey: maskKey(key) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível salvar a chave.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    await removeGeminiKey();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível remover a chave.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
