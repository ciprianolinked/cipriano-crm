import type { jsPDF } from "jspdf";
import { brl, fmtDate } from "@/lib/brand";
import { calcTotals, typeLabels } from "@/lib/proposal/catalog";
import { isMaintenanceProposal, maintenanceSummary } from "@/lib/proposal/maintenance-plan";
import type { ProposalItem, ProposalSection, ProposalType } from "@/lib/proposal/types";

/** Normaliza para NFC e troca apenas glifos fora do conjunto das fontes padrão do PDF. */
export const pdfSafe = (value: string) =>
  String(value ?? "")
    .normalize("NFC")
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u2022\u25AA\u25CF\u25B8]/g, "-")
    .replace(/\u00A0/g, " ");

const text = (value: unknown) => pdfSafe(String(value ?? ""));

/** Limita um texto à largura disponível, preservando acentos e evitando sobreposição entre colunas. */
function clip(pdf: jsPDF, value: unknown, maxWidth: number): string {
  const valueText = text(value);
  if (pdf.getTextWidth(valueText) <= maxWidth) return valueText;
  let result = valueText;
  while (result.length > 1 && pdf.getTextWidth(`${result}...`) > maxWidth) result = result.slice(0, -1);
  return `${result.trimEnd()}...`;
}

export type PdfSettings = {
  companyName: string;
  legalName: string;
  tagline: string;
  director: string;
  role: string;
  phone: string;
  landline: string;
  email: string;
  site: string;
  address: string;
  cnpj: string;
  crea: string;
  hours: string;
};

export type PdfProposalData = {
  number: string;
  type: string;
  clientName: string;
  contact: string | null;
  clientEmail: string | null;
  site: string | null;
  issuedAt: string | Date;
  validityDays: number;
  discountPct: number;
  items: ProposalItem[];
  sections: ProposalSection[];
  paymentTerms: string | null;
  deliveryTime: string | null;
  warranty: string | null;
  artIncluded: boolean;
  briefing?: Record<string, unknown> | null;
};

const W = 210;
const H = 297;
const HEADER_H = 33;
const M = { left: 17, right: 17, top: 40, bottom: 25 };
const CONTENT = W - M.left - M.right;
const CONTENT_BOTTOM = H - M.bottom; // 272 mm: limite máximo do corpo
const FOOTER_TOP = H - 22; // 275 mm: início da faixa do rodapé

type RGB = [number, number, number];
const C = {
  navy: [10, 25, 47] as RGB,
  ink: [51, 70, 94] as RGB,
  dark: [10, 25, 47] as RGB,
  steel: [125, 147, 173] as RGB,
  silver: [198, 210, 224] as RGB,
  rule: [220, 228, 238] as RGB,
  signal: [0, 168, 189] as RGB,
  pale: [242, 247, 252] as RGB,
  band: [232, 245, 249] as RGB,
  white: [255, 255, 255] as RGB,
};

export type SheetOptions = {
  label: string;
  reference: string;
  meta: string[];
  footerLeft: string;
  footerLeft2: string;
  footerCenter: string;
  footerNote: string;
};

const BODY_SIZE = 8.3;
const LINE_H = 4.3;

/** Folha A4: cabeçalho repetido, conteúdo paginado por linha e rodapé com colunas limitadas. */
export class A4Sheet {
  private y = M.top;

  constructor(private pdf: jsPDF, private opts: SheetOptions, private logo: string | null) {
    this.paintHeader();
  }

