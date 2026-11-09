import type {
  CostType,
  QuotationAnalysis,
  QuotationDraft,
  QuotationKind,
  QuotationStatus,
  QuoteItem,
  Supplier,
} from "./types";
import { CATEGORIES, MAX_SUPPLIERS, parsePurchaseUrl } from "./constants";

export function uid(prefix = ""): string {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}${Date.now().toString(36)}${random}`;
}

export function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatCompactCurrency(value: number): string {
  if (!value) return "R$ 0,00";
  if (value >= 1_000_000) {
    return `R$ ${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value / 1_000_000)} mi`;
  }
  if (value >= 1_000) {
    return `R$ ${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value / 1_000)} mil`;
  }
  return formatCurrency(value);
}

export function parseCurrencyInput(raw: string): number | null {
  const clean = raw.replace(/[^\d,.-]/g, "").trim();
  if (!clean) return null;
  let normalized = clean;
  if (clean.includes(",")) {
    normalized = clean.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(clean)) {
    normalized = clean.replace(/\./g, "");
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatDateTimeBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function itemTotal(item: QuoteItem, supplierId: string): number | null {
  const price = item.prices?.[supplierId];
  if (price === null || price === undefined || Number.isNaN(price)) return null;
  return round2(price * (item.quantity || 0));
}

export function supplierTotal(items: QuoteItem[], supplierId: string): number | null {
  let total = 0;
  let priced = 0;
  for (const item of items) {
    const value = itemTotal(item, supplierId);
    if (value !== null) {
      total += value;
      priced += 1;
    }
  }
  return priced > 0 ? round2(total) : null;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type CostBreakdown = Record<CostType, { total: number | null; pricedItems: number }>;

/** Soma somente os valores efetivamente informados, sem inferir partes de um preço global. */
export function supplierCostBreakdown(items: QuoteItem[], supplierId: string): CostBreakdown {
  const result: CostBreakdown = {
    mao_obra: { total: null, pricedItems: 0 },
    material: { total: null, pricedItems: 0 },
    nao_discriminado: { total: null, pricedItems: 0 },
  };
  for (const item of items) {
    const value = itemTotal(item, supplierId);
    if (value === null) continue;
    const type: CostType = item.costType === "mao_obra" || item.costType === "material" ? item.costType : "nao_discriminado";
    result[type].total = round2((result[type].total ?? 0) + value);
    result[type].pricedItems += 1;
  }
  return result;
}

/** Só apura economia efetiva quando a equipe confirma os valores de contratação. */
export function recordedSavings(draft: Pick<QuotationDraft, "status" | "suppliers" | "analysis">): number | null {
  const outcome = draft.analysis.outcome;
  if (draft.status !== "concluido" || !outcome?.confirmed || !outcome.supplierId ||
      !draft.suppliers.some((supplier) => supplier.id === outcome.supplierId) ||
      outcome.referenceAmount === null || outcome.contractedAmount === null ||
      !Number.isFinite(outcome.referenceAmount) || !Number.isFinite(outcome.contractedAmount) ||
      outcome.referenceAmount < 0 || outcome.contractedAmount < 0) return null;
  return round2(outcome.referenceAmount - outcome.contractedAmount);
}

export type SupplierRanking = {
  supplier: Supplier;
  total: number | null;
  coverage: number;
  isBest: boolean;
};

export function rankSuppliers(items: QuoteItem[], suppliers: Supplier[]): SupplierRanking[] {
  const rows = suppliers.map((supplier) => {
    const total = supplierTotal(items, supplier.id);
    const coverage = items.filter((item) => itemTotal(item, supplier.id) !== null).length;
    return { supplier, total, coverage, isBest: false };
  });
  // Uma proposta parcial não pode ser comparada como se tivesse cotado todo o escopo.
  const comparable = rows.filter((row) => items.length > 0 && row.total !== null && row.coverage === items.length);
  if (comparable.length > 0) {
    const best = comparable.reduce((acc, row) => ((row.total as number) < (acc.total as number) ? row : acc));
    best.isBest = true;
  }
  return rows;
}

/** Economia por natureza do custo, considerando apenas propostas completas. */
export type NatureSavings = {
  material: number;
  mao_de_obra: number;
  outros: number;
};

export type QuotationMetrics = {
  rankings: SupplierRanking[];
  best: SupplierRanking | null;
  highest: SupplierRanking | null;
  savings: number;
  savingsPercent: number;
  /** Economia potencial separada por natureza do custo (0 quando não comparável). */
  savingsByNature: NatureSavings;
  itemCount: number;
  supplierCount: number;
  isComparable: boolean;
};

export function computeMetrics(draft: Pick<QuotationDraft, "items" | "suppliers">): QuotationMetrics {
  const rankings = rankSuppliers(draft.items, draft.suppliers);
  const priced = rankings.filter((row) => draft.items.length > 0 && row.total !== null && row.coverage === draft.items.length);
  const best = priced.find((row) => row.isBest) ?? null;
  const highest =
    priced.length > 1
      ? priced.reduce((acc, row) => ((row.total as number) > (acc.total as number) ? row : acc))
      : null;
  const savings = best && highest ? round2((highest.total as number) - (best.total as number)) : 0;
  const savingsPercent =
    best && highest && (highest.total as number) > 0 ? (savings / (highest.total as number)) * 100 : 0;
  // Só compara uma natureza quando as duas propostas completas informaram essa parte;
  // caso contrário não há como apurar a diferença sem inventar valores.
  const savingsByNature: NatureSavings = { material: 0, mao_de_obra: 0, outros: 0 };
  if (best && highest) {
    const bestBreakdown = supplierCostBreakdown(draft.items, best.supplier.id);
    const highestBreakdown = supplierCostBreakdown(draft.items, highest.supplier.id);
    for (const type of ["mao_obra", "material"] as const) {
      const bestTotal = bestBreakdown[type].total;
      const highestTotal = highestBreakdown[type].total;
      if (bestTotal === null || highestTotal === null) continue;
      savingsByNature[type === "material" ? "material" : "mao_de_obra"] = round2(highestTotal - bestTotal);
    }
    const bestOther = bestBreakdown.nao_discriminado.total;
    const highestOther = highestBreakdown.nao_discriminado.total;
    if (bestOther !== null && highestOther !== null) {
      savingsByNature.outros = round2(highestOther - bestOther);
    }
  }
  return {
    rankings,
    best,
    highest,
    savings,
    savingsPercent,
    savingsByNature,
    itemCount: draft.items.length,
    supplierCount: draft.suppliers.filter((supplier) => supplier.name.trim()).length,
    isComparable: priced.length > 1,
  };
}

export function lowestPriceForItem(item: QuoteItem, suppliers: Supplier[]): number | null {
  const values = suppliers
    .map((supplier) => item.prices?.[supplier.id])
    .filter((value): value is number => value !== null && value !== undefined && !Number.isNaN(value));
  if (values.length === 0) return null;
  return Math.min(...values);
}

export function buildNarrative(draft: Pick<QuotationDraft, "items" | "suppliers" | "kind" | "service" | "condominium">): QuotationAnalysis {
  const metrics = computeMetrics(draft);
  const best = metrics.best;

  if (!best) {
    return {
      summary:
        "Ainda não há proposta com preços para todos os itens do escopo. Os totais parciais não são comparáveis como propostas completas.",
      recommendation:
        "Preencha os valores unitários de cada item e confira o escopo de cada fornecedor antes de gerar uma recomendação.",
      notes: "",
    };
  }

  const bestName = best.supplier.name || "Fornecedor";
  const covered = best.coverage;
  const totalItems = metrics.itemCount;
  const breakdown = supplierCostBreakdown(draft.items, best.supplier.id);
  const breakdownText = [
    breakdown.mao_obra.total !== null ? `mão de obra ${formatCurrency(breakdown.mao_obra.total)}` : "",
    breakdown.material.total !== null ? `material ${formatCurrency(breakdown.material.total)}` : "",
    breakdown.nao_discriminado.total !== null ? `não discriminado ${formatCurrency(breakdown.nao_discriminado.total)}` : "",
  ].filter(Boolean).join("; ");

  const summary = [
    `Foram analisadas ${metrics.supplierCount} proposta(s) para ${draft.kind === "produtos" ? "o fornecimento dos produtos" : "a prestação dos serviços"}${draft.service ? ` de ${draft.service.toLowerCase()}` : ""}, totalizando ${totalItems} item(ns) no escopo.`,
    metrics.isComparable
      ? `A proposta de ${bestName} apresenta o menor valor global (${formatCurrency(best.total)}), com cobertura de ${covered} de ${totalItems} item(ns) cotados.`
      : `A proposta de ${bestName} é a única com preços para todos os itens até o momento (${formatCurrency(best.total)}). Não há comparação suficiente para calcular a economia.`,
    breakdownText ? `Na proposta de ${bestName}, os itens informados somam: ${breakdownText}. Valores não discriminados não foram divididos entre mão de obra e material.` : "",
    metrics.savings > 0
      ? `A diferença em relação à proposta mais elevada é de ${formatCurrency(metrics.savings)} (${metrics.savingsPercent.toFixed(1)}%), valor que representa a economia potencial na contratação.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const recommendation = metrics.isComparable
    ? `Recomendamos avaliar a proposta de ${bestName}, condicionada à confirmação do escopo, das condições comerciais e da documentação exigida. A decisão deve ser validada pelo condomínio.`
    : "Antes de recomendar uma contratação, obtenha ao menos duas propostas completas e confirme que os fornecedores cotaram o mesmo escopo.";

  return { summary, recommendation, notes: draft.condominium ? `Mapa elaborado para ${draft.condominium}.` : "" };
}

