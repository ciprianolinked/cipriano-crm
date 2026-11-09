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
  briefing?: Record<string, unknown> | null;
};

const W = 210;
const H = 297;
const M = { left: 17, right: 17, top: 33, bottom: 21 };
const CONTENT = W - M.left - M.right;

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

const LH = 4.35;

/** Folha A4 com cabeçalho repetido, paginação por linha e rodapé numerado. */
export class A4Sheet {
  private y = M.top;
  constructor(private pdf: jsPDF, private opts: SheetOptions, private logo: string | null) {
    this.paintHeader();
  }

  private paintHeader() {
    const { pdf } = this;
    pdf.setFillColor(...C.navy);
    pdf.rect(0, 0, W, 26, "F");
    if (this.logo) {
      try {
        pdf.addImage(this.logo, "PNG", M.left, 5.4, 52, 13);
      } catch {
        pdf.setTextColor(...C.white);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.text("CIPRIANO TECH & SECURITY", M.left, 13);
      }
    } else {
      pdf.setTextColor(...C.white);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text("CIPRIANO TECH & SECURITY", M.left, 13);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...C.silver);
      pdf.text(pdfSafe("Seguranca eletronica IP"), M.left, 17.5);
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.2);
    pdf.setTextColor(...C.silver);
    pdf.text(pdfSafe(this.opts.label.toUpperCase()), W - M.right, 11, { align: "right" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.6);
    pdf.setTextColor(...C.silver);
    pdf.text(pdfSafe(this.opts.reference), W - M.right, 15.6, { align: "right" });
    pdf.setFontSize(6.6);
    pdf.setTextColor(159, 178, 199);
    this.opts.meta.slice(0, 3).forEach((line, i) => {
      pdf.text(pdfSafe(line), W - M.right, 20 + i * 3.2, { align: "right" });
    });
    pdf.setDrawColor(0, 198, 222);
    pdf.setLineWidth(1);
    pdf.line(0, 26, W, 26);
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

  /** Título numerado com selo ciano e filete, quebra antes se não houver espaço. */
  heading(index: string, title: string) {
    this.ensure(14);
    const y = this.y;
    const label = pdfSafe(title.toUpperCase());
    this.pdf.setFillColor(...C.band);
    this.pdf.roundedRect(M.left, y - 3.9, 9.2, 5.4, 1, 1, "F");
    this.pdf.setFont("courier", "bold");
    this.pdf.setFontSize(6.8);
    this.pdf.setTextColor(...C.signal);
    this.pdf.text(pdfSafe(index), M.left + 4.6, y - 0.2, { align: "center" });
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(9.4);
    this.pdf.setTextColor(...C.dark);
    this.pdf.text(label, M.left + 12.5, y);
    const titleWidth = this.pdf.getTextWidth(label);
    this.pdf.setDrawColor(...C.rule);
    this.pdf.setLineWidth(0.35);
    this.pdf.line(M.left + 12.5 + titleWidth + 4, y - 1.5, W - M.right, y - 1.5);
    this.y = y + 6.2;
  }

  /** Título simples (contratos com numeração própria no texto). */
  sectionTitle(text: string) {
    this.ensure(13);
    const y = this.y;
    const label = pdfSafe(text);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(9);
    this.pdf.setTextColor(...C.dark);
    this.pdf.text(label, M.left, y);
    const width = this.pdf.getTextWidth(label);
    this.pdf.setDrawColor(...C.rule);
    this.pdf.setLineWidth(0.35);
    this.pdf.line(M.left + width + 4, y - 1.5, W - M.right, y - 1.5);
    this.y = y + 5.8;
  }

  paragraph(text: string, options: { indent?: number; size?: number; bold?: boolean; color?: RGB; gap?: number } = {}) {
    const size = options.size ?? 8.5;
    const lh = size * 0.3528 * 1.55;
    const indent = options.indent ?? 0;
    this.pdf.setFont("helvetica", options.bold ? "bold" : "normal");
    this.pdf.setFontSize(size);
    this.pdf.setTextColor(...(options.color ?? C.ink));
    const lines = this.pdf.splitTextToSize(pdfSafe(text), CONTENT - indent) as string[];
    if (lines.length === 0) return;
    this.ensure(Math.min(lines.length, 2) * lh + 1);
    for (const line of lines) {
      this.ensure(lh);
      this.pdf.text(line, M.left + indent, this.y);
      this.y += lh;
    }
    this.y += options.gap ?? 1.6;
  }

  bullets(items: string[]) {
    for (const item of items) {
      const lines = this.pdf.splitTextToSize(pdfSafe(item), CONTENT - 6) as string[];
      if (lines.length === 0) continue;
      this.ensure(Math.min(lines.length, 2) * LH + 1);
      for (let i = 0; i < lines.length; i++) {
        this.ensure(LH);
        if (i === 0) {
          this.pdf.setFillColor(...C.signal);
          this.pdf.rect(M.left + 0.6, this.y - 1.7, 1.4, 1.4, "F");
        }
        this.pdf.text(lines[i], M.left + 6, this.y);
        this.y += LH;
      }
      this.y += 0.5;
    }
    this.y += 1;
  }

  /** Reproduz texto livre (proposta e contratos), com bullets e parágrafos. */
  richText(text: string) {
    for (const raw of pdfSafe(text).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) {
        this.y += 2.3;
        continue;
      }
      const bullet = /^[-]\s+/.test(line) ? line.replace(/^[-]\s+/, "") : null;
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

  clientStrip(data: { name: string; contact: string; email: string; site: string }) {
    this.ensure(22);
    const y = this.y;
    this.pdf.setFillColor(...C.pale);
    this.pdf.roundedRect(M.left, y, CONTENT, 17, 1.2, 1.2, "F");
    const cols: [string, string][] = [
      ["CLIENTE", data.name],
      ["CONTATO", data.contact],
      ["LOCAL", data.site],
    ];
    const widths = [0.36, 0.3, 0.34];
    let x = M.left + 5;
    cols.forEach(([label, value], i) => {
      this.pdf.setFont("courier", "normal");
      this.pdf.setFontSize(5.9);
      this.pdf.setTextColor(...C.steel);
      this.pdf.text(pdfSafe(label), x, y + 5.6);
      this.pdf.setFont("helvetica", i === 0 ? "bold" : "normal");
      this.pdf.setFontSize(8);
      this.pdf.setTextColor(...(i === 0 ? C.dark : C.ink));
      const lines = this.pdf.splitTextToSize(pdfSafe(value || "-"), CONTENT * widths[i] - 6) as string[];
      this.pdf.text(lines[0] ?? "-", x, y + 10.6);
      if (lines[1]) this.pdf.text(lines[1], x, y + 14.4);
      if (i < 2) {
        this.pdf.setDrawColor(...C.rule);
        this.pdf.setLineWidth(0.3);
        this.pdf.line(x + CONTENT * widths[i] - 4, y + 3.5, x + CONTENT * widths[i] - 4, y + 13.5);
      }
      x += CONTENT * widths[i];
    });
    if (data.email) {
      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(6.8);
      this.pdf.setTextColor(...C.steel);
      this.pdf.text(pdfSafe(data.email), M.left + 5, y + 15.2);
    }
    this.y = y + 21;
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
      this.pdf.setFont("courier", "normal");
      this.pdf.setFontSize(5.8);
      this.pdf.setTextColor(...C.steel);
      let x = M.left;
      for (const col of columns) {
        this.pdf.text(pdfSafe(col.label.toUpperCase()), x + (col.align === "right" ? col.width - 2.5 : col.align === "center" ? col.width / 2 : 2.5), y + 4.2, { align: col.align ?? "left" });
        x += col.width;
      }
      this.pdf.setDrawColor(...C.rule);
      this.pdf.setLineWidth(0.3);
      this.pdf.line(M.left, y + 6.4, W - M.right, y + 6.4);
      this.y = y + 6.4;
    };
    this.ensure(30);
    paintHeader();
    for (const row of rows) {
      const wrapped = columns.map((col, i) => this.pdf.splitTextToSize(pdfSafe(row[i] ?? ""), col.width - 5) as string[]);
      const lineCount = Math.max(1, ...wrapped.map((lines) => lines.length));
      const height = lineCount * 3.7 + 3.2;
      if (this.y + height > H - M.bottom) {
        this.newPage();
        paintHeader();
      }
      const y = this.y;
      let x = M.left;
      columns.forEach((col, i) => {
        const align = col.align ?? "left";
        const cellX = align === "right" ? x + col.width - 2.5 : align === "center" ? x + col.width / 2 : x + 2.5;
        this.pdf.setFont("helvetica", "normal");
        this.pdf.setFontSize(7.4);
        this.pdf.setTextColor(...C.ink);
        wrapped[i].forEach((line, li) => {
          this.pdf.text(line, cellX, y + 4 + li * 3.7, { align });
        });
        x += col.width;
      });
      this.pdf.setDrawColor(...C.rule);
      this.pdf.setLineWidth(0.25);
      this.pdf.line(M.left, y + height, W - M.right, y + height);
      this.y = y + height;
    }
    if (footer) {
      this.ensure(8);
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
        this.pdf.text(pdfSafe(footer[i] ?? ""), cellX, y + 4.6, { align });
        x += col.width;
      });
      this.y = y + 8;
    }
  }

  terms(rows: [string, string][]) {
    this.ensure(24);
    const y = this.y;
    this.pdf.setFillColor(...C.pale);
    this.pdf.roundedRect(M.left, y, CONTENT, rows.length * 6.2 + 3, 1, 1, "F");
    let rowY = y + 5;
    for (const [label, value] of rows) {
      this.pdf.setFont("courier", "normal");
      this.pdf.setFontSize(5.9);
      this.pdf.setTextColor(...C.steel);
      this.pdf.text(pdfSafe(label.toUpperCase()), M.left + 4, rowY);
      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(7.6);
      this.pdf.setTextColor(...C.ink);
      const lines = this.pdf.splitTextToSize(pdfSafe(value), CONTENT - 48) as string[];
      lines.forEach((line, i) => this.pdf.text(line, M.left + 48, rowY + i * 3.4));
      rowY += Math.max(6.2, lines.length * 3.4 + 2.4);
    }
    this.y = rowY + 1;
    this.space(2);
  }

  totals(data: { primaryLabel: string; primaryValue: string; primaryNote: string; rows: [string, string][] }) {
    this.ensure(38);
    const y = this.y;
    this.pdf.setFillColor(...C.navy);
    this.pdf.roundedRect(M.left, y, CONTENT, 30, 1.2, 1.2, "F");
    this.pdf.setFont("courier", "normal");
    this.pdf.setFontSize(5.9);
    this.pdf.setTextColor(...C.steel);
    this.pdf.text(pdfSafe(data.primaryLabel.toUpperCase()), M.left + 6, y + 7);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.setFontSize(17);
    this.pdf.setTextColor(0, 229, 255);
    this.pdf.text(pdfSafe(data.primaryValue), M.left + 6, y + 17.5);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(6.6);
    this.pdf.setTextColor(...C.steel);
    const noteLines = this.pdf.splitTextToSize(pdfSafe(data.primaryNote), 95) as string[];
    noteLines.slice(0, 2).forEach((line, i) => this.pdf.text(line, M.left + 6, y + 23 + i * 3.2));
    let rowY = y + 8;
    for (const [label, value] of data.rows) {
      this.pdf.setFont("courier", "normal");
      this.pdf.setFontSize(5.9);
      this.pdf.setTextColor(...C.steel);
      this.pdf.text(pdfSafe(label.toUpperCase()), M.left + 112, rowY);
      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(8);
      this.pdf.setTextColor(...C.white);
      this.pdf.text(pdfSafe(value), W - M.right - 6, rowY, { align: "right" });
      rowY += 6.6;
    }
    this.y = y + 34;
  }

  signatures(left: string, right: string) {
    this.ensure(32);
    const y = this.y + 8;
    const width = (CONTENT - 12) / 2;
    this.pdf.setDrawColor(...C.dark);
    this.pdf.setLineWidth(0.35);
    this.pdf.line(M.left, y, M.left + width, y);
    this.pdf.line(M.left + width + 12, y, W - M.right, y);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(6.8);
    this.pdf.setTextColor(...C.steel);
    this.pdf.text(pdfSafe(left), M.left, y + 4);
    this.pdf.text(pdfSafe(right), M.left + width + 12, y + 4);
    this.y = y + 10;
  }

  seal(tags: string[]) {
    if (!tags.length) return;
    this.ensure(10);
    this.pdf.setFont("courier", "normal");
    this.pdf.setFontSize(6);
    this.pdf.setTextColor(...C.steel);
    this.pdf.text(pdfSafe(tags.join("  |  ")), M.left, this.y);
    this.y += 6;
  }

  /** Rodapé profissional repetido em todas as páginas, com numeração. */
  finalize() {
    const total = this.pdf.getNumberOfPages();
    for (let page = 1; page <= total; page++) {
      this.pdf.setPage(page);
      const top = H - 17;
      this.pdf.setDrawColor(...C.rule);
      this.pdf.setLineWidth(0.35);
      this.pdf.line(M.left, top, W - M.right, top);
      this.pdf.setDrawColor(...C.signal);
      this.pdf.setLineWidth(1.2);
      this.pdf.line(M.left, top, M.left + 17, top);
      this.pdf.setFont("helvetica", "bold");
      this.pdf.setFontSize(6.4);
      this.pdf.setTextColor(...C.dark);
      this.pdf.text(pdfSafe(this.opts.footerLeft), M.left, top + 4.4);
      this.pdf.setFont("helvetica", "normal");
      this.pdf.setFontSize(6);
      this.pdf.setTextColor(...C.steel);
      this.pdf.text(pdfSafe(this.opts.footerLeft2), M.left, top + 8);
      this.pdf.text(pdfSafe(this.opts.footerCenter), W / 2, top + 4.4, { align: "center" });
      this.pdf.text(pdfSafe(this.opts.footerNote), W / 2, top + 8, { align: "center" });
      this.pdf.setFont("courier", "bold");
      this.pdf.setFontSize(6.6);
      this.pdf.setTextColor(...C.dark);
      this.pdf.text(`PAGINA ${page} DE ${total}`, W - M.right, top + 4.4, { align: "right" });
      this.pdf.setFont("courier", "normal");
      this.pdf.setFontSize(5.8);
      this.pdf.setTextColor(...C.steel);
      this.pdf.text("DOCUMENTO GERADO ELETRONICAMENTE", W - M.right, top + 8, { align: "right" });
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
  const sheet = new A4Sheet(
    pdf,
    {
      label,
      reference: `${doc.number}${doc.type ? `  |  ${String(doc.type).replace("_", " & ")}` : ""}`,
      meta: [`EMISSAO  ${fmtDate(doc.issuedAt)}`, `VALIDADE  ${doc.validityDays} DIAS`, settings.crea],
      footerLeft: settings.legalName,
      footerLeft2: `CNPJ ${settings.cnpj}  |  ${settings.crea}  |  ${settings.phone}`,
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

  const enabled = doc.sections.filter((s) => s.enabled);
  enabled.forEach((section, index) => {
    sheet.heading(String(index + 1).padStart(2, "0"), section.title);
    if (section.body?.trim()) sheet.richText(section.body);

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

    if (section.kind === "terms") {
      sheet.terms([
        ["Pagamento", doc.paymentTerms || "A combinar"],
        [maintenance ? "Servicos recorrentes" : "Execucao", doc.deliveryTime || "A combinar"],
        ["Garantia", doc.warranty || "A combinar"],
        ["Validade", `${doc.validityDays} dias corridos a partir da emissao`],
      ]);
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
    sheet.space(1.5);
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
  const sheet = new A4Sheet(
    pdf,
    {
      label: input.title,
      reference: `REV. ${String(input.revision).padStart(2, "0")}  |  ${input.reference}`,
      meta: [`CLIENTE  ${input.clientName}`, `EMISSAO  ${fmtDate(new Date())}`, input.settings.crea],
      footerLeft: input.settings.legalName,
      footerLeft2: `CNPJ ${input.settings.cnpj}  |  ${input.settings.crea}  |  ${input.settings.phone}`,
      footerCenter: `${input.reference}  |  ${input.clientName}`,
      footerNote: `${input.settings.site}  |  ${input.settings.email}`,
    },
    input.logo ?? null,
  );
  sheet.richText(input.text);
  sheet.finalize();
}
