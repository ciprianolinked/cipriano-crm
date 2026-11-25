import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import { serviceOrders } from "../src/db/schema";
import { POST } from "../src/app/api/service-orders/[id]/rewrite/route";

// Run after build_and_start has prepared the local database. No production data is modified.
test("OS rewrite route uses unsaved text and does not change stored text until Save", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  let id: string | undefined;
  try {
    const [row] = await db.insert(serviceOrders).values({
      number: `QA-${Date.now()}`, clientName: "Teste automatizado da revisão", description: "Descrição antiga no banco",
      diagnosis: "Diagnóstico antigo", solution: "Solução antiga", laborCents: 0,
    }).returning();
    id = row.id;
    const draft = { description: "revisar 4 câmeras", diagnosis: "ips fora da faixa", solution: "refeita configuração das câmeras", notes: "" };
    const revised = { description: "Solicita-se a revisão de 4 câmeras.", diagnosis: "Os endereços IP estavam fora da faixa de rede.", solution: "A configuração das câmeras foi refeita.", notes: "" };
    process.env.OPENAI_API_KEY = "integration-test-placeholder";
    globalThis.fetch = async (_url, init) => {
      const payload = JSON.parse(String(init?.body));
      assert.deepEqual(JSON.parse(payload.messages[1].content).textos_atuais_do_editor, draft);
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(revised) } }] });
    };
    const response = await POST(new Request(`http://localhost/api/service-orders/${id}/rewrite`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blocks: draft }),
    }), { params: Promise.resolve({ id }) });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload.blocks, revised);
    assert.deepEqual(payload.changed, ["description", "diagnosis", "solution"]);
    const [stored] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, id));
    assert.equal(stored.description, "Descrição antiga no banco");
    const missing = await POST(new Request(`http://localhost/api/service-orders/${id}/rewrite`, { method: "POST" }), { params: Promise.resolve({ id }) });
    assert.equal(missing.status, 400);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
    if (id) await db.delete(serviceOrders).where(eq(serviceOrders.id, id));
    await pool.end();
  }
});
