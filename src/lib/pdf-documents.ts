import type { jsPDF } from "jspdf";
import { brl, fmtDate } from "@/lib/brand";
import { calcTotals, typeLabels } from "@/lib/proposal/catalog";
import { paymentRows, resolveValueBlock } from "@/lib/proposal/value-block";
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

const BODY_SIZE = 9.2;
const LINE_H = 5.0;

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
    pdf.setFontSize(9.6);
    pdf.setTextColor(...C.white);
    pdf.text(clip(pdf, text(this.opts.label).toUpperCase(), 98), W - M.right, 12.5, { align: "right" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.4);
    pdf.setTextColor(...C.silver);
    pdf.text(clip(pdf, this.opts.reference, 98), W - M.right, 16.9, { align: "right" });
    pdf.setFontSize(7.4);
    pdf.setTextColor(159, 178, 199);
    this.opts.meta.slice(0, 3).forEach((line, i) => {
      pdf.text(clip(pdf, line, 98), W - M.right, 21.8 + i * 4.1, { align: "right" });
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
    // Espaçamento externo entre seções: respiração antes do título.
    if (this.y > M.top + 1) this.y += 9;
    this.ensure(30);
    const y = this.y;
    this.setBody(10.6, true, C.dark);
    // Caixa alta como na prévia em tela, preservando acentuação.
    const label = clip(this.pdf, text(title).toUpperCase(), CONTENT - 19);
    this.pdf.setFillColor(...C.band);
    this.pdf.roundedRect(M.left, y - 4.6, 10.4, 6.8, 1, 1, "F");
    this.pdf.setFont("courier", "bold");
    this.pdf.setFontSize(8);
    this.pdf.setTextColor(...C.signal);
    this.pdf.text(text(index), M.left + 5.2, y - 0.3, { align: "center" });
    this.setBody(10.6, true, C.dark);
    this.pdf.text(label, M.left + 14, y);
    const titleWidth = this.pdf.getTextWidth(label);
    this.pdf.setDrawColor(...C.rule);
    this.pdf.setLineWidth(0.35);
    this.pdf.line(M.left + 14 + titleWidth + 4, y - 1.6, W - M.right, y - 1.6);
    this.y = y + 9;
  }

  sectionTitle(value: string) {
    if (this.y > M.top + 1) this.y += 7;
    this.ensure(23);
    const y = this.y;
    this.setBody(9.8, true, C.dark);
    const label = clip(this.pdf, value, CONTENT - 4);
    this.pdf.text(label, M.left, y);
    this.pdf.setDrawColor(...C.rule);
    this.pdf.setLineWidth(0.35);
    this.pdf.line(M.left + this.pdf.getTextWidth(label) + 4, y - 1.5, W - M.right, y - 1.5);
    this.y = y + 7.4;
  }

  subheading(value: string) {
    this.y += 3;
    this.ensure(16);
    const y = this.y;
    this.pdf.setFillColor(...C.signal);
    this.pdf.rect(M.left, y - 3.4, 1.6, 4.8, "F");
    this.setBody(9.3, true, C.dark);
    this.pdf.text(clip(this.pdf, value, CONTENT - 8), M.left + 4.5, y);
    this.y = y + 6.6;
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
    this.y += options.gap ?? 3.6;
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
        this.space(2.6);
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
      const size = i === 0 ? 8.6 : 8.2;
      const bold = i === 0;
      const color: RGB = i === 0 ? C.dark : C.ink;
      this.setBody(size, bold, color);
      let parts = pdf.splitTextToSize(text(values[i]), maxWidth) as string[];
      if (parts.length > 2) parts = [parts[0], clip(pdf, parts.slice(1).join(" "), maxWidth - 3)];
      const lines: CellLine[] = parts.map((value) => ({ value, size, bold, color }));
      if (i === 0 && data.email) {
        // Mesma coluna do nome, como na prévia em tela — evita cruzar com o contato.
        this.setBody(7.8, false, C.steel);
        const emailLines = pdf.splitTextToSize(text(data.email), maxWidth) as string[];
        emailLines.slice(0, 2).forEach((value) => lines.push({ value, size: 7.8, bold: false, color: C.steel }));
      }
      columns.push(lines);
    });

    const maxLines = Math.max(2, ...columns.map((lines) => lines.length));
    const height = 9 + maxLines * 5.2 + 4;
    this.ensure(height + 4);
    const y = this.y;
    pdf.setFillColor(...C.pale);
    pdf.roundedRect(M.left, y, CONTENT, height, 1.2, 1.2, "F");
    let x = M.left + 5;
    widths.forEach((ratio, i) => {
      pdf.setFont("courier", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...C.steel);
      pdf.text(text(labels[i]), x, y + 5.8);
      columns[i].forEach((line, li) => {
        this.setBody(line.size, line.bold, line.color);
        pdf.text(line.value, x, y + 11.2 + li * 5.2);
      });
      if (i < 2) {
        pdf.setDrawColor(...C.rule);
        pdf.setLineWidth(0.3);
        pdf.line(x + CONTENT * ratio - 4, y + 3.5, x + CONTENT * ratio - 4, y + height - 3);
      }
      x += CONTENT * ratio;
    });
    this.y = y + height + 10;
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
      pdf.rect(M.left, y, CONTENT, 7.8, "F");
      pdf.setFont("courier", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...C.steel);
      let x = M.left;
      for (const col of columns) {
        const align = col.align ?? "left";
        const cellX = align === "right" ? x + col.width - 2.5 : align === "center" ? x + col.width / 2 : x + 2.5;
        pdf.text(clip(pdf, col.label.toUpperCase(), col.width - 5), cellX, y + 5.4, { align });
        x += col.width;
      }
      pdf.setDrawColor(...C.rule);
      pdf.setLineWidth(0.3);
      pdf.line(M.left, y + 7.8, W - M.right, y + 7.8);
      this.y = y + 7.8;
    };
    const ensureWithHeader = (height: number) => {
      if (this.y + height > CONTENT_BOTTOM) {
        this.newPage();
        paintTableHeader();
      }
    };
    paintTableHeader();
    for (const row of rows) {
      this.setBody(8.3);
      const wrapped = columns.map((col, i) => pdf.splitTextToSize(text(row[i] ?? ""), col.width - 5) as string[]);
      const count = Math.max(1, ...wrapped.map((lines) => lines.length));
      for (let li = 0; li < count; li++) {
        ensureWithHeader(LINE_H);
        const y = this.y;
        let x = M.left;
        columns.forEach((col, i) => {
          const align = col.align ?? "left";
          const cellX = align === "right" ? x + col.width - 2.5 : align === "center" ? x + col.width / 2 : x + 2.5;
          this.setBody(8.3);
          pdf.text(wrapped[i][li] ?? "", cellX, y + 3.9, { align });
          x += col.width;
        });
        this.y += 4.4;
      }
      ensureWithHeader(3);
      const bottom = this.y + 2.2;
      pdf.setDrawColor(...C.rule);
      pdf.setLineWidth(0.25);
      pdf.line(M.left, bottom, W - M.right, bottom);
      this.y = bottom + 1.6;
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
        this.setBody(8.3, true, C.dark);
        pdf.text(clip(pdf, footer[i] ?? "", col.width - 5), cellX, y + 5.6, { align });
        x += col.width;
      });
      this.y = y + 9.6;
    }
  }

  /** Condições comerciais: uma faixa por linha, com altura calculada e sem duplicar o texto. */
  terms(rows: [string, string][]) {
    const pdf = this.pdf;
    for (const [label, value] of rows) {
      this.setBody(8.5);
      const lines = pdf.splitTextToSize(text(value || "—"), CONTENT - 54) as string[];
      const height = Math.max(9.6, lines.length * 4.6 + 4.6);
      this.ensure(height + 2);
      const y = this.y;
      pdf.setFillColor(...C.pale);
      pdf.roundedRect(M.left, y, CONTENT, height, 1, 1, "F");
      pdf.setFont("courier", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...C.steel);
      pdf.text(clip(pdf, label.toUpperCase(), 43), M.left + 4, y + 5.8);
      this.setBody(8.5);
      lines.forEach((line, i) => pdf.text(line, M.left + 52, y + 5.8 + i * 4.6));
      pdf.setDrawColor(...C.rule);
      pdf.setLineWidth(0.25);
      pdf.line(M.left, y + height, W - M.right, y + height);
      this.y = y + height + 2.2;
    }
    this.space(3);
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
    pdf.setFontSize(18);
    pdf.setTextColor(0, 229, 255);
    pdf.text(clip(pdf, data.primaryValue, 100), M.left + 6, y + 17.5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.4);
    pdf.setTextColor(...C.silver);
    const noteLines = pdf.splitTextToSize(text(data.primaryNote), 96) as string[];
    noteLines.slice(0, 2).forEach((line, i) => pdf.text(clip(pdf, line, 96), M.left + 6, y + 24 + i * 4));
    let rowY = y + 8;
    for (const [label, value] of data.rows) {
      pdf.setFont("courier", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...C.steel);
      pdf.text(clip(pdf, label.toUpperCase(), 55), M.left + 110, rowY);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.8);
      pdf.setTextColor(...C.white);
      pdf.text(clip(pdf, value, 62), W - M.right - 6, rowY, { align: "right" });
      rowY += 7.4;
    }
    this.y = y + 34;
  }

  signatures(left: string, right: string) {
    const pdf = this.pdf;
    this.ensure(46);
    const y = this.y + 10;
    const width = (CONTENT - 12) / 2;
    pdf.setDrawColor(...C.dark);
    pdf.setLineWidth(0.35);
    pdf.line(M.left, y, M.left + width, y);
    pdf.line(M.left + width + 12, y, W - M.right, y);
    this.setBody(8.2, false, C.steel);
    pdf.text(clip(pdf, left, width), M.left, y + 5.4);
    pdf.text(clip(pdf, right, width), M.left + width + 12, y + 5.4);
    this.y = y + 15;
  }

  seal(tags: string[]) {
    if (!tags.length) return;
    if (this.y > M.top + 1) this.y += 8;
    this.ensure(16);
    const pdf = this.pdf;
    pdf.setFont("courier", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...C.steel);
    pdf.text(clip(pdf, tags.join("  |  "), CONTENT), M.left, this.y);
    this.y += 8;
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
      pdf.setFontSize(7.2);
      pdf.setTextColor(...C.dark);
      pdf.text(clip(pdf, this.opts.footerLeft, 62), leftX, row1);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.6);
      pdf.setTextColor(...C.steel);
      pdf.text(clip(pdf, this.opts.footerLeft2, 62), leftX, row2);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.6);
      pdf.setTextColor(...C.dark);
      pdf.text(clip(pdf, this.opts.footerCenter, 62), centerX, row1);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.6);
      pdf.setTextColor(...C.steel);
      pdf.text(clip(pdf, this.opts.footerNote, 62), centerX, row2);

      pdf.setFont("courier", "bold");
      pdf.setFontSize(7.6);
      pdf.setTextColor(...C.dark);
      pdf.text(clip(pdf, `PÁGINA ${page} DE ${total}`, 40), rightX, row1, { align: "right" });
      pdf.setFont("courier", "normal");
      pdf.setFontSize(6.3);
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
  const maintenance = isMaintenanceProposal(doc.briefing);
  const monthly = maintenanceSummary(doc.items, doc.discountPct, doc.briefing);
  const valueBlock = resolveValueBlock({
    briefing: doc.briefing,
    maintenance,
    itemCount: doc.items.length,
    discountPct: doc.discountPct,
    months: monthly.months,
  });
  const totals = calcTotals(doc.items, doc.discountPct, valueBlock.installments);
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
          [`Subtotal · ${group.label}`, "", "", "", brl(subtotal)],
        );
      }
    }

    if (section.kind === "totals") {
      sheet.totals({
        primaryLabel: valueBlock.primaryLabel,
        primaryValue: `${brl((maintenance ? monthly.monthlyCents : totals.totalCents) / 100)}${maintenance ? " / mês" : ""}`,
        primaryNote: valueBlock.primaryNote,
        rows: [
          [valueBlock.subtotalLabel, brl(totals.subtotalCents / 100)],
          [valueBlock.discountLabel, `− ${brl(totals.offCents / 100)}`],
          [
            maintenance ? valueBlock.installmentLabel : `${valueBlock.installments}× ${valueBlock.installmentLabel}`,
            brl((maintenance ? totals.totalCents : totals.installmentCents) / 100),
          ],
        ],
      });
      if (!maintenance) {
        sheet.subheading(valueBlock.paymentTitle.toUpperCase());
        sheet.terms(paymentRows(valueBlock, totals.totalCents));
      }
    }

    if (section.id === "aceite") {
      sheet.signatures(`${settings.legalName}  |  ${settings.director}`, `${doc.clientName}  |  Responsável pelo aceite`);
    }
    sheet.space(4.5);
  });

  sheet.seal(["CFTV IP", "CONTROLE DE ACESSO", "CERCA ELÉTRICA", "REDES ESTRUTURADAS", "LGPD"]);
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

