import { ACCEPTED_UPLOAD_TYPES, CATEGORIES, MAX_FILES, MAX_FILE_BYTES, parsePurchaseUrl } from "./constants";
import type { AiExtractionResult, QuotationKind, QuoteItem, Supplier } from "./types";
import { checkCompleteness, parseCurrencyInput, round2, todayISO, uid } from "./quotation";
import { getGeminiKey } from "./server/quotations";
import { createGeminiInteractionDetailed, resolveGeminiModel, type GeminiInputPart } from "./server/gemini";
import { searchProductsOnline } from "./server/product-search";
import type { AiAnalysisPhase } from "./ai-stream";

export type UploadInput = {
  name: string;
  type: string;
  size: number;
  base64: string;
};

export type ExtractionHints = {
  condominium?: string;
  service?: string;
  recipient?: string;
  description?: string;
};

export type AiProviderInfo = {
  provider: "gemini" | "openai" | "none";
  model: string;
  source: "painel" | "ambiente" | null;
  free: boolean;
};

type RawSupplier = {
  name?: string;
  contact?: string;
  purchaseUrl?: string;
  purchaseStore?: string;
  deliveryDays?: string;
  paymentTerms?: string;
  validity?: string;
  notes?: string;
  proposalTotal?: number | null;
};

type RawItem = {
  description?: string;
  costType?: string;
  unit?: string;
  quantity?: number | null;
  prices?: (number | string | null)[];
  purchaseUrl?: string;
  purchaseStore?: string;
  purchasePrice?: number | string | null;
};

type RawExtraction = {
  condominium?: string;
  analysisDate?: string;
  recipient?: string;
  service?: string;
  description?: string;
  kind?: string;
  category?: string;
  suppliers?: RawSupplier[];
  items?: RawItem[];
  analysis?: { summary?: string; recommendation?: string; notes?: string };
};

const MAX_CHARS = 60_000;

// Corrige automaticamente a configuração antiga 2.5 Flash, inclusive quando
// estava definida em GEMINI_MODEL no ambiente de publicação.
export const GEMINI_MODEL = resolveGeminiModel(process.env.GEMINI_MODEL);
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

/**
 * IA gratuita recomendada: Google Gemini (plano gratuito do Google AI Studio).
 * A chave pode ser colada no painel (Configurar IA), sem mexer em código.
 */
export async function getAiConfig(): Promise<AiProviderInfo & { geminiKey: string | null; openaiKey: string | null }> {
  const { key: geminiKey, source } = await getGeminiKey();
  if (geminiKey) {
    return { provider: "gemini", model: GEMINI_MODEL, source, free: source === "painel" ? true : true, geminiKey, openaiKey: null };
  }
  const openaiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (openaiKey) {
    return { provider: "openai", model: OPENAI_MODEL, source: "ambiente", free: false, geminiKey: null, openaiKey };
  }
  return { provider: "none", model: "pré-análise local", source: null, free: true, geminiKey: null, openaiKey: null };
}

/** Versão síncrona apenas para rótulos rápidos (não lê o banco). */
export function aiProvider(): { provider: "openai" | "gemini" | "none"; model: string } {
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    return { provider: "gemini", model: GEMINI_MODEL };
  }
  if (process.env.OPENAI_API_KEY) {
    return { provider: "openai", model: OPENAI_MODEL };
  }
  return { provider: "none", model: "pré-análise local" };
}

