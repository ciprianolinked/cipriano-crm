import "dotenv/config";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createCondominium, deleteCondominium, updateCondominium } from "../src/lib/server/condominiums";
import { createQuotation, deleteQuotation, getQuotation } from "../src/lib/server/quotations";
import { recordedSavings } from "../src/lib/quotation";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test("cadastrar, editar e preservar mapas vinculados", async () => {
  const name = `Condomínio de teste ${suffix}`;
  const renamed = `Condomínio atualizado ${suffix}`;
  const condominium = await createCondominium({ name, city: "São Paulo/SP", manager: "Síndico de teste", contactEmail: "teste@example.com" });
  let quotationId = "";
  try {
    assert.equal(condominium.contactEmail, "teste@example.com");
    const quotation = await createQuotation({
      condominium: name,
      analysisDate: "2026-01-01",
      status: "concluido",
      service: "Teste",
      suppliers: [{ id: "a", name: "Fornecedor", contact: "", deliveryDays: "", paymentTerms: "", validity: "", notes: "" }],
      items: [{ id: "1", description: "Instalação", unit: "serviço", quantity: 1, costType: "mao_obra", prices: { a: 800 } }],
      analysis: { summary: "", recommendation: "", notes: "", outcome: { supplierId: "a", referenceAmount: 1000, contractedAmount: 800, confirmed: true } },
      attachments: [],
    });
    quotationId = quotation.id;
    const updated = await updateCondominium(condominium.id, { name: renamed, city: "Campinas/SP", manager: "Nova síndica", contactEmail: "novo@example.com" });
    assert.equal(updated?.name, renamed);
    assert.equal(updated?.city, "Campinas/SP");
    const saved = await getQuotation(quotation.id);
    assert.equal(saved?.condominium, renamed);
    assert.equal(saved?.items[0].costType, "mao_obra");
    assert.ok(saved);
    assert.equal(recordedSavings(saved), 200);
    assert.equal(await deleteCondominium(condominium.id), "has_quotations");
  } finally {
    if (quotationId) await deleteQuotation(quotationId);
    await deleteCondominium(condominium.id);
  }
});

after(async () => {
  const { pool } = await import("../src/db");
  await pool.end();
});
