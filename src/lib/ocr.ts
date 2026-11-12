import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Extracts text from PDF files using pdfjs-dist (legacy build, works in Node).
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import of the legacy build (works in Node/serverless without a worker).
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
    });
    const pdf = await task.promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? (item as { str: string }).str : ""))
        .join(" ");
      text += pageText + "\n";
      page.cleanup();
    }
    await pdf.destroy();
    return text.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  } catch (err) {
    console.error("PDF parse error:", (err as Error).message);
    return "";
  }
}

/**
 * Extracts text from image files using tesseract.js OCR (eng+por, offline).
 */
export async function extractImageText(buffer: Buffer): Promise<string> {
  try {
    const Tesseract = (await import("tesseract.js")).default;
    const { data } = await Tesseract.recognize(buffer, "eng+por", {
      logger: () => {},
    });
    return (data.text || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  } catch (err) {
    console.error("OCR error:", (err as Error).message);
    return "";
  }
}

/**
 * Extracts text from a file based on its type.
 * - PDF: pdfjs-dist text extraction.
 * - Image (png/jpg/webp): tesseract.js OCR.
 * - CSV/TXT: direct text.
 */
export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<{ text: string; source: "pdf" | "imagem" | "texto" | "csv" }> {
  const lower = fileName.toLowerCase();
  const isImage = /image\/|\.png$|\.jpe?g$|\.webp$|\.bmp$/.test(`${mimeType} ${lower}`);
  const isPdf = mimeType === "application/pdf" || /\.pdf$/.test(lower);
  const isCsv = /text\/csv|\.csv$/i.test(`${mimeType} ${lower}`);
  const isText = /text\/|\.txt$/i.test(`${mimeType} ${lower}`);

  if (isPdf) {
    const text = await extractPdfText(buffer);
    return { text, source: "pdf" };
  }
  if (isImage) {
    const text = await extractImageText(buffer);
    return { text, source: "imagem" };
  }
  if (isCsv) {
    return { text: buffer.toString("utf8"), source: "csv" };
  }
  if (isText) {
    return { text: buffer.toString("utf8"), source: "texto" };
  }
  // Fallback: try OCR if it looks like an image, else empty.
  const fallbackText = isImage ? await extractImageText(buffer) : "";
  return { text: fallbackText, source: isImage ? "imagem" : "texto" };
}

export type ParsedItem = {
  description: string;
  qty: number;
  unit: string;
  unitPrice: number; // R$ por unidade
  total: number;
};

const PRICE_RE = /R\$\s*([\d]{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/g;

const brlToNumber = (value: string): number => {
  const n = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const UNIT_RE =
  /\b(und|un|und\.|pc|cx|m\b|vb|conj|par\b|m[eê]s|ponto|pontos|porta|portas|un)\b/i;

const isHeaderLine = (line: string): boolean => {
  const t = line.trim();
  if (!t) return true;
  const hasKeyword =
    /descri|item|equip|item|produt|servi|quantidade|\bqtd\b|unidade|\bun\b|unit[aá]rio|pre[çc]o|total|valor|c[uú]lqu[eê]|categoria|item de custo/i.test(
      t,
    );
  const numbers = (t.match(/\d/g) || []).length;
  return hasKeyword && numbers <= 3;
};

const cleanDescription = (value: string): string =>
  value
    .replace(/\s*\|\s*/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–·*]+/, "")
    .trim();

/**
 * Parses supplier quote lines. Supports:
 *   "Description  8  und  1.290,00  10.320,00"  (desc qty unit unitPrice total)
 *   "Description  und  1.290,00  10.320,00"
 *   "Description  R$ 1.290,00"
 */
export function parseQuoteLines(text: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s*\|\s*/g, " ").replace(/\s+/g, " ").trim();
    if (!line || isHeaderLine(line)) continue;

    const prices: { value: number; index: number }[] = [];
    for (const m of line.matchAll(PRICE_RE)) {
      const value = brlToNumber(m[1]);
      if (value > 0) prices.push({ value, index: m.index ?? 0 });
    }
    if (!prices.length) continue;

    const descriptionRaw = line.slice(0, prices[0].index);
    const description = cleanDescription(descriptionRaw);
    if (description.length < 2) continue;

    let unit = "un";
    const unitMatch = descriptionRaw.match(UNIT_RE);
    if (unitMatch) unit = unitMatch[1].toLowerCase();

    let qty: number | null = null;
    for (const token of descriptionRaw.split(/\s+/)) {
      if (/^\d{1,4}$/.test(token)) {
        qty = Number(token);
        break;
      }
    }

    let unitPrice = prices[prices.length - 1].value;
    let total = prices[prices.length - 1].value;

    if (prices.length >= 2) {
      const first = prices[0].value;
      const last = prices[prices.length - 1].value;
      if (qty && last > first && Math.abs(last - first * qty) < Math.max(1, last * 0.02)) {
        unitPrice = first;
        total = last;
      } else if (last > first && last / first >= 1.5) {
        unitPrice = first;
        total = last;
        qty = qty ?? Math.round(last / first);
      } else {
        unitPrice = last;
        total = last;
        qty = qty ?? 1;
      }
    } else {
      qty = qty ?? 1;
      total = qty * unitPrice;
    }

    if (total > 0 && description) {
      items.push({
        description,
        qty: qty && qty > 0 ? qty : 1,
        unit,
        unitPrice: Math.round(unitPrice * 100) / 100,
        total: Math.round(total * 100) / 100,
      });
    }
  }
  return items;
}

/**
 * Parses a CSV supplier quote. Handles:
 *   - Standard CSV: "Desc, un, 8, 1290.00, 10320.00"
 *   - pt-BR CSV where comma is both decimal AND column separator:
 *     "Câmera, un, 8, 1290,00, 10320,00"  →  "1290,00" = 1290.00
 * Strategy: split by delimiter, then re-merge trailing "00"/"00,xx" centavos fragments
 * that got split from their integer part (e.g. "1290" + "00" → 1290.00).
 */
export function parseCsvQuote(text: string): ParsedItem[] {
  const rawLines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!rawLines.length) return [];

  const delimiter = (rawLines[0].match(/;/g)?.length ?? 0) > (rawLines[0].match(/,/g)?.length ?? 0) ? ";" : ",";

  const items: ParsedItem[] = [];

  for (const rawLine of rawLines) {
    let cells = rawLine.split(delimiter).map((c) => c.trim());

    // Re-merge centavos fragments: "1290" followed by "00" → "1290.00".
    // Pattern: a pure integer cell immediately followed by a 1-2 digit cell (centavos).
    const merged: string[] = [];
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const next = cells[i + 1];
      // If current is a bare integer and next is exactly 1-2 digits (centavos), merge.
      if (/^\d{1,6}$/.test(cell) && next !== undefined && /^\d{1,2}$/.test(next) && Number(next) < 100) {
        merged.push(`${cell}.${next}`);
        i++; // skip the centavos fragment
      } else {
        merged.push(cell);
      }
    }
    cells = merged.map((c) => c.trim()).filter((c) => c.length > 0);
    if (!cells.length) continue;

    // Skip header rows (keywords, few numbers).
    const hasKeyword = /descri|descri|item|equip|produt|servi|quantidade|qtd|unidade|unidade|unit[aá]rio|unitar|pre[çc]o|total|valor|c[uú]lqu[eê]|categoria|item de custo/i.test(rawLine);
    const numCount = cells.filter((c) => /\d/.test(c)).length;
    if (hasKeyword && numCount <= 2) continue;

    // Parse each cell into a number if it's a money/number token.
    type Cell = { text: string; value: number | null; index: number };
    const parsed: Cell[] = cells.map((cell, index) => {
      const cleaned = cell.replace(/^\$/, "").trim();
      const moneyMatch = cleaned.match(/R\$\s*([\d]{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?|\d+(?:\.\d{1,2})?)/);
      if (moneyMatch) {
        const value = Number(moneyMatch[1].replace(/\./g, "").replace(",", "."));
        return { text: cell, value: Number.isFinite(value) && value > 0 ? value : null, index };
      }
      const bareMatch = cleaned.match(/^(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?|\d+(?:\.\d{1,2})?)$/);
      if (bareMatch) {
        const value = Number(bareMatch[1].replace(/\./g, "").replace(",", "."));
        return { text: cell, value: Number.isFinite(value) && value > 0 ? value : null, index };
      }
      return { text: cell, value: null, index };
    });

    const numericCells = parsed.filter((c) => c.value !== null);
    if (!numericCells.length) continue;

    // Description = longest non-numeric text cell.
    const UNIT_WORDS = /^(un|und|und\.|pc|pc\.|cx|cx\.|vb|vb\.|m|m²|ponto|pontos|porta|portas|mes|m[eê]s|h|hora|horas|par|conj)$/i;
    const descCells = parsed.filter((c) => c.value === null && c.text.length > 1 && !UNIT_WORDS.test(c.text));
    const description = descCells.sort((a, b) => b.text.length - a.text.length)[0]?.text.trim() || "";
    if (description.length < 2) continue;

    const values = numericCells.map((c) => c.value as number);
    const last = values[values.length - 1];
    const first = values[0];

    let qty: number | null = null;
    let unitPrice = last;
    let total = last;

    if (values.length >= 2) {
      // Quantity = the smallest small integer (qty is usually a small number like 8, 12, 24).
      // We pick the smallest integer ≤ 100 that is not the total (last) and not the unit price.
      const smallInts = numericCells
        .filter((c) => Number.isInteger(c.value) && (c.value as number) >= 1 && (c.value as number) <= 100 && c.value !== last)
        .map((c) => c.value as number)
        .sort((a, b) => a - b);
      if (smallInts.length) qty = smallInts[0];

      if (qty && last > first && Math.abs(last - first * qty) < Math.max(1, last * 0.02)) {
        unitPrice = first;
        total = last;
      } else if (last > first && last / first >= 1.2 && qty) {
        unitPrice = last / qty;
        total = last;
      } else if (last > first && last / first >= 1.5) {
        unitPrice = first;
        total = last;
        qty = qty ?? Math.round(last / first);
      } else {
        unitPrice = last;
        total = last;
        qty = qty ?? 1;
      }
    } else {
      qty = 1;
      total = unitPrice;
    }

    if (total > 0) {
      items.push({
        description: description.slice(0, 180),
        qty: qty && qty > 0 ? qty : 1,
        unit: "un",
        unitPrice: Math.round(unitPrice * 100) / 100,
        total: Math.round(total * 100) / 100,
      });
    }
  }

  return items;
}

export async function extractAndParse(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<{ text: string; items: ParsedItem[]; source: "pdf" | "imagem" | "texto" | "csv" }> {
  const { text, source } = await extractTextFromFile(buffer, mimeType, fileName);
  const items = source === "csv" ? parseCsvQuote(text) : parseQuoteLines(text);
  return { text, items, source };
}