function buildPrompt(hints: ExtractionHints): string {
  return `Você é analista sênior de compras e contratos da Gerencial, empresa de governança condominial.
Sua tarefa é ler documentos de cotação (propostas comerciais, orçamentos, notas de fornecedores) enviados em PDF ou imagem e transformá-los em um MAPA DE COTAÇÃO comparativo, em português do Brasil.

Regras obrigatórias:
1. Extraia o condomínio/associação destinatário quando aparecer; caso não apareça, use "${hints.condominium || ""}" (pode ficar vazio).
2. Identifique TODOS os fornecedores com proposta (até 5) e todos os itens/serviços cotados.
3. Para cada item, informe "prices": um array de números na MESMA ORDEM dos fornecedores listados. Use null quando o fornecedor não cotou o item. Informe o valor UNITÁRIO em reais, sem símbolo e usando ponto decimal.
4. Classifique cada linha em "costType": "mao_obra" para execução/instalação/serviço, "material" para peças ou produtos, e "nao_discriminado" quando o documento informar apenas valor global ou combinar mão de obra e material sem separação.
5. Se o fornecedor discriminar mão de obra e material em valores separados, crie linhas separadas com os valores exatos. NÃO estime, invente ou divida preços globais. Se só houver preço global, registre uma linha "Fornecimento global conforme proposta" com "costType":"nao_discriminado". Não duplique subtotais ou valores totais junto com itens detalhados.
6. Unifique itens equivalentes entre propostas apenas quando a descrição, unidade e quantidade forem comparáveis. Se um fornecedor não cotou um item, deixe seu preço como null, não zero. Se quantidades ou escopos forem diferentes, registre linhas distintas e ressalvas.
7. "quantity" deve ser numérica (default 1). Unidades comuns: un, serviço, mês, m², m, kg, L, cx, hora, vb (verba).
8. Classifique "kind" como "servico" ou "produtos" e "category" escolhendo exatamente uma opção: ${CATEGORIES.join(" | ")}.
9. Extraia TODAS as informações visíveis da proposta: contato (e-mail/telefone), prazo de entrega/execução, condições de pagamento, validade, observações (garantia, impostos, frete) e quantidades. Não deixe em branco nada que estiver legível no documento.
9.1. Se a proposta ou o print trouxer um link de compra, produto ou e-commerce, copie o endereço COMPLETO em "purchaseUrl" do item — incluindo todo o caminho após o domínio (ex.: .../produto/475566/luminaria-solar-...). Nunca informe apenas o domínio quando existir a página do produto, e nunca invente links: sem link no documento, deixe vazio.
9.2. Se o fornecedor for um e-commerce (loja virtual), informe a página/loja dele em "purchaseUrl" do fornecedor, também com o endereço mais completo visível. Nunca invente links: sem link no documento, deixe vazio.
10. Em "analysis", compare mão de obra e materiais quando discriminados, cobertura, valor global e condições. Informe diferenças de escopo e valores não discriminados. Não recomende uma proposta parcial como se cobrisse tudo.
11. Responda exclusivamente com JSON válido, sem markdown. Não invente valores ausentes.
12. Use a data de análise ${todayISO()} no formato AAAA-MM-DD.

Contexto adicional informado pelo usuário:
- Condomínio: ${hints.condominium || "não informado"}
- Serviço/objeto: ${hints.service || "não informado"}
- A/C: ${hints.recipient || "não informado"}
- Descrição: ${hints.description || "não informada"}`;
}

const RAW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["suppliers", "items"],
  properties: {
    condominium: { type: "string" },
    analysisDate: { type: "string" },
    recipient: { type: "string" },
    service: { type: "string" },
    description: { type: "string" },
    kind: { type: "string", enum: ["servico", "produtos"] },
    category: { type: "string" },
    suppliers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name"],
        properties: {
          name: { type: "string" },
          contact: { type: "string" },
          deliveryDays: { type: "string" },
          paymentTerms: { type: "string" },
          validity: { type: "string" },
          notes: { type: "string" },
          purchaseUrl: { type: "string" },
          purchaseStore: { type: "string" },
          proposalTotal: { type: ["number", "null"] },
        },
      },
    },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description"],
        properties: {
          description: { type: "string" },
          costType: { type: "string", enum: ["mao_obra", "material", "nao_discriminado"] },
          unit: { type: "string" },
          quantity: { type: ["number", "null"] },
          prices: { type: "array", items: { type: ["number", "null"] } },
          purchaseUrl: { type: "string" },
          purchaseStore: { type: "string" },
          purchasePrice: { type: ["number", "null"] },
        },
      },
    },
    analysis: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        recommendation: { type: "string" },
        notes: { type: "string" },
      },
    },
  },
} as const;