export function createSupplier(index: number): Supplier {
  return {
    id: uid("sup_"),
    name: index === 0 ? "Fornecedor A" : `Fornecedor ${String.fromCharCode(65 + index)}`,
    contact: "",
    deliveryDays: "",
    paymentTerms: "",
    validity: "",
    notes: "",
  };
}

export function createItem(description = "", supplierIds: string[] = []): QuoteItem {
  const prices: Record<string, number | null> = {};
  for (const id of supplierIds) prices[id] = null;
  return { id: uid("itm_"), description, unit: "un", quantity: 1, prices, costType: "nao_discriminado" };
}

export function createEmptyDraft(overrides: Partial<QuotationDraft> = {}): QuotationDraft {
  const suppliers = [createSupplier(0), createSupplier(1), createSupplier(2)];
  const items = [createItem("", suppliers.map((supplier) => supplier.id))];
  return {
    status: "em_analise",
    condominium: "",
    analysisDate: todayISO(),
    recipient: "Síndico(a) e Conselho Consultivo",
    service: "",
    description: "",
    kind: "servico",
    category: CATEGORIES[0],
    suppliers,
    items,
    analysis: { summary: "", recommendation: "", notes: "" },
    attachments: [],
    ...overrides,
  };
}

const KIND_VALUES: QuotationKind[] = ["servico", "produtos"];
const STATUS_VALUES: QuotationStatus[] = ["rascunho", "em_analise", "concluido"];

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.slice(0, 4000);
  if (typeof value === "number") return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = parseCurrencyInput(value);
    if (parsed !== null) return parsed;
  }
  return fallback;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = asNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function supplierPurchase(supplier: Record<string, unknown>) {
  const link = parsePurchaseUrl(supplier.purchaseUrl);
  if (!link) return {};
  const sourceValue = asString(supplier.purchaseSource, "manual");
  return {
    purchaseUrl: link.url,
    purchaseStore: link.store ?? asString(supplier.purchaseStore).slice(0, 80),
    purchaseVerified: link.trusted,
    purchaseSource: (["manual", "documento", "pesquisa"].includes(sourceValue) ? sourceValue : "manual") as
      | "manual"
      | "documento"
      | "pesquisa",
  };
}

