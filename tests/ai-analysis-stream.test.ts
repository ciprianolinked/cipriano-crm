import "dotenv/config";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readAiAnalysisResponse } from "../src/lib/ai-response";
import { createAiAnalysisStream } from "../src/lib/server/analysis-stream";
import { GEMINI_ANALYSIS_TIMEOUT_MS } from "../src/lib/server/gemini";
import type { AiExtractionResult } from "../src/lib/types";

const example: AiExtractionResult = {
  mode: "ia",
  provider: "Google Gemini · teste",
  warnings: [],
  fileSummaries: [],
  draft: { suppliers: [], items: [] },
};

function asResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, { headers: { "content-type": "application/x-ndjson" } });
}

test("a análise dispõe de mais tempo que o limite anterior de 52 segundos", () => {
  assert.equal(GEMINI_ANALYSIS_TIMEOUT_MS, 210_000);
  assert.ok(GEMINI_ANALYSIS_TIMEOUT_MS > 52_000);
});

test("o fluxo informa as etapas reais e entrega somente o resultado concluído", async () => {
  const phases: string[] = [];
  const stream = createAiAnalysisStream(
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return example;
    },
    { heartbeatMs: 5 },
  );
  const result = await readAiAnalysisResponse(asResponse(stream), (phase) => phases.push(phase));
  assert.deepEqual(phases, ["recebido", "analisando"]);
  assert.deepEqual(result, example);
});

test("o fluxo mantém a conexão ativa enquanto espera a IA", async () => {
  const stream = createAiAnalysisStream(
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return example;
    },
    { heartbeatMs: 5 },
  );
  const raw = await asResponse(stream).text();
  assert.match(raw, /"type":"heartbeat"/);
  assert.match(raw, /"type":"result"/);
});

test("cancelar a leitura interrompe a operação em andamento", async () => {
  let canceled = false;
  const stream = createAiAnalysisStream(
    (signal) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        canceled = true;
        reject(new Error("Cancelado"));
      }, { once: true });
    }),
    { heartbeatMs: 10 },
  );
  const reader = stream.getReader();
  await reader.read();
  await Promise.resolve();
  await reader.cancel();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(canceled, true);
});

test("erro da IA é apresentado sem inventar dados ou mencionar tamanho do PDF", async () => {
  const stream = createAiAnalysisStream(async () => {
    throw new Error("A conexão com a IA expirou; tente novamente.");
  });
  await assert.rejects(readAiAnalysisResponse(asResponse(stream)), /A conexão com a IA expirou/);
});

test("respostas HTML e JSON inválido não causam erro de token inesperado", async () => {
  const html = new Response("<html>Um erro ocorreu FUNCTION_INVOCATION_TIMEOUT</html>", {
    status: 504,
    headers: { "content-type": "text/html" },
  });
  await assert.rejects(readAiAnalysisResponse(html), /hospedagem encerrou a conexão/i);
  const malformed = new Response("Um erro ocorreu", {
    status: 500,
    headers: { "content-type": "application/json" },
  });
  await assert.rejects(readAiAnalysisResponse(malformed), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.doesNotMatch(error.message, /token|JSON/i);
    return true;
  });
});

test("solicitação antiga continua recebendo JSON tradicional", async () => {
  const response = Response.json(example);
  assert.deepEqual(await readAiAnalysisResponse(response), example);
});

