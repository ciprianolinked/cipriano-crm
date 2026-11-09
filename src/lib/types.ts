export type QuotationStatus = "rascunho" | "em_analise" | "concluido";
export type QuotationKind = "servico" | "produtos";
export type CostType = "mao_obra" | "material" | "nao_discriminado";

export type Supplier = {
  id: string;
  name: string;
  contact: string;
  deliveryDays: string;
  paymentTerms: string;
  validity: string;
  notes: string;
  /** Link do e-commerce/loja do próprio fornecedor. */
  purchaseUrl?: string;
  purchaseStore?: string;
  purchaseVerified?: boolean;
  purchaseSource?: "manual" | "documento" | "pesquisa";
};

export type QuoteItem = {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  prices: Record<string, number | null>;
  // Registros anteriores continuam válidos; itens antigos são considerados não discriminados.
  costType?: CostType;
  /** Link de compra (informado manualmente, extraído do documento ou achado na pesquisa). */
  purchaseUrl?: string;
  /** Loja identificada a partir do domínio do link. */
  purchaseStore?: string;
  /** Preço encontrado na pesquisa online, quando houver. */
  purchasePrice?: number | null;
  /** Verdadeiro quando o link pertence à lista de lojas confiáveis. */
  purchaseVerified?: boolean;
  /** Origem do link: manual, documento ou pesquisa online. */
  purchaseSource?: "manual" | "documento" | "pesquisa";
};

export type ProductSearchResult = {
  index: number;
  description: string;
  found: boolean;
  store: string | null;
  productName: string;
  price: number | null;
  purchaseUrl: string;
  trusted: boolean;
  note: string;
};

/** Valores informados e confirmados pela equipe após uma contratação. */
export type QuotationOutcome = {
  supplierId: string;
  referenceAmount: number | null;
  contractedAmount: number | null;
  confirmed: boolean;
};

export type QuotationAnalysis = {
  summary: string;
  recommendation: string;
  notes: string;
  outcome?: QuotationOutcome;
};

export type AttachmentMeta = {
  name: string;
  size: number;
  type: string;
  source: "ia" | "manual";
  analyzedAt?: string;
};

export type QuotationDraft = {
  protocol?: string;
  status: QuotationStatus;
  condominium: string;
  analysisDate: string;
  recipient: string;
  service: string;
  description: string;
  kind: QuotationKind;
  category: string;
  suppliers: Supplier[];
  items: QuoteItem[];
  analysis: QuotationAnalysis;
  attachments: AttachmentMeta[];
};

export type QuotationRecord = QuotationDraft & {
  id: string;
  protocol: string;
  createdAt: string;
  updatedAt: string;
};

export type AiExtractionResult = {
  draft: Partial<QuotationDraft> & {
    suppliers: Supplier[];
    items: QuoteItem[];
  };
  mode: "ia" | "local";
  provider: string;
  warnings: string[];
  fileSummaries: { name: string; note: string }[];
};

export type CondominiumRecord = {
  id: string;
  name: string;
  city: string | null;
  manager: string | null;
  contactEmail?: string | null;
};
