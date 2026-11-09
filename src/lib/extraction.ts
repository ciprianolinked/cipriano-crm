import type { AiExtractionResult, AttachmentMeta, QuotationDraft, QuoteItem, Supplier } from "./types";
import { MAX_SUPPLIERS } from "./constants";
import { buildNarrative, supplierTotal, uid } from "./quotation";

export type ApplyMode = "replace" | "merge";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // Remove pontuação para que "Luminária Solar, LSI 4800" combine com "luminaria solar lsi 4800".
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Quando há dois endereços do mesmo site, prefere o mais completo (página do produto). */
export function preferFullerUrl(current: string | undefined, incoming: string | undefined): string | undefined {
  if (!incoming) return current;
  if (!current) return incoming;
  try {
    const a = new URL(current);
    const b = new URL(incoming);
    if (a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "") && b.pathname.length > a.pathname.length) {
      return incoming;
    }
  } catch {
    if (incoming.length > current.length) return incoming;
  }
  return current;
}

function attachmentSource(extraction: AiExtractionResult): AttachmentMeta["source"] {
  return extraction.mode === "ia" ? "ia" : "manual";
}

function buildAttachments(base: QuotationDraft, extraction: AiExtractionResult, files: { name: string; size: number; type: string }[]) {
  const analyzedAt = new Date().toISOString();
  const source = attachmentSource(extraction);
  const incoming: AttachmentMeta[] = files.map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type || "application/pdf",
    source,
    analyzedAt,
  }));
  // Soma os anexos: mantém os anteriores e evita duplicar o mesmo arquivo.
  return [
    ...base.attachments.filter((file) => !incoming.some((entry) => entry.name === file.name)),
    ...incoming,
  ].slice(-24);
}

/** Substitui fornecedores e itens pelos dados da nova análise (comportamento original). */
export function mergeExtraction(
  base: QuotationDraft,
  extraction: AiExtractionResult,
  files: { name: string; size: number; type: string }[],
): QuotationDraft {
  const extracted = extraction.draft;
  const suppliers = extracted.suppliers?.length ? extracted.suppliers : base.suppliers;
  const items = extracted.items?.length ? extracted.items : base.items;

  const analysis =
    extracted.analysis && (extracted.analysis.summary || extracted.analysis.recommendation)
      ? {
          summary: extracted.analysis.summary || base.analysis.summary,
          recommendation: extracted.analysis.recommendation || base.analysis.recommendation,
          notes: extracted.analysis.notes || base.analysis.notes,
        }
      : buildNarrative({
          items,
          suppliers,
          kind: extracted.kind ?? base.kind,
          service: extracted.service || base.service,
          condominium: extracted.condominium || base.condominium,
        });

  return {
    ...base,
    condominium: base.condominium.trim() || extracted.condominium?.trim() || "",
    analysisDate: base.analysisDate || extracted.analysisDate || "",
    recipient: base.recipient.trim() || extracted.recipient?.trim() || "",
    service: base.service.trim() || extracted.service?.trim() || "",
    description: base.description.trim() || extracted.description?.trim() || "",
    kind: extracted.kind ?? base.kind,
    category: extracted.category || base.category,
    suppliers,
    items,
    analysis: { ...analysis, outcome: base.analysis.outcome },
    attachments: buildAttachments(base, extraction, files),
    protocol: base.protocol,
  };
}

/**
 * Complementa o mapa existente com uma nova análise, somando os arquivos já
 * anexados. Preços já informados não são apagados; fornecedores com o mesmo
 * nome são reaproveitados e itens equivalentes recebem apenas os valores que
 * faltavam.
 */
