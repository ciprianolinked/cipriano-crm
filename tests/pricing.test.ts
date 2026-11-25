import assert from "node:assert/strict";
import test from "node:test";
import { calcTotals } from "../src/lib/proposal/catalog";
import { finalizeItems, internalMarginCents, setItemPrice, catalogToItem, isIndirectItem } from "../src/lib/proposal/pricing";
import { clampInstallments, DEFAULT_INSTALLMENTS, paymentRows, resolveValueBlock } from "../src/lib/proposal/value-block";
import type { ProposalItem } from "../src/lib/proposal/types";

const config = { marginPct: 5, miscPct: 8, infraPct: 10 };
const equipment = (id: string, price: number, qty = 1): ProposalItem => ({ id, kind: "equipamento", desc: `Equipamento ${id}`, spec: "", unit: "un", qty, price, scope: "CFTV" });

test("safety margin composes the final unit price and is never a visible line", () => {
  const items = finalizeItems([equipment("a", 1000, 2), equipment("b", 500)], config);
  assert.equal(items.find((i) => i.id === "a")?.price, 1050);
  assert.equal(items.find((i) => i.id === "b")?.price, 525);
  assert.ok(!items.some((i) => /margem/i.test(i.desc)), "margin must not be listed");
  assert.equal(internalMarginCents(items), 12500); // (50 × 2) + 25 reais, in centavos
  // Misc and infrastructure are visible lines calculated from the base (1000*2 + 500 = 2500).
  assert.equal(items.find((i) => i.auto === "indirect" && /Miscelâneas/.test(i.desc))?.price, 200);
  assert.equal(items.find((i) => i.auto === "indirect" && /Infraestrutura/.test(i.desc))?.price, 250);
});

test("finalizing twice gives the same result (idempotent)", () => {
  const once = finalizeItems([equipment("a", 1000, 3)], config);
  assert.deepEqual(finalizeItems(once, config), once);
});

test("legacy margin line from older proposals is removed and rebuilt into prices", () => {
  const legacy: ProposalItem[] = [
    equipment("a", 1000),
    { id: "old", kind: "equipamento", desc: "Margem de segurança e contingência técnica", spec: "", unit: "vb", qty: 1, price: 50, scope: "x" },
  ];
  assert.ok(isIndirectItem(legacy[1]));
  const items = finalizeItems(legacy, config);
  assert.ok(!items.some((i) => i.id === "old"));
  assert.equal(items.find((i) => i.id === "a")?.price, 1050);
});

test("manual final price keeps the margin rule consistent", () => {
  const typed = setItemPrice(equipment("a", 1000), 1200, config);
  const [item] = finalizeItems([typed], config);
  assert.equal(item.price, 1200);
});

test("services never receive the equipment margin", () => {
  const service = catalogToItem({ kind: "servico", category: "Instalação", description: "Instalação", spec: null, unit: "ponto", priceCents: 32000 }, 2);
  const [item] = finalizeItems([service], config);
  assert.equal(item.price, 320);
});

test("summary example: subtotal, discount, total à vista and 3x installment", () => {
  const items = [{ ...equipment("x", 4027.2) }];
  const totals = calcTotals(items, 7);
  assert.equal(totals.subtotalCents, 402720);
  assert.equal(totals.offCents, 28190);
  assert.equal(totals.totalCents, 374530);
  assert.equal(totals.installments, 3);
  assert.equal(totals.installmentCents, 124843);
});

test("installments default to 3x and accept 1 to 60", () => {
  assert.equal(DEFAULT_INSTALLMENTS, 3);
  assert.equal(clampInstallments(undefined), 3);
  assert.equal(clampInstallments(0), 3);
  assert.equal(clampInstallments(1), 1);
  assert.equal(clampInstallments(60), 60);
  assert.equal(clampInstallments(61), 60);
  const block = resolveValueBlock({ briefing: {}, maintenance: false, itemCount: 1, discountPct: 7 });
  assert.equal(block.installments, 3);
  assert.equal(block.totalLabel, "Total à vista / 1x");
  assert.equal(block.primaryNote, "1 item · desconto comercial de 7% já aplicado");
  assert.equal(block.installmentLabel, "sem juros");
});

test("payment rows show entry and balance without a duplicated card row", () => {
  const rows = paymentRows({ entryLabel: "Entrada", balanceLabel: "Saldo", cardLabel: "Cartão", installments: 3, entryPct: 40 }, 374530);
  assert.equal(rows.length, 2);
  assert.equal(rows[0][1].replace(/\s/g, " "), "R$ 1.498,12 na assinatura");
});
