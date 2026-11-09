import "dotenv/config";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createGeminiInteraction, DEFAULT_GEMINI_MODEL, resolveGeminiModel } from "../src/lib/server/gemini";

test("seleciona Flash-Lite e corrige a configuração antiga", () => {
  assert.equal(resolveGeminiModel(), "gemini-3.1-flash-lite");
  assert.equal(resolveGeminiModel("gemini-2.5-flash"), DEFAULT_GEMINI_MODEL);
  assert.equal(resolveGeminiModel(" models/gemini-2.5-flash "), DEFAULT_GEMINI_MODEL);
  assert.equal(resolveGeminiModel("models/gemini-3.8-flash"), "gemini-3.8-flash");
  assert.equal(resolveGeminiModel("gemini-modelo-personalizado"), "gemini-modelo-personalizado");
});

test("envia PDF e imagem pela API multimodal com resposta estruturada", async () => {
  const originalFetch = globalThis.fetch;
  const schema = { type: "object", properties: { suppliers: { type: "array" } } };
  let called = false;
  globalThis.fetch = async (url, init) => {
    called = true;
    assert.equal(String(url), `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent`);
    assert.equal(new Headers(init?.headers).get("x-goog-api-key"), "chave-de-teste");
    assert.ok(!String(url).includes("chave-de-teste"));
    const body = JSON.parse(String(init?.body)) as { contents: { parts: unknown[] }[]; generationConfig: Record<string, unknown> };
    assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: "low" });
    assert.deepEqual(body.generationConfig.responseFormat, { text: { mimeType: "APPLICATION_JSON", schema } });
    assert.deepEqual(body.contents[0].parts, [
      { text: "Analisar propostas" },
      { inlineData: { mimeType: "application/pdf", data: "cGRm" } },
      { inlineData: { mimeType: "image/jpeg", data: "anBn" } },
    ]);
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"suppliers":[]}' }] } }] });
  };
  try {
    const result = await createGeminiInteraction({
      model: "gemini-2.5-flash",
      apiKey: "chave-de-teste",
      input: [
        { type: "text", text: "Analisar propostas" },
        { type: "document", mime_type: "application/pdf", data: "cGRm" },
        { type: "image", mime_type: "image/jpeg", data: "anBn" },
      ],
      responseSchema: schema,
    });
    assert.equal(result, '{"suppliers":[]}');
    assert.equal(called, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("mostra orientação amigável quando o modelo não está disponível", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("detalhes privados", { status: 404 });
  try {
    await assert.rejects(
      createGeminiInteraction({
        model: "gemini-3.8-flash",
        apiKey: "chave-de-teste",
        input: [{ type: "text", text: "Teste" }],
        retryBaseDelayMs: 0,
      }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /modelo Gemini configurado não está disponível/i);
        assert.match(error.message, /Google AI Studio/);
        assert.doesNotMatch(error.message, /detalhes privados|chave-de-teste/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("não considera uma resposta incompleta como teste bem-sucedido", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ status: "incomplete", steps: [] });
  try {
    await assert.rejects(
      createGeminiInteraction({
        model: DEFAULT_GEMINI_MODEL,
        apiKey: "chave-de-teste",
        input: [{ type: "text", text: "Teste" }],
      }),
      /não concluiu a análise/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("teste de chave e extração usam o modelo atual sem expor credenciais", async () => {
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = "chave-ficticia-para-teste";
  process.env.GEMINI_MODEL = "models/gemini-2.5-flash";
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requests.push({ url: String(url), body });
    assert.equal(new Headers(init?.headers).get("x-goog-api-key"), "chave-ficticia-para-teste");
    if (String(url).endsWith("/interactions")) {
      return Response.json({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: "OK" }] }] });
    }
    const generationConfig = body.generationConfig as { responseFormat?: unknown } | undefined;
    if (!generationConfig?.responseFormat) {
      return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "OK" }] } }] });
    }
    const answer = JSON.stringify({
      condominium: "Condomínio de teste",
      kind: "produtos",
      category: "Hidráulica",
      suppliers: [{ name: "Fornecedor de teste" }],
      items: [{ description: "Tubo", quantity: 2, unit: "un", prices: [12.5] }],
    });
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: answer }] } }] });
  };

  try {
    const { testGeminiKey, extractQuotation } = await import("../src/lib/ai");
    const check = await testGeminiKey("chave-ficticia-para-teste");
    assert.deepEqual(check, { ok: true, model: DEFAULT_GEMINI_MODEL });
    const result = await extractQuotation({
      files: [
        { name: "proposta.pdf", type: "application/pdf", size: 3, base64: "cGRm" },
        { name: "foto.jpg", type: "image/jpeg", size: 3, base64: "anBn" },
      ],
      text: "",
      hints: {},
    });
    assert.equal(result.mode, "ia");
    assert.ok(result.provider.includes(DEFAULT_GEMINI_MODEL));
    assert.equal(result.draft.suppliers[0].name, "Fornecedor de teste");
    assert.equal(result.draft.items[0].prices[result.draft.suppliers[0].id], 12.5);
    assert.equal(requests.length, 2);
    assert.match(requests[0].url, /gemini-3\.1-flash-lite:generateContent$/);
    assert.match(requests[1].url, /gemini-3\.1-flash-lite:generateContent$/);
    const contents = requests[1].body.contents as Array<{ parts: Array<{ inlineData?: { mimeType: string } }> }>;
    assert.ok(contents[0].parts.some((part) => part.inlineData?.mimeType === "application/pdf"));
    assert.ok(contents[0].parts.some((part) => part.inlineData?.mimeType === "image/jpeg"));
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = previousModel;
  }
});

after(async () => {
  const { pool } = await import("../src/db");
  await pool.end();
});
