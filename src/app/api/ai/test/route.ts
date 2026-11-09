import { NextResponse } from "next/server";
import { testGeminiKey } from "@/lib/ai";
import { getGeminiKey } from "@/lib/server/quotations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    let key = "";
    try {
      const payload = (await request.json()) as { key?: unknown };
      if (typeof payload.key === "string") key = payload.key.trim();
    } catch {
      key = "";
    }
    if (!key) {
      const saved = await getGeminiKey();
      key = saved.key ?? "";
    }
    if (!key) {
      return NextResponse.json({ error: "Nenhuma chave encontrada para testar." }, { status: 400 });
    }
    const result = await testGeminiKey(key);
    return NextResponse.json({ ok: true, model: result.model });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no teste de conexão.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