  private paintHeader() {
    const { pdf } = this;
    pdf.setFillColor(...C.navy);
    pdf.rect(0, 0, W, HEADER_H, "F");
    if (this.logo) {
      try {
        pdf.addImage(this.logo, "PNG", M.left, 7, 54, 13.5);
      } catch {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor(...C.white);
        pdf.text("CIPRIANO TECH & SECURITY", M.left, 14);
      }
    } else {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(...C.white);
      pdf.text("CIPRIANO TECH & SECURITY", M.left, 14);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...C.silver);
      pdf.text(text("SEGURANÇA ELETRÔNICA IP"), M.left, 18.6);
    }
    // Bloco direito em caixa alta, com acentuação preservada e espaço para as três linhas de meta.
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.8);
    pdf.setTextColor(...C.white);
    pdf.text(clip(pdf, text(this.opts.label).toUpperCase(), 98), W - M.right, 12, { align: "right" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...C.silver);
    pdf.text(clip(pdf, this.opts.reference, 98), W - M.right, 16.6, { align: "right" });
    pdf.setFontSize(6.6);
    pdf.setTextColor(159, 178, 199);
    this.opts.meta.slice(0, 3).forEach((line, i) => {
      pdf.text(clip(pdf, line, 98), W - M.right, 21.2 + i * 3.4, { align: "right" });
    });
    // Última linha em 28 mm; faixa navy até 33 mm — nenhuma linha é cortada pela filete ciano.
    pdf.setDrawColor(0, 198, 222);
    pdf.setLineWidth(1.2);
    pdf.line(0, HEADER_H, W, HEADER_H);
    pdf.setLineWidth(0.3);
  }

  private newPage() {
    this.pdf.addPage();
    this.paintHeader();
    this.y = M.top;
  }

  private ensure(height: number) {
    if (this.y + height > CONTENT_BOTTOM) this.newPage();
  }

  get cursor() {
    return this.y;
  }

  space(amount = 3) {
    this.ensure(amount);
    this.y += amount;
  }

  private setBody(size = BODY_SIZE, bold = false, color: RGB = C.ink) {
    this.pdf.setFont("helvetica", bold ? "bold" : "normal");
    this.pdf.setFontSize(size);
    this.pdf.setTextColor(...color);
  }

  /** Título numerado, com o texto original e acentuação preservada. */
  heading(index: string, title: string) {
    this.ensure(14);
    const y = this.y;
    this.setBody(9.2, true, C.dark);
    // Caixa alta como na prévia em tela, preservando acentuação.
    const label = clip(this.pdf, text(title).toUpperCase(), CONTENT - 17);
    this.pdf.setFillColor(...C.band);
    this.pdf.roundedRect(M.left, y - 3.9, 9.2, 5.4, 1, 1, "F");
    this.pdf.setFont("courier", "bold");
    this.pdf.setFontSize(6.8);
    this.pdf.setTextColor(...C.signal);
    this.pdf.text(text(index), M.left + 4.6, y - 0.2, { align: "center" });
    this.setBody(9.2, true, C.dark);
    this.pdf.text(label, M.left + 12.5, y);
    const titleWidth = this.pdf.getTextWidth(label);
    this.pdf.setDrawColor(...C.rule);
    this.pdf.setLineWidth(0.35);
    this.pdf.line(M.left + 12.5 + titleWidth + 4, y - 1.5, W - M.right, y - 1.5);
    this.y = y + 6.4;
  }

  sectionTitle(value: string) {
    this.ensure(12);
    const y = this.y;
    this.setBody(9, true, C.dark);
    const label = clip(this.pdf, value, CONTENT - 4);
    this.pdf.text(label, M.left, y);
    this.pdf.setDrawColor(...C.rule);
    this.pdf.setLineWidth(0.35);
    this.pdf.line(M.left + this.pdf.getTextWidth(label) + 4, y - 1.5, W - M.right, y - 1.5);
    this.y = y + 5.8;
  }

  subheading(value: string) {
    this.ensure(9);
    const y = this.y;
    this.pdf.setFillColor(...C.signal);
    this.pdf.rect(M.left, y - 3.1, 1.3, 4, "F");
    this.setBody(8.2, true, C.dark);
    this.pdf.text(clip(this.pdf, value, CONTENT - 8), M.left + 4, y);
    this.y = y + 5.4;
  }

  paragraph(value: string, options: { indent?: number; size?: number; bold?: boolean; color?: RGB; gap?: number } = {}) {
    const size = options.size ?? BODY_SIZE;
    const lh = size * 0.3528 * 1.55;
    const indent = options.indent ?? 0;
    this.setBody(size, options.bold, options.color ?? C.ink);
    // A fonte é definida ANTES de medir a quebra de linha.
    const lines = this.pdf.splitTextToSize(text(value), CONTENT - indent) as string[];
    if (!lines.length) return;
    this.ensure(Math.min(lines.length, 2) * lh + 1);
    for (const line of lines) {
      this.ensure(lh);
      this.setBody(size, options.bold, options.color ?? C.ink);
      this.pdf.text(line, M.left + indent, this.y);
      this.y += lh;
    }
    this.y += options.gap ?? 1.5;
  }

  bullets(items: string[]) {
    for (const item of items) {
      // A métrica da quebra precisa usar a mesma fonte usada no desenho.
      this.setBody(BODY_SIZE);
      const lines = this.pdf.splitTextToSize(text(item), CONTENT - 9) as string[];
      if (!lines.length) continue;
      this.ensure(Math.min(lines.length, 2) * LINE_H + 1);
      for (let i = 0; i < lines.length; i++) {
        this.ensure(LINE_H);
        this.setBody(BODY_SIZE);
        if (i === 0) {
          this.pdf.setFillColor(...C.signal);
          this.pdf.rect(M.left + 0.8, this.y - 1.6, 1.4, 1.4, "F");
        }
        this.pdf.text(lines[i], M.left + 6.5, this.y);
        this.y += LINE_H;
      }
      this.y += 0.8;
    }
    this.y += 1;
  }

  richText(value: string) {
    for (const raw of text(value).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) {
        this.space(2.1);
        continue;
      }
      const bullet = /^[-•]\s+/.test(line);
      if (bullet) {
        this.bullets([line.replace(/^[-•]\s+/, "")]);
        continue;
      }
      if (line === line.toUpperCase() && line.length <= 70 && /[A-ZÀ-Ý]/.test(line) && !line.includes(":")) {
        this.subheading(line);
        continue;
      }
      this.paragraph(line);
    }
  }

  /** Faixa de cliente: altura dinâmica, e-mail abaixo do nome (como na prévia) e estilos por linha. */
  clientStrip(data: { name: string; contact: string; email: string; site: string }) {
    const pdf = this.pdf;
    const widths = [0.36, 0.3, 0.34];
    const labels = ["CLIENTE", "CONTATO", "LOCAL"];
    const values = [data.name || "-", data.contact || "-", data.site || "A confirmar"];
    type CellLine = { value: string; size: number; bold: boolean; color: RGB };
    const columns: CellLine[][] = [];

    widths.forEach((ratio, i) => {
      const maxWidth = CONTENT * ratio - 9;
      const size = i === 0 ? 7.6 : 7.1;
      const bold = i === 0;
      const color: RGB = i === 0 ? C.dark : C.ink;
      this.setBody(size, bold, color);
      let parts = pdf.splitTextToSize(text(values[i]), maxWidth) as string[];
      if (parts.length > 2) parts = [parts[0], clip(pdf, parts.slice(1).join(" "), maxWidth - 3)];
      const lines: CellLine[] = parts.map((value) => ({ value, size, bold, color }));
      if (i === 0 && data.email) {
        // Mesma coluna do nome, como na prévia em tela — evita cruzar com o contato.
        this.setBody(6.8, false, C.steel);
        const emailLines = pdf.splitTextToSize(text(data.email), maxWidth) as string[];
        emailLines.slice(0, 2).forEach((value) => lines.push({ value, size: 6.8, bold: false, color: C.steel }));
      }
      columns.push(lines);
    });

    const maxLines = Math.max(2, ...columns.map((lines) => lines.length));
    const height = 8 + maxLines * 4 + 3;
    this.ensure(height + 4);
    const y = this.y;
    pdf.setFillColor(...C.pale);
    pdf.roundedRect(M.left, y, CONTENT, height, 1.2, 1.2, "F");
    let x = M.left + 5;
    widths.forEach((ratio, i) => {
      pdf.setFont("courier", "normal");
      pdf.setFontSize(5.9);
      pdf.setTextColor(...C.steel);
      pdf.text(text(labels[i]), x, y + 5.5);
      columns[i].forEach((line, li) => {
        this.setBody(line.size, line.bold, line.color);
        pdf.text(line.value, x, y + 10.4 + li * 4);
      });
      if (i < 2) {
        pdf.setDrawColor(...C.rule);
        pdf.setLineWidth(0.3);
        pdf.line(x + CONTENT * ratio - 4, y + 3.5, x + CONTENT * ratio - 4, y + height - 3);
      }
      x += CONTENT * ratio;
    });
    this.y = y + height + 4;
  }

  table(
    columns: { label: string; width: number; align?: "left" | "right" | "center" }[],
    rows: string[][],
    footer?: string[],
  ) {
    const pdf = this.pdf;
    const paintTableHeader = () => {
      this.ensure(8);
      const y = this.y;
      pdf.setFillColor(...C.pale);
      pdf.rect(M.left, y, CONTENT, 6.4, "F");
      pdf.setFont("courier", "normal");
      pdf.setFontSize(5.8);
      pdf.setTextColor(...C.steel);
      let x = M.left;
      for (const col of columns) {
        const align = col.align ?? "left";
        const cellX = align === "right" ? x + col.width - 2.5 : align === "center" ? x + col.width / 2 : x + 2.5;
        pdf.text(clip(pdf, col.label.toUpperCase(), col.width - 5), cellX, y + 4.2, { align });
        x += col.width;
      }
      pdf.setDrawColor(...C.rule);
      pdf.setLineWidth(0.3);
      pdf.line(M.left, y + 6.4, W - M.right, y + 6.4);
      this.y = y + 6.4;
    };
    const ensureWithHeader = (height: number) => {
      if (this.y + height > CONTENT_BOTTOM) {
        this.newPage();
        paintTableHeader();
      }
    };
    paintTableHeader();
    for (const row of rows) {
      this.setBody(7.2);
      const wrapped = columns.map((col, i) => pdf.splitTextToSize(text(row[i] ?? ""), col.width - 5) as string[]);
      const count = Math.max(1, ...wrapped.map((lines) => lines.length));
      for (let li = 0; li < count; li++) {
        ensureWithHeader(LINE_H);
        const y = this.y;
        let x = M.left;
        columns.forEach((col, i) => {
          const align = col.align ?? "left";
          const cellX = align === "right" ? x + col.width - 2.5 : align === "center" ? x + col.width / 2 : x + 2.5;
          this.setBody(7.2);
          pdf.text(wrapped[i][li] ?? "", cellX, y + 3.1, { align });
          x += col.width;
        });
        this.y += 3.7;
      }
      ensureWithHeader(3);
      const bottom = this.y + 1.8;
      pdf.setDrawColor(...C.rule);
      pdf.setLineWidth(0.25);
      pdf.line(M.left, bottom, W - M.right, bottom);
      this.y = bottom + 1;
    }
    if (footer) {
      ensureWithHeader(9);
      const y = this.y;
      pdf.setDrawColor(...C.dark);
      pdf.setLineWidth(0.5);
      pdf.line(M.left, y, W - M.right, y);
      let x = M.left;
      columns.forEach((col, i) => {
        const align = col.align ?? "left";
        const cellX = align === "right" ? x + col.width - 2.5 : align === "center" ? x + col.width / 2 : x + 2.5;
        this.setBody(7.6, true, C.dark);
        pdf.text(clip(pdf, footer[i] ?? "", col.width - 5), cellX, y + 5, { align });
        x += col.width;
      });
      this.y = y + 8;
    }
  }

  /** Condições comerciais: uma faixa por linha, com altura calculada e sem duplicar o texto. */
  terms(rows: [string, string][]) {
    const pdf = this.pdf;
    for (const [label, value] of rows) {
      this.setBody(7.3);
      const lines = pdf.splitTextToSize(text(value || "—"), CONTENT - 54) as string[];
      const height = Math.max(7.6, lines.length * 3.7 + 3.8);
      this.ensure(height + 2);
      const y = this.y;
      pdf.setFillColor(...C.pale);
      pdf.roundedRect(M.left, y, CONTENT, height, 1, 1, "F");
      pdf.setFont("courier", "normal");
      pdf.setFontSize(5.9);
      pdf.setTextColor(...C.steel);
      pdf.text(clip(pdf, label.toUpperCase(), 43), M.left + 4, y + 5);
      this.setBody(7.3);
      lines.forEach((line, i) => pdf.text(line, M.left + 50, y + 5 + i * 3.7));
      pdf.setDrawColor(...C.rule);
      pdf.setLineWidth(0.25);
      pdf.line(M.left, y + height, W - M.right, y + height);
      this.y = y + height + 1.5;
    }
    this.space(2);
  }

  totals(data: { primaryLabel: string; primaryValue: string; primaryNote: string; rows: [string, string][] }) {
    const pdf = this.pdf;
    this.ensure(38);
    const y = this.y;
    pdf.setFillColor(...C.navy);
    pdf.roundedRect(M.left, y, CONTENT, 30, 1.2, 1.2, "F");
    pdf.setFont("courier", "normal");
    pdf.setFontSize(5.9);
    pdf.setTextColor(...C.steel);
    pdf.text(clip(pdf, data.primaryLabel.toUpperCase(), 92), M.left + 6, y + 7);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(0, 229, 255);
    pdf.text(clip(pdf, data.primaryValue, 100), M.left + 6, y + 17.5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.6);
    pdf.setTextColor(...C.silver);
    const noteLines = pdf.splitTextToSize(text(data.primaryNote), 96) as string[];
    noteLines.slice(0, 2).forEach((line, i) => pdf.text(clip(pdf, line, 96), M.left + 6, y + 23 + i * 3.2));
    let rowY = y + 8;
    for (const [label, value] of data.rows) {
      pdf.setFont("courier", "normal");
      pdf.setFontSize(5.9);
      pdf.setTextColor(...C.steel);
      pdf.text(clip(pdf, label.toUpperCase(), 55), M.left + 110, rowY);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(...C.white);
      pdf.text(clip(pdf, value, 62), W - M.right - 6, rowY, { align: "right" });
      rowY += 6.6;
    }
    this.y = y + 34;
  }

  signatures(left: string, right: string) {
    const pdf = this.pdf;
    this.ensure(26);
    const y = this.y + 7;
    const width = (CONTENT - 12) / 2;
    pdf.setDrawColor(...C.dark);
    pdf.setLineWidth(0.35);
    pdf.line(M.left, y, M.left + width, y);
    pdf.line(M.left + width + 12, y, W - M.right, y);
    this.setBody(6.8, false, C.steel);
    pdf.text(clip(pdf, left, width), M.left, y + 4.2);
    pdf.text(clip(pdf, right, width), M.left + width + 12, y + 4.2);
    this.y = y + 10;
  }

  seal(tags: string[]) {
    if (!tags.length) return;
    this.ensure(9);
    const pdf = this.pdf;
    pdf.setFont("courier", "normal");
    pdf.setFontSize(6);
    pdf.setTextColor(...C.steel);
    pdf.text(clip(pdf, tags.join("  |  "), CONTENT), M.left, this.y);
    this.y += 6;
  }

  /** Rodapé profissional em três colunas, com divisores, faixa de proteção e numeração. */
  finalize() {
    const pdf = this.pdf;
    const total = pdf.getNumberOfPages();
    const row1 = FOOTER_TOP + 6.5;
    const row2 = FOOTER_TOP + 11.5;
    const leftX = M.left;
    const centerX = M.left + 68;
    const rightX = W - M.right;
    for (let page = 1; page <= total; page++) {
      pdf.setPage(page);
      // Faixa clara cobre apenas o intervalo entre o limite do corpo e a página — não apaga texto.
      pdf.setFillColor(247, 250, 253);
      pdf.rect(0, FOOTER_TOP - 2, W, H - FOOTER_TOP + 2, "F");
      pdf.setDrawColor(...C.rule);
      pdf.setLineWidth(0.35);
      pdf.line(M.left, FOOTER_TOP, W - M.right, FOOTER_TOP);
      pdf.setDrawColor(...C.signal);
      pdf.setLineWidth(1.2);
      pdf.line(M.left, FOOTER_TOP, M.left + 17, FOOTER_TOP);
      // Divisores vertuais entre as três colunas.
      pdf.setDrawColor(...C.rule);
      pdf.setLineWidth(0.3);
      pdf.line(M.left + 64.5, FOOTER_TOP + 3.5, M.left + 64.5, FOOTER_TOP + 13.5);
      pdf.line(M.left + 132.5, FOOTER_TOP + 3.5, M.left + 132.5, FOOTER_TOP + 13.5);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.6);
      pdf.setTextColor(...C.dark);
      pdf.text(clip(pdf, this.opts.footerLeft, 62), leftX, row1);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.1);
      pdf.setTextColor(...C.steel);
      pdf.text(clip(pdf, this.opts.footerLeft2, 62), leftX, row2);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6);
      pdf.setTextColor(...C.dark);
      pdf.text(clip(pdf, this.opts.footerCenter, 62), centerX, row1);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6);
      pdf.setTextColor(...C.steel);
      pdf.text(clip(pdf, this.opts.footerNote, 62), centerX, row2);

      pdf.setFont("courier", "bold");
      pdf.setFontSize(6.8);
      pdf.setTextColor(...C.dark);
      pdf.text(clip(pdf, `PÁGINA ${page} DE ${total}`, 40), rightX, row1, { align: "right" });
      pdf.setFont("courier", "normal");
      pdf.setFontSize(5.6);
      pdf.setTextColor(...C.steel);
      pdf.text(clip(pdf, "DOC. GERADO ELETRONICAMENTE", 40), rightX, row2, { align: "right" });
    }
    pdf.setPage(1);
  }
}

