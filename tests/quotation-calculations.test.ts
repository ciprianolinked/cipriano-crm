import assert from "node:assert/strict";
import { test } from "node:test";
import { buildNarrative, computeMetrics, createEmptyDraft, normalizeDraft, parseCurrencyInput, recordedSavings, supplierCostBreakdown } from "../src/lib/quotation";
import { mergeExtraction } from "../src/lib/extraction";
import type { AiExtractionResult, QuoteItem, Supplier } from "../src/lib/types";

const suppliers: Supplier[] = ["a", "b", "c"].map((id) => ({
  id, name: `Fornecedor ${id.toUpperCase()}`, contact: "", deliveryDays: "", paymentTerms: "", validity: "", notes: "",
}));

function item(id: string, quantity: number, prices: Record<string, number | null>): QuoteItem {
  return { id, description: `Item ${id}`, unit: "un", quantity, prices };
}

test("não recomenda fornecedor com total parcial menor", () => {
  const items = [item("1", 1, { a: 100, b: 110, c: 1 }), item("2", 2, { a: 50, b: 60, c: null })];
  const metrics = computeMetrics({ items, suppliers });
  assert.equal(metrics.best?.supplier.id, "a");
  assert.equal(metrics.best?.total, 200);
  assert.equal(metrics.highest?.supplier.id, "b");
  assert.equal(metrics.savings, 30);
  assert.equal(metrics.isComparable, true);
  assert.equal(metrics.rankings.find((row) => row.supplier.id === "c")?.isBest, false);
});

test("sem proposta completa, não cria recomendação automática", () => {
  const items = [item("1", 1, { a: 100, b: null }), item("2", 1, { a: null, b: 100 })];
  const metrics = computeMetrics({ items, suppliers: suppliers.slice(0, 2) });
  assert.equal(metrics.best, null);
  assert.equal(metrics.isComparable, false);
  const narrative = buildNarrative({ items, suppliers: suppliers.slice(0, 2), kind: "servico", service: "teste", condominium: "teste" });
  assert.match(narrative.summary, /não há proposta com preços para todos/i);
  assert.doesNotMatch(narrative.recommendation, /recomendamos a contratação/i);
});

test("uma única proposta completa não gera recomendação de contratação", () => {
  const items = [item("1", 1, { a: 100, b: null })];
  const metrics = computeMetrics({ items, suppliers: suppliers.slice(0, 2) });
  assert.equal(metrics.best?.supplier.id, "a");
  assert.equal(metrics.isComparable, false);
  const narrative = buildNarrative({ items, suppliers: suppliers.slice(0, 2), kind: "servico", service: "teste", condominium: "teste" });
  assert.match(narrative.recommendation, /ao menos duas propostas completas/i);
});

test("economia por natureza usa apenas partes informadas nas duas propostas", () => {
  const items: QuoteItem[] = [
    { ...item("1", 1, { a: 900, b: 1000 }), costType: "mao_obra" },
    { ...item("2", 1, { a: 300, b: 320 }), costType: "material" },
    { ...item("3", 1, { a: 100, b: 60 }), costType: "nao_discriminado" },
  ];
  // c tem total parcial, então não entra na comparação.
  const metrics = computeMetrics({ items, suppliers });
  assert.equal(metrics.best?.supplier.id, "a");
  assert.equal(metrics.highest?.supplier.id, "b");
  assert.equal(metrics.savings, 80);
  assert.equal(metrics.savingsByNature.mao_de_obra, 100);
  assert.equal(metrics.savingsByNature.material, 20);
  // Nessa parte a melhor proposta global era mais cara: a diferença é negativa.
  assert.equal(metrics.savingsByNature.outros, -40);
});

test("natureza não comparada fica em zero em vez de gerar estimativa", () => {
  const items: QuoteItem[] = [
    { ...item("1", 1, { a: 900, b: 1000 }), costType: "mao_obra" },
    { ...item("2", 1, { a: 300, b: 320 }), costType: "material" },
    { ...item("3", 1, { a: 100, b: null }), costType: "nao_discriminado" },
  ];
  // b não cotou o item 3, então não é proposta completa: sem comparativo global.
  const metrics = computeMetrics({ items, suppliers });
  assert.equal(metrics.highest, null);
  assert.equal(metrics.isComparable, false);
  assert.deepEqual(metrics.savingsByNature, { material: 0, mao_de_obra: 0, outros: 0 });
});