test("três PDFs pequenos são comparados juntos em uma única análise", { timeout: 8_000 }, async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = "chave-ficticia-sem-custo";
  let documentCount = 0;
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls += 1;
    const body = JSON.parse(String(init?.body)) as {
      contents: Array<{ parts: Array<{ inlineData?: { mimeType: string } }> }>;
      generationConfig?: { thinkingConfig?: { thinkingLevel?: string } };
    };
    documentCount = body.contents[0].parts.filter((part) => part.inlineData?.mimeType === "application/pdf").length;
    assert.match(String(_url), /gemini-3\.1-flash-lite:generateContent$/);
    assert.equal(body.generationConfig?.thinkingConfig?.thinkingLevel, "low");
    const raw = {
      condominium: "Condomínio de teste",
      suppliers: [{ name: "Fornecedor A" }, { name: "Fornecedor B" }, { name: "Fornecedor C" }],
      items: [{ description: "Manutenção", unit: "serviço", quantity: 1, prices: [300, 250, 275] }],
    };
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(raw) }] } }] });
  };

  try {
    const { POST } = await import("../src/app/api/ai/extract/route");
    const form = new FormData();
    for (let index = 1; index <= 3; index++) {
      form.append("files", new File([new Uint8Array(250 * 1024)], `proposta-${index}.pdf`, { type: "application/pdf" }));
    }
    form.append("hints", "{}");
    const response = await POST(new Request("http://localhost/api/ai/extract?stream=1", { method: "POST", body: form }));
    const result = await readAiAnalysisResponse(response);
    assert.equal(calls, 1);
    assert.equal(documentCount, 3);
    assert.equal(result.draft.suppliers.length, 3);
    assert.deepEqual(result.draft.suppliers.map((supplier) => result.draft.items[0].prices[supplier.id]), [300, 250, 275]);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test("falha do Google aciona alternativa sem perder os três PDFs", { timeout: 10_000 }, async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = "chave-ficticia-sem-custo";
  let calls = 0;
  const counts: number[] = [];
  globalThis.fetch = async (url, init) => {
    calls += 1;
    const body = JSON.parse(String(init?.body)) as {
      input?: Array<{ type: string }>;
      contents?: Array<{ parts: Array<Record<string, unknown>> }>;
    };
    counts.push(body.input ? body.input.filter((part) => part.type === "document").length : body.contents?.[0].parts.filter((part) => "inlineData" in part).length ?? 0);
    if (calls < 4) return new Response("indisponível", { status: 503 });
    assert.match(String(url), /gemini-3\.8-flash:generateContent$/);
    const raw = {
      suppliers: [{ name: "Fornecedor A" }, { name: "Fornecedor B" }, { name: "Fornecedor C" }],
      items: [{ description: "Manutenção", unit: "serviço", quantity: 1, prices: [300, 250, 275] }],
    };
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(raw) }] } }] });
  };
  try {
    const { POST } = await import("../src/app/api/ai/extract/route");
    const form = new FormData();
    for (let index = 1; index <= 3; index++) {
      form.append("files", new File([new Uint8Array(250 * 1024)], `proposta-${index}.pdf`, { type: "application/pdf" }));
    }
    const response = await POST(new Request("http://localhost/api/ai/extract?stream=1", { method: "POST", body: form }));
    const phases: string[] = [];
    const result = await readAiAnalysisResponse(response, (phase) => phases.push(phase));
    assert.deepEqual(counts, [3, 3, 3, 3]);
    assert.deepEqual(phases, ["recebido", "analisando", "alternativa", "alternativa", "alternativa"]);
    assert.equal(result.draft.suppliers.length, 3);
    assert.match(result.provider, /gemini-3\.8-flash/);
    assert.ok(result.warnings.some((warning) => /modelo principal estava indisponível/i.test(warning)));
    assert.deepEqual(result.draft.suppliers.map((supplier) => result.draft.items[0].prices[supplier.id]), [300, 250, 275]);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test("três PDFs permanecem na mesma análise após mais de 52 segundos", {
  timeout: 65_000,
  skip: process.env.RUN_SLOW_AI_TEST !== "1",
}, async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = "chave-ficticia-sem-custo";
  let observedSignal: AbortSignal | null = null;
  let documentCount = 0;
  globalThis.fetch = async (_url, init) => {
    observedSignal = init?.signal ?? null;
    const body = JSON.parse(String(init?.body)) as { contents: Array<{ parts: Array<{ inlineData?: { mimeType: string } }> }> };
    documentCount = body.contents[0].parts.filter((part) => part.inlineData?.mimeType === "application/pdf").length;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 52_300);
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("Sinal de timeout antecipado"));
      }, { once: true });
    });
    const raw = {
      suppliers: [{ name: "Fornecedor A" }, { name: "Fornecedor B" }, { name: "Fornecedor C" }],
      items: [{ description: "Manutenção", unit: "serviço", quantity: 1, prices: [300, 250, 275] }],
    };
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(raw) }] } }] });
  };
  try {
    const { POST } = await import("../src/app/api/ai/extract/route");
    const form = new FormData();
    for (let index = 1; index <= 3; index++) {
      form.append("files", new File([new Uint8Array(250 * 1024)], `proposta-${index}.pdf`, { type: "application/pdf" }));
    }
    const response = await POST(new Request("http://localhost/api/ai/extract?stream=1", { method: "POST", body: form }));
    const phases: string[] = [];
    const result = await readAiAnalysisResponse(response, (phase) => phases.push(phase));
    assert.deepEqual(phases, ["recebido", "analisando"]);
    assert.equal(documentCount, 3);
    assert.equal(result.draft.suppliers.length, 3);
    assert.ok(observedSignal);
    assert.equal((observedSignal as AbortSignal).aborted, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

after(async () => {
  const { pool } = await import("../src/db");
  await pool.end();
});
