import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGeminiInteractionDetailed,
  DEFAULT_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
  type GeminiInputPart,
} from "../src/lib/server/gemini";

const documents: GeminiInputPart[] = [
  { type: "text", text: "Compare as três propostas" },
  { type: "document", mime_type: "application/pdf", data: "cGRmMQ==" },
  { type: "document", mime_type: "application/pdf", data: "cGRmMg==" },
  { type: "document", mime_type: "application/pdf", data: "cGRmMw==" },
];
const schema = { type: "object", properties: { suppliers: { type: "array" } } };
const interactionOk = () => Response.json({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: '{"suppliers":[]}' }] }] });
const generationOk = () => Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"suppliers":[]}' }] } }] });

function request(onRetry?: (phase: "retrying" | "alternative") => void) {
  return { model: DEFAULT_GEMINI_MODEL, apiKey: "chave-ficticia", input: documents, responseSchema: schema, retryBaseDelayMs: 0, onRetry };
}

test("recupera erro 503 mantendo os três PDFs e a chave protegida", async () => {
  const original = globalThis.fetch;
  const phases: string[] = [];
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = async (url, init) => {
    assert.doesNotMatch(String(url), /chave-ficticia/);
    assert.equal(new Headers(init?.headers).get("x-goog-api-key"), "chave-ficticia");
    requests.push({ url: String(url), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
    return requests.length === 1 ? new Response("temporarily unavailable", { status: 503 }) : interactionOk();
  };
  try {
    const result = await createGeminiInteractionDetailed(request((phase) => phases.push(phase)));
    assert.equal(requests.length, 2);
    assert.match(requests[0].url, /gemini-3\.1-flash-lite:generateContent$/);
    assert.match(requests[1].url, /\/interactions$/);
    const contents = requests[0].body.contents as Array<{ parts: unknown[] }>;
    assert.equal(contents[0].parts.length, 4);
    assert.deepEqual(requests[1].body.input, documents);
    assert.deepEqual(phases, ["alternative"]);
    assert.equal(result.model, DEFAULT_GEMINI_MODEL);
    assert.equal(result.usedAlternative, true);
    assert.equal(result.switchedModel, false);
  } finally { globalThis.fetch = original; }
});

test("usa Interactions se GenerateContent retornar erro 500", async () => {
  const original = globalThis.fetch;
  const phases: string[] = [];
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls += 1;
    if (calls === 1) {
      assert.match(String(url), /:generateContent$/);
      const body = JSON.parse(String(init?.body)) as { contents: Array<{ parts: Array<Record<string, unknown>> }>; generationConfig: { responseFormat: unknown; thinkingConfig: unknown } };
      assert.equal(body.contents[0].parts.length, 4);
      assert.deepEqual(body.contents[0].parts[1], { inlineData: { mimeType: "application/pdf", data: "cGRmMQ==" } });
      assert.deepEqual(body.generationConfig.responseFormat, { text: { mimeType: "APPLICATION_JSON", schema } });
      assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: "low" });
      return new Response("erro interno", { status: 500 });
    }
    assert.match(String(url), /\/interactions$/);
    return interactionOk();
  };
  try {
    const result = await createGeminiInteractionDetailed(request((phase) => phases.push(phase)));
    assert.equal(calls, 2);
    assert.equal(result.model, DEFAULT_GEMINI_MODEL);
    assert.deepEqual(phases, ["alternative"]);
    assert.equal(result.text, '{"suppliers":[]}');
  } finally { globalThis.fetch = original; }
});

test("usa o modelo alternativo quando o principal segue indisponível", async () => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  const phases: string[] = [];
  globalThis.fetch = async (url, init) => {
    urls.push(String(url));
    if (urls.length < 4) return new Response("temporariamente indisponível", { status: 503 });
    const body = JSON.parse(String(init?.body)) as { contents: Array<{ parts: unknown[] }> };
    assert.equal(body.contents[0].parts.length, 4);
    return generationOk();
  };
  try {
    const result = await createGeminiInteractionDetailed(request((phase) => phases.push(phase)));
    assert.equal(urls.length, 4);
    assert.match(urls[3], /gemini-3\.8-flash:generateContent$/);
    assert.equal(result.model, FALLBACK_GEMINI_MODEL);
    assert.equal(result.switchedModel, true);
    assert.deepEqual(phases, ["alternative", "alternative", "alternative"]);
  } finally { globalThis.fetch = original; }
});

