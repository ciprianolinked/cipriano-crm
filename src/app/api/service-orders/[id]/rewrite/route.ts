import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceOrders } from "@/db/schema";
import { ensureSchema } from "@/lib/db-migrations";
import { maybePolishWithLLM } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MARK = "@@@BLOCO@@@";

const PARTS = [
  { key: "description", label: "SOLICITAÇÃO", hint: "descreva a solicitação, o defeito informado pelo cliente ou a necessidade de serviço, mantendo todos os fatos, datas e valores." },
  { key: "diagnosis", label: "DIAGNÓSTICO TÉCNICO", hint: "descreva o que foi identificado em campo, com o mesmo detalhe técnico que você escreveu." },
  { key: "solution", label: "SOLUÇÃO EXECUTADA / PROPOSTA", hint: "descreva o serviço executado e/ou a solução proposta, mantendo peças, quantidades e procedimentos." },
  { key: "notes", label: "OBSERVAÇÕES", hint: "redija os combinados e avisos para o cliente com tom formal." },
] as const;

type PartKey = (typeof PARTS)[number]["key"];

/** Reescreve os textos da OS com linguagem formal, preservando TODOS os fatos escritos pelo usuário. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const [os] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
  if (!os) return NextResponse.json({ error: "OS não encontrada." }, { status: 404 });

  const source = [
    ["description", os.description],
    ["diagnosis", os.diagnosis],
    ["solution", os.solution],
    ["notes", os.notes],
  ] as [PartKey, string][];

  const sections = source
    .map(([key, text]) => {
      const part = PARTS.find((p) => p.key === key)!;
      return `${part.label}:\n${String(text ?? "").trim() || "(vazio)"}`;
    })
    .join(`\n\n${MARK}\n\n`);

  if (!sections.includes("(vazio)") && sections.trim().length > 0) {
    // tudo preenchido — segue normalmente
  }

  const polished = await maybePolishWithLLM({
    system:
      "Você é um engenheiro de segurança eletrônica redigindo documentos formais de trabalho (ordem de serviço) em português formal e objetivo, no padrão de uma engenharia de serviços técnicos prestados em campo. Reescreva APENAS os blocos fornecidos, preservando com fidelidade TODOS os fatos: números, datas, valores, modelos, quantidades, procedimentos, nomes, localidades e contatos. Não invente nada que não conste no texto de origem; se o bloco estiver vazio, devolva-o vazio. Não acrescente itens, não invente garantias, não prometa resultados. Separe os blocos reescritos com a linha exata @@@BLOCO@@@, na mesma ordem, sem títulos extras e sem formatação markdown.",
    prompt: `OS ${os.number} · Cliente ${os.clientName} · Local ${os.site ?? "—"} · Tipo: ${os.kind} · Status: ${os.status}\n\n${sections}`,
  });

  if (!polished || !polished.includes(MARK)) {
    return NextResponse.json(
      { error: "IA generativa indisponível no momento (sem OPENAI_API_KEY no servidor). O texto atual foi preservado." },
      { status: 503 },
    );
  }

  const parts = polished.split(MARK).map((p) => p.trim());
  const result: Record<PartKey, string> = { description: "", diagnosis: "", solution: "", notes: "" };
  PARTS.forEach((part, index) => {
    const text = parts[index] ?? "";
    if (text && text !== "(vazio)" && text !== "(vazio)") result[part.key] = text;
  });
  // Se a IA devolveu menos blocos do que pedimos, mantém os textos originais vazios intactos.
  for (const [key, text] of source) {
    if (!result[key] && String(text ?? "").trim()) result[key] = String(text).trim();
  }

  const changed = (Object.keys(result) as PartKey[]).filter(
    (key) => result[key] !== String(os[key as keyof typeof os] ?? "").trim(),
  );

  return NextResponse.json({
    blocks: result,
    changed,
    source: "llm",
    message:
      changed.length === 0
        ? "A IA entendeu que seu texto já está formal. Nada foi alterado."
        : `Reescrito por IA: ${changed.map((k) => PARTS.find((p) => p.key === k)?.label.toLowerCase()).join(", ")}. Revise e salve.`,
  });
}