export type PdfDeliveryTermData = {
  termNumber: string;
  proposalNumber: string | null;
  clientName: string;
  site: string | null;
  deliveryDate: string | Date | null;
  technician: string;
  receiverName: string;
  receiverDoc: string;
  items: { id: string; desc: string; spec: string; unit: string; qty: number; checked: boolean; serial: string; obs: string }[];
  intro: string;
  scopeSummary: string;
  tests: string;
  pendencies: string;
  warranty: string;
  observations: string;
};

export function renderDeliveryTermPdf(pdf: jsPDF, doc: PdfDeliveryTermData, settings: PdfSettings, logo: string | null) {
  pdf.setProperties({
    title: `${doc.termNumber} · ${doc.clientName}`,
    subject: "Termo de entrega e comissionamento",
    author: settings.legalName,
    creator: "Cipriano Doc Engine 3.0",
    keywords: "termo de entrega, comissionamento, segurança eletrônica, Cipriano",
  });
  const sheet = new A4Sheet(
    pdf,
    {
      label: "Termo de entrega",
      reference: `${doc.termNumber}${doc.proposalNumber ? `  |  REF. ${doc.proposalNumber}` : ""}`,
      meta: [`ENTREGA  ${fmtDate(doc.deliveryDate)}`, `CLIENTE  ${doc.clientName}`, settings.crea],
      footerLeft: settings.legalName,
      footerLeft2: `CNPJ ${settings.cnpj}  |  ${settings.phone}`,
      footerCenter: `${doc.termNumber}  |  ${doc.clientName}`,
      footerNote: `${settings.site}  |  ${settings.email}`,
    },
    logo,
  );

  sheet.clientStrip({
    name: doc.clientName,
    contact: doc.receiverName || "-",
    email: doc.receiverDoc || "",
    site: doc.site || "A confirmar",
  });

  sheet.heading("01", "Identificação da entrega");
  if (doc.intro.trim()) sheet.richText(doc.intro);
  sheet.terms([
    ["Responsável técnico", doc.technician || "—"],
    ["Data da entrega", fmtDate(doc.deliveryDate)],
    ["Proposta de origem", doc.proposalNumber || "—"],
  ]);

  sheet.heading("02", "Escopo entregue");
  if (doc.scopeSummary.trim()) sheet.richText(doc.scopeSummary);
  if (doc.items.length) {
    const checked = doc.items.filter((i) => i.checked).length;
    sheet.subheading(`CHECKLIST DE ENTREGA · ${checked}/${doc.items.length} CONFERIDOS`);
    sheet.table(
      [
        { label: "OK", width: 12, align: "center" },
        { label: "Item entregue", width: 76 },
        { label: "Un.", width: 14, align: "center" },
        { label: "Qtd.", width: 16, align: "right" },
        { label: "Série / observação", width: 58 },
      ],
      doc.items.map((item) => [
        item.checked ? "[X]" : "[ ]",
        `${item.desc}${item.spec ? ` — ${item.spec}` : ""}`,
        item.unit,
        String(item.qty),
        [item.serial, item.obs].filter(Boolean).join(" · ") || "—",
      ]),
    );
  }

  sheet.heading("03", "Testes executados");
  if (doc.tests.trim()) sheet.richText(doc.tests);
  else sheet.paragraph("Testes de funcionamento executados e aprovados em campo.");

  sheet.heading("04", "Pendências");
  if (doc.pendencies.trim()) sheet.richText(doc.pendencies);

  sheet.heading("05", "Garantia");
  if (doc.warranty.trim()) sheet.richText(doc.warranty);

  sheet.heading("06", "Observações e aceite");
  if (doc.observations.trim()) sheet.richText(doc.observations);
  sheet.signatures(
    `${settings.legalName}  |  ${doc.technician || settings.director}`,
    `${doc.clientName}  |  ${doc.receiverName || "Responsável pelo recebimento"}`,
  );

  sheet.seal(["CFTV IP", "CONTROLE DE ACESSO", "CERCA ELÉTRICA", "REDES ESTRUTURADAS", "LGPD"]);
  sheet.finalize();
}

