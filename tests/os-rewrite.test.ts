import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { mergeOsRewrite, pickOsTexts, readOsTexts, type OsTexts } from "../src/lib/os-rewrite";
import { OsRewriteError, rewriteOsTexts, validateOsRewrite } from "../src/lib/os-rewrite-ai";

const source: OsTexts = {
  description: "cameras 4 e 5 sem imagem desde 24/11/2026",
  diagnosis: "ip 192.168.1.20 fora da faixa",
  solution: "refeito ip 192.168.1.20, prazo 2 dias",
  notes: "",
};
const revised: OsTexts = {
  description: "As câmeras 4 e 5 estão sem imagem desde 24/11/2026.",
  diagnosis: "O endereço IP 192.168.1.20 estava fora da faixa de rede.",
  solution: "A configuração do endereço IP 192.168.1.20 foi refeita. Prazo: 2 dias.",
  notes: "",
};
const completion = (blocks: unknown) => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(blocks) } }] });

function mock(t: TestContext, handler: typeof fetch) {
  const fetchBefore = globalThis.fetch;
  const vars = ["OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_BASE_URL"] as const;
  const before = Object.fromEntries(vars.map((name) => [name, process.env[name]]));
  process.env.OPENAI_API_KEY = "unit-test-placeholder";
  delete process.env.OPENAI_MODEL;
  delete process.env.OPENAI_BASE_URL;
  globalThis.fetch = handler;
  t.after(() => {
    globalThis.fetch = fetchBefore;
    vars.forEach((name) => { if (before[name] === undefined) delete process.env[name]; else process.env[name] = before[name]; });
  });
}

test("Draft validation requires all current fields and enforces length limits", () => {
  assert.deepEqual(readOsTexts(source), source);
  assert.throws(() => readOsTexts(null));
  assert.throws(() => readOsTexts({ description: "oi" }));
  assert.throws(() => readOsTexts({ ...source, notes: "a".repeat(8001) }));
});

test("Structured revision preserves numeric facts and blank fields", () => {
  assert.deepEqual(validateOsRewrite(revised, source), revised);
  assert.throws(() => validateOsRewrite({ ...revised, solution: "Prazo: 10 dias." }, source), OsRewriteError);
  assert.throws(() => validateOsRewrite({ ...revised, notes: "Testes aprovados." }, source), OsRewriteError);
  assert.throws(() => validateOsRewrite({ description: "incompleto" }, source), OsRewriteError);
});

test("Merge updates changed fields but preserves text edited during the request", () => {
  const current = { ...source, diagnosis: "Diagnóstico digitado enquanto a IA respondia." };
  const merged = mergeOsRewrite(current, source, revised);
  assert.deepEqual(merged.skipped, ["diagnosis"]);
  assert.equal(merged.changes.length, 2);
  assert.equal(merged.patch.description, revised.description);
  assert.equal(merged.patch.diagnosis, undefined);
  assert.equal(merged.patch.notes, undefined);
});

test("Identical AI output is reported as no changes, not an applied rewrite", () => {
  assert.equal(mergeOsRewrite(source, source, source).changes.length, 0);
});

test("OpenAI receives the current unsaved draft as structured JSON", async (t) => {
  mock(t, async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.response_format.type, "json_schema");
    assert.equal(body.response_format.json_schema.strict, true);
    assert.deepEqual(JSON.parse(body.messages[1].content).textos_atuais_do_editor, source);
    assert.equal(body.model, "gpt-4o-mini");
    return completion(revised);
  });
  assert.deepEqual(await rewriteOsTexts(pickOsTexts(source), { kind: "corretiva", status: "aberta" }), revised);
});

test("Unsupported strict schemas retry JSON mode once without discarding fields", async (t) => {
  let calls = 0;
  mock(t, async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    if (calls === 1) return Response.json({ error: { param: "response_format", message: "json_schema unsupported" } }, { status: 400 });
    assert.equal(body.response_format.type, "json_object");
    return completion(revised);
  });
  assert.deepEqual(await rewriteOsTexts(source, { kind: "corretiva", status: "aberta" }), revised);
  assert.equal(calls, 2);
});

test("No credentials does not call the provider or fake a successful revision", async (t) => {
  mock(t, async () => { throw new Error("must not fetch"); });
  delete process.env.OPENAI_API_KEY;
  await assert.rejects(rewriteOsTexts(source, { kind: "corretiva", status: "aberta" }), (error: unknown) => error instanceof OsRewriteError && error.code === "ai_not_configured");
});

test("Provider errors and malformed/truncated responses never silently return saved texts", async (t) => {
  let response = Response.json({ error: { code: "invalid_api_key" } }, { status: 401 });
  mock(t, async () => response);
  await assert.rejects(rewriteOsTexts(source, { kind: "corretiva", status: "aberta" }), (error: unknown) => error instanceof OsRewriteError && error.code === "ai_auth");
  response = Response.json({ choices: [{ finish_reason: "stop", message: { content: "NOT JSON" } }] });
  await assert.rejects(rewriteOsTexts(source, { kind: "corretiva", status: "aberta" }), (error: unknown) => error instanceof OsRewriteError && error.code === "ai_invalid_response");
  response = Response.json({ choices: [{ finish_reason: "length", message: { content: "{..." } }] });
  await assert.rejects(rewriteOsTexts(source, { kind: "corretiva", status: "aberta" }), (error: unknown) => error instanceof OsRewriteError && error.code === "ai_incomplete");
});
