import assert from "node:assert/strict";
import { test } from "node:test";
import { readAiAnalysisResponse } from "../src/lib/ai-response";

test("resposta HTML de timeout não aparece como erro de JSON", async () => {
  const response = new Response("<html><body>An error occurred FUNCTION_INVOCATION_TIMEOUT</body></html>", {
    status: 504,
    headers: { "content-type": "text/html" },
  });
  await assert.rejects(readAiAnalysisResponse(response), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /hospedagem encerrou a conexão/i);
    assert.doesNotMatch(error.message, /token|JSON|arquivos menores|60 segundos/i);
    return true;
  });
});

test("erro 413 informa o limite de envio, sem confundir com tempo de análise", async () => {
  const response = new Response("FUNCTION_PAYLOAD_TOO_LARGE", {
    status: 413,
    headers: { "content-type": "text/plain" },
  });
  await assert.rejects(readAiAnalysisResponse(response), /abaixo de 4 MB/i);
});

test("erro da IA em JSON é preservado para o usuário", async () => {
  const response = Response.json({ error: "A chave de IA não é válida." }, { status: 500 });
  await assert.rejects(readAiAnalysisResponse(response), /chave de IA não é válida/i);
});

test("JSON malformado não expõe a mensagem técnica de parsing", async () => {
  const response = new Response("Um erro ocorreu", {
    status: 500,
    headers: { "content-type": "application/json" },
  });
  await assert.rejects(readAiAnalysisResponse(response), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /não foi possível analisar/i);
    assert.doesNotMatch(error.message, /token|JSON/i);
    return true;
  });
});

test("fluxo interrompido avisa que os arquivos continuam selecionados", async () => {
  const response = new Response('{"type":"progress","phase":"analisando"}\n', {
    headers: { "content-type": "application/x-ndjson" },
  });
  await assert.rejects(readAiAnalysisResponse(response), /arquivos continuam selecionados/i);
});
