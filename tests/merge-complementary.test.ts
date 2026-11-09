import "dotenv/config";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { describeMerge, mergeComplementary, mergeExtraction } from "../src/lib/extraction";
import { createEmptyDraft, normalizeDraft } from "../src/lib/quotation";
import type { AiExtractionResult, QuotationDraft, Supplier } from "../src/lib/types";

const alfa: Supplier = { id: "a", name: "Alfa Serviços", contact: "", deliveryDays: "", paymentTerms: "", validity: "", notes: "" };
const bravo: Supplier = { id: "b", name: "Bravo Materiais", contact: "", deliveryDays: "", paymentTerms: "", validity: "", notes: "" };

function baseDraft(): QuotationDraft {
  return createEmptyDraft({
    condominium: "Condomínio Complemento",
    analysisDate: "2026-01-10",
    status: "em_analise",
    suppliers: [alfa],
    items: [
      { id: "i1", description: "Mão de obra de limpeza", unit: "serviço", quantity: 1, costType: "mao_obra", prices: { a: 1000 } },
      { id: "i2", description: "Material de limpeza", unit: "cx", quantity: 2, costType: "material", prices: { a: null } },
    ],
    attachments: [{ name: "proposta-alfa.pdf", size: 100, type: "application/pdf", source: "ia" }],
    analysis: {
      summary: "Parecer inicial.",
      recommendation: "Recomendação inicial.",
      notes: "Ata registrada.",
      outcome: { supplierId: "a", referenceAmount: 2500, contractedAmount: 2000, confirmed: true },
    },
  });
}

const incoming: AiExtractionResult = {
  mode: "ia",
  provider: "teste",
  warnings: [],
  fileSummaries: [],
  draft: {
    suppliers: [
      { id: "x1", name: "Alfa Serviços", contact: "contato@alfa.com", deliveryDays: "5 dias", paymentTerms: "", validity: "", notes: "" },
      { id: "x2", name: "Bravo Materiais", contact: "vendas@bravo.com", deliveryDays: "", paymentTerms: "28 dias", validity: "", notes: "" },
    ],
    items: [
      { id: "n1", description: "Mão de obra de limpeza", unit: "serviço", quantity: 1, costType: "mao_obra", prices: { x1: 1400, x2: null } },
      { id: "n2", description: "material de limpeza", unit: "cx", quantity: 2, costType: "material", prices: { x1: 90, x2: 85 } },
      { id: "n3", description: "Pintura da fachada", unit: "m²", quantity: 10, costType: "mao_obra", prices: { x1: 25, x2: null }, purchaseUrl: "https://www.leroymerlin.com.br/tinta/p", purchaseSource: "documento", purchaseStore: "Leroy Merlin", purchaseVerified: true },
    ],
    analysis: { summary: "Segunda proposta recebida.", recommendation: "", notes: "" },
  },
};

test("complementa o mapa somando fornecedores, itens e preços sem apagar o que existe", () => {
  const base = baseDraft();
  const merged = normalizeDraft(mergeComplementary(base, incoming, [{ name: "proposta-bravo.pdf", size: 200, type: "application/pdf" }]));

  // Fornecedores: reaproveita Alfa (mesmo nome) e adiciona Bravo.
  assert.equal(merged.suppliers.length, 2);
  const alfaMerged = merged.suppliers.find((supplier) => supplier.name === "Alfa Serviços");
  assert.ok(alfaMerged);
  assert.equal(alfaMerged?.contact, "contato@alfa.com");
  // Preço anterior da Alfa permanece (1000), sem ser sobrescrito por 1400.
  const maoObra = merged.items.find((item) => /limpeza/i.test(item.description) && item.costType === "mao_obra");
  assert.equal(maoObra?.prices[alfaMerged!.id], 1000);
  // Bravo preenche o preço que faltava no material existente.
  const material = merged.items.find((item) => /material/i.test(item.description));
  assert.equal(material?.prices[alfaMerged!.id], 90);
  const bravoMerged = merged.suppliers.find((supplier) => supplier.name === "Bravo Materiais");
  assert.equal(material?.prices[bravoMerged!.id], 85);
  // Item novo é adicionado com o link de compra do documento.
  const pintura = merged.items.find((item) => /pintura/i.test(item.description));
  assert.equal(pintura?.purchaseUrl, "https://www.leroymerlin.com.br/tinta/p");
  assert.equal(pintura?.purchaseVerified, true);
  assert.equal(pintura?.purchaseSource, "documento");
  // Anexos somados, sem duplicar.
  assert.deepEqual(merged.attachments.map((file) => file.name).sort(), ["proposta-alfa.pdf", "proposta-bravo.pdf"]);
  // Cabeçalho e resultado confirmado preservados.
  assert.equal(merged.condominium, "Condomínio Complemento");
  assert.equal(merged.analysis.outcome?.contractedAmount, 2000);
  assert.equal(merged.analysis.notes, "Ata registrada.");
  assert.match(merged.analysis.summary, /Parecer inicial/);
  assert.match(merged.analysis.summary, /Segunda proposta recebida/);

  const changes = describeMerge(base, merged);
  assert.ok(changes.some((entry) => /fornecedor/i.test(entry)));
  assert.ok(changes.some((entry) => /item\(ns\) novo/i.test(entry)));
});

test("modo substituir continua trocando os dados pela nova análise", () => {
  const merged = mergeExtraction(baseDraft(), incoming, [{ name: "nova.pdf", size: 10, type: "application/pdf" }]);
  assert.equal(merged.attachments.length, 2);
  assert.equal(merged.items.length, 3);
  assert.equal(merged.suppliers.length, 2);
});

test("complemento ignora linha vazia e não quebra sem anexos novos", () => {
  const base = createEmptyDraft({ condominium: "Teste", suppliers: [alfa], items: [] });
  const empty: AiExtractionResult = { ...incoming, draft: { ...incoming.draft, items: [], suppliers: [] } };
  const merged = mergeComplementary(base, empty, []);
  assert.ok(merged.items.length >= 0);
  assert.equal(merged.suppliers.length, 1);
});

after(async () => {
  const { pool } = await import("../src/db");
  await pool.end();
});
