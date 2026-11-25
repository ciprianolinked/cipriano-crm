import type { ProposalItem } from "@/lib/proposal/types";

/**
 * Pricing rules shared by generation, the editor and the PDF.
 *
 * - Equipment lines keep `basePrice` (cost-plus price before the safety margin) and `price`
 *   (the final unit price the client sees). The safety margin is composed into `price`, so it
 *   is part of the total but is never listed as its own line.
 * - Miscellaneous and infrastructure are separate, visible lines calculated on the base equipment value.
 * - Service lines (kind "servico") never receive the equipment margin.
 */
export type PricingConfig = { marginPct: number; miscPct: number; infraPct: number };

export const DEFAULT_PRICING: PricingConfig = { marginPct: 5, miscPct: 8, infraPct: 10 };

const clampPct = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fallback;
};

export function pricingFrom(briefing: unknown): PricingConfig {
  const b = (briefing ?? {}) as Record<string, unknown>;
  return {
    marginPct: clampPct(b.marginPct, DEFAULT_PRICING.marginPct),
    miscPct: clampPct(b.miscPct, DEFAULT_PRICING.miscPct),
    infraPct: clampPct(b.infraPct, DEFAULT_PRICING.infraPct),
  };
}

// Lines created by earlier versions of the generator are recognised and rebuilt from the rules above.
const LEGACY_INDIRECT = /^(Miscelâneas de instalação e fixação|Infraestrutura seca, eletrodutos e canaletas|Margem de segurança e contingência técnica)/;

export const isIndirectItem = (item: ProposalItem) => item.auto === "indirect" || LEGACY_INDIRECT.test(item.desc);
export const isEquipment = (item: ProposalItem) => item.kind === "equipamento" && !isIndirectItem(item);

const cents = (value: number) => Math.round(value * 100);
const factor = (pct: number) => 1 + pct / 100;

/** Base equipment value (before the safety margin), in centavos. */
export function equipmentBaseCents(items: ProposalItem[]): number {
  return items
    .filter(isEquipment)
    .reduce((sum, item) => sum + cents(item.basePrice ?? item.price) * Math.max(0, item.qty), 0);
}

/**
 * Safety margin included in the final prices, in centavos (never printed on the document).
 * Used by the internal panel only.
 */
export function internalMarginCents(items: ProposalItem[]): number {
  return items
    .filter(isEquipment)
    .reduce((sum, item) => sum + Math.round(((item.price - (item.basePrice ?? item.price)) * 100)) * Math.max(0, item.qty), 0);
}

/**
 * Applies the pricing rules. Idempotent: running it twice gives the same result, because the
 * margin is always derived from `basePrice`, never from the already-margined `price`.
 */
export function finalizeItems(items: ProposalItem[], config: PricingConfig): ProposalItem[] {
  const core = items
    .filter((item) => !isIndirectItem(item))
    .map((item) => {
      if (item.kind !== "equipamento") return item;
      const base = item.basePrice ?? item.price;
      return { ...item, basePrice: base, price: Math.round(base * factor(config.marginPct) * 100) / 100 };
    });

  const base = equipmentBaseCents(core);
  if (base <= 0) return core;

  const indirect: ProposalItem[] = [];
  const line = (id: string, desc: string, spec: string, pct: number): ProposalItem | null => {
    const value = Math.round((base * pct) / 100);
    if (pct <= 0 || value <= 0) return null;
    return {
      id,
      kind: "equipamento",
      desc,
      spec,
      unit: "vb",
      qty: 1,
      price: value / 100,
      scope: "Rede e Infraestrutura",
      auto: "indirect",
    };
  };
  const misc = line(
    "indirect-misc",
    "Miscelâneas de instalação e fixação",
    `Conectores blindados, buchas, parafusos, abraçadeiras, caixas de passagem e vedação (${config.miscPct}% sobre equipamentos)`,
    config.miscPct,
  );
  const infra = line(
    "indirect-infra",
    "Infraestrutura seca, eletrodutos e canaletas",
    `Eletrodutos rígidos/flexíveis, canaletas de proteção, curvas, conexões e suportes (${config.infraPct}% sobre equipamentos)`,
    config.infraPct,
  );
  if (misc) indirect.push(misc);
  if (infra) indirect.push(infra);
  return [...core, ...indirect];
}

/** Editing a final price on an equipment line keeps the margin rule: the base is derived from it. */
export function setItemPrice(item: ProposalItem, price: number, config: PricingConfig): ProposalItem {
  if (!isEquipment(item)) return { ...item, price };
  return { ...item, price, basePrice: price / factor(config.marginPct) };
}

/** Converts a catalog entry into a proposal line. Equipment margin is applied by finalizeItems. */
export function catalogToItem(
  entry: { kind: string; category: string; description: string; spec: string | null; unit: string; priceCents: number },
  qty: number,
): ProposalItem {
  return {
    id: `cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    kind: entry.kind === "servico" ? "servico" : "equipamento",
    desc: entry.description,
    spec: entry.spec ?? "",
    unit: entry.unit,
    qty: Math.max(1, Math.round(qty) || 1),
    price: entry.priceCents / 100,
    scope: entry.category,
  };
}
