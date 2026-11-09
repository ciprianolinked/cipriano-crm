import "dotenv/config";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readAiAnalysisResponse } from "../src/lib/ai-response";

/** Gera PDFs de teste sintéticos em memória; não usa dados de clientes. */
function samplePdf(supplier: string, price: string): ArrayBuffer {
  const lines = [
    `FORNECEDOR: ${supplier}`,
    "ORCAMENTO - CONDOMINIO DE TESTE",
    "SERVICO: Limpeza de reservatorio",
    "QUANTIDADE: 1 servico",
    `VALOR UNITARIO: R$ ${price}`,
    `VALOR TOTAL: R$ ${price}`,
    "PRAZO DE EXECUCAO: 10 dias",
    "PAGAMENTO: 30 dias",
  ];
  const content = `BT\n/F1 12 Tf\n50 750 Td\n18 TL\n${lines.map((line) => `(${line.replace(/[\\()]/g, "\\$&")}) Tj T*`).join("\n")}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(Buffer.from(pdf)).buffer;
}

test("teste real opcional: compara três PDFs sintéticos em uma única análise", {
  timeout: 230_000,
  skip: process.env.GEMINI_LIVE_TEST !== "1" || !process.env.GEMINI_API_KEY,
}, async () => {
  const { POST } = await import("../src/app/api/ai/extract/route");
  const form = new FormData();
  for (const [name, price] of [["Fornecedor Alfa", "1.000,00"], ["Fornecedor Bravo", "1.200,00"], ["Fornecedor Charlie", "1.500,00"]]) {
    form.append("files", new File([samplePdf(name, price)], `${name}.pdf`, { type: "application/pdf" }));
  }
  form.append("hints", JSON.stringify({ condominium: "Condominio de teste", service: "Limpeza de reservatorio" }));
  const phases: string[] = [];
  const start = Date.now();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    if (String(input).startsWith("https://generativelanguage.googleapis.com/")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
      const route = String(input).includes(":generateContent") ? "generateContent" : "interactions";
      let code = "";
      try {
        const parsed = await response.clone().json() as { error?: { code?: string | number; status?: string } };
        code = String(parsed.error?.status ?? parsed.error?.code ?? "");
      } catch { /* não registrar conteúdo dos documentos ou da chave */ }
      console.log(`Google: ${route}, modelo=${body.model ?? "modelo na rota"}, HTTP=${response.status}, código=${code || "—"}, retry-after=${response.headers.get("retry-after") ?? "—"}`);
    }
    return response;
  };
  let result;
  try {
    const response = await POST(new Request("http://localhost/api/ai/extract?stream=1", { method: "POST", body: form }));
    result = await readAiAnalysisResponse(response, (phase) => phases.push(phase));
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(result.mode, "ia");
  assert.equal(result.draft.suppliers.length, 3, "A análise deve identificar os três fornecedores.");
  assert.ok(result.draft.items.length > 0, "A análise deve identificar o serviço cotado.");
  const prices = result.draft.items.flatMap((item) => Object.values(item.prices).filter((value): value is number => value !== null));
  for (const expected of [1000, 1200, 1500]) {
    assert.ok(prices.some((price) => Math.abs(price - expected) < 0.01), `Valor ${expected} deve ser identificado.`);
  }
  console.log(`Teste real: ${result.provider}; 3 fornecedores; ${result.draft.items.length} item(ns); ${(Date.now() - start) / 1000}s; etapas: ${phases.join(", ")}.`);
});

after(async () => {
  const { pool } = await import("../src/db");
  await pool.end();
});
