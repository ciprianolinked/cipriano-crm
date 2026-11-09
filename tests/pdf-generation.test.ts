import "dotenv/config";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { recordPdfExport } from "../src/lib/server/downloads";
import { buildIndicatorsPdf, buildMapPdf, indicatorsFileName, mapFileName } from "../src/lib/server/pdf";
import { createQuotation, deleteQuotation } from "../src/lib/server/quotations";
import type { QuotationDraft } from "../src/lib/types";

const suffix = `${Date.now()}`;
const suppliers = ["a", "b", "c"].map((id, index) => ({
  id, name: `Fornecedor ${String.fromCharCode(65 + index)}`, contact: "contato@fornecedor.com", deliveryDays: "10 dias", paymentTerms: "30 dias", validity: "30 dias", notes: "Garantia 12 meses",
}));
const draft: QuotationDraft = {
  protocol: "MC-TESTE",
  status: "concluido",
  condominium: `Condomínio Acentuação ${suffix}`,
  analysisDate: "2026-10-27",
  recipient: "Síndico e Conselho",
  service: "Limpeza da caixa d'água",
  description: "Escopo de teste com acentuação e itens de mão de obra e material.",
  kind: "servico",
  category: "Limpeza e conservação",
  suppliers,
  items: [
    { id: "1", description: "Mão de obra de higienização", unit: "serviço", quantity: 1, costType: "mao_obra", prices: { a: 1200.5, b: 1350, c: null } },
    { id: "2", description: "Kit de materiais (cloro, escovas)", unit: "cx", quantity: 4, costType: "material", prices: { a: 89.9, b: 95, c: 79.9 } },
    { id: "3", description: "Valor global combinado", unit: "vb (verba)", quantity: 1, costType: "nao_discriminado", prices: { a: null, b: null, c: 200 } },
  ],
  analysis: {
    summary: "Parecer com acentuação para validar a codificação do PDF.",
    recommendation: "Recomendação condicionada à documentação.",
    notes: "Aprovação registrada em ata.",
    outcome: { supplierId: "a", referenceAmount: 1600, contractedAmount: 1500, confirmed: true },
  },
  attachments: [],
};

test("nomes de arquivo são sanitizados e descritivos", () => {
  assert.equal(mapFileName(draft, "MC-2026-0001"), `Mapa-de-Cotacao_MC-2026-0001_Condominio-Acentuacao-${suffix}_2026-10-27.pdf`);
  assert.match(indicatorsFileName({ condominium: "Todos os condomínios", start: "", end: "" }), /^Indicadores-Gerencial_Todos-os-condominios_inicio_a_hoje\.pdf$/);
});

test("gera PDF válido do mapa com múltiplas páginas e acentos", async () => {
  const { buffer, fileName } = await buildMapPdf(draft, "MC-2026-0001");
  assert.ok(fileName.endsWith(".pdf"));
  assert.ok(buffer.subarray(0, 5).toString() === "%PDF-", "PDF deve começar com %PDF-");
  assert.ok(buffer.byteLength > 2000, `PDF muito pequeno: ${buffer.byteLength} bytes`);
  assert.ok(buffer.toString("latin1").includes("/Type /Catalog"), "estrutura de PDF ausente");
  console.log(`Mapa PDF: ${fileName} · ${buffer.byteLength} bytes`);
});

test("gera PDF válido dos indicadores respeitando filtros", async () => {
  const saved = await createQuotation({ ...draft, condominium: draft.condominium });
  try {
    const { buffer, fileName } = await buildIndicatorsPdf({
      condominium: saved.condominium,
      start: "2026-01-01",
      end: "2026-12-31",
      generatedAt: new Date(),
      records: [saved],
    });
    assert.ok(fileName.includes("Condominio-Acentuacao"));
    assert.ok(buffer.subarray(0, 5).toString() === "%PDF-");
    assert.ok(buffer.byteLength > 2000);
    console.log(`Indicadores PDF: ${fileName} · ${buffer.byteLength} bytes`);
  } finally {
    await deleteQuotation(saved.id);
  }
});

test("registra o nome do arquivo no banco a cada download", async () => {
  const { listPdfExports } = await import("../src/lib/server/downloads");
  const record = await recordPdfExport({
    fileName: `teste-historico-${suffix}.pdf`,
    kind: "mapa",
    sizeBytes: 12345,
    condominium: draft.condominium,
    protocol: "MC-TESTE",
  });
  const list = await listPdfExports(5);
  const found = list.find((entry) => entry.id === record.id);
  assert.ok(found, "registro não encontrado no histórico");
  assert.equal(found.fileName, `teste-historico-${suffix}.pdf`);
  assert.equal(found.kind, "mapa");
  assert.equal(found.sizeBytes, 12345);
  await (await import("../src/db")).db.delete((await import("../src/db/schema")).pdfExports).where(eqId(record.id));
});

function eqId(id: string) {
  const { eq } = require("drizzle-orm") as typeof import("drizzle-orm");
  const { pdfExports } = require("../src/db/schema") as typeof import("../src/db/schema");
  return eq(pdfExports.id, id);
}

after(async () => {
  const { pool } = await import("../src/db");
  await pool.end();
});