export async function loadBrandLogo(): Promise<string | null> {
  try {
    const image = new Image();
    image.src = "/logo-cipriano.svg";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("logo"));
    });
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, 1024, 256);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

const shortTypes: Record<string, string> = {
  simples: "Proposta simples",
  completa: "Proposta completa",
  produtos_servicos: "Produtos e serviços",
};

/** Lê as condições da própria proposta, preservando rótulos e valores sem repetir o conteúdo. */
function conditionRows(section: ProposalSection, doc: PdfProposalData, maintenance: boolean): { intro: string[]; rows: [string, string][] } {
  const intro: string[] = [];
  const rows: [string, string][] = [];
  for (const raw of section.body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const clean = line.replace(/^[•\-–]\s*/, "").trim();
    const isBullet = /^[•\-–]\s*/.test(line);
    const separator = clean.indexOf(":");
    if (isBullet && separator > 0) {
      rows.push([clean.slice(0, separator).trim(), clean.slice(separator + 1).trim()]);
    } else if (isBullet) {
      rows.push(["", clean]);
    } else {
      intro.push(clean);
    }
  }
  if (!rows.length) {
    // Em manutenção, o corpo é um parágrafo de pagamento: consumi-lo evita repetir a mesma condição.
    const payment = intro.length ? intro.join(" ") : doc.paymentTerms || "A combinar";
    intro.length = 0;
    rows.push(
      ["Pagamento", payment],
      [maintenance ? "Serviços recorrentes" : "Execução", doc.deliveryTime || "A combinar"],
      ["Garantia", doc.warranty || "A combinar"],
      ["Validade", `${doc.validityDays} dias corridos a partir da emissão`],
    );
  }
  return { intro, rows };
}

