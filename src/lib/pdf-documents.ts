import type { jsPDF } from "jspdf";
import { brl, fmtDate } from "@/lib/brand";
import { calcTotals, typeLabels } from "@/lib/proposal/catalog";
import { isMaintenanceProposal, maintenanceSummary } from "@/lib/proposal/maintenance-plan";
import type { ProposalItem, ProposalSection, ProposalType } from "@/lib/proposal/types";

/** jsPDF usa fontes WinAnsi: mantemos acentos e substituímos glifos fora do conjunto. */
export const pdfSafe = (value: string) =>
  String(value ?? "")
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u2022\u25AA\u25CF]/g, "-")
    .replace(/\u00A0/g, " ");

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
  revision?: number;
  briefing?: Record<string, unknown> | null;
};

const W = 210;
const H = 297;
const HEADER_HEIGHT = 35;
const M = { left: 17, right: 17, top: 43, bottom: 26 };
const CONTENT = W - M.left - M.right;
const FOOTER_TOP = 277;

type RGB = [number, number, number];
const C = {
  navy: [10, 25, 47] as RGB,
  ink: [51, 70, 94] as RGB,
  dark: [10, 25, 47] as RGB,
  steel: [125, 147, 173] as RGB,
  silver: [198, 210, 224] as RGB,
  rule: [220, 228, 238] as RGB,
  cyan: [0, 229, 255] as RGB,
  signal: [0, 168, 189] as RGB,
  pale: [244, 248, 252] as RGB,
  band: [232, 245, 249] as RGB,
  cardBg: [249, 251, 253] as RGB,
  cardBorder: [220, 228, 238] as RGB,
  white: [255, 255, 255] as RGB,
};

export type SheetOptions = {
  label: string;
  reference: string;
  meta: string[];
  footerCompany: string;
  footerAddress: string;
  footerContact: string;
  footerDocLabel: string;
  footerDocRef: string;
};

const LH = 4.3;

/** Folha A4 com cabeçalho repetido, paginação por linha e rodapé numerado sem sobreposições. */
export class A4Sheet {
  private y = M.top;

  constructor(private pdf: jsPDF, private opts: SheetOptions, private logo: string | null) {
    this.paintHeader();
  }