function dataUrl(file: UploadInput): string {
  return `data:${file.type || "application/pdf"};base64,${file.base64}`;
}

async function callOpenAI(
  model: string,
  apiKey: string,
  files: UploadInput[],
  text: string,
  hints: ExtractionHints,
  signal?: AbortSignal,
): Promise<RawExtraction> {
  const content: Record<string, unknown>[] = [{ type: "input_text", text: buildPrompt(hints) }];
  if (text.trim()) {
    content.push({ type: "input_text", text: `Texto da cotação (extraído):\n${text.slice(0, MAX_CHARS)}` });
  }
  for (const file of files) {
    if (file.type.startsWith("image/")) {
      content.push({ type: "input_image", image_url: dataUrl(file) });
    } else {
      content.push({ type: "input_file", filename: file.name, file_data: dataUrl(file) });
    }
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content }],
      text: {
        format: { type: "json_schema", name: "mapa_cotacao", schema: RAW_SCHEMA, strict: false },
      },
    }),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(210_000)])
      : AbortSignal.timeout(210_000),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Falha na IA (${response.status}): ${details.slice(0, 400)}`);
  }

  const data = (await response.json()) as {
    output_text?: string;
    output?: { content?: { type?: string; text?: string }[] }[];
  };
  const outputText =
    data.output_text ??
    (data.output ?? [])
      .flatMap((entry) => entry.content ?? [])
      .map((part) => part.text ?? "")
      .join("\n");

  return parseJsonLoose(outputText, "OpenAI");
}

async function callGemini(
  model: string,
  apiKey: string,
  files: UploadInput[],
  text: string,
  hints: ExtractionHints,
  signal?: AbortSignal,
  onPhase?: (phase: AiAnalysisPhase) => void,
): Promise<{ raw: RawExtraction; model: string; usedAlternative: boolean; switchedModel: boolean }> {
  const input: GeminiInputPart[] = [{ type: "text", text: buildPrompt(hints) }];
  if (text.trim()) {
    input.push({ type: "text", text: `Texto da cotação (extraído):\n${text.slice(0, MAX_CHARS)}` });
  }
  for (const file of files) {
    const mimeType = file.type === "image/jpg" ? "image/jpeg" : file.type || "application/pdf";
    input.push({
      type: mimeType.startsWith("image/") ? "image" : "document",
      mime_type: mimeType,
      data: file.base64,
    });
  }

  const result = await createGeminiInteractionDetailed({
    model,
    apiKey,
    input,
    responseSchema: RAW_SCHEMA,
    signal,
    onRetry: (phase) => onPhase?.(phase === "retrying" ? "tentando_novamente" : "alternativa"),
  });
  return { ...result, raw: parseJsonLoose(result.text, "Gemini") };
}

/** Testa a chave pela mesma API e modelo usados na leitura das cotações. */
export async function testGeminiKey(apiKey: string): Promise<{ ok: true; model: string }> {
  const result = await createGeminiInteractionDetailed({
    model: GEMINI_MODEL,
    apiKey,
    input: [{ type: "text", text: "Responda apenas com a palavra: OK" }],
    preferredTransport: "generateContent",
    timeoutMs: 45_000,
  });
  return { ok: true, model: result.model };
}

function parseJsonLoose(raw: string, provider: string): RawExtraction {
  if (!raw || !raw.trim()) throw new Error(`${provider} não retornou conteúdo.`);
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  try {
    return JSON.parse(text) as RawExtraction;
  } catch {
    throw new Error(`${provider} retornou um formato inválido. Tente novamente ou cole o texto da cotação.`);
  }
}

function normalizeUnit(unit: string | undefined): string {
  const value = (unit || "un").trim();
  const known = ["un", "serviço", "mês", "m²", "m", "kg", "L", "cx", "hora", "vb (verba)"];
  const match = known.find((entry) => entry.toLowerCase() === value.toLowerCase());
  if (match) return match;
  if (/^m2$/i.test(value)) return "m²";
  if (/^(und|unid|unidade|unidades)$/i.test(value)) return "un";
  return value.slice(0, 24) || "un";
}

function mapRaw(raw: RawExtraction, hints: ExtractionHints, mode: AiExtractionResult["mode"]) {
  const rawSuppliers = (raw.suppliers ?? []).map((supplier, originalIndex) => ({ supplier, originalIndex }))
    .filter(({ supplier }) => (supplier?.name ?? "").trim().length > 0).slice(0, 5);
  const suppliers: Supplier[] = rawSuppliers.map(({ supplier }, index) => {
    const supplierLink = parsePurchaseUrl(supplier.purchaseUrl);
    return {
      id: `sup_${index}_${uid()}`,
      name: (supplier.name || `Fornecedor ${String.fromCharCode(65 + index)}`).trim().slice(0, 160),
      contact: (supplier.contact || "").trim().slice(0, 200),
      deliveryDays: (supplier.deliveryDays || "").trim().slice(0, 80),
      paymentTerms: (supplier.paymentTerms || "").trim().slice(0, 160),
      validity: (supplier.validity || "").trim().slice(0, 80),
      notes: (supplier.notes || "").trim().slice(0, 400),
      ...(supplierLink
        ? {
            purchaseUrl: supplierLink.url,
            purchaseStore: supplierLink.store ?? (supplier.purchaseStore || "").trim().slice(0, 80),
            purchaseVerified: supplierLink.trusted,
            purchaseSource: "documento" as const,
          }
        : {}),
    };
  });

  const safeSuppliers =
    suppliers.length > 0
      ? suppliers
      : [0, 1, 2].map((index) => ({
          id: `sup_${index}_${uid()}`,
          name: `Fornecedor ${String.fromCharCode(65 + index)}`,
          contact: "",
          deliveryDays: "",
          paymentTerms: "",
          validity: "",
          notes: "",
        }));

  const items: QuoteItem[] = (raw.items ?? []).slice(0, 120).map((item, itemIndex) => {
    const prices: Record<string, number | null> = {};
    safeSuppliers.forEach((supplier, supplierIndex) => {
      const originalIndex = rawSuppliers[supplierIndex]?.originalIndex ?? supplierIndex;
      const rawPrice = Array.isArray(item.prices) ? item.prices[originalIndex] : null;
      const parsed =
        typeof rawPrice === "number"
          ? rawPrice
          : typeof rawPrice === "string"
            ? parseCurrencyInput(rawPrice)
            : null;
      prices[supplier.id] = parsed !== null && Number.isFinite(parsed) ? round2(parsed) : null;
    });
    const quantity = typeof item.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : 1;
    const link = parsePurchaseUrl(item.purchaseUrl);
    const purchasePrice = typeof item.purchasePrice === "number"
      ? item.purchasePrice
      : typeof item.purchasePrice === "string"
        ? parseCurrencyInput(item.purchasePrice)
        : null;
    return {
      id: `itm_${itemIndex}_${uid()}`,
      description: (item.description || `Item ${itemIndex + 1}`).trim().slice(0, 600),
      costType: item.costType === "mao_obra" || item.costType === "material" ? item.costType : "nao_discriminado",
      unit: normalizeUnit(item.unit),
      quantity: quantity > 0 ? quantity : 1,
      prices,
      ...(link
        ? {
            purchaseUrl: link.url,
            purchaseStore: link.store ?? (item.purchaseStore || "").trim().slice(0, 80),
            purchasePrice: purchasePrice !== null && purchasePrice >= 0 ? round2(purchasePrice) : null,
            purchaseVerified: link.trusted,
            purchaseSource: "documento" as const,
          }
        : {}),
    };
  });

  const kind: QuotationKind = raw.kind === "produtos" ? "produtos" : "servico";
  const category = CATEGORIES.includes(raw.category as (typeof CATEGORIES)[number])
    ? (raw.category as string)
    : CATEGORIES[0];
  const rawDate = (raw.analysisDate || "").slice(0, 10);
  const analysisDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayISO();

  return {
    condominium: (raw.condominium || hints.condominium || "").trim().slice(0, 200),
    analysisDate,
    recipient: (raw.recipient || hints.recipient || "Síndico(a) e Conselho Consultivo").trim().slice(0, 240),
    service: (raw.service || hints.service || "").trim().slice(0, 240),
    description: (raw.description || hints.description || "").trim().slice(0, 2000),
    kind,
    category,
    suppliers: safeSuppliers,
    items:
      items.length > 0
        ? items
        : [
            {
              id: `itm_${uid()}`,
              description: "Fornecimento global conforme escopo apresentado",
              costType: "nao_discriminado" as const,
              unit: "vb (verba)",
              quantity: 1,
              prices: Object.fromEntries(safeSuppliers.map((supplier) => [supplier.id, null])),
            },
          ],
    analysis: {
      summary: (raw.analysis?.summary || "").trim().slice(0, 4000),
      recommendation: (raw.analysis?.recommendation || "").trim().slice(0, 2000),
      notes: (raw.analysis?.notes || "").trim().slice(0, 2000),
    },
    mode,
  };
}

export function validateUploads(input: unknown): UploadInput[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, MAX_FILES)
    .map((entry) => entry as UploadInput)
    .filter((entry) => typeof entry?.base64 === "string" && entry.base64.length > 0)
    .filter((entry) => {
      const type = entry.type || "application/pdf";
      const okType = ACCEPTED_UPLOAD_TYPES.includes(type) || type.startsWith("image/");
      return okType && entry.size <= MAX_FILE_BYTES;
    });
}

export const NO_AI_MESSAGE =
  "A leitura automática de arquivos precisa da IA gratuita ativada. Abra “Configurar IA” no menu, cole sua chave do Google Gemini (leva 2 minutos, é grátis) e tente de novo. Enquanto isso, você pode colar o texto da cotação ou preencher o mapa manualmente.";

export async function extractQuotation({
  files,
  text,
  hints,
  signal,
  onPhase,
  searchProducts = false,
}: {
  files: UploadInput[];
  text: string;
  hints: ExtractionHints;
  signal?: AbortSignal;
  onPhase?: (phase: AiAnalysisPhase) => void;
  /** Pesquisa preços e links de compra em lojas confiáveis após a extração. */
  searchProducts?: boolean;
}): Promise<AiExtractionResult> {
  const config = await getAiConfig();
  const warnings: string[] = [];

  /** Preenche links de compra somente quando o item ainda não tem um link do documento. */
  async function enrichWithOnlineSearch(draft: { items: QuoteItem[] }) {
    if (!searchProducts) return;
    if (!config.geminiKey) {
      warnings.push("A pesquisa online de produtos exige a chave do Google Gemini em Configurar IA.");
      return;
    }
    const targets = draft.items.filter((item) => item.description.trim().length > 2).slice(0, 12);
    if (targets.length === 0) return;
    onPhase?.("pesquisando");
    try {
      const output = await searchProductsOnline({
        descriptions: targets.map((item) => item.description),
        apiKey: config.geminiKey,
        model: config.model,
        hint: hints.condominium,
        signal,
      });
      warnings.push(...output.warnings);
      for (const result of output.results) {
        const item = targets[result.index];
        if (!item || !result.found || !result.purchaseUrl || item.purchaseUrl) continue;
        item.purchaseUrl = result.purchaseUrl;
        item.purchaseStore = result.store ?? "";
        item.purchasePrice = result.price;
        item.purchaseVerified = result.trusted;
        item.purchaseSource = "pesquisa";
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "A pesquisa online de produtos não pôde ser concluída.");
    }
  }
  const fileSummaries = files.map((file) => ({
    name: file.name,
    note: file.type.startsWith("image/") ? "Imagem lida pelo analista de IA" : "PDF lido pelo analista de IA",
  }));

  if (config.provider !== "none") {
    try {
      let raw: RawExtraction;
      let usedModel = config.model;
      if (config.provider === "openai" && config.openaiKey) {
        raw = await callOpenAI(config.model, config.openaiKey, files, text, hints, signal);
      } else if (config.geminiKey) {
        const result = await callGemini(config.model, config.geminiKey, files, text, hints, signal, onPhase);
        raw = result.raw;
        usedModel = result.model;
        if (result.switchedModel) {
          warnings.push(`O modelo principal estava indisponível; a análise usou ${result.model}, também do Google. Revise os dados extraídos antes de salvar.`);
        } else if (result.usedAlternative) {
          warnings.push("A análise foi concluída após uma nova tentativa de conexão com o Google. Revise os dados antes de salvar.");
        }
      } else {
        throw new Error("Chave de IA indisponível.");
      }
      const mapped = mapRaw(raw, hints, "ia");
      if (!mapped.analysis.summary) {
        warnings.push("A IA não retornou parecer textual; a análise será gerada automaticamente pelos valores.");
      }
      // Conferência de gestor: aponta o que a leitura deixou incompleto.
      for (const issue of checkCompleteness(mapped).slice(0, 8)) {
        warnings.push(`Conferir: ${issue.message}`);
      }
      await enrichWithOnlineSearch(mapped);
      return {
        draft: mapped,
        mode: "ia",
        provider: config.provider === "openai" ? `OpenAI · ${usedModel}` : `Google Gemini · ${usedModel}`,
        warnings,
        fileSummaries,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido na análise de IA.";
      warnings.push(message);
      // Não apresentar texto local como se os PDFs tivessem sido lidos pela IA.
      if (signal?.aborted || files.length > 0 || !text.trim()) throw new Error(message);
    }
  }

  if (files.length > 0 && config.provider === "none") {
    throw new Error(NO_AI_MESSAGE);
  }

  if (text.trim()) {
    const parsed = parseQuotationText(text, hints);
    const localDraft = mapRaw(parsed.raw, hints, "local");
    await enrichWithOnlineSearch(localDraft);
    return {
      draft: localDraft,
      mode: "local",
      provider: "Pré-análise local de texto",
      warnings: [
        ...warnings,
        config.provider === "none"
          ? "IA ainda não ativada: o texto foi interpretado pelo analisador local. Para ler PDFs e fotos automaticamente, ative a IA gratuita em “Configurar IA”."
          : "A IA não pôde ser usada agora; o texto foi interpretado pelo analisador local.",
        ...parsed.warnings,
      ],
      fileSummaries,
    };
  }

  throw new Error(config.provider === "none" ? NO_AI_MESSAGE : warnings[0] || NO_AI_MESSAGE);
}

/* ------------------------------------------------------------------ */
/* Analisador local de texto (funciona sem chave de IA)                */
/* ------------------------------------------------------------------ */

const CURRENCY_REGEX = /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:[.,]\d{2})?)/gi;
const SUPPLIER_HINT_REGEX =
  /^(fornecedor|empresa|proposta(?: de)?|raz[ãa]o social|concorrente)\s*(?:n[º°]?\s*\d+)?\s*[:\-–]\s*(.+)$/i;
const COMPANY_REGEX = /\b(ltda|eireli|s\.?a\.?|me\b|comercial|engenharia|construtora|servi[çc]os|materiais|distribuidora|piscinas?)\b/i;

function parseMoney(token: string): number {
  const normalized = token.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? round2(value) : 0;
}

export function parseQuotationText(
  text: string,
  hints: ExtractionHints,
): { raw: RawExtraction; warnings: string[] } {
  const warnings: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 400);

  const supplierNames: string[] = [];
  for (const line of lines) {
    const hinted = line.match(SUPPLIER_HINT_REGEX);
    const candidate = hinted?.[2]?.trim();
    if (candidate && candidate.length > 2 && !supplierNames.includes(candidate)) {
      supplierNames.push(candidate.slice(0, 80));
    }
  }
  if (supplierNames.length === 0) {
    for (const line of lines) {
      if (line.length < 4 || line.length > 70) continue;
      if (!COMPANY_REGEX.test(line)) continue;
      if (/total|valor|prazo|pagamento|validade|item|descri/i.test(line)) continue;
      const cleaned = line.replace(/^(fornecedor|empresa|proposta)\s*[:\-–]\s*/i, "").trim();
      if (!supplierNames.includes(cleaned)) supplierNames.push(cleaned);
      if (supplierNames.length >= 5) break;
    }
  }

  const items: RawItem[] = [];
  for (const line of lines) {
    const moneyMatches = [...line.matchAll(CURRENCY_REGEX)].map((match) => match[1]);
    if (moneyMatches.length === 0) continue;
    if (/^(total|subtotal|total geral|valor total|frete|desconto)\b/i.test(line)) continue;
    const description = line
      .replace(CURRENCY_REGEX, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\d]+[.)\-–]?\s*/, "")
      .trim();
    if (description.length < 3) continue;
    const qtyMatch = line.match(/\b(\d{1,4}(?:[.,]\d{1,2})?)\s*(un|und|unid|m2|m²|m|kg|l|cx|mes|mês|h|hora)\b/i);
    items.push({
      description: description.slice(0, 300),
      quantity: qtyMatch ? Number(qtyMatch[1].replace(",", ".")) : 1,
      unit: qtyMatch ? normalizeUnit(qtyMatch[2]) : "un",
      prices: moneyMatches.slice(0, Math.max(supplierNames.length, 1)).map((value) => parseMoney(value)),
    });
    if (items.length >= 60) break;
  }

  if (items.length === 0) {
    warnings.push(
      "Não encontramos linhas de item com valores (R$) no texto. O escopo foi registrado na descrição — complete a tabela manualmente.",
    );
  }
  if (supplierNames.length === 0) {
    warnings.push("Nenhum fornecedor foi identificado no texto. Os nomes ficaram como Fornecedor A, B e C.");
  }

  const dateMatch = text.match(/\b(\d{2})[/.](\d{2})[/.](\d{4})\b/);
  const analysisDate = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : todayISO();
  const condoMatch =
    text.match(/condom[íi]nio\s*[:\-–]\s*(.+)/i) ??
    text.match(/associa[çc][ãa]o\s*[:\-–]\s*(.+)/i) ??
    text.match(/cliente\s*[:\-–]\s*(.+)/i);

  const kind: QuotationKind = /produto|material|pe[çc]a|equipamento|insumo/i.test(text) ? "produtos" : "servico";
  const category = CATEGORIES.find((entry) => new RegExp(entry.split(" ")[0], "i").test(text)) ?? CATEGORIES[0];

  return {
    raw: {
      condominium: (condoMatch?.[1] || hints.condominium || "").trim(),
      analysisDate,
      recipient: hints.recipient || "Síndico(a) e Conselho Consultivo",
      service: hints.service || lines[0]?.slice(0, 120) || "Cotação analisada",
      description: hints.description || text.slice(0, 1200),
      kind,
      category,
      suppliers: (supplierNames.length > 0 ? supplierNames : ["Fornecedor A", "Fornecedor B", "Fornecedor C"]).map(
        (name) => ({ name, contact: "", deliveryDays: "", paymentTerms: "", validity: "", notes: "" }),
      ),
      items,
    },
    warnings,
  };
}
