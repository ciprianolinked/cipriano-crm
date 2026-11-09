import type { CostType, QuotationKind, QuotationStatus } from "./types";

export const COST_TYPE_LABEL: Record<CostType, string> = {
  mao_obra: "Mão de obra",
  material: "Material",
  nao_discriminado: "Não discriminado",
};

export const COST_TYPES: CostType[] = ["mao_obra", "material", "nao_discriminado"];

export const CATEGORIES = [
  "Manutenção predial",
  "Elétrica",
  "Hidráulica",
  "Piscina",
  "Limpeza e conservação",
  "Jardinagem",
  "Segurança e portaria",
  "Obras e reformas",
  "Administrativo",
  "Outros",
] as const;

export const UNITS = [
  "un",
  "serviço",
  "mês",
  "m²",
  "m",
  "kg",
  "L",
  "cx",
  "hora",
  "vb (verba)",
] as const;

export const STATUS_LABEL: Record<QuotationStatus, string> = {
  rascunho: "Rascunho",
  em_analise: "Em análise",
  concluido: "Concluído",
};

export const STATUS_STYLE: Record<QuotationStatus, string> = {
  rascunho: "bg-slate-100 text-slate-600 ring-slate-200",
  em_analise: "bg-amber-50 text-amber-700 ring-amber-200",
  concluido: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export const KIND_LABEL: Record<QuotationKind, string> = {
  servico: "Serviço",
  produtos: "Produtos",
};

/**
 * Rótulo da natureza da cotação. Alias de KIND_LABEL, mantido por compatibilidade
 * com implementações que indexam por string.
 */
export const NATURE_LABEL: Record<string, string> = KIND_LABEL;

/**
 * Lojas usadas na pesquisa online de produtos. A IA só pode devolver links
 * destes domínios; qualquer outro endereço é descartado e sinalizado.
 */
export const TRUSTED_STORES: { domain: string; label: string }[] = [
  { domain: "leroymerlin.com.br", label: "Leroy Merlin" },
  { domain: "sodimac.com.br", label: "Sodimac" },
  { domain: "obramax.com.br", label: "Obramax" },
  { domain: "telhanorte.com.br", label: "Telhanorte" },
  { domain: "cem.com.br", label: "C&C" },
  { domain: "cassol.com.br", label: "Cassol" },
  { domain: "balaroti.com.br", label: "Balaroti" },
  { domain: "madeiramadeira.com.br", label: "MadeiraMadeira" },
  { domain: "amazon.com.br", label: "Amazon Brasil" },
  { domain: "magazineluiza.com.br", label: "Magazine Luiza" },
  { domain: "mercadolivre.com.br", label: "Mercado Livre" },
  { domain: "casasbahia.com.br", label: "Casas Bahia" },
  { domain: "fastshop.com.br", label: "Fast Shop" },
  { domain: "carrefour.com.br", label: "Carrefour" },
  { domain: "extra.com.br", label: "Extra" },
  { domain: "gigante.com.br", label: "Gigante" },
  { domain: "kabum.com.br", label: "KaBuM!" },
  { domain: "pichau.com.br", label: "Pichau" },
  { domain: "terabyteshop.com.br", label: "Terabyte Shop" },
  { domain: "ferramentasgerais.com.br", label: "Ferramentas Gerais" },
  { domain: "lojadomecanico.com.br", label: "Loja do Mecânico" },
  { domain: "santil.com.br", label: "Santil" },
  { domain: "dicico.com.br", label: "Dicico" },
  { domain: "martinsfontes.com.br", label: "Martins Fontes" },
  { domain: "tumelero.com.br", label: "Tumelero" },
  { domain: "wurth.com.br", label: "Würth" },
  { domain: "tigre.com.br", label: "Tigre" },
  { domain: "decorluz.com.br", label: "Decorflex" },
  { domain: "fischer.com.br", label: "Fischer" },
  { domain: "camicado.com.br", label: "Camicado" },
  { domain: "cobasi.com.br", label: "Cobasi" },
  { domain: "americanas.com.br", label: "Americanas" },
  { domain: "shopee.com.br", label: "Shopee" },
];

export const TRUSTED_STORE_DOMAINS = TRUSTED_STORES.map((store) => store.domain);

/** Normaliza um endereço de compra e confirma se pertence a uma loja confiável. */
export function parsePurchaseUrl(raw: unknown): { url: string; host: string; store: string | null; trusted: boolean } | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > 500) return null;
  let parsed: URL;
  try {
    parsed = new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (!host.includes(".") || host.endsWith(".local")) return null;
  const store = TRUSTED_STORES.find((entry) => host === entry.domain || host.endsWith(`.${entry.domain}`));
  return {
    url: parsed.toString().slice(0, 500),
    host,
    store: store?.label ?? null,
    trusted: Boolean(store),
  };
}

export const MAX_SUPPLIERS = 5;
export const MAX_FILES = 6;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const ACCEPTED_UPLOAD_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
