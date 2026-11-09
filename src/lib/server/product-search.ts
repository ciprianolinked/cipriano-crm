import { TRUSTED_STORES, parsePurchaseUrl } from "@/lib/constants";
import { round2 } from "@/lib/quotation";
import type { ProductSearchResult } from "@/lib/types";

const GENERATE_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";
const SEARCH_TIMEOUT_MS = 50_000;
const SEARCH_BUDGET_MS = 100_000;

type RawSearchItem = {
  item?: number | string;
  description?: string;
  found?: boolean;
  store?: string;
  productName?: string;
  price?: number | string | null;
  url?: string;
  purchaseUrl?: string;
  note?: string;
};

export type ProductSearchOutput = {
  results: ProductSearchResult[];
  warnings: string[];
};

function buildPrompt(descriptions: string[], hint?: string): string {
  const list = descriptions.map((description, index) => `${index + 1}. ${description}`).join("\n");
  return `Você é analista de compras da Gerencial (governança condominial) e fará uma pesquisa de preços na internet.

Pesquise cada item abaixo em lojas confiáveis do Brasil e devolva o melhor resultado encontrado.

ITENS:
${list}

LOJAS PREFERENCIAIS: ${TRUSTED_STORES.map((store) => `${store.label} (${store.domain})`).join("; ")}.

REGRAS OBRIGATÓRIAS:
1. Devolva o endereço exato da página de produto que apareceu na pesquisa. Prefira as lojas preferenciais; outra loja conhecida só é aceita se você tiver certeza da URL.
2. Nunca invente, complete ou adivinhe um endereço. Sem página encontrada, use "found": false e "url": "".
3. Preencha "item" com o número do item da lista acima.
4. "price" é o preço unitário em reais encontrado no anúncio (número, sem R$). Use null se não houver preço visível.
5. "productName" é a descrição curta do produto encontrado; "store" é o nome da loja.
6. Uma sugestão por item. Se o item for genérico (ex.: "material de manutenção"), marque found=false.
7. Responda APENAS com JSON: {"results":[{"item":1,"found":true,"store":"","productName":"","price":0,"url":"","note":""}]}
${hint ? `\nContexto do condomínio: ${hint}` : ""}`;
}

function parseJsonLoose(raw: string): RawSearchItem[] {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  const parsed: unknown = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed as RawSearchItem[];
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { results?: unknown }).results)) {
    return (parsed as { results: RawSearchItem[] }).results;
  }
  throw new Error("A pesquisa não retornou a lista de produtos em formato válido.");
}

function extractText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const generate = data as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const fromGenerate = (generate.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("\n");
  if (fromGenerate.trim()) return fromGenerate;
  const interaction = data as { output_text?: string; steps?: { type?: string; content?: { type?: string; text?: string }[] }[] };
  return (
    interaction.output_text ||
    (interaction.steps ?? [])
      .filter((step) => step.type === "model_output")
      .flatMap((step) => step.content ?? [])
      .map((part) => part.text ?? "")
      .join("\n")
  );
}

/**
 * Pesquisa preços/links com Google Search grounding no Gemini.
 * Links válidos são mantidos (com selo apenas para lojas preferenciais);
 * somente endereços inválidos são descartados.
 */
