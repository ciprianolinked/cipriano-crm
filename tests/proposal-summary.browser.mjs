import assert from "node:assert/strict";
import { chromium, request, expect } from "@playwright/test";

// Requires the app running at TEST_BASE_URL (default http://127.0.0.1:3000) with a reachable database.
const baseURL = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const api = await request.newContext({ baseURL });
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
let id;
try {
  const generated = await api.post("/api/generate", { data: {
    type: "completa", clientName: "QA Quadro de valores", site: "Rua de teste, 10", validityDays: 15, artIncluded: true,
    briefing: { purpose: "projeto", cameras: 5, doors: 1, fenceMeters: 0, monitoring: false, alarm: false, intercom: false, network: true,
      maintenance: false, notes: "", priority: "seguranca", miscPct: 8, infraPct: 10, marginPct: 5, laborValue: 2800,
      valueBlock: { installments: 3, entryPct: 40 }, comodato: { enabled: false, termMonths: 36, monthlyCents: null, residualCents: 0 } },
    customItems: [],
  } });
  assert.equal(generated.status(), 200, await generated.text());
  const { draft } = await generated.json();
  assert.ok(!draft.items.some((item) => /^Margem de segurança/.test(item.desc)), "margin must not be a line item");
  const saved = await api.post("/api/proposals", { data: { type: "completa", status: "novo", draft } });
  assert.equal(saved.status(), 201, await saved.text());
  id = (await saved.json()).proposal.id;

  await page.goto(`${baseURL}/propostas/${id}`, { waitUntil: "networkidle" });
  const summary = page.locator(".cip-sum");
  await expect(summary).toBeVisible();
  // Editable fields keep their text in <input> values, which innerText does not include.
  const text = (await summary.evaluate((root) => Array.from(root.querySelectorAll(".cip-sum-row, .cip-sum-kicker, .cip-sum-big, .cip-sum-note"))
    .map((row) => Array.from(row.querySelectorAll("input")).reduce((t, input) => t.replace(input.outerHTML, input.value), row.textContent ?? ""))
    .join("\n"))).replace(/\u00a0/g, " ");
  console.log(text);
  assert.match(text, /Investimento total/i);
  assert.match(text, /SUBTOTAL\s*R\$/i);
  assert.match(text, /DESCONTO\s*\(\d+%\)/i);
  assert.match(text, /TOTAL À VISTA \/ 1X\s*R\$/i);
  assert.match(text, /3×\s*sem juros\s*R\$/i);
  await summary.screenshot({ path: ".verification/summary-block.png" });

  const doc = page.locator("#proposal-document");
  await expect(doc).not.toContainText("Margem de segurança");
  await expect(doc).toContainText("Miscelâneas de instalação e fixação");

  // Catalog popup from the editor's items tab
  await page.getByRole("button", { name: "Itens & valores", exact: true }).click();
  await page.getByRole("button", { name: /Abrir catálogo/ }).click();
  const dialog = page.getByRole("dialog", { name: "Catálogo de produtos e serviços" });
  await expect(dialog).toBeVisible();
  const entries = await dialog.locator("li").count();
  assert.ok(entries >= 10, `catalog shows ${entries} entries`);
  await dialog.screenshot({ path: ".verification/catalog-popup.png" });
  await dialog.getByRole("button", { name: "Incluir" }).first().click();
  await expect(dialog.getByText(/Incluído 1×/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Matrix: remove one row from the responsibility table
  await page.getByRole("button", { name: "Documento", exact: true }).click();
  const matrix = page.locator("table.cip-table").filter({ hasText: "Frente de trabalho" }).first();
  const before = await matrix.locator("tbody tr").count();
  await matrix.locator("button.cip-mini-remove").first().click();
  await expect(matrix.locator("tbody tr")).toHaveCount(before - 1);
  console.log(`Browser OK: summary, popup with ${entries} items, matrix ${before} → ${before - 1}.`);
} finally {
  if (id) await api.delete(`/api/proposals?id=${id}`);
  await browser.close();
  await api.dispose();
}