export function mergeComplementary(
  base: QuotationDraft,
  extraction: AiExtractionResult,
  files: { name: string; size: number; type: string }[],
): QuotationDraft {
  const suppliers: Supplier[] = base.suppliers.map((supplier) => ({ ...supplier }));
  const supplierIdMap = new Map<string, string>();

  for (const incoming of extraction.draft.suppliers ?? []) {
    if (!incoming.name?.trim()) continue;
    const key = normalize(incoming.name);
    const existingIndex = suppliers.findIndex((supplier) => normalize(supplier.name) === key && supplier.name.trim());
    if (existingIndex >= 0) {
      const existing = suppliers[existingIndex];
      supplierIdMap.set(incoming.id, existing.id);
      suppliers[existingIndex] = {
        ...existing,
        contact: existing.contact || incoming.contact,
        deliveryDays: existing.deliveryDays || incoming.deliveryDays,
        paymentTerms: existing.paymentTerms || incoming.paymentTerms,
        validity: existing.validity || incoming.validity,
        notes: existing.notes || incoming.notes,
        purchaseUrl: preferFullerUrl(existing.purchaseUrl, incoming.purchaseUrl) ?? existing.purchaseUrl,
        purchaseStore: existing.purchaseStore || incoming.purchaseStore,
        purchaseVerified: existing.purchaseVerified ?? incoming.purchaseVerified,
        purchaseSource: existing.purchaseSource ?? incoming.purchaseSource,
      };
    } else if (suppliers.filter((supplier) => supplier.name.trim()).length < MAX_SUPPLIERS || suppliers.length < MAX_SUPPLIERS) {
      suppliers.push(incoming);
      supplierIdMap.set(incoming.id, incoming.id);
    }
  }

  const emptied = (item: QuoteItem) =>
    !item.description.trim() && !Object.values(item.prices ?? {}).some((price) => price !== null && price !== undefined);
  const baseItems = base.items.filter((item) => !emptied(item));
  const items: QuoteItem[] = baseItems.map((item) => ({ ...item, prices: { ...item.prices } }));

  for (const incoming of extraction.draft.items ?? []) {
    if (!incoming.description?.trim()) continue;
    const incomingPrices: Record<string, number | null> = {};
    for (const [incomingSupplierId, price] of Object.entries(incoming.prices ?? {})) {
      const mapped = supplierIdMap.get(incomingSupplierId);
      if (mapped) incomingPrices[mapped] = price ?? null;
    }
    const key = normalize(incoming.description);
    const existingIndex = items.findIndex((item) => normalize(item.description) === key);
    if (existingIndex >= 0) {
      const existing = items[existingIndex];
      const prices = { ...existing.prices };
      for (const [supplierId, price] of Object.entries(incomingPrices)) {
        if (price === null) continue;
        if (prices[supplierId] === null || prices[supplierId] === undefined) prices[supplierId] = price;
      }
      const keepCostType = existing.costType && existing.costType !== "nao_discriminado";
      items[existingIndex] = {
        ...existing,
        prices,
        costType: keepCostType ? existing.costType : incoming.costType ?? existing.costType,
        purchaseUrl: preferFullerUrl(existing.purchaseUrl, incoming.purchaseUrl),
        purchaseStore: existing.purchaseStore || incoming.purchaseStore,
        purchasePrice: existing.purchasePrice ?? incoming.purchasePrice ?? null,
        purchaseVerified: existing.purchaseVerified ?? incoming.purchaseVerified,
        purchaseSource: existing.purchaseSource ?? incoming.purchaseSource,
      };
    } else {
      items.push({ ...incoming, id: uid("itm_"), prices: incomingPrices });
    }
  }

  for (const item of items) {
    for (const supplier of suppliers) {
      if (item.prices[supplier.id] === undefined) item.prices[supplier.id] = null;
    }
  }

  const narrative = buildNarrative({
    items,
    suppliers,
    kind: extraction.draft.kind ?? base.kind,
    service: base.service || extraction.draft.service || "",
    condominium: base.condominium || extraction.draft.condominium || "",
  });
  const incomingSummary = extraction.draft.analysis?.summary?.trim();
  const summary = [
    base.analysis.summary.trim(),
    incomingSummary && normalize(incomingSummary) !== normalize(base.analysis.summary) ? incomingSummary : "",
    narrative.summary,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    ...base,
    kind: extraction.draft.kind ?? base.kind,
    category: base.category || extraction.draft.category || "",
    service: base.service.trim() || extraction.draft.service?.trim() || "",
    description: base.description.trim() || extraction.draft.description?.trim() || "",
    suppliers,
    items,
    analysis: {
      summary,
      recommendation: narrative.recommendation || base.analysis.recommendation,
      notes: base.analysis.notes || extraction.draft.analysis?.notes || "",
      outcome: base.analysis.outcome,
    },
    attachments: buildAttachments(base, extraction, files),
    protocol: base.protocol,
  };
}

/** Resume o que foi somado, para exibir ao usuário. */
export function describeMerge(before: QuotationDraft, after: QuotationDraft): string[] {
  const newSuppliers = after.suppliers.filter((supplier) => !before.suppliers.some((entry) => entry.id === supplier.id));
  const newItems = after.items.filter((item) => !before.items.some((entry) => entry.id === item.id));
  const updatedPrices = after.items.filter((item) => {
    const previous = before.items.find((entry) => entry.id === item.id);
    if (!previous) return false;
    return after.suppliers.some((supplier) => previous.prices[supplier.id] == null && item.prices[supplier.id] != null);
  });
  return [
    newSuppliers.length ? `${newSuppliers.length} fornecedor(es) adicionado(s)` : "",
    newItems.length ? `${newItems.length} item(ns) novo(s)` : "",
    updatedPrices.length ? `${updatedPrices.length} item(ns) com preços completados` : "",
  ].filter(Boolean);
}

export function fileToMeta(file: File) {
  return { id: uid("file_"), name: file.name, size: file.size, type: file.type || "application/pdf" };
}

export function quotationTotal(draft: Pick<QuotationDraft, "items" | "suppliers">): number {
  return draft.suppliers.reduce((sum, supplier) => sum + (supplierTotal(draft.items, supplier.id) ?? 0), 0);
}