export async function searchProductsOnline({
  descriptions,
  apiKey,
  model,
  hint,
  signal,
}: {
  descriptions: string[];
  apiKey: string;
  model: string;
  hint?: string;
  signal?: AbortSignal;
}): Promise<ProductSearchOutput> {
  const items = descriptions.map((description) => description.trim()).filter(Boolean).slice(0, 12);
  if (items.length === 0) {
    return { results: [], warnings: ["Nenhum item descrito para pesquisar."] };
  }
  const key = apiKey.trim();
  if (!key) {
    return { results: [], warnings: ["A pesquisa online usa a chave do Google Gemini em Configurar IA."] };
  }

  const prompt = buildPrompt(items, hint);
  const generateUrl = (candidate: string) => `${GENERATE_BASE}/${encodeURIComponent(candidate)}:generateContent`;
  const attempts: { name: string; model: string; url: string; body: () => string }[] = [];
  const models = [model, FALLBACK_MODEL].filter((candidate, index, list) => candidate && list.indexOf(candidate) === index);
  for (const candidate of models) {
    attempts.push({
      name: `generateContent (${candidate})`,
      model: candidate,
      url: generateUrl(candidate),
      body: () => JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { thinkingConfig: { thinkingLevel: "low" } },
      }),
    });
  }
  // Último recurso: mesma busca pela API Interactions.
  attempts.push({
    name: "interactions",
    model: models[0],
    url: INTERACTIONS_URL,
    body: () => JSON.stringify({
      model: models[0],
      input: [{ type: "text", text: prompt }],
      tools: [{ type: "google_search" }],
      store: false,
    }),
  });

  const deadline = Date.now() + SEARCH_BUDGET_MS;
  const detailLines: string[] = [];
  for (const attempt of attempts) {
    const remaining = deadline - Date.now();
    if (signal?.aborted) return { results: [], warnings: ["Pesquisa cancelada."] };
    if (remaining < 15_000) break;
    const timeout = AbortSignal.timeout(Math.min(SEARCH_TIMEOUT_MS, remaining));
    const composed = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response: Response | null = null;
    try {
      response = await fetch(attempt.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: attempt.body(),
        signal: composed,
      });
    } catch {
      detailLines.push(`${attempt.name}: sem resposta (tempo esgotado ou conexão).`);
      continue;
    }
    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) {
        detailLines.push(`${attempt.name}: Google indisponível no momento (erro ${response.status}).`);
        continue;
      }
      return {
        results: [],
        warnings: [
          `A pesquisa online retornou erro ${response.status}. Verifique a chave e se o Google Search está disponível para este projeto no Google AI Studio.`,
        ],
      };
    }
    const text = extractText(await response.json().catch(() => null));
    if (!text.trim()) {
      detailLines.push(`${attempt.name}: resposta vazia.`);
      continue;
    }
    let raw: RawSearchItem[];
    try {
      raw = parseJsonLoose(text);
    } catch {
      detailLines.push(`${attempt.name}: formato inesperado.`);
      continue;
    }
    return buildOutput(items, raw);
  }

  return {
    results: [],
    warnings: [
      "Nenhum link encontrado nesta tentativa. Confira a conexão, a cota do projeto no Google AI Studio e tente novamente — ou cole o link manualmente.",
      ...(detailLines.length ? [`Detalhes técnicos: ${detailLines.join(" ")}`] : []),
    ],
  };
}

function buildOutput(items: string[], raw: RawSearchItem[]): ProductSearchOutput {
  const warnings: string[] = [];
  const unverified = new Set<string>();
  const results: ProductSearchResult[] = [];
  for (const entry of raw) {
    const index = Number(entry.item) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= items.length) continue;
    const rawUrl = typeof entry.url === "string" ? entry.url : typeof entry.purchaseUrl === "string" ? entry.purchaseUrl : "";
    const link = parsePurchaseUrl(rawUrl);
    const price = typeof entry.price === "number" ? entry.price : typeof entry.price === "string" ? Number(entry.price.replace(/\./g, "").replace(",", ".")) : null;
    if (rawUrl && !link) {
      warnings.push(`O endereço sugerido para "${items[index]}" não é válido e foi descartado.`);
    } else if (link && !link.trusted) {
      unverified.add(link.store ?? link.host);
    }
    results.push({
      index,
      description: items[index],
      found: Boolean(link),
      store: link?.store ?? (typeof entry.store === "string" && entry.store.trim() ? entry.store.trim().slice(0, 80) : link?.host ?? null),
      productName: typeof entry.productName === "string" ? entry.productName.slice(0, 200) : "",
      price: price !== null && Number.isFinite(price) && price > 0 ? round2(price) : null,
      purchaseUrl: link?.url ?? "",
      trusted: Boolean(link?.trusted),
      note: !link
        ? "Nenhum link encontrado; descreva o item com mais detalhes ou informe o fornecedor."
        : !link.trusted
          ? "Loja fora da lista preferencial: confira o endereço e o vendedor antes de comprar."
          : typeof entry.note === "string" ? entry.note.slice(0, 300) : "",
    });
  }

  if (unverified.size > 0) {
    warnings.push(`Links mantidos sem o selo de loja confiável: ${[...unverified].join(", ")}.`);
  }
  const missing = items.filter((_, index) => !results.some((result) => result.index === index && result.found));
  if (missing.length > 0) {
    warnings.push(`${missing.length} item(ns) sem link encontrado: ${missing.slice(0, 4).join("; ")}${missing.length > 4 ? "…" : ""}.`);
  }
  return { results, warnings };
}
