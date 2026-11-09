import PDFDocument from "pdfkit";
import { GERENCIAL_LOGO_PNG } from "@/lib/brand-assets";
import { COST_TYPE_LABEL, STATUS_LABEL } from "@/lib/constants";
import {
  computeMetrics,
  formatCurrency,
  formatDateBR,
  itemTotal,
  recordedSavings,
  supplierCostBreakdown,
} from "@/lib/quotation";
import type { QuotationDraft, QuotationRecord } from "@/lib/types";

const INK = "#181447";
const INK_SOFT = "#26215E";
const GOLD = "#FAB12A";
const SUCCESS = "#0E4828";
const SUCCESS_SOFT = "#E7F0E9";
const LINE = "#E3E0D3";
const MUTED = "#6B6B7D";
const PAPER = "#F6F4EE";
const TEXT = "#23233A";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 34;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

type Doc = PDFKit.PDFDocument;

type TableOptions = {
  x: number;
  y: number;
  width: number;
  columns: { label: string; width: number; align?: "left" | "right" | "center" }[];
  rows: { cells: string[]; emphasis?: boolean; tone?: "ink" | "best" | null }[];
  minHeight?: number;
  zebra?: boolean;
};

function sanitize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function slugify(value: string): string {
  return sanitize(value).slice(0, 60) || "sem-nome";
}

export function mapFileName(draft: Pick<QuotationDraft, "condominium" | "analysisDate">, protocol: string): string {
  const condo = slugify(draft.condominium || "condominio-nao-informado");
  const date = draft.analysisDate || "sem-data";
  return `Mapa-de-Cotacao_${sanitize(protocol) || "sem-protocolo"}_${condo}_${date}.pdf`;
}

export type IndicatorsInput = {
  condominium: string;
  start: string;
  end: string;
};

export function indicatorsFileName(input: IndicatorsInput): string {
  const condo = slugify(input.condominium || "todos-os-condominios");
  const start = input.start || "inicio";
  const end = input.end || "hoje";
  return `Indicadores-Gerencial_${condo}_${start}_a_${end}.pdf`;
}

function layout(doc: Doc, columns: TableOptions["columns"], width: number) {
  const flexible = columns.reduce((total, column) => total + column.width, 0);
  const scale = width / flexible;
  return columns.map((column) => ({ ...column, width: Math.round(column.width * scale * 100) / 100 }));
}