test("economia por natureza é zero quando há uma única proposta completa", () => {
  const items = [item("1", 1, { a: 100, b: null }), item("2", 1, { a: 50, b: null })];
  const metrics = computeMetrics({ items, suppliers });
  assert.equal(metrics.best?.supplier.id, "a");
  assert.equal(metrics.isComparable, false);
  assert.deepEqual(metrics.savingsByNature, { material: 0, mao_de_obra: 0, outros: 0 });
});

test("separa mão de obra, material e valor global sem inventar divisão", () => {
  const items: QuoteItem[] = [
    { ...item("1", 2, { a: 100 }), costType: "mao_obra" },
    { ...item("2", 4, { a: 25 }), costType: "material" },
    { ...item("3", 1, { a: 50 }), costType: "nao_discriminado" },
  ];
  const breakdown = supplierCostBreakdown(items, "a");
  assert.equal(breakdown.mao_obra.total, 200);
  assert.equal(breakdown.material.total, 100);
  assert.equal(breakdown.nao_discriminado.total, 50);
  assert.equal(computeMetrics({ items, suppliers }).best?.total, 350);
});

test("KPI confirmado só usa contratação concluída e explicitamente confirmada", () => {
  const draft = createEmptyDraft({ status: "concluido", suppliers, analysis: { summary: "", recommendation: "", notes: "", outcome: { supplierId: "a", referenceAmount: 1000, contractedAmount: 800, confirmed: true } } });
  assert.equal(recordedSavings(draft), 200);
  assert.equal(recordedSavings({ ...draft, status: "em_analise" }), null);
  assert.equal(recordedSavings({ ...draft, analysis: { ...draft.analysis, outcome: { ...draft.analysis.outcome!, confirmed: false } } }), null);
  assert.equal(recordedSavings({ ...draft, analysis: { ...draft.analysis, outcome: { ...draft.analysis.outcome!, contractedAmount: 1200 } } }), -200);
  assert.equal(recordedSavings({ ...draft, analysis: { ...draft.analysis, outcome: { ...draft.analysis.outcome!, supplierId: "ausente" } } }), null);
});

test("registros antigos mantêm valor como não discriminado e dados confirmados sobrevivem ao salvamento", () => {
  const draft = createEmptyDraft({ status: "concluido", suppliers, items: [item("1", 1, { a: 10 })], analysis: { summary: "", recommendation: "", notes: "", outcome: { supplierId: "a", referenceAmount: 100, contractedAmount: 80, confirmed: true } } });
  const normalized = normalizeDraft(draft);
  assert.equal(normalized.items[0].costType, "nao_discriminado");
  assert.equal(recordedSavings(normalized), 20);
  assert.equal(parseCurrencyInput("1.250"), 1250);
  assert.equal(parseCurrencyInput("1.250,50"), 1250.5);
});

test("aplicar IA preserva dados do cabeçalho já preenchidos", () => {
  const draft = createEmptyDraft({ condominium: "Condomínio escolhido", analysisDate: "2026-01-04", recipient: "Conselho", service: "Objeto escolhido", description: "Escopo escolhido" });
  const extraction: AiExtractionResult = {
    mode: "ia", provider: "teste", warnings: [], fileSummaries: [],
    draft: { condominium: "Outro condomínio", analysisDate: "2026-10-01", recipient: "Outro", service: "Outro objeto", description: "Outro escopo", suppliers, items: [item("1", 1, { a: 10 })] },
  };
  const merged = mergeExtraction(draft, extraction, []);
  assert.equal(merged.condominium, "Condomínio escolhido");
  assert.equal(merged.analysisDate, "2026-01-04");
  assert.equal(merged.recipient, "Conselho");
  assert.equal(merged.service, "Objeto escolhido");
  assert.equal(merged.description, "Escopo escolhido");
});
