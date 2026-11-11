import { extractText, extractTextItems, getDocumentProxy } from "unpdf";

/** Limite por arquivo: o corpo da requisição na Vercel é limitado a ~4,5 MB. */
export const MAX_REFERENCE_BYTES = 4 * 1024 * 1024;
export const MAX_REFERENCE_FILES = 6;
export const ALLOWED_REFERENCE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/markdown",
  "text/csv",
] as const;

export const TEXT_REFERENCE_TYPES = ["text/plain", "text/markdown", "text/csv"] as const;

export function isTextReference(mimeType: string) {
  return (TEXT_REFERENCE_TYPES as readonly string[]).includes(mimeType);
}

export type ReferencePrice = { raw: string; value: number; context: string };

export type ReferenceAnalysis = {
  prices: ReferencePrice[];
  wordCount: number;
  pages: number | null;
  hasText: boolean;
  /** Linhas de tabela reconstruídas pela posição das colunas no PDF. */
  layoutRows?: string[][];
};

/** R$ 1.234,56 · R$ 1.234 · R$ 390,00 */
const PRICE_PATTERN = /R\$\s*([\d]{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/g;

export function parseBrl(raw: string): number {
  const value = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) ? value : 0;
}

/** Localiza valores monetários no texto do concorrente, com trecho de contexto. */
export function analyzeReferenceText(text: string, pages: number | null): ReferenceAnalysis {
  const prices: ReferencePrice[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(PRICE_PATTERN)) {
    const raw = match[0];
    const value = parseBrl(match[1]);
    if (!Number.isFinite(value) || value <= 0 || seen.has(raw)) continue;
    seen.add(raw);
    const at = match.index ?? 0;
    const context = text
      .slice(Math.max(0, at - 60), at + raw.length + 30)
      .replace(/\s+/g, " ")
      .trim();
    prices.push({ raw, value, context });
    if (prices.length >= 40) break;
  }
  prices.sort((a, b) => b.value - a.value);
  const trimmed = text.trim();
  return {
    prices,
    wordCount: trimmed ? trimmed.split(/\s+/).length : 0,
    pages,
    hasText: trimmed.length > 0,
  };
}

type TextItem = { str?: string; text?: string; x: number; y: number; width: number };

/** Agrupa fragmentos de texto em linhas e colunas pela posição (X/Y) na página. */
function buildLayoutRows(pages: TextItem[][]): string[][] {
  const rows: string[][] = [];
  for (const pageItems of pages) {
    const items = pageItems.filter((item) => (item.str ?? item.text ?? "").trim().length > 0);
    if (!items.length) continue;
    const lines: { y: number; cells: TextItem[] }[] = [];
    for (const item of items.sort((a, b) => a.y - b.y || a.x - b.x)) {
      const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 4);
      if (line) line.cells.push(item);
      else lines.push({ y: item.y, cells: [item] });
    }
    for (const line of lines.sort((a, b) => a.y - b.y)) {
      const cells: TextItem[] = [];
      for (const item of line.cells.sort((a, b) => a.x - b.x)) {
        const previous = cells[cells.length - 1];
        const text = (item.str ?? item.text ?? "").trim();
        if (previous && item.x - (previous.x + previous.width) < 3.5) {
          previous.str = `${(previous.str ?? "").trim()} ${text}`.trim();
          previous.width = item.x + item.width - previous.x;
        } else {
          cells.push({ ...item, str: text });
        }
      }
      const values = cells.map((cell) => (cell.str ?? "").trim()).filter(Boolean);
      if (!values.length) continue;
      // Linha de página (número isolado, rodapé) não ajuda na leitura de itens.
      if (values.length === 1 && values[0].length <= 3) continue;
      rows.push(values.slice(0, 12));
      if (rows.length > 900) return rows;
    }
  }
  return rows;
}

/** Extrai texto e estrutura de tabela de um PDF; imagens ficam para transcrição visual. */
export async function extractReference(
  bytes: Buffer,
  mimeType: string,
): Promise<{ text: string; pages: number | null; layoutRows: string[][] }> {
  if (bytes.length === 0) return { text: "", pages: null, layoutRows: [] };
  if (isTextReference(mimeType)) {
    const text = bytes.toString("utf8").replace(/\r/g, "").slice(0, 200000);
    const layoutRows = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\s*[;|\t]\s*/).filter(Boolean).slice(0, 12));
    return { text, pages: null, layoutRows };
  }
  if (mimeType !== "application/pdf") return { text: "", pages: null, layoutRows: [] };

  try {
    const document = await getDocumentProxy(new Uint8Array(bytes));
    const { text, totalPages } = await extractText(document, { mergePages: true });
    const normalized = text
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    let layoutRows: string[][] = [];
    try {
      const structured = await extractTextItems(document);
      layoutRows = buildLayoutRows(
        structured.items.map((page) =>
          page.map((item) => {
            const value = item as unknown as { str?: string; text?: string; x?: number; y?: number; width?: number; transform?: number[] };
            const transform = value.transform ?? [];
            return {
              str: value.str ?? value.text,
              x: value.x ?? transform[4] ?? 0,
              y: value.y ?? transform[5] ?? 0,
              width: value.width ?? 0,
            };
          }),
        ),
      );
    } catch {
      layoutRows = [];
    }

    return { text: normalized, pages: totalPages, layoutRows };
  } catch {
    // PDF protegido, corrompido ou sem camada de texto: o arquivo fica disponível para leitura visual.
    return { text: "", pages: null, layoutRows: [] };
  }
}

/** Faixa resumida de valores encontrados, útil ao posicionar o próprio preço. */
export function priceSummary(prices: ReferencePrice[]) {
  const values = prices.map((price) => price.value).filter((value) => value > 0);
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const median =
    sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return { min: sorted[0], max: sorted[sorted.length - 1], median, count: sorted.length };
}