function drawTableCell(doc: Doc, text: string, x: number, y: number, width: number, options: { align?: "left" | "right" | "center"; bold?: boolean; size?: number; color?: string } = {}) {
  doc.font(options.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(options.size ?? 8)
    .fillColor(options.color ?? TEXT);
  const height = doc.heightOfString(text, { width: width - 6 });
  doc.text(text, x + 3, y + 3, { width: width - 6, align: options.align ?? "left", lineBreak: false });
  return height + 6;
}

function drawTable(doc: Doc, options: TableOptions): number {
  const columns = layout(doc, options.columns, options.width);
  const headerHeight = 18;
  let y = options.y;
  const drawHeader = () => {
    doc.rect(options.x, y, options.width, headerHeight).fill(INK);
    let x = options.x;
    for (const column of columns) {
      drawTableCell(doc, column.label.toUpperCase(), x, y, column.width, {
        align: column.align,
        bold: true,
        size: 6.5,
        color: "#FFFFFF",
      });
      x += column.width;
    }
    y += headerHeight;
  };
  drawHeader();

  for (const row of options.rows) {
    const heights = row.cells.map((cell, index) => {
      doc.font(row.emphasis ? "Helvetica-Bold" : "Helvetica").fontSize(8);
      return doc.heightOfString(cell, { width: columns[index].width - 6 }) + 6;
    });
    const rowHeight = Math.max(options.minHeight ?? 15, ...heights);
    if (y + rowHeight > PAGE_HEIGHT - MARGIN - 26) {
      doc.addPage();
      y = MARGIN + 6;
      drawHeader();
    }
    if (row.tone === "ink") doc.rect(options.x, y, options.width, rowHeight).fill(INK);
    else if (row.tone === "best") doc.rect(options.x, y, options.width, rowHeight).fill(SUCCESS_SOFT);
    else if (options.zebra !== false && options.rows.indexOf(row) % 2 === 1) doc.rect(options.x, y, options.width, rowHeight).fill(PAPER);
    let x = options.x;
    row.cells.forEach((cell, index) => {
      const tone = row.tone === "ink" ? "#FFFFFF" : row.tone === "best" ? SUCCESS : TEXT;
      drawTableCell(doc, cell, x, y, columns[index].width, {
        align: columns[index].align,
        bold: Boolean(row.emphasis) || row.tone === "ink",
        color: tone,
      });
      x += columns[index].width;
    });
    doc.moveTo(options.x, y + rowHeight).lineTo(options.x + options.width, y + rowHeight).lineWidth(0.5).strokeColor(LINE).stroke();
    y += rowHeight;
  }
  return y;
}

function sectionTitle(doc: Doc, title: string, hint?: string): number {
  let y = doc.y + 14;
  ensureSpace(doc, 30);
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text(title.toUpperCase(), MARGIN, y, { characterSpacing: 0.6 });
  if (hint) {
    doc.font("Helvetica").fontSize(7).fillColor(MUTED).text(hint, MARGIN, y + 12, { align: "right", width: CONTENT_WIDTH, lineBreak: false });
  }
  doc.moveTo(MARGIN, y + 21).lineTo(MARGIN + CONTENT_WIDTH, y + 21).lineWidth(1).strokeColor(GOLD).stroke();
  doc.y = y + 27;
  return doc.y;
}

function paragraph(doc: Doc, text: string, options: { size?: number; color?: string; bold?: boolean; width?: number; lineGap?: number } = {}): number {
  ensureSpace(doc, 20);
  doc.font(options.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(options.size ?? 8.5)
    .fillColor(options.color ?? TEXT)
    .text(text, MARGIN, doc.y, { width: options.width ?? CONTENT_WIDTH, lineGap: options.lineGap ?? 1.6 });
  return doc.y;
}

function ensureSpace(doc: Doc, needed: number): void {
  if (doc.y + needed > PAGE_HEIGHT - MARGIN - 26) doc.addPage();
}

function footer(doc: Doc, label: string): void {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index++) {
    doc.switchToPage(index);
    const y = PAGE_HEIGHT - MARGIN - 2;
    doc.font("Helvetica").fontSize(6.5).fillColor(MUTED);
    doc.text(`Gerencial · Governança Condominial — ${label}`, MARGIN, y, { lineBreak: false, height: 10 });
    doc.text(`Página ${index - range.start + 1} de ${range.count}`, MARGIN, y, { width: CONTENT_WIDTH, align: "right", lineBreak: false, height: 10 });
  }
  doc.switchToPage(range.start + range.count - 1);
}

function collect(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function documentBase(title: string, subtitle: string): { doc: Doc; done: Promise<Buffer> } {
  const doc = new PDFDocument({ size: "A4", margin: MARGIN, info: { Title: title, Author: "Gerencial · Governança Condominial" } });
  // O rodapé é desenhado no fim, sobre as páginas já em buffer. Escrever durante
  // "pageAdded" dispara quebras de página em cascata dentro do pdfkit.
  void subtitle;
  return { doc, done: collect(doc) };
}

/** Gera o PDF do mapa de cotação com o layout institucional da Gerencial. */
export async function buildMapPdf(draft: QuotationDraft, protocol: string): Promise<{ buffer: Buffer; fileName: string }> {
  const fileName = mapFileName(draft, protocol);
  const { doc, done } = documentBase(`Mapa de Cotação ${protocol}`, `Mapa de Cotação ${protocol}`);
  const metrics = computeMetrics(draft);
  const suppliers = draft.suppliers.filter((supplier) => supplier.name.trim().length > 0 || draft.items.some((item) => item.prices?.[supplier.id] != null));
  const items = draft.items.filter((item) => item.description.trim().length > 0 || item.quantity > 0);

  // Cabeçalho institucional
  doc.rect(0, 0, PAGE_WIDTH, 84).fill(INK);
  doc.image(Buffer.from(GERENCIAL_LOGO_PNG, "base64"), MARGIN, 26, { height: 30 });
  doc.font("Helvetica").fontSize(6.5).fillColor(GOLD).text("DOCUMENTO DE GOVERNANÇA", MARGIN, 20, { width: CONTENT_WIDTH, align: "right", characterSpacing: 0.8 });
  doc.font("Helvetica-Bold").fontSize(19).fillColor("#FFFFFF").text("Mapa de Cotação", MARGIN, 30, { width: CONTENT_WIDTH, align: "right" });
  doc.font("Helvetica").fontSize(7).fillColor("#FFFFFF").text(`Protocolo ${protocol} · ${formatDateBR(draft.analysisDate)}`, MARGIN, 54, { width: CONTENT_WIDTH, align: "right" });
  doc.rect(0, 84, PAGE_WIDTH, 4).fill(GOLD);
  doc.y = 100;

  // Identificação
  sectionTitle(doc, "Identificação do mapa", "Cabeçalho do processo");
  ensureSpace(doc, 74);
  doc.rect(MARGIN, doc.y, CONTENT_WIDTH, 72).fillAndStroke(PAPER, LINE);
  const infoY = doc.y + 8;
  const info = [
    ["Condomínio / Associação", draft.condominium || "—"],
    ["Data análise", formatDateBR(draft.analysisDate)],
    ["A/C", draft.recipient || "—"],
    ["Serviço / Objeto", draft.service || "—"],
    ["Natureza", `${draft.kind === "produtos" ? "Produtos" : "Serviço"} · ${draft.category}`],
    ["Status", STATUS_LABEL[draft.status]],
  ] as const;
  info.forEach((entry, index) => {
    const x = MARGIN + 10 + (index % 2) * (CONTENT_WIDTH / 2);
    const y = infoY + Math.floor(index / 2) * 20;
    doc.font("Helvetica-Bold").fontSize(6.2).fillColor(MUTED).text(entry[0].toUpperCase(), x, y, { characterSpacing: 0.5, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(8.6).fillColor(INK).text(entry[1], x, y + 8, { width: CONTENT_WIDTH / 2 - 20, lineBreak: false });
  });
  doc.y = infoY + 66;
  if (draft.description.trim()) {
    paragraph(doc, draft.description, { size: 8.2 });
  }

  // Itens comparativos
  sectionTitle(doc, "1 · Mapa comparativo de propostas", "Valores em reais · menor preço destacado");
  const supplierColumns = suppliers.map((supplier) => ({
    label: supplier.name.trim() || "Fornecedor",
    width: 68,
    align: "right" as const,
  }));
  const columns = [
    { label: "#", width: 18, align: "center" as const },
    { label: "Descrição do item / escopo", width: 168 },
    { label: "Tipo", width: 52 },
    { label: "Qtd", width: 26, align: "right" as const },
    { label: "Un.", width: 34 },
    ...supplierColumns,
  ];
  const rows = items.map((item, index) => {
    const lowest = Math.min(...suppliers.map((supplier) => item.prices?.[supplier.id]).filter((value): value is number => value != null));
    const row = [
      String(index + 1).padStart(2, "0"),
      (item.description || "Item sem descrição") +
        (item.purchaseUrl ? `\nCompra: ${item.purchaseStore || "link"}${item.purchasePrice != null ? ` · ${formatCurrency(item.purchasePrice)}` : ""}${item.purchaseVerified ? " · loja confiável" : ""}` : ""),
      COST_TYPE_LABEL[item.costType ?? "nao_discriminado"],
      String(item.quantity || "—"),
      item.unit,
      ...suppliers.map((supplier) => {
        const value = item.prices?.[supplier.id] ?? null;
        const isLowest = value !== null && Number.isFinite(lowest) && Math.abs(value - lowest) < 0.005;
        return formatCurrency(value) + (isLowest ? " •" : "");
      }),
    ];
    const allCovered = suppliers.length > 1 && suppliers.every((supplier) => item.prices?.[supplier.id] != null);
    const bestIsHere = metrics.best?.supplier.id != null && allCovered;
    return { cells: row, tone: null, emphasis: false, bestIsHere };
  });
  const tableRows = rows.map((row) => ({ cells: row.cells, tone: null as "ink" | "best" | null }));
  let tableEnd = drawTable(doc, { x: MARGIN, y: doc.y, width: CONTENT_WIDTH, columns, rows: tableRows });
  const totalsRow = {
    cells: ["", "Total geral da proposta", "", "", "", ...suppliers.map((supplier) => formatCurrency(supplierCostBreakdown(items, supplier.id).mao_obra.total === null && supplierCostBreakdown(items, supplier.id).material.total === null && supplierCostBreakdown(items, supplier.id).nao_discriminado.total === null ? null : items.reduce((sum, item) => { const value = itemTotal(item, supplier.id); return value === null ? sum : sum + value; }, 0)))],
    tone: "ink" as const,
  };
  tableEnd = drawTable(doc, { x: MARGIN, y: tableEnd, width: CONTENT_WIDTH, columns, rows: [totalsRow], zebra: false });
  doc.y = tableEnd;
  ensureSpace(doc, 60);
  for (const type of ["mao_obra", "material", "nao_discriminado"] as const) {
    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED).text(COST_TYPE_LABEL[type], MARGIN, doc.y, { continued: true })
      .font("Helvetica").fillColor(TEXT)
      .text(`   ${suppliers.map((supplier) => formatCurrency(supplierCostBreakdown(items, supplier.id)[type].total)).join("   |   ")}`, { width: CONTENT_WIDTH });
  }
  paragraph(doc, "• marca o menor preço do item. Valores globais sem separação aparecem como não discriminados; não se presume a divisão entre mão de obra e material. Totais parciais não são comparados como propostas completas.", { size: 7, color: MUTED });

  // Condições comerciais
  sectionTitle(doc, "2 · Condições comerciais e cobertura", `${metrics.supplierCount} fornecedor(es) consultado(s)`);
  const conditions = suppliers.map((supplier) => {
    const ranking = metrics.rankings.find((row) => row.supplier.id === supplier.id);
    return {
      cells: [
        supplier.name.trim() || "Fornecedor",
        formatCurrency(ranking?.total ?? null),
        ranking ? `${ranking.coverage}/${items.length}` : "—",
        supplier.deliveryDays || "—",
        supplier.paymentTerms || "—",
        supplier.validity || "—",
        (supplier.contact || "—") + (supplier.purchaseUrl ? `\nLoja: ${supplier.purchaseUrl}` : ""),
      ],
      tone: (ranking?.isBest && metrics.isComparable ? "best" : null) as "ink" | "best" | null,
    };
  });
  doc.y = drawTable(doc, {
    x: MARGIN,
    y: doc.y,
    width: CONTENT_WIDTH,
    columns: [
      { label: "Fornecedor", width: 132 },
      { label: "Proposta", width: 60, align: "right" },
      { label: "Cobertura", width: 46, align: "center" },
      { label: "Entrega", width: 66 },
      { label: "Pagamento", width: 70 },
      { label: "Validade", width: 54 },
      { label: "Contato", width: 96 },
    ],
    rows: conditions,
  });

  // Parecer e indicadores
  sectionTitle(doc, "3 · Análise técnica e recomendação", "Parecer da governança");
  ensureSpace(doc, 96);
  const boxY = doc.y;
  doc.rect(MARGIN, boxY, CONTENT_WIDTH * 0.63 - 6, 92).fillAndStroke("#FFFFFF", LINE);
  doc.font("Helvetica-Bold").fontSize(6.2).fillColor(MUTED).text("PARECER", MARGIN + 8, boxY + 8, { characterSpacing: 0.5, lineBreak: false });
  doc.font("Helvetica").fontSize(8).fillColor(TEXT).text(draft.analysis.summary || "A análise técnica é gerada a partir das propostas inseridas.", MARGIN + 8, boxY + 18, { width: CONTENT_WIDTH * 0.63 - 22 });
  doc.font("Helvetica-Bold").fontSize(8).fillColor(INK).text(draft.analysis.recommendation || "Recomendação pendente de análise.", MARGIN + 8, boxY + 54, { width: CONTENT_WIDTH * 0.63 - 22 });
  const sideX = MARGIN + CONTENT_WIDTH * 0.63 + 6;
  const sideWidth = CONTENT_WIDTH * 0.37 - 6;
  doc.rect(sideX, boxY, sideWidth, 92).fillAndStroke(PAPER, LINE);
  doc.font("Helvetica-Bold").fontSize(6.2).fillColor(MUTED).text("MELHOR PROPOSTA", sideX + 8, boxY + 8, { characterSpacing: 0.5, lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text(metrics.best?.supplier.name || "—", sideX + 8, boxY + 17, { width: sideWidth - 16 });
  doc.font("Helvetica-Bold").fontSize(14).fillColor(SUCCESS).text(formatCurrency(metrics.best?.total ?? null), sideX + 8, boxY + 30);
  doc.font("Helvetica-Bold").fontSize(6.2).fillColor(MUTED).text("ECONOMIA POTENCIAL", sideX + 8, boxY + 52, { characterSpacing: 0.5, lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(formatCurrency(metrics.isComparable ? metrics.savings : null), sideX + 8, boxY + 61);
  doc.font("Helvetica").fontSize(6.5).fillColor(MUTED).text(metrics.isComparable ? `${metrics.savingsPercent.toFixed(1)}% frente à maior proposta` : "Requer 2 propostas completas", sideX + 8, boxY + 76, { width: sideWidth - 16 });
  doc.y = boxY + 98;

  const confirmed = recordedSavings(draft);
  if (confirmed !== null && draft.analysis.outcome) {
    sectionTitle(doc, "4 · Resultado confirmado da contratação");
    const outcomeSupplier = draft.suppliers.find((supplier) => supplier.id === draft.analysis.outcome?.supplierId);
    paragraph(doc, `Fornecedor: ${outcomeSupplier?.name || "—"} · Valor de referência: ${formatCurrency(draft.analysis.outcome.referenceAmount)} · Valor contratado: ${formatCurrency(draft.analysis.outcome.contractedAmount)} · Diferença: ${formatCurrency(confirmed)}`, { bold: true, size: 8.4 });
  }

  sectionTitle(doc, `${confirmed !== null ? "5" : "4"} · Observações e aprovação`);
  ensureSpace(doc, 60);
  const notesY = doc.y;
  doc.rect(MARGIN, notesY, CONTENT_WIDTH, 40).lineWidth(0.7).stroke(LINE);
  doc.font("Helvetica").fontSize(8).fillColor(TEXT).text(draft.analysis.notes || "Sem observações adicionais registradas.", MARGIN + 8, notesY + 6, { width: CONTENT_WIDTH - 16 });
  doc.y = notesY + 46;
  ensureSpace(doc, 46);
  const signatureY = doc.y + 26;
  const signatureWidth = (CONTENT_WIDTH - 24) / 3;
  [
    ["Analista responsável", "Gerencial · Governança Condominial"],
    ["Síndico(a)", "Aprovação da assembleia / conselho"],
    ["Conselho consultivo", "Ciência e validação"],
  ].forEach((entry, index) => {
    const x = MARGIN + index * (signatureWidth + 12);
    doc.moveTo(x, signatureY).lineTo(x + signatureWidth, signatureY).lineWidth(0.8).strokeColor("#9CA3AF").stroke();
    doc.font("Helvetica-Bold").fontSize(6.4).fillColor(INK).text(entry[0].toUpperCase(), x, signatureY + 4, { characterSpacing: 0.4, lineBreak: false });
    doc.font("Helvetica").fontSize(6).fillColor(MUTED).text(entry[1], x, signatureY + 12, { width: signatureWidth });
  });

  footer(doc, protocol);
  doc.end();
  const buffer = await done;
  return { buffer, fileName };
}

type IndicatorsPayload = {
  condominium: string;
  start: string;
  end: string;
  generatedAt: Date;
  records: QuotationRecord[];
};

function monthLabel(month: string): string {
  const [year, number] = month.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(number) - 1] ?? number}/${year.slice(2)}`;
}

/** Gera o PDF dos indicadores com os mesmos critérios da tela de assembleia. */
export async function buildIndicatorsPdf(payload: IndicatorsPayload): Promise<{ buffer: Buffer; fileName: string }> {
  const fileName = indicatorsFileName({ condominium: payload.condominium, start: payload.start, end: payload.end });
  const { doc, done } = documentBase("Indicadores Gerencial", `Indicadores Gerencial · ${payload.condominium || "todos"}`);
  const records = payload.records
    .filter((record) => (!payload.condominium || record.condominium === payload.condominium) && (!payload.start || record.analysisDate >= payload.start) && (!payload.end || record.analysisDate <= payload.end))
    .map((record) => ({ record, metrics: computeMetrics(record), recorded: recordedSavings(record) }));
  const periodLabel = `${payload.start ? formatDateBR(payload.start) : "Início"} a ${payload.end ? formatDateBR(payload.end) : "hoje"}`;

  doc.rect(0, 0, PAGE_WIDTH, 84).fill(INK);
  doc.image(Buffer.from(GERENCIAL_LOGO_PNG, "base64"), MARGIN, 26, { height: 30 });
  doc.font("Helvetica").fontSize(6.5).fillColor(GOLD).text("INDICADORES PARA ASSEMBLEIA", MARGIN, 20, { width: CONTENT_WIDTH, align: "right", characterSpacing: 0.8 });
  doc.font("Helvetica-Bold").fontSize(19).fillColor("#FFFFFF").text("Resultados das cotações", MARGIN, 30, { width: CONTENT_WIDTH, align: "right" });
  doc.font("Helvetica").fontSize(7).fillColor("#FFFFFF").text(`${payload.condominium || "Todos os condomínios"} · ${periodLabel}`, MARGIN, 54, { width: CONTENT_WIDTH, align: "right" });
  doc.rect(0, 84, PAGE_WIDTH, 4).fill(GOLD);
  doc.y = 100;

  const confirmed = records.filter((entry) => entry.recorded !== null);
  const confirmedTotal = confirmed.reduce((sum, entry) => sum + (entry.recorded ?? 0), 0);
  const comparable = records.filter((entry) => entry.metrics.isComparable);
  const potentialTotal = comparable.reduce((sum, entry) => sum + entry.metrics.savings, 0);
  const withPrices = records.reduce((sum, entry) => sum + entry.metrics.rankings.filter((row) => row.total !== null).length, 0);
  const completed = records.filter((entry) => entry.record.status === "concluido").length;

  sectionTitle(doc, "Resumo do período", "Dados dos mapas salvos");
  ensureSpace(doc, 62);
  const cardWidth = (CONTENT_WIDTH - 18) / 4;
  [
    ["Economia confirmada", confirmed.length ? formatCurrency(confirmedTotal) : "—", `${confirmed.length} contratação(ões)`],
    ["Economia potencial", comparable.length ? formatCurrency(potentialTotal) : "—", `${comparable.length} comparativo(s)`],
    ["Mapas de cotação", String(records.length), `${completed} concluído(s)`],
    ["Propostas com valor", String(withPrices), "Fornecedores com preço"],
  ].forEach((entry, index) => {
    const x = MARGIN + index * (cardWidth + 6);
    const isPrimary = index === 0;
    doc.rect(x, doc.y, cardWidth, 54).fill(isPrimary ? INK : "#FFFFFF").lineWidth(0.7).stroke(isPrimary ? INK : LINE);
    doc.font("Helvetica-Bold").fontSize(5.8).fillColor(isPrimary ? "#FFFFFF" : MUTED).text(entry[0].toUpperCase(), x + 7, doc.y + 8, { characterSpacing: 0.4, width: cardWidth - 14 });
    doc.font("Helvetica-Bold").fontSize(12).fillColor(isPrimary ? "#FFFFFF" : INK).text(entry[1], x + 7, doc.y + 19, { width: cardWidth - 14 });
    doc.font("Helvetica").fontSize(6).fillColor(isPrimary ? "#FFFFFF" : MUTED).text(entry[2], x + 7, doc.y + 38, { width: cardWidth - 14 });
  });
  doc.y += 62;

  sectionTitle(doc, "Economia por mês", "Potencial versus confirmada");
  const grouped = new Map<string, { count: number; potential: number; recorded: number }>();
  for (const entry of records) {
    const key = entry.record.analysisDate.slice(0, 7);
    const value = grouped.get(key) ?? { count: 0, potential: 0, recorded: 0 };
    value.count += 1;
    if (entry.metrics.isComparable) value.potential += entry.metrics.savings;
    if (entry.recorded !== null) value.recorded += entry.recorded;
    grouped.set(key, value);
  }
  const months = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8);
  if (months.length === 0) {
    paragraph(doc, "Sem dados para o período selecionado.", { size: 8, color: MUTED });
  } else {
    doc.y = drawTable(doc, {
      x: MARGIN,
      y: doc.y,
      width: CONTENT_WIDTH,
      columns: [
        { label: "Mês", width: 70 },
        { label: "Mapas", width: 52, align: "center" },
        { label: "Economia potencial", width: 130, align: "right" },
        { label: "Economia confirmada", width: 130, align: "right" },
        { label: "Observação", width: 140 },
      ],
      rows: months.map(([month, value]) => ({
        cells: [
          monthLabel(month),
          String(value.count),
          formatCurrency(value.potential),
          value.recorded === 0 && !records.some((entry) => entry.recorded !== null && entry.record.analysisDate.startsWith(month)) ? "—" : formatCurrency(value.recorded),
          value.recorded < 0 ? "Contratação acima da referência" : "",
        ],
      })),
    });
  }
  doc.y += 6;

  sectionTitle(doc, "Composição das propostas", "Menores propostas completas do período");
  ensureSpace(doc, 56);
  const composition: Record<"mao_obra" | "material" | "nao_discriminado", number> = { mao_obra: 0, material: 0, nao_discriminado: 0 };
  for (const entry of comparable) {
    if (!entry.metrics.best) continue;
    const breakdown = supplierCostBreakdown(entry.record.items, entry.metrics.best.supplier.id);
    composition.mao_obra += breakdown.mao_obra.total ?? 0;
    composition.material += breakdown.material.total ?? 0;
    composition.nao_discriminado += breakdown.nao_discriminado.total ?? 0;
  }
  const hasComposition = comparable.length > 0;
  doc.y = drawTable(doc, {
    x: MARGIN,
    y: doc.y,
    width: CONTENT_WIDTH,
    columns: [
      { label: "Tipo de custo", width: 200 },
      { label: "Valor", width: 130, align: "right" },
    ],
    rows: (["mao_obra", "material", "nao_discriminado"] as const).map((type) => ({
      cells: [COST_TYPE_LABEL[type], hasComposition ? formatCurrency(composition[type]) : "—"],
    })),
  });
  doc.y += 6;

  sectionTitle(doc, "Mapas do período", "Clique no mapa no aplicativo para editar valores");
  if (records.length === 0) {
    paragraph(doc, "Nenhum mapa encontrado para os filtros selecionados.", { size: 8, color: MUTED });
  } else {
    doc.y = drawTable(doc, {
      x: MARGIN,
      y: doc.y,
      width: CONTENT_WIDTH,
      columns: [
        { label: "Condomínio / objeto", width: 180 },
        { label: "Data", width: 62 },
        { label: "Status", width: 60 },
        { label: "Potencial", width: 88, align: "right" },
        { label: "Confirmada", width: 88, align: "right" },
      ],
      rows: records.map((entry) => ({
        cells: [
          `${entry.record.condominium || "Não informado"} — ${entry.record.service || entry.record.protocol}`,
          formatDateBR(entry.record.analysisDate),
          STATUS_LABEL[entry.record.status],
          entry.metrics.isComparable ? formatCurrency(entry.metrics.savings) : "—",
          formatCurrency(entry.recorded),
        ],
      })),
    });
  }

  ensureSpace(doc, 40);
  paragraph(doc, "Como ler: economia potencial compara a maior e a menor proposta com cobertura completa; economia confirmada usa o valor de referência e o valor contratado confirmados em mapas concluídos. Valores negativos indicam contratação acima da referência. Esses números não representam lucro contábil.", { size: 7, color: MUTED });

  footer(doc, `${payload.condominium || "Todos os condomínios"} · ${periodLabel}`);
  doc.end();
  const buffer = await done;
  return { buffer, fileName };
}