/** Aceita apenas endereços http(s) válidos; links inválidos são descartados. */
function normalizedPurchase(item: Record<string, unknown>) {
  const link = parsePurchaseUrl(item.purchaseUrl);
  if (!link) return {};
  const sourceValue = asString(item.purchaseSource, "manual");
  const purchaseSource = ["manual", "documento", "pesquisa"].includes(sourceValue)
    ? (sourceValue as "manual" | "documento" | "pesquisa")
    : "manual";
  const price = nullableNumber(item.purchasePrice);
  return {
    purchaseUrl: link.url,
    purchaseStore: link.store ?? asString(item.purchaseStore).slice(0, 80),
    purchasePrice: price !== null && price >= 0 ? round2(price) : null,
    purchaseVerified: link.trusted,
    purchaseSource,
  };
}

export function normalizeDraft(input: unknown): QuotationDraft {
  const source = (input ?? {}) as Record<string, unknown>;
  const rawSuppliers = Array.isArray(source.suppliers) ? source.suppliers : [];
  const suppliers: Supplier[] = rawSuppliers.slice(0, MAX_SUPPLIERS).map((entry, index) => {
    const supplier = (entry ?? {}) as Record<string, unknown>;
    return {
      id: asString(supplier.id) || `sup_${index}_${uid()}`,
      name: asString(supplier.name, `Fornecedor ${String.fromCharCode(65 + index)}`).slice(0, 160),
      contact: asString(supplier.contact).slice(0, 200),
      deliveryDays: asString(supplier.deliveryDays).slice(0, 80),
      paymentTerms: asString(supplier.paymentTerms).slice(0, 160),
      validity: asString(supplier.validity).slice(0, 80),
      notes: asString(supplier.notes).slice(0, 400),
      ...supplierPurchase(supplier),
    };
  });
  const safeSuppliers = suppliers.length > 0 ? suppliers : [createSupplier(0), createSupplier(1), createSupplier(2)];

  const rawItems = Array.isArray(source.items) ? source.items : [];
  const items: QuoteItem[] = rawItems.slice(0, 200).map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    const rawPrices = (item.prices ?? {}) as Record<string, unknown>;
    const prices: Record<string, number | null> = {};
    for (const supplier of safeSuppliers) {
      prices[supplier.id] = nullableNumber(rawPrices[supplier.id]);
    }
    return {
      id: asString(item.id) || uid("itm_"),
      description: asString(item.description).slice(0, 600),
      unit: asString(item.unit, "un").slice(0, 24),
      quantity: Math.max(0, asNumber(item.quantity, 1)),
      prices,
      costType: item.costType === "mao_obra" || item.costType === "material" ? item.costType : "nao_discriminado",
      ...normalizedPurchase(item),
    };
  });

  const analysisInput = (source.analysis ?? {}) as Record<string, unknown>;
  const outcomeInput = (analysisInput.outcome ?? {}) as Record<string, unknown>;
  const referenceAmount = nullableNumber(outcomeInput.referenceAmount);
  const contractedAmount = nullableNumber(outcomeInput.contractedAmount);
  const outcomeSupplierId = asString(outcomeInput.supplierId).slice(0, 100);
  const rawStatus = asString(source.status);
  const rawKind = asString(source.kind);
  const rawDate = asString(source.analysisDate);
  const analysisDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayISO();

  const attachments = Array.isArray(source.attachments) ? source.attachments : [];

  return {
    status: STATUS_VALUES.includes(rawStatus as QuotationStatus) ? (rawStatus as QuotationStatus) : "em_analise",
    condominium: asString(source.condominium).slice(0, 200),
    analysisDate,
    recipient: asString(source.recipient).slice(0, 240),
    service: asString(source.service).slice(0, 240),
    description: asString(source.description).slice(0, 2000),
    kind: KIND_VALUES.includes(rawKind as QuotationKind) ? (rawKind as QuotationKind) : "servico",
    category: asString(source.category, CATEGORIES[0]).slice(0, 80),
    suppliers: safeSuppliers,
    items: items.length > 0 ? items : [createItem("", safeSuppliers.map((supplier) => supplier.id))],
    analysis: {
      summary: asString(analysisInput.summary).slice(0, 4000),
      recommendation: asString(analysisInput.recommendation).slice(0, 2000),
      notes: asString(analysisInput.notes).slice(0, 2000),
      outcome: {
        supplierId: safeSuppliers.some((supplier) => supplier.id === outcomeSupplierId) ? outcomeSupplierId : "",
        referenceAmount: referenceAmount !== null && referenceAmount >= 0 ? referenceAmount : null,
        contractedAmount: contractedAmount !== null && contractedAmount >= 0 ? contractedAmount : null,
        confirmed: outcomeInput.confirmed === true,
      },
    },
    attachments: attachments.slice(0, 12).map((entry, index) => {
      const file = (entry ?? {}) as Record<string, unknown>;
      const sourceValue = asString(file.source, "manual");
      return {
        name: asString(file.name, `Anexo ${index + 1}`).slice(0, 200),
        size: Math.max(0, asNumber(file.size, 0)),
        type: asString(file.type, "application/pdf").slice(0, 80),
        source: (["ia", "manual"].includes(sourceValue) ? sourceValue : "manual") as "ia" | "manual",
        analyzedAt: asString(file.analyzedAt) || undefined,
      };
    }),
    ...(asString(source.protocol) ? { protocol: asString(source.protocol) } : {}),
  };
}

