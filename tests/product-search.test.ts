import "dotenv/config";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { parsePurchaseUrl } from "../src/lib/constants";
import { searchProductsOnline } from "../src/lib/server/product-search";

test("reconhece KaBuM e demais lojas da lista, e mantém lojas desconhecidas sem selo", () => {
  const kabum = parsePurchaseUrl("https://www.kabum.com.br/produto/475566/luminaria-solar-integrada-intelbras-lsi-4800-lm-4848040");
  assert.equal(kabum?.trusted, true);
  assert.equal(kabum?.store, "KaBuM!");
  assert.equal(parsePurchaseUrl("shopping.mercadolivre.com.br/item/1")?.trusted, true);
  assert.equal(parsePurchaseUrl("https://www.leroymerlin.com.br/produto")?.trusted, true);
});

test("aceita links apenas de lojas confiáveis", () => {
  const trusted = parsePurchaseUrl("https://www.leroymerlin.com.br/tubo-pvc-25mm-123");
  assert.equal(trusted?.trusted, true);
  assert.equal(trusted?.store, "Leroy Merlin");
  assert.equal(trusted?.host, "leroymerlin.com.br");
  const produto = parsePurchaseUrl("produto.mercadolivre.com.br/MLB-123");
  assert.equal(produto?.trusted, true);
  assert.equal(produto?.url.startsWith("https://"), true);
  const unknown = parsePurchaseUrl("https://loja-qualquer-desconhecida.com/produto");
  assert.equal(unknown?.trusted, false);
  assert.equal(unknown?.store, null);
  assert.equal(parsePurchaseUrl("javascript:alert(1)"), null);
  assert.equal(parsePurchaseUrl(""), null);
  assert.equal(parsePurchaseUrl(null), null);
});

test("pesquisa com Google Search, descarta loja não confiável e trata preço", async () => {
  const original = globalThis.fetch;
  let received: Record<string, unknown> = {};
  globalThis.fetch = async (url, init) => {
    received = {
      url: String(url),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    };
    const raw = {
      results: [
        { item: 1, found: true, store: "Leroy Merlin", productName: "Tubo PVC 25mm", price: 89.9, url: "https://www.leroymerlin.com.br/tubo-pvc-25mm/p" },
        { item: 2, found: true, store: "Loja duvidosa", productName: "Registro", price: "64,50", url: "https://loja-duvidosa.example/registro" },
        { item: 3, found: false, store: "", productName: "", price: null, url: "" },
      ],
    };
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(raw) }] } }] });
  };
  try {
    const output = await searchProductsOnline({
      descriptions: ["Tubo PVC 25mm", "Registro gaveta 3/4", "Material genérico de manutenção"],
      apiKey: "chave-ficticia",
      model: "gemini-3.1-flash-lite",
      hint: "Condomínio teste",
    });
    const body = received.body as { tools: unknown; contents: { parts: { text: string }[] }[] };
    assert.deepEqual(body.tools, [{ google_search: {} }]);
    assert.ok(!String(received.url).includes("chave-ficticia"), "a chave não pode ir na URL");
    assert.equal((received.headers as Headers).get("x-goog-api-key"), "chave-ficticia");
    assert.match(body.contents[0].parts[0].text, /LOJAS PREFERENCIAIS/);
    assert.match(body.contents[0].parts[0].text, /leroymerlin\.com\.br/);

    const [tubo, registro, generico] = output.results;
    assert.equal(tubo.found, true);
    assert.equal(tubo.purchaseUrl, "https://www.leroymerlin.com.br/tubo-pvc-25mm/p");
    assert.equal(tubo.price, 89.9);
    assert.equal(tubo.trusted, true);
    // Loja fora da lista: link válido mantido, porém sem o selo de confiável.
    assert.equal(registro.found, true);
    assert.equal(registro.purchaseUrl, "https://loja-duvidosa.example/registro");
    assert.equal(registro.trusted, false);
    assert.equal(registro.price, 64.5);
    assert.match(registro.note, /fora da lista preferencial/i);
    assert.equal(generico.found, false);
    assert.equal(generico.purchaseUrl, "");
    assert.ok(output.warnings.some((warning) => /sem o selo de loja confiável/i.test(warning)));
    assert.ok(output.warnings.some((warning) => /sem link encontrado/i.test(warning)));
  } finally {
    globalThis.fetch = original;
  }
});

test("não quebra quando o Google está indisponível", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  try {
    const output = await searchProductsOnline({ descriptions: ["Cabo flexível 2,5mm"], apiKey: "chave", model: "gemini-3.1-flash-lite" });
    assert.deepEqual(output.results, []);
    assert.ok(output.warnings.length > 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("ignora descrições vazias sem chamar a IA", async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; return Response.json({}); };
  try {
    const output = await searchProductsOnline({ descriptions: ["", "   "], apiKey: "chave", model: "gemini-3.1-flash-lite" });
    assert.equal(called, false);
    assert.deepEqual(output.results, []);
  } finally {
    globalThis.fetch = original;
  }
});

after(async () => {
  const { pool } = await import("../src/db");
  await pool.end();
});
