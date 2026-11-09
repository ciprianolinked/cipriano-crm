import "dotenv/config";
import assert from "node:assert/strict";
import { after, test } from "node:test";

const extractionRaw = {
  condominium: "Condomínio Links",
  suppliers: [{ name: "Alfa" }, { name: "Bravo" }],
  items: [
    { description: "Tubo PVC 25mm", costType: "material", unit: "un", quantity: 10, prices: [89.9, 95], purchaseUrl: "https://www.leroymerlin.com.br/tubo/p" },
    { description: "Registro gaveta", costType: "material", unit: "un", quantity: 2, prices: [64.5, 70], purchaseUrl: "não informado" },
  ],
};

test("extrai link do documento, descarta endereço inválido e completa pela pesquisa online", async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "chave-ficticia";
  const original = globalThis.fetch;
  const calls: { url: string; tools?: unknown }[] = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body)) as { tools?: unknown; contents: { parts: { text?: string }[] }[] };
    calls.push({ url: String(url), tools: body.tools });
    if (body.tools) {
      const raw = {
        results: [
          { item: 2, found: true, store: "Telhanorte", productName: "Registro gaveta 3/4", price: 59.9, url: "https://www.telhanorte.com.br/registro/p" },
        ],
      };
      return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(raw) }] } }] });
    }
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(extractionRaw) }] } }] });
  };
  try {
    const { extractQuotation } = await import("../src/lib/ai");
    const phases: string[] = [];
    const result = await extractQuotation({
      files: [{ name: "proposta.pdf", size: 10, type: "application/pdf", base64: "cGRm" }],
      text: "",
      hints: {},
      searchProducts: true,
      onPhase: (phase) => phases.push(phase),
    });
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].tools, [{ google_search: {} }]);
    assert.deepEqual(phases, ["pesquisando"]);

    const [tubo, registro] = result.draft.items;
    // Link do documento mantido e marcado como confiável.
    assert.equal(tubo.purchaseUrl, "https://www.leroymerlin.com.br/tubo/p");
    assert.equal(tubo.purchaseStore, "Leroy Merlin");
    assert.equal(tubo.purchaseVerified, true);
    assert.equal(tubo.purchaseSource, "documento");
    // Texto inválido do documento é descartado; a pesquisa preenche o restante.
    assert.equal(registro.purchaseUrl, "https://www.telhanorte.com.br/registro/p");
    assert.equal(registro.purchaseStore, "Telhanorte");
    assert.equal(registro.purchasePrice, 59.9);
    assert.equal(registro.purchaseSource, "pesquisa");
    assert.equal(registro.purchaseVerified, true);
  } finally {
    globalThis.fetch = original;
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});

test("sem a opção marcada, nenhuma pesquisa é feita", async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "chave-ficticia";
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(extractionRaw) }] } }] });
  };
  try {
    const { extractQuotation } = await import("../src/lib/ai");
    const result = await extractQuotation({
      files: [{ name: "proposta.pdf", size: 10, type: "application/pdf", base64: "cGRm" }],
      text: "",
      hints: {},
      searchProducts: false,
    });
    assert.equal(calls, 1);
    assert.equal(result.draft.items[0].purchaseUrl, "https://www.leroymerlin.com.br/tubo/p");
  } finally {
    globalThis.fetch = original;
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});

after(async () => {
  const { pool } = await import("../src/db");
  await pool.end();
});

test("extrai site do fornecedor e permite complementar com link de e-commerce", async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "chave-ficticia";
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    candidates: [{
      finishReason: "STOP",
      content: { parts: [{ text: JSON.stringify({
        condominium: "Condomínio E-commerce",
        suppliers: [{ name: "Kabum Comércio", purchaseUrl: "https://www.kabum.com.br" }, { name: "Fornecedor Local" }],
        items: [{ description: "Luminária Solar Intelbras LSI 4800", costType: "material", unit: "un", quantity: 1, prices: [1572.28, 1690] }],
      }) }] },
    }],
  });
  try {
    const { extractQuotation } = await import("../src/lib/ai");
    const result = await extractQuotation({
      files: [{ name: "cotacao.pdf", size: 10, type: "application/pdf", base64: "cGRm" }],
      text: "",
      hints: {},
      searchProducts: false,
    });
    const [kabum] = result.draft.suppliers;
    assert.equal(kabum.purchaseUrl, "https://www.kabum.com.br/");
    assert.equal(kabum.purchaseVerified, true);
    assert.equal(kabum.purchaseSource, "documento");
    assert.equal(result.draft.suppliers[1].purchaseUrl, undefined);
  } finally {
    globalThis.fetch = original;
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});