export type PdfServiceOrderData = {
  number: string;
  kind: string;
  status: string;
  priority: string;
  clientName: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  site: string | null;
  description: string;
  diagnosis: string;
  solution: string;
  technician: string;
  scheduledAt: string | Date | null;
  startedAt: string | Date | null;
  finishedAt: string | Date | null;
  laborCents: number;
  items: { id: string; desc: string; spec: string; unit: string; qty: number; priceCents: number; billable: boolean; checked: boolean; obs: string }[];
  notes: string;
  clientSignature: string;
  originProposalNumber: string | null;
  budgetProposalNumber: string | null;
};

const SO_KIND: Record<string, string> = {
  instalacao: "Instalação",
  preventiva: "Preventiva",
  corretiva: "Corretiva",
  vistoria: "Vistoria",
  orcamento: "Orçamento",
};

const SO_STATUS: Record<string, string> = {
  aberta: "Aberta",
  agendada: "Agendada",
  em_execucao: "Em execução",
  aguardando_orcamento: "Aguardando orçamento",
  aguardando_aprovacao: "Aguardando aprovação",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export function renderServiceOrderPdf(pdf: jsPDF, os: PdfServiceOrderData, settings: PdfSettings, logo: string | null) {
  const partsCents = os.items
    .filter((i) => i.billable !== false)
    .reduce((sum, i) => sum + Math.max(0, i.priceCents) * Math.max(0, i.qty), 0);
  const totalCents = partsCents + Math.max(0, os.laborCents);

  pdf.setProperties({
    title: `${os.number} · ${os.clientName}`,
    subject: "Ordem de serviço",
    author: settings.legalName,
    creator: "Cipriano Doc Engine 3.0",
    keywords: "ordem de serviço, OS, manutenção, segurança eletrônica, Cipriano",
  });

  const sheet = new A4Sheet(
    pdf,
    {
      label: "Ordem de serviço",
      reference: `${os.number}  |  ${SO_KIND[os.kind] ?? os.kind}`,
      meta: [
        `STATUS  ${(SO_STATUS[os.status] ?? os.status).toUpperCase()}`,
        `AGENDA  ${fmtDate(os.scheduledAt)}`,
        settings.crea,
      ],
      footerLeft: settings.legalName,
      footerLeft2: `CNPJ ${settings.cnpj}  |  ${settings.phone}`,
      footerCenter: `${os.number}  |  ${os.clientName}`,
      footerNote: `${settings.site}  |  ${settings.email}`,
    },
    logo,
  );

  sheet.clientStrip({
    name: os.clientName,
    contact: os.technician || "-",
    email: os.phone || os.email || "",
    site: os.site || "A confirmar",
  });

  sheet.heading("01", "Solicitação");
  if (os.description.trim()) sheet.richText(os.description);
  sheet.terms([
    ["Tipo", SO_KIND[os.kind] ?? os.kind],
    ["Agendada", os.scheduledAt ? fmtDate(os.scheduledAt) : "a agendar"],
    ["Início / conclusão", `${os.startedAt ? fmtDate(os.startedAt) : "—"} · ${os.finishedAt ? fmtDate(os.finishedAt) : "em aberto"}`],
    ["Proposta de origem", os.originProposalNumber || "—"],
  ]);

  sheet.heading("02", "Diagnóstico e solução");
  sheet.subheading("DIAGNÓSTICO TÉCNICO");
  sheet.paragraph(os.diagnosis.trim() || "A preencher pelo técnico.");
  sheet.subheading("SOLUÇÃO EXECUTADA / PROPOSTA");
  sheet.paragraph(os.solution.trim() || "A preencher pelo técnico.");

  sheet.heading("03", "Peças, materiais e serviços");
  if (os.items.length) {
    const checked = os.items.filter((i) => i.checked).length;
    sheet.subheading(`CHECKLIST · ${checked}/${os.items.length} CONFERIDOS`);
    sheet.table(
      [
        { label: "OK", width: 12, align: "center" },
        { label: "Descrição", width: 76 },
        { label: "Un.", width: 13, align: "center" },
        { label: "Qtd.", width: 14, align: "right" },
        { label: "Unitário", width: 28, align: "right" },
        { label: "Total", width: 33, align: "right" },
      ],
      os.items.map((item) => [
        item.checked ? "[X]" : "[ ]",
        `${item.desc}${item.spec ? ` — ${item.spec}` : ""}${item.billable === false ? " (conferência)" : ""}`,
        item.unit,
        String(item.qty),
        brl(item.priceCents / 100),
        item.billable === false ? "—" : brl((item.priceCents * item.qty) / 100),
      ]),
      ["", "Peças e materiais", "", "", "", brl(partsCents / 100)],
    );
  } else {
    sheet.paragraph("Sem peças registradas. Serviço de mão de obra ou diagnóstico.");
  }
  sheet.terms([
    ["Mão de obra", brl(os.laborCents / 100)],
    ["Total da OS", brl(totalCents / 100)],
    ...(os.budgetProposalNumber ? ([["Orçamento vinculado", os.budgetProposalNumber]] as [string, string][]) : []),
  ]);

  sheet.heading("04", "Observações");
  sheet.paragraph(os.notes.trim() || "Sem observações.");

  sheet.heading("05", "Encerramento");
  sheet.paragraph(
    "Declaro que o serviço descrito nesta ordem foi executado e conferido, com os itens acima testados na presença do responsável do cliente. Peças e serviços não previstos dependem de orçamento complementar aprovado.",
  );
  sheet.signatures(
    `${settings.legalName}  |  ${os.technician || settings.director}`,
    `${os.clientName}  |  ${os.clientSignature || "Responsável pelo recebimento"}`,
  );

  sheet.seal(["CFTV IP", "CONTROLE DE ACESSO", "CERCA ELÉTRICA", "REDES ESTRUTURADAS", "LGPD"]);
  sheet.finalize();
}
