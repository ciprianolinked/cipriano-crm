import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, request, expect } from "@playwright/test";

const baseURL = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const api = await request.newContext({ baseURL });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1700, height: 1050 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let id;
const draft = { description: "revisar 4 câmeras", diagnosis: "ips fora da faixa", solution: "refeita configuração das câmeras", notes: "" };
const revised = { description: "Solicita-se a revisão de 4 câmeras.", diagnosis: "Os endereços IP estavam fora da faixa de rede.", solution: "A configuração das câmeras foi refeita.", notes: "" };
mkdirSync(".verification", { recursive: true });
try {
  const created = await api.post("/api/service-orders", { data: {
    clientName: "QA • Revisão e legibilidade", description: "Descrição salva anteriormente", diagnosis: "Texto salvo", solution: "Texto salvo",
    site: "São José dos Campos/SP", kind: "corretiva", laborCents: 30000, technician: "Gabriel Cipriano", items: [],
  } });
  assert.equal(created.status(), 201, await created.text());
  id = (await created.json()).serviceOrder.id;
  await page.goto(`${baseURL}/os/${id}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const description = page.getByLabel("Solicitação / defeito relatado", { exact: true });
  await description.fill(draft.description);
  await page.getByLabel("Diagnóstico", { exact: true }).fill(draft.diagnosis);
  await page.getByLabel("Solução executada / proposta", { exact: true }).fill(draft.solution);

  let calls = 0;
  await page.route(`**/api/service-orders/${id}/rewrite`, async (route) => {
    assert.deepEqual(route.request().postDataJSON().blocks, draft);
    calls++;
    await route.fulfill({ status: 200, json: { blocks: revised, changed: ["description", "diagnosis", "solution"], source: "llm", message: "Revisão concluída." } });
  });
  await page.getByRole("button", { name: "Refinar com IA", exact: true }).click();
  await expect(description).toHaveValue(revised.description);
  await expect(page.locator("#service-order-document textarea").first()).toHaveValue(revised.description);
  await expect(page.getByRole("button", { name: "Desfazer IA" })).toBeVisible();
  await page.getByText("Solicitação · antes e depois", { exact: true }).click();
  await expect(page.getByText(draft.description, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Desfazer IA" }).click();
  await expect(description).toHaveValue(draft.description);
  await page.getByRole("button", { name: "Refinar com IA", exact: true }).click();
  await expect(description).toHaveValue(revised.description);
  const saved = page.waitForResponse((res) => res.url().endsWith(`/api/service-orders/${id}`) && res.request().method() === "PATCH");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  assert.equal((await saved).status(), 200);
  const stored = await api.get(`/api/service-orders/${id}`);
  assert.equal((await stored.json()).serviceOrder.description, revised.description);
  assert.equal(calls, 2);

  const style = await page.locator(".cip-term-row b").first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { color: s.color, size: s.fontSize, weight: s.fontWeight, family: s.fontFamily };
  });
  assert.equal(style.color, "rgb(10, 25, 47)");
  assert.equal(style.weight, "600");
  assert.ok(Number.parseFloat(style.size) >= 12);
  assert.ok(style.family.includes("Cipriano Sans"));
  await page.locator("#service-order-document").screenshot({ path: ".verification/os-document.png", style: "header.no-print { visibility: hidden !important; }" });

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const download = await downloadEvent;
  await download.saveAs("/tmp/cipriano-document-tests/os-browser.pdf");
  assert.equal(await download.failure(), null);

  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#service-order-document textarea").first()).toBeHidden();
  await page.pdf({ path: "/tmp/cipriano-document-tests/os-browser-print.pdf", format: "A4", printBackground: true });
  await page.emulateMedia({ media: "screen" });

  await page.unroute(`**/api/service-orders/${id}/rewrite`);
  await page.route(`**/api/service-orders/${id}/rewrite`, async (route) => {
    await route.fulfill({ status: 503, json: { error: "IA não configurada. Seus textos foram preservados.", code: "ai_not_configured" } });
  });
  await page.getByRole("button", { name: "Refinar com IA", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Seus textos foram preservados" })).toBeVisible();
  await expect(description).toHaveValue(revised.description);

  const exportInfo = await api.get("/api/publicacao");
  assert.equal(exportInfo.status(), 200);
  assert.ok((await exportInfo.json()).files.some((file) => file.path.endsWith("fonts/IBMPlexSans-Regular.ttf")), "Source export must include font binaries");
  assert.deepEqual(errors, []);
  console.log("Browser OK: unsaved draft, visible rewrite, undo, save, dark labels, PDF download, print mirror and font export.");
} finally {
  if (id) await api.delete(`/api/service-orders/${id}`);
  await context.close();
  await browser.close();
  await api.dispose();
}