  /** Trunca texto em uma linha caso exceda a largura máxima permitida. */
  private fitLine(value: string, maxWidth: number): string {
    const text = pdfSafe(value).replace(/\s+/g, " ").trim();
    if (!text || this.pdf.getTextWidth(text) <= maxWidth) return text;
    const suffix = "...";
    let low = 0;
    let high = text.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (this.pdf.getTextWidth(text.slice(0, mid).trimEnd() + suffix) <= maxWidth) low = mid;
      else high = mid - 1;
    }
    return text.slice(0, low).trimEnd() + suffix;
  }

  /** Quebra respeitando a fonte atual e parte palavras longas se necessário. */
  private wrap(value: string, maxWidth: number): string[] {
    const text = pdfSafe(value).replace(/\t/g, " ");
    if (!text.trim()) return [];
    const initial = this.pdf.splitTextToSize(text, maxWidth) as string[];
    const lines: string[] = [];
    for (const initialLine of initial) {
      let rest = initialLine;
      while (rest && this.pdf.getTextWidth(rest) > maxWidth + 0.2) {
        let low = 1;
        let high = rest.length;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          if (this.pdf.getTextWidth(rest.slice(0, mid)) <= maxWidth) low = mid;
          else high = mid - 1;
        }
        lines.push(rest.slice(0, Math.max(1, low)));
        rest = rest.slice(Math.max(1, low));
      }
      if (rest) lines.push(rest);
    }
    return lines;
  }

  private limitLines(lines: string[], maxLines: number, maxWidth: number): string[] {
    if (lines.length <= maxLines) return lines;
    const limited = lines.slice(0, maxLines);
    limited[maxLines - 1] = this.fitLine(`${limited[maxLines - 1]} ${lines.slice(maxLines).join(" ")}`, maxWidth);
    return limited;
  }

  private paintHeader() {
    const { pdf } = this;
    pdf.setFillColor(...C.navy);
    pdf.rect(0, 0, W, HEADER_HEIGHT, "F");

    // Logo ou tipografia institucional à esquerda
    if (this.logo) {
      try {
        pdf.addImage(this.logo, "PNG", M.left, 8.5, 56, 14);
      } catch {
        pdf.setTextColor(...C.white);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.text("CIPRIANO TECH & SECURITY", M.left, 16);
      }
    } else {
      pdf.setTextColor(...C.white);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text("CIPRIANO TECH & SECURITY", M.left, 15);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.2);
      pdf.setTextColor(...C.cyan);
      pdf.text(pdfSafe("Seguranca eletronica IP"), M.left, 20.5);
    }

    // Metadados à direita com espaçamento vertical seguro (nenhum texto encosta na barra ciano)
    const rightWidth = 92;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.2);
    pdf.setTextColor(...C.cyan);
    pdf.text(this.fitLine(this.opts.label.toUpperCase(), rightWidth), W - M.right, 9.5, { align: "right" });

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    pdf.setTextColor(...C.white);
    pdf.text(this.fitLine(this.opts.reference, rightWidth), W - M.right, 14.8, { align: "right" });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.8);
    pdf.setTextColor(...C.silver);
    this.opts.meta.slice(0, 3).forEach((line, i) => {
      pdf.text(this.fitLine(line, rightWidth), W - M.right, 19.5 + i * 4.0, { align: "right" });
    });

    // Filete ciano inferior do cabeçalho
    pdf.setDrawColor(...C.cyan);
    pdf.setLineWidth(1.2);
    pdf.line(0, HEADER_HEIGHT, W, HEADER_HEIGHT);
  }

  private newPage() {
    this.pdf.addPage();
    this.paintHeader();
    this.y = M.top;
  }

  private ensure(height: number) {
    if (this.y + height > H - M.bottom) this.newPage();
  }

  get cursor() {
    return this.y;
  }

  space(amount = 3) {
    this.y += amount;
  }

  /** Título numerado com selo ciano e filete. Nunca quebra sozinho no fim da folha. */
  heading(index: string, title: string) {
    const label = pdfSafe(title.toUpperCase());
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(9.4);
    const lines = this.limitLines(this.wrap(label, CONTENT - 18), 2, CONTENT - 18);
    const height = lines.length * 4.5 + 2.5;
    this.ensure(height + 10);
    const y = this.y;

    this.pdf.setFillColor(...C.band);
    this.pdf.roundedRect(M.left, y - 3.9, 9.2, 5.4, 1, 1, "F");
    this.pdf.setFont("courier", "bold");
    this.pdf.setFontSize(6.8);
    this.pdf.setTextColor(...C.signal);
    this.pdf.text(pdfSafe(index), M.left + 4.6, y - 0.2, { align: "center" });

    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(9.4);
    this.pdf.setTextColor(...C.dark);
    lines.forEach((line, i) => this.pdf.text(line, M.left + 12.5, y + i * 4.5));

    const lastWidth = this.pdf.getTextWidth(lines[lines.length - 1] ?? "");
    const ruleX = M.left + 12.5 + lastWidth + 4;
    if (ruleX < W - M.right - 8) {
      this.pdf.setDrawColor(...C.rule);
      this.pdf.setLineWidth(0.35);
      this.pdf.line(ruleX, y + (lines.length - 1) * 4.5 - 1.5, W - M.right, y + (lines.length - 1) * 4.5 - 1.5);
    }
    this.y = y + height;
  }

  /** Título simples para seções de contrato. */
  sectionTitle(text: string) {
    const label = pdfSafe(text);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(9);
    const lines = this.limitLines(this.wrap(label, CONTENT), 2, CONTENT);
    const height = lines.length * 4.3 + 2;
    this.ensure(height + 10);
    const y = this.y;

    this.pdf.setTextColor(...C.dark);
    lines.forEach((line, i) => this.pdf.text(line, M.left, y + i * 4.3));

    const lastWidth = this.pdf.getTextWidth(lines[lines.length - 1] ?? "");
    if (M.left + lastWidth + 4 < W - M.right - 8) {
      this.pdf.setDrawColor(...C.rule);
      this.pdf.setLineWidth(0.35);
      this.pdf.line(M.left + lastWidth + 4, y + (lines.length - 1) * 4.3 - 1.5, W - M.right, y + (lines.length - 1) * 4.3 - 1.5);
    }
    this.y = y + height;
  }

  paragraph(text: string, options: { indent?: number; size?: number; bold?: boolean; color?: RGB; gap?: number } = {}) {
    const size = options.size ?? 8.5;
    const lh = size * 0.3528 * 1.55;
    const indent = options.indent ?? 0;
    this.pdf.setFont("helvetica", options.bold ? "bold" : "normal");
    this.pdf.setFontSize(size);
    this.pdf.setTextColor(...(options.color ?? C.ink));
    const lines = this.wrap(text, CONTENT - indent);
    if (lines.length === 0) return;
    this.ensure(Math.min(lines.length, 2) * lh + 1);
    for (const line of lines) {
      this.ensure(lh);
      this.pdf.text(line, M.left + indent, this.y);
      this.y += lh;
    }
    this.y += options.gap ?? 1.8;
  }

  bullets(items: string[]) {
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(8.5);
    this.pdf.setTextColor(...C.ink);
    for (const item of items) {
      const lines = this.wrap(item, CONTENT - 6);
      if (lines.length === 0) continue;
      this.ensure(Math.min(lines.length, 2) * LH + 1);
      for (let i = 0; i < lines.length; i++) {
        this.ensure(LH);
        if (i === 0) {
          this.pdf.setFillColor(...C.signal);
          this.pdf.rect(M.left + 0.6, this.y - 1.7, 1.4, 1.4, "F");
          this.pdf.setFont("helvetica", "normal");
          this.pdf.setFontSize(8.5);
          this.pdf.setTextColor(...C.ink);
        }
        this.pdf.text(lines[i], M.left + 6, this.y);
        this.y += LH;
      }
      this.y += 0.5;
    }
    this.y += 1.2;
  }

  /** Reproduz texto livre com bullets e títulos detectados. */
  richText(text: string) {
    for (const raw of pdfSafe(text).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) {
        this.y += 2.2;
        continue;
      }
      const bullet = /^[-•▸]\s+/.test(line) ? line.replace(/^[-•▸]\s+/, "") : null;
      if (bullet) {
        this.bullets([bullet]);
        continue;
      }
      if (line === line.toUpperCase() && line.length <= 92 && /[A-Z]/.test(line) && !/\d{2}\.\d{3}/.test(line)) {
        this.sectionTitle(line);
        continue;
      }
      this.paragraph(line);
    }
  }

  /**
   * Faixa de dados do cliente com altura 100% dinâmica.
   * O e-mail nunca sobrepõe o nome, e o endereço tem até 4 linhas sem corte.
   */
  clientStrip(data: { name: string; contact: string; email: string; site: string }) {
    const colWidths = [62, 48, 66];
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(8.0);
    const nameLines = this.limitLines(this.wrap(data.name || "-", colWidths[0] - 6), 3, colWidths[0] - 6);

    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(6.8);
    const emailLines = data.email ? this.limitLines(this.wrap(data.email, colWidths[0] - 6), 2, colWidths[0] - 6) : [];

    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(8.0);
    const contactLines = this.limitLines(this.wrap(data.contact || "-", colWidths[1] - 6), 3, colWidths[1] - 6);

    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(7.6);
    const siteLines = this.limitLines(this.wrap(data.site || "A confirmar", colWidths[2] - 6), 4, colWidths[2] - 6);

    const col1Count = nameLines.length + (emailLines.length ? emailLines.length + 0.3 : 0);
    const maxLines = Math.max(col1Count, contactLines.length, siteLines.length, 1.8);
    const stripHeight = Math.max(22, 10 + maxLines * 4.0 + 4);

    this.ensure(stripHeight + 5);
    const y = this.y;

    // Fundo e borda sutil
    this.pdf.setFillColor(...C.pale);
    this.pdf.roundedRect(M.left, y, CONTENT, stripHeight, 1.2, 1.2, "F");
    this.pdf.setDrawColor(...C.rule);
    this.pdf.setLineWidth(0.3);
    this.pdf.roundedRect(M.left, y, CONTENT, stripHeight, 1.2, 1.2, "S");

    // Coluna 1: CLIENTE
    const x1 = M.left + 5;
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(6.4);
    this.pdf.setTextColor(...C.steel);
    this.pdf.text("CLIENTE", x1, y + 5.6);

    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(8.0);
    this.pdf.setTextColor(...C.dark);
    nameLines.forEach((line, i) => this.pdf.text(line, x1, y + 10.2 + i * 4.0));

    if (emailLines.length) {
      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(6.8);
      this.pdf.setTextColor(90, 110, 136);
      const emailStartY = y + 10.2 + nameLines.length * 4.0 + 0.8;
      emailLines.forEach((line, i) => this.pdf.text(line, x1, emailStartY + i * 3.4));
    }

    // Divisor 1
    const div1X = M.left + colWidths[0];
    this.pdf.setDrawColor(...C.rule);
    this.pdf.setLineWidth(0.3);
    this.pdf.line(div1X, y + 3.2, div1X, y + stripHeight - 3.2);

    // Coluna 2: CONTATO
    const x2 = div1X + 5;
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(6.4);
    this.pdf.setTextColor(...C.steel);
    this.pdf.text("CONTATO", x2, y + 5.6);

    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(8.0);
    this.pdf.setTextColor(...C.ink);
    contactLines.forEach((line, i) => this.pdf.text(line, x2, y + 10.2 + i * 4.0));

    // Divisor 2
    const div2X = div1X + colWidths[1];
    this.pdf.line(div2X, y + 3.2, div2X, y + stripHeight - 3.2);

    // Coluna 3: LOCAL
    const x3 = div2X + 5;
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(6.4);
    this.pdf.setTextColor(...C.steel);
    this.pdf.text("LOCAL", x3, y + 5.6);

    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(7.6);
    this.pdf.setTextColor(...C.ink);
    siteLines.forEach((line, i) => this.pdf.text(line, x3, y + 10.2 + i * 3.8));

    this.y = y + stripHeight + 5;
  }

  table(
    columns: { label: string; width: number; align?: "left" | "right" | "center" }[],
    rows: string[][],
    footer?: string[],
  ) {
    const paintHeader = () => {
      const y = this.y;
      this.pdf.setFillColor(...C.pale);
      this.pdf.rect(M.left, y, CONTENT, 6.4, "F");
      this.pdf.setFont("helvetica", "bold");
      this.pdf.setFontSize(6.2);
      this.pdf.setTextColor(...C.steel);
      let x = M.left;
      for (const col of columns) {
        const align = col.align ?? "left";
        const cellX = align === "right" ? x + col.width - 2.5 : align === "center" ? x + col.width / 2 : x + 2.5;
        this.pdf.text(this.fitLine(col.label.toUpperCase(), col.width - 5), cellX, y + 4.3, { align });
        x += col.width;
      }
      this.pdf.setDrawColor(...C.rule);
      this.pdf.setLineWidth(0.35);
      this.pdf.line(M.left, y + 6.4, W - M.right, y + 6.4);
      this.y = y + 6.4;
    };

    const drawRowLines = (wrapped: string[][], start: number, count: number) => {
      const height = count * 3.8 + 3.2;
      const y = this.y;
      let x = M.left;
      columns.forEach((col, i) => {
        const align = col.align ?? "left";
        const cellX = align === "right" ? x + col.width - 2.5 : align === "center" ? x + col.width / 2 : x + 2.5;
        this.pdf.setFont("helvetica", "normal");
        this.pdf.setFontSize(7.4);
        this.pdf.setTextColor(...C.ink);
        wrapped[i].slice(start, start + count).forEach((line, li) => {
          this.pdf.text(line, cellX, y + 4.1 + li * 3.8, { align });
        });
        x += col.width;
      });
      this.pdf.setDrawColor(...C.rule);
      this.pdf.setLineWidth(0.25);
      this.pdf.line(M.left, y + height, W - M.right, y + height);
      this.y = y + height;
    };

    this.ensure(20);
    paintHeader();
    const usableHeight = H - M.bottom - M.top;
    for (const row of rows) {
      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(7.4);
      this.pdf.setTextColor(...C.ink);
      const wrapped = columns.map((col, i) => this.wrap(row[i] ?? "", col.width - 5));
      const lineCount = Math.max(1, ...wrapped.map((lines) => lines.length));
      const height = lineCount * 3.8 + 3.2;

      if (height > usableHeight - 6.4) {
        let start = 0;
        while (start < lineCount) {
          const availableLines = Math.floor((H - M.bottom - this.y - 3.2) / 3.8);
          if (availableLines < 1) {
            this.newPage();
            paintHeader();
            continue;
          }
          const count = Math.min(lineCount - start, availableLines);
          drawRowLines(wrapped, start, count);
          start += count;
          if (start < lineCount) {
            this.newPage();
            paintHeader();
          }
        }
        continue;
      }

      if (this.y + height > H - M.bottom) {
        this.newPage();
        paintHeader();
      }
      drawRowLines(wrapped, 0, lineCount);
    }

    if (footer) {
      if (this.y + 8.5 > H - M.bottom) {
        this.newPage();
        paintHeader();
      }
      const y = this.y;
      this.pdf.setDrawColor(...C.dark);
      this.pdf.setLineWidth(0.5);
      this.pdf.line(M.left, y, W - M.right, y);
      let x = M.left;
      columns.forEach((col, i) => {
        const align = col.align ?? "left";
        const cellX = align === "right" ? x + col.width - 2.5 : align === "center" ? x + col.width / 2 : x + 2.5;
        this.pdf.setFont("helvetica", "bold");
        this.pdf.setFontSize(7.6);
        this.pdf.setTextColor(...C.dark);
        this.pdf.text(this.fitLine(footer[i] ?? "", col.width - 5), cellX, y + 4.8, { align });
        x += col.width;
      });
      this.y = y + 8.5;
    }
  }

  /**
   * Card de condições comerciais formatado com borda sutil, barra ciano
   * e divisores entre linhas, replicando fielmente a prévia da tela.
   */
  terms(rows: [string, string][]) {
    type PreparedRow = { label: string; lines: string[]; height: number };
    const labelWidth = 32;
    const valueWidth = CONTENT - labelWidth - 10;

    const prepared: PreparedRow[] = rows.map(([label, value]) => {
      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(7.8);
      const lines = this.wrap(value || "-", valueWidth);
      const rowHeight = Math.max(7.2, lines.length * 4.0 + 3.2);
      return { label, lines: lines.length ? lines : ["-"], height: rowHeight };
    });

    const totalCardHeight = prepared.reduce((sum, r) => sum + r.height, 0) + 4;
    const usableHeight = H - M.bottom - M.top;

    // Se o card inteiro couber na página, desenha em bloco com borda única
    if (totalCardHeight <= usableHeight) {
      if (this.y + totalCardHeight > H - M.bottom) this.newPage();
      const cardY = this.y;

      // Fundo e borda externa
      this.pdf.setFillColor(...C.cardBg);
      this.pdf.roundedRect(M.left, cardY, CONTENT, totalCardHeight, 1.2, 1.2, "F");
      this.pdf.setDrawColor(...C.cardBorder);
      this.pdf.setLineWidth(0.3);
      this.pdf.roundedRect(M.left, cardY, CONTENT, totalCardHeight, 1.2, 1.2, "S");

      // Barra de acento ciano à esquerda
      this.pdf.setFillColor(...C.cyan);
      this.pdf.rect(M.left, cardY, 1.3, totalCardHeight, "F");

      let currentY = cardY + 2.5;
      prepared.forEach((row, index) => {
        // Label em negrito
        this.pdf.setFont("helvetica", "bold");
        this.pdf.setFontSize(7.0);
        this.pdf.setTextColor(90, 110, 136);
        this.pdf.text(this.fitLine(row.label.toUpperCase(), labelWidth - 2), M.left + 5, currentY + 4.2);

        // Valor
        this.pdf.setFont("helvetica", "normal");
        this.pdf.setFontSize(7.8);
        this.pdf.setTextColor(...C.ink);
        row.lines.forEach((line, i) => {
          this.pdf.text(line, M.left + labelWidth + 4, currentY + 4.2 + i * 4.0);
        });

        // Divisor pontilhado entre linhas (exceto após a última)
        if (index < prepared.length - 1) {
          const dividerY = currentY + row.height;
          this.pdf.setDrawColor(228, 234, 242);
          this.pdf.setLineWidth(0.25);
          this.pdf.line(M.left + 4, dividerY, W - M.right - 4, dividerY);
        }

        currentY += row.height;
      });

      this.y = cardY + totalCardHeight + 5;
      return;
    }

    // Se for extenso, pagina linha por linha com o mesmo visual
    for (const row of prepared) {
      this.ensure(row.height + 2);
      const y = this.y;

      this.pdf.setFillColor(...C.cardBg);
      this.pdf.rect(M.left, y, CONTENT, row.height, "F");
      this.pdf.setDrawColor(...C.cardBorder);
      this.pdf.setLineWidth(0.3);
      this.pdf.rect(M.left, y, CONTENT, row.height, "S");

      this.pdf.setFillColor(...C.cyan);
      this.pdf.rect(M.left, y, 1.3, row.height, "F");

      this.pdf.setFont("helvetica", "bold");
      this.pdf.setFontSize(7.0);
      this.pdf.setTextColor(90, 110, 136);
      this.pdf.text(this.fitLine(row.label.toUpperCase(), labelWidth - 2), M.left + 5, y + 4.4);

      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(7.8);
      this.pdf.setTextColor(...C.ink);
      row.lines.forEach((line, i) => {
        this.pdf.text(line, M.left + labelWidth + 4, y + 4.4 + i * 4.0);
      });

      this.y = y + row.height + 1.2;
    }
    this.space(2.5);
  }

  /** Card de totais da proposta em fundo navy escuro. */
  totals(data: { primaryLabel: string; primaryValue: string; primaryNote: string; rows: [string, string][] }) {
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(6.8);
    const noteLines = this.limitLines(this.wrap(data.primaryNote, 88), 3, 88);
    const height = Math.max(32, 23 + noteLines.length * 3.4 + 3);
    this.ensure(height + 5);
    const y = this.y;

    this.pdf.setFillColor(...C.navy);
    this.pdf.roundedRect(M.left, y, CONTENT, height, 1.2, 1.2, "F");

    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(6.2);
    this.pdf.setTextColor(...C.steel);
    this.pdf.text(this.fitLine(data.primaryLabel.toUpperCase(), 88), M.left + 6, y + 7.2);

    let valueSize = 17;
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(valueSize);
    while (valueSize > 10 && this.pdf.getTextWidth(pdfSafe(data.primaryValue)) > 92) {
      valueSize -= 1;
      this.pdf.setFontSize(valueSize);
    }
    this.pdf.setTextColor(...C.cyan);
    this.pdf.text(pdfSafe(data.primaryValue), M.left + 6, y + 17.5);

    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(6.8);
    this.pdf.setTextColor(...C.steel);
    noteLines.forEach((line, i) => this.pdf.text(line, M.left + 6, y + 23.2 + i * 3.4));

    // Resumo à direita
    let rowY = y + 8.2;
    for (const [label, value] of data.rows) {
      this.pdf.setFont("helvetica", "bold");
      this.pdf.setFontSize(6.2);
      this.pdf.setTextColor(...C.steel);
      this.pdf.text(this.fitLine(label.toUpperCase(), 28), M.left + 110, rowY);

      this.pdf.setFont("helvetica", "bold");
      this.pdf.setFontSize(8.0);
      this.pdf.setTextColor(...C.white);
      this.pdf.text(this.fitLine(value, 50), W - M.right - 6, rowY, { align: "right" });
      rowY += 6.8;
    }
    this.y = y + height + 5;
  }

  signatures(left: string, right: string) {
    const width = (CONTENT - 12) / 2;
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(7.0);
    const leftLines = this.limitLines(this.wrap(left, width), 3, width);
    const rightLines = this.limitLines(this.wrap(right, width), 3, width);
    const height = 10 + Math.max(leftLines.length, rightLines.length) * 3.6 + 4;
    this.ensure(height);
    const y = this.y + 8;

    this.pdf.setDrawColor(...C.dark);
    this.pdf.setLineWidth(0.35);
    this.pdf.line(M.left, y, M.left + width, y);
    this.pdf.line(M.left + width + 12, y, W - M.right, y);

    this.pdf.setTextColor(...C.steel);
    leftLines.forEach((line, i) => this.pdf.text(line, M.left, y + 4.2 + i * 3.6));
    rightLines.forEach((line, i) => this.pdf.text(line, M.left + width + 12, y + 4.2 + i * 3.6));
    this.y = y + 4.2 + Math.max(leftLines.length, rightLines.length) * 3.6 + 4;
  }

  seal(tags: string[]) {
    if (!tags.length) return;
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(6.4);
    const lines = this.limitLines(this.wrap(tags.join("   ·   "), CONTENT), 2, CONTENT);
    const height = lines.length * 3.6 + 3;
    this.ensure(height);
    this.pdf.setTextColor(...C.steel);
    lines.forEach((line, i) => this.pdf.text(line, M.left, this.y + i * 3.6));
    this.y += height;
  }

  /**
   * Rodapé profissional em duas colunas delimitadas, repetido em todas as páginas.
   * A coluna da esquerda (empresa e contatos) e a coluna da direita (número e página)
   * possuem larguras estritas e fitLine, tornando impossível qualquer sobreposição.
   */
  finalize() {
    const total = this.pdf.getNumberOfPages();
    for (let page = 1; page <= total; page++) {
      this.pdf.setPage(page);

      // Fundo branco opaco para garantir que o rodapé fique 100% isolado
      this.pdf.setFillColor(255, 255, 255);
      this.pdf.rect(0, FOOTER_TOP - 1, W, H - FOOTER_TOP + 1, "F");

      // Linha cinza superior e acento ciano à esquerda
      this.pdf.setDrawColor(...C.rule);
      this.pdf.setLineWidth(0.35);
      this.pdf.line(M.left, FOOTER_TOP, W - M.right, FOOTER_TOP);
      this.pdf.setDrawColor(...C.cyan);
      this.pdf.setLineWidth(1.2);
      this.pdf.line(M.left, FOOTER_TOP, M.left + 22, FOOTER_TOP);

      // Coluna da esquerda: dados institucionais (máximo 113mm)
      const leftWidth = 113;
      this.pdf.setFont("helvetica", "bold");
      this.pdf.setFontSize(6.5);
      this.pdf.setTextColor(...C.dark);
      this.pdf.text(this.fitLine(this.opts.footerCompany, leftWidth), M.left, FOOTER_TOP + 4.5);

      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(5.8);
      this.pdf.setTextColor(...C.steel);
      this.pdf.text(this.fitLine(this.opts.footerAddress, leftWidth), M.left, FOOTER_TOP + 8.5);
      this.pdf.text(this.fitLine(this.opts.footerContact, leftWidth), M.left, FOOTER_TOP + 12.3);

      // Coluna da direita: documento e numeração de página (máximo 58mm, alinhada à direita)
      const rightWidth = 58;
      this.pdf.setFont("helvetica", "bold");
      this.pdf.setFontSize(7.2);
      this.pdf.setTextColor(...C.dark);
      this.pdf.text(`PAGINA ${page} DE ${total}`, W - M.right, FOOTER_TOP + 4.5, { align: "right" });

      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(6.0);
      this.pdf.setTextColor(90, 110, 136);
      this.pdf.text(this.fitLine(`${this.opts.footerDocLabel} · ${this.opts.footerDocRef}`, rightWidth), W - M.right, FOOTER_TOP + 8.5, { align: "right" });

      this.pdf.setFont("courier", "normal");
      this.pdf.setFontSize(5.4);
      this.pdf.setTextColor(...C.steel);
      this.pdf.text("DOCUMENTO GERADO ELETRONICAMENTE", W - M.right, FOOTER_TOP + 12.3, { align: "right" });
    }
    this.pdf.setPage(1);
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

export function renderProposalPdf(pdf: jsPDF, doc: PdfProposalData, settings: PdfSettings, logo: string | null) {
  const totals = calcTotals(doc.items, doc.discountPct);
  const maintenance = isMaintenanceProposal(doc.briefing);
  const monthly = maintenanceSummary(doc.items, doc.discountPct, doc.briefing);
  const label = maintenance ? "Proposta de manutencao mensal" : typeLabels[(doc.type as ProposalType) ?? "completa"] ?? "Proposta comercial";
  const revision = doc.revision ? `Rev. ${String(doc.revision).padStart(2, "0")}` : "Rev. 01";

  const sheet = new A4Sheet(
    pdf,
    {
      label,
      reference: `${doc.number}  |  ${String(doc.type ?? "completa").replace("_", " & ")}  |  ${revision}`,
      meta: [`EMISSAO  ${fmtDate(doc.issuedAt)}`, `VALIDADE  ${doc.validityDays} DIAS`, settings.crea],
      footerCompany: `${settings.companyName} · ${settings.legalName}`,
      footerAddress: `${settings.address} · CNPJ ${settings.cnpj} · ${settings.crea}`,
      footerContact: `${settings.phone} · ${settings.email} · ${settings.site}`,
      footerDocLabel: maintenance ? "Proposta de manutencao" : "Proposta comercial",
      footerDocRef: `${doc.number} · ${revision}`,
    },
    logo,
  );

  sheet.clientStrip({
    name: doc.clientName,
    contact: doc.contact || "-",
    email: doc.clientEmail || "",
    site: doc.site || "A confirmar",
  });

  const enabled = doc.sections.filter((s) => s.enabled);
  enabled.forEach((section, index) => {
    sheet.heading(String(index + 1).padStart(2, "0"), section.title);

    // Se for seção de termos comerciais, renderiza o card estruturado para evitar duplicidade
    if (section.kind === "terms") {
      sheet.terms([
        ["Pagamento", doc.paymentTerms || "A combinar"],
        [maintenance ? "Servicos recorrentes" : "Execucao", doc.deliveryTime || "A combinar"],
        ["Garantia", doc.warranty || "A combinar"],
        ["Validade", `${doc.validityDays} dias corridos a partir da emissao`],
      ]);

      // Se houver notas extras no body que não apenas repetem os 4 termos estruturados, imprime como complemento
      if (section.body?.trim()) {
        const extraLines = section.body
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l && !/^(pagamento|prazo|execu[cç][aã]o|garantia|validade)/i.test(l.replace(/^[-•▸]\s*/, "")));
        if (extraLines.length) sheet.richText(extraLines.join("\n"));
      }
    } else {
      if (section.body?.trim()) sheet.richText(section.body);
    }

    if (section.kind === "table" && section.rows?.length) {
      sheet.table(
        [
          { label: "Frente de trabalho", width: 74 },
          { label: "Cipriano Tech & Security", width: 51 },
          { label: "Cliente", width: 51 },
        ],
        section.rows.map((row) => [row.label, row.cipriano, row.client]),
      );
    }

    if (section.kind === "items") {
      const groups: { key: ProposalItem["kind"]; label: string }[] = [
        { key: "equipamento", label: "EQUIPAMENTOS" },
        { key: "servico", label: "SERVICOS" },
      ];
      for (const group of groups) {
        const rows = doc.items.filter((i) => i.kind === group.key);
        if (!rows.length) continue;
        const subtotal = rows.reduce((a, i) => a + i.qty * i.price, 0);
        sheet.paragraph(group.label, { bold: true, size: 7.4, color: C.dark, gap: 1.2 });
        sheet.table(
          [
            { label: "Descricao / especificacao", width: 78 },
            { label: "Un.", width: 14, align: "center" },
            { label: "Qtd.", width: 16, align: "right" },
            { label: "Unitario", width: 32, align: "right" },
            { label: "Total", width: 36, align: "right" },
          ],
          rows.map((item) => [`${item.desc}${item.spec ? ` - ${item.spec}` : ""}`, item.unit, String(item.qty), brl(item.price), brl(item.price * item.qty)]),
          ["", "", `Subtotal ${group.label.toLowerCase()}`, "", brl(subtotal)],
        );
      }
    }

    if (section.kind === "totals") {
      sheet.totals({
        primaryLabel: maintenance ? "Mensalidade da manutencao" : "Investimento total",
        primaryValue: `${brl((maintenance ? monthly.monthlyCents : totals.totalCents) / 100)}${maintenance ? " / mes" : ""}`,
        primaryNote: maintenance
          ? `${monthly.months} meses de vigencia estimada. Desconto comercial de ${doc.discountPct}% ja aplicado.`
          : `${doc.items.length} itens. Desconto comercial de ${doc.discountPct}% ja aplicado.`,
        rows: [
          ["Subtotal", brl(totals.subtotalCents / 100)],
          ["Desconto", `- ${brl(totals.offCents / 100)}`],
          [maintenance ? "Total do periodo" : "12x de", brl((maintenance ? totals.totalCents : totals.installmentCents) / 100)],
        ],
      });
    }

    if (section.id === "aceite") {
      sheet.signatures(`${settings.legalName}  |  ${settings.director}`, `${doc.clientName}  |  Responsavel pelo aceite`);
    }
    sheet.space(2);
  });

  sheet.seal(["CFTV IP", "CONTROLE DE ACESSO", "CERCA ELETRICA", "MONITORAMENTO 24H", "LGPD"]);
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
  const revision = `Rev. ${String(input.revision).padStart(2, "0")}`;
  const sheet = new A4Sheet(
    pdf,
    {
      label: input.title,
      reference: `${revision}  |  ${input.reference}`,
      meta: [`CLIENTE  ${input.clientName}`, `EMISSAO  ${fmtDate(new Date())}`, input.settings.crea],
      footerCompany: `${input.settings.companyName} · ${input.settings.legalName}`,
      footerAddress: `${input.settings.address} · CNPJ ${input.settings.cnpj} · ${input.settings.crea}`,
      footerContact: `${input.settings.phone} · ${input.settings.email} · ${input.settings.site}`,
      footerDocLabel: input.maintenance ? "Contrato de manutencao" : "Contrato da proposta",
      footerDocRef: `${input.reference} · ${revision}`,
    },
    input.logo ?? null,
  );
  sheet.richText(input.text);
  sheet.finalize();
}