test("modelo principal antigo usa Flash-Lite como alternativa", async () => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return urls.length < 2 ? new Response("indisponível", { status: 503 }) : generationOk();
  };
  try {
    const result = await createGeminiInteractionDetailed({ ...request(), model: "gemini-3.8-flash" });
    assert.match(urls[1], /gemini-3\.1-flash-lite:generateContent$/);
    assert.equal(result.model, DEFAULT_GEMINI_MODEL);
    assert.equal(result.switchedModel, true);
  } finally { globalThis.fetch = original; }
});

test("não repete chave inválida nem revela informações da resposta", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response('{"error":{"message":"API key not valid. secret"}}', { status: 400 }); };
  try {
    await assert.rejects(createGeminiInteractionDetailed(request()), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /chave do Gemini não é válida/i);
      assert.doesNotMatch(error.message, /secret|chave-ficticia/);
      return true;
    });
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("repete uma limitação temporária apenas uma vez", async () => {
  const original = globalThis.fetch;
  const phases: string[] = [];
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1 ? Response.json({ error: { code: "rate_limit_exceeded" } }, { status: 429 }) : interactionOk();
  };
  try {
    const result = await createGeminiInteractionDetailed(request((phase) => phases.push(phase)));
    assert.equal(calls, 2);
    assert.equal(result.model, DEFAULT_GEMINI_MODEL);
    assert.deepEqual(phases, ["alternative"]);
  } finally { globalThis.fetch = original; }
});

test("trata falha transitória informada no corpo da interação", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1 ? Response.json({ status: "failed", error: { code: "service_unavailable" } }) : generationOk();
  };
  try {
    const result = await createGeminiInteractionDetailed({ ...request(), input: [{ type: "text", text: "Teste" }] });
    assert.equal(calls, 2);
    assert.equal(result.text, '{"suppliers":[]}');
  } finally { globalThis.fetch = original; }
});

test("não repete solicitações quando a cota diária foi esgotada", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return Response.json({ error: { code: "quota_exceeded" } }, { status: 429 }); };
  try {
    await assert.rejects(createGeminiInteractionDetailed(request()), /limite de uso ou falta de cota/i);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("identifica limite diário no formato antigo do Google", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return Response.json({ error: { status: "RESOURCE_EXHAUSTED", message: "GenerateRequestsPerDay exceeded" } }, { status: 429 }); };
  try {
    await assert.rejects(createGeminiInteractionDetailed(request()), /limite de uso ou falta de cota/i);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("respeita o Retry-After de 30 segundos retornado pelo Google", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  let calls = 0;
  let retryScheduled = false;
  globalThis.fetch = async () => { calls += 1; return new Response("indisponível", { status: 503, headers: { "retry-after": "30" } }); };
  try {
    await assert.rejects(createGeminiInteractionDetailed({
      ...request(() => { retryScheduled = true; setTimeout(() => controller.abort(), 10); }),
      signal: controller.signal,
    }), /análise cancelada/i);
    assert.equal(retryScheduled, true);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("informa erro sem tentar imediatamente quando Retry-After excede 60 segundos", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response("indisponível", { status: 503, headers: { "retry-after": "90" } }); };
  try {
    await assert.rejects(createGeminiInteractionDetailed(request()), /código 503/i);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("o cancelamento durante a espera impede novas chamadas", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response("instável", { status: 503 }); };
  try {
    await assert.rejects(createGeminiInteractionDetailed({ ...request(() => controller.abort()), signal: controller.signal }), /análise cancelada/i);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("erro 503 persistente mantém os arquivos e informa o código", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response("detalhes privados", { status: 503 }); };
  try {
    await assert.rejects(createGeminiInteractionDetailed(request()), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /código 503/i);
      assert.match(error.message, /arquivos continuam selecionados/i);
      assert.doesNotMatch(error.message, /detalhes privados|chave-ficticia/i);
      return true;
    });
    assert.equal(calls, 4);
  } finally { globalThis.fetch = original; }
});