export function renderProposalPdf(pdf: jsPDF, doc: PdfProposalData, settings: PdfSettings, logo: string | null) {
  const totals = calcTotals(doc.items, doc.discountPct);
  const maintenance = isMaintenanceProposal(doc.briefing);
  const monthly = maintenanceSummary(doc.items, doc.discountPct, doc.briefing);
  const label = maintenance ? "Proposta de manutenção mensal" : typeLabels[(doc.type as ProposalType) ?? "completa"] ?? "Proposta comercial";
  pdf.setProperties({
    title: `${doc.number} · ${doc.clientName}`,
    subject: label,
    author: settings.legalName,
    creator: "Cipriano Doc Engine 3.0",
    keywords: "proposta, segurança eletrônica, Cipriano, manutenção",
  });
  const sheet = new A4Sheet(
    pdf,
    {
      label,
      reference: `${doc.number}  |  ${shortTypes[doc.type] ?? doc.type}`,
      meta: [`EMISSÃO  ${fmtDate(doc.issuedAt)}`, `VALIDADE  ${doc.validityDays} DIAS`, settings.crea],
      footerLeft: settings.legalName,
      footerLeft2: `CNPJ ${settings.cnpj}  |  ${settings.phone}`,
      footerCenter: `${doc.number}  |  ${doc.clientName}`,
      footerNote: `${settings.site}  |  ${settings.email}`,
    },
    logo,
  );

  sheet.clientStrip({
    name: doc.clientName,
    contact: doc.contact || "-",
    email: doc.clientEmail || "",
    site: doc.site || "A confirmar",
  });

  const enabled = doc.sections.filter((section) => section.enabled);
  enabled.forEach((section, index) => {
    sheet.heading(String(index + 1).padStart(2, "0"), section.title);

    if (section.kind === "terms") {
      const { intro, rows } = conditionRows(section, doc, maintenance);
      intro.forEach((line) => sheet.paragraph(line));
      sheet.terms(rows);
    } else if (section.body?.trim()) {
      sheet.richText(section.body);
    }

    if (section.kind === "table" && section.rows?.length) {
      const columns = section.columns;
      sheet.table(
        [
          { label: columns?.[0] ?? "Frente de trabalho", width: 74 },
          { label: columns?.[1] ?? "Cipriano Tech & Security", width: 51 },
          { label: columns?.[2] ?? "Cliente", width: 51 },
        ],
        section.rows.map((row) => [row.label, row.cipriano, row.client]),
      );
    }

    if (section.kind === "items") {
      const hasScope = doc.items.some((item) => Boolean(item.scope));
      const scoped: { label: string; rows: ProposalItem[] }[] = [];
      if (hasScope) {
        for (const item of doc.items) {
          const label = item.scope?.trim() || "Itens Complementares";
          const existing = scoped.find((group) => group.label === label);
          if (existing) existing.rows.push(item);
          else scoped.push({ label, rows: [item] });
        }
      } else {
        scoped.push(
          { label: "EQUIPAMENTOS", rows: doc.items.filter((item) => item.kind === "equipamento") },
          { label: "SERVIÇOS", rows: doc.items.filter((item) => item.kind === "servico") },
        );
      }
      for (const group of scoped) {
        const rows = group.rows;
        if (!rows.length) continue;
        const subtotal = rows.reduce((sum, item) => sum + item.qty * item.price, 0);
        sheet.subheading(group.label);
        sheet.table(
          [
            { label: "Descrição / especificação", width: 78 },
            { label: "Un.", width: 14, align: "center" },
            { label: "Qtd.", width: 16, align: "right" },
            { label: "Unitário", width: 32, align: "right" },
            { label: "Total", width: 36, align: "right" },
          ],
          rows.map((item) => [`${item.desc}${item.spec ? ` — ${item.spec}` : ""}`, item.unit, String(item.qty), brl(item.price), brl(item.price * item.qty)]),
          ["", "", `Subtotal · ${group.label}`, "", brl(subtotal)],
        );
      }
    }

    if (section.kind === "totals") {
      sheet.totals({
        primaryLabel: maintenance ? "Mensalidade da manutenção" : "Investimento total",
        primaryValue: `${brl((maintenance ? monthly.monthlyCents : totals.totalCents) / 100)}${maintenance ? " / mês" : ""}`,
        primaryNote: maintenance
          ? `${monthly.months} meses de vigência estimada. Desconto comercial de ${doc.discountPct}% já aplicado.`
          : `${doc.items.length} itens. Desconto comercial de ${doc.discountPct}% já aplicado.`,
        rows: [
          ["Subtotal", brl(totals.subtotalCents / 100)],
          ["Desconto", `− ${brl(totals.offCents / 100)}`],
          [maintenance ? "Total do período" : "12× de", brl((maintenance ? totals.totalCents : totals.installmentCents) / 100)],
        ],
      });
    }

    if (section.id === "aceite") {
      sheet.signatures(`${settings.legalName}  |  ${settings.director}`, `${doc.clientName}  |  Responsável pelo aceite`);
    }
    sheet.space(4.2);
  });

  sheet.seal(["CFTV IP", "CONTROLE DE ACESSO", "CERCA ELÉTRICA", "MONITORAMENTO 24H", "LGPD"]);
  sheet.finalize();
}

export function renderContractPdf(
  pdf: jsPDF,
  input: {
    text: string;
    title: string;
    reference: string;
    clientName: string;
    revision: number;
    maintenance: boolean;
    settings: PdfSettings;
    logo?: string | null;
  },
) {
  pdf.setProperties({
    title: `${input.reference} · ${input.clientName}`,
    subject: input.title,
    author: input.settings.legalName,
    creator: "Cipriano Doc Engine 3.0",
    keywords: "contrato, manutenção, segurança eletrônica, Cipriano",
  });
  const sheet = new A4Sheet(
    pdf,
    {
      label: input.title,
      reference: `REV. ${String(input.revision).padStart(2, "0")}  |  ${input.reference}`,
      meta: [`CLIENTE  ${input.clientName}`, `EMISSÃO  ${fmtDate(new Date())}`, input.settings.crea],
      footerLeft: input.settings.legalName,
      footerLeft2: `CNPJ ${input.settings.cnpj}  |  ${input.settings.phone}`,
      footerCenter: `${input.reference}  |  ${input.clientName}`,
      footerNote: `${input.settings.site}  |  ${input.settings.email}`,
    },
    input.logo ?? null,
  );
  sheet.richText(input.text);
  sheet.finalize();
}