export function nextProtocol(count: number): string {
  const year = new Date().getFullYear();
  return `MC-${year}-${String(count + 1).padStart(4, "0")}`;
}

export type CompletenessIssue = { field: string; message: string };

/**
 * Lista o que falta preencher no mapa, como faria um gestor conferindo a
 * proposta: identificação, preços por item, condições comerciais e links.
 */
export function checkCompleteness(draft: Pick<QuotationDraft, "condominium" | "service" | "suppliers" | "items">): CompletenessIssue[] {
  const issues: CompletenessIssue[] = [];
  if (!draft.condominium.trim()) issues.push({ field: "condominium", message: "Informe o condomínio/associação." });
  if (!draft.service.trim()) issues.push({ field: "service", message: "Informe o serviço/objeto da cotação." });
  const named = draft.suppliers.filter((supplier) => supplier.name.trim());
  if (named.length < 2) issues.push({ field: "suppliers", message: "Cadastre ao menos 2 fornecedores com nome." });

  draft.items.forEach((item, index) => {
    const label = `Item ${String(index + 1).padStart(2, "0")}`;
    const description = item.description.trim();
    if (!description) {
      issues.push({ field: `items.${index}.description`, message: `${label}: descreva o produto ou serviço.` });
      return;
    }
    if (!(item.quantity > 0)) issues.push({ field: `items.${index}.quantity`, message: `${label} (${description.slice(0, 40)}): informe a quantidade.` });
    const priced = named.filter((supplier) => item.prices?.[supplier.id] != null);
    if (named.length > 0 && priced.length === 0) {
      issues.push({ field: `items.${index}.prices`, message: `${label} (${description.slice(0, 40)}): nenhum fornecedor com preço.` });
    } else if (priced.length > 0 && priced.length < named.length) {
      const missing = named.filter((supplier) => item.prices?.[supplier.id] == null).map((supplier) => supplier.name.trim());
      issues.push({ field: `items.${index}.prices`, message: `${label} (${description.slice(0, 40)}): sem preço de ${missing.join(", ")}.` });
    }
    if (!item.purchaseUrl) issues.push({ field: `items.${index}.purchaseUrl`, message: `${label} (${description.slice(0, 40)}): sem link de compra.` });
  });

  for (const supplier of named) {
    const missing: string[] = [];
    if (!supplier.contact.trim()) missing.push("contato");
    if (!supplier.deliveryDays.trim()) missing.push("prazo de entrega");
    if (!supplier.paymentTerms.trim()) missing.push("pagamento");
    if (!supplier.validity.trim()) missing.push("validade");
    if (missing.length > 0) {
      issues.push({ field: `suppliers.${supplier.id}`, message: `${supplier.name.trim()}: faltam ${missing.join(", ")}.` });
    }
  }
  return issues;
}
