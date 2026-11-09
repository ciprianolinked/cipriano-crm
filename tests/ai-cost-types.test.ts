import "dotenv/config";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { supplierCostBreakdown } from "../src/lib/quotation";

test("IA separa mão de obra, material e valor global sem duplicar", async () => {
  const original = globalThis.fetch;
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "chave-ficticia-teste";
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { contents: { parts: { text?: string }[] }[]; generationConfig: { responseFormat: { text: { schema: { properties: { items: { items: { properties: Record<string, unknown> } } } } } } } };
    assert.match(body.contents[0].parts[0].text ?? "", /NÃO estime, invente ou divida preços globais/i);
    assert.ok(body.generationConfig.responseFormat.text.schema.properties.items.items.properties.costType);
    const raw = {
      suppliers: [{ name: "Empresa A" }, { name: "Empresa B" }],
      items: [
        { description: "Instalação", costType: "mao_obra", unit: "serviço", quantity: 1, prices: [500, 600] },
        { description: "Materiais", costType: "material", unit: "un", quantity: 2, prices: [100, 120] },
        { description: "Valor global combinado", costType: "nao_discriminado", unit: "vb (verba)", quantity: 1, prices: [null, null] },
      ],
    };
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(raw) }] } }] });
  };
  try {
    const { extractQuotation } = await import("../src/lib/ai");
    const result = await extractQuotation({ files: [{ name: "cotacao.pdf", size: 10, type: "application/pdf", base64: "cGRm" }], text: "", hints: {} });
    assert.deepEqual(result.draft.items.map((item) => item.costType), ["mao_obra", "material", "nao_discriminado"]);
    const costs = supplierCostBreakdown(result.draft.items, result.draft.suppliers[0].id);
    assert.equal(costs.mao_obra.total, 500);
    assert.equal(costs.material.total, 200);
    assert.equal(costs.nao_discriminado.total, null);
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
