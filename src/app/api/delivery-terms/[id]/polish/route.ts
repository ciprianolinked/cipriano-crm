import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { deliveryTerms } from "@/db/schema";
import { ensureSchema } from "@/lib/db-migrations";
import { maybePolishWithLLM } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };

const MARK = "@@@BLOCO@@@";

/** Refina a redação do termo com IA sem salvar — o editor aplica e o usuário confirma. */
export async function POST(request: Request, { params }: Context) {
  await ensureSchema();
  const { id } = await params;
  const [row] = await db.select().from(deliveryTerms).where(eq(deliveryTerms.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "Termo não encontrado." }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { fields?: string[] };
  const fields = (Array.isArray(body.fields) ? body.fields : ["intro", "scopeSummary", "tests"]).filter((f) =>
    ["intro", "scopeSummary", "tests", "pendencies", "warranty", "observations"].includes(String(f)),
  ) as ("intro" | "scopeSummary" | "tests" | "pendencies" | "warranty" | "observations")[];
  if (!fields.length) return NextResponse.json({ error: "Nenhum campo para refinar." }, { status: 400 });

  const labels: Record<string, string> = {
    intro: "IDENTIFICAÇÃO",
    scopeSummary: "ESCOPO ENTREGUE",
    tests: "TESTES EXECUTADOS",
    pendencies: "PENDÊNCIAS",
    warranty: "GARANTIA",
    observations: "OBSERVAÇÕES",
  };
  const prompt =
    `Termo ${row.termNumber} · Cliente ${row.clientName} · Local ${row.site ?? "—"}.\n\n` +
    fields.map((f) => `${labels[f]}:\n${row[f] || "(vazio)"}`).join(`\n\n${MARK}\n\n`);

  const polished = await maybePolishWithLLM({
    system:
      "Você é um engenheiro de segurança eletrônica revisando um termo de entrega e comissionamento em português formal e objetivo. Reescreva cada bloco mantendo TODOS os números, quantidades, modelos, locais e condições exatamente como estão. Não invente equipamentos, testes, pendências ou garantias. Se um bloco estiver vazio, devolva-o vazio. Separe os blocos reescritos com a linha exata @@@BLOCO@@@, na mesma ordem, sem títulos extras.",
    prompt,
  });
  if (!polished) {
    return NextResponse.json(
      { error: "IA generativa indisponível no momento (sem OPENAI_API_KEY no servidor). O texto atual foi preservado." },
      { status: 503 },
    );
  }
  const parts = polished.includes(MARK)
    ? polished.split(MARK).map((p) => p.trim())
    : [polished.trim()];
  const blocks: Record<string, string> = {};
  fields.forEach((f, i) => {
    const text = parts[i] ?? parts[0] ?? "";
    if (text) blocks[f] = text;
  });
  return NextResponse.json({ blocks, source: "llm" });
}
