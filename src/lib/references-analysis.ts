import { brl } from "@/lib/brand";
import { defaultBriefing } from "@/lib/proposal/catalog";
import type { GeneratorSettings } from "@/lib/proposal/generate";
import type { Briefing, ProposalDraft, ProposalItem, ProposalSection, SectionTableRow, ProposalType } from "@/lib/proposal/types";
import { parseBrl } from "@/lib/references";

export type ScopeId =
  | "cftv"
  | "acesso"
  | "perimetro"
  | "rede"
  | "monitoramento"
  | "manutencao"
  | "servicos"
  | "outros";

export const SCOPE_DEFINITIONS: { id: ScopeId; name: string; keywords: RegExp[]; service: boolean }[] = [
  {
    id: "cftv",
    name: "CFTV IP",
    service: false,
    keywords: [/camera/, /cftv/, /\bnvr\b/, /\bdvr\b/, /bullet/, /dome/, /lente/, /gravad/, /video/, /4k/, /ip6[67]/, /colorvu/, /vigilanc/, /speed ?dome/, /analitic/, /imagem/],
  },
  {
    id: "acesso",
    name: "Controle de Acesso",
    service: false,
    keywords: [/acesso/, /facial/, /biometr/, /fechadura/, /eletroim/, /catraca/, /\brfid\b/, /cartao/, /botoeira/, /controlador/, /interfon/, /portaria remota/, /torniquete/, /leitor/, /tag/],
  },
  {
    id: "perimetro",
    name: "Perímetro e Alarme",
    service: false,
    keywords: [/cerca/, /perimetr/, /haste/, /fio de aco/, /choque/, /sirene/, /alarme/, /sensor/, /\bivp\b/, /infravermelho/],
  },
  {
    id: "rede",
    name: "Rede e Infraestrutura",
    service: false,
    keywords: [/switch/, /rack/, /nobreak/, /cabeamento/, /cat ?6/, /cat ?5/, /patch/, /\bdps\b/, /aterramento/, /fibra/, /roteador/, /\bpoe\b/, /quadro/, /vlan/, /storage|servidor/, /eletrocalha/, /conector/],
  },
  {
    id: "monitoramento",
    name: "Monitoramento e NOC",
    service: true,
    keywords: [/monitoramento/, /\bnoc\b/, /ronda virtual/, /24 ?h/, /suporte remoto/, /nuvem/, /aplicativo|\bapp\b/],
  },
  {
    id: "manutencao",
    name: "Manutenção Mensal",
    service: true,
    keywords: [/manutencao/, /preventiva/, /corretiva/, /visita tecnica/, /hora tecnica/, /contrato mensal/],
  },
  {
    id: "servicos",
    name: "Projeto e Serviços Técnicos",
    service: true,
    keywords: [/instalacao/, /configuracao/, /comissionamento/, /\bprojeto\b/, /\bart\b/, /as.?built/, /memorial/, /treinamento/, /laudo/, /mao de obra/, /frete/, /deslocamento/, /testes?/],
  },
  { id: "outros", name: "Itens Complementares", service: false, keywords: [] },
];

export type ReferenceDocumentInput = {
  id: string;
  fileName: string;
  extractedText: string | null;
  manualText: string | null;
  note: string | null;
  pages: number | null;
  layoutRows: string[][] | null;
};

export type CompetitorItem = {
  id: string;
  description: string;
  spec: string;
  qty: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  scope: ScopeId;
  scopeName: string;
  sourceFile: string;
  recurring: boolean;
  rawLine: string;
};

export type CompetitorDocument = {
  id: string;
  fileName: string;
  hasText: boolean;
  usedManualText: boolean;
  usedLayout: boolean;
  pages: number | null;
  itemCount: number;
  declaredTotal: number | null;
  detectedItemsTotal: number;
  adoptedTotal: number;
  conditions: string[];
};

export type CompetitorScope = {
  id: ScopeId;
  name: string;
  items: CompetitorItem[];
  subtotal: number;
  service: boolean;
};

export type CompetitorAnalysis = {
  documents: CompetitorDocument[];
  items: CompetitorItem[];
  scopes: CompetitorScope[];
  conditions: string[];
  matchedValue: number;
  itemsValue: number;
  monthlyValue: number;
  note: string;
  warnings: string[];
  hasCftvAndAccess: boolean;
  source: string;
};

const MONEY = /R\$\s*-?\s*([\d]{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/g;
const TOTAL_LABEL = /\b(total|valor total|total geral|investimento|valor global|total do projeto|total da proposta|soma)\b/i;
const IGNORE_LABEL = /\b(subtotal|desconto|frete|cotacao|or[cç]amento n|cnpj|cpf|telefone|e-?mail|validade|pagamento|garantia|prazo|obs|condi[cç][õo]es|data|cliente|endere[cç]o)\b/i;
const UNIT_CELL = /^(un|und|unid|und\.|pç|pc|peca|peça|vb|m|mt|m²|m2|kg|kit|cj|conj|mes|mês|porta|portas|ponto|pontos|camera|câmera|cam|licen[çc]a|hora|h)$/i;
const SPEC = /\b(?:DS-?[A-Z0-9-]{4,}|[A-Z]{2,}[A-Z0-9]*-[A-Z0-9-]{3,}|4K|8TB|6TB|4TB|2TB|IP6[67]|IK10|PoE|CAT ?6|CAT ?5E?|NVR|DVR|WDR|RAID ?1|H\.?265\+?|ONVIF|RFID|TCP\/IP|12 ?V|127\/220 ?V)\b/gi;

const normalize = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/* -------------------------------------------------------------------------- */
/* Leitura de linhas e células                                                */
/* -------------------------------------------------------------------------- */

function moneyValues(value: string): number[] {
  const out: number[] = [];
  for (const match of value.matchAll(MONEY)) {
    const number = parseBrl(match[1]);
    if (number > 0) out.push(number);
  }
  // Números no formato brasileiro sem "R$" (tabelas com coluna de valores).
  if (!out.length) {
    const bare = value.match(/(?:^|\s)(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})(?=\s|$)/g);
    for (const item of bare ?? []) {
      const number = parseBrl(item.trim());
      if (number > 0) out.push(number);
    }
  }
  return out;
}

function headerish(cells: string[]) {
  const joined = cells.join(" ");
  return /descri[cç][aã]o|produto|equipamento|quantidade|qtd|unit[aá]rio|valor total|vl\.? unit|vl\.? total|item\b/i.test(joined);
}

function classifyScope(description: string): ScopeId {
  // Compara sem acentos e sem diferença de caixa: "Câmera" e "CAMERA" caem no mesmo escopo.
  const haystack = normalize(description);
  let best: ScopeId = "outros";
  let score = 0;
  for (const definition of SCOPE_DEFINITIONS) {
    let current = 0;
    for (const keyword of definition.keywords) {
      const probe = new RegExp(keyword.source, "i");
      if (probe.test(haystack)) current += 1;
    }
    if (current > score) {
      score = current;
      best = definition.id;
    }
  }
  return best;
}

const scopeName = (id: ScopeId) => SCOPE_DEFINITIONS.find((scope) => scope.id === id)?.name ?? "Itens Complementares";

function extractSpec(line: string): string {
  const found = [...line.matchAll(SPEC)].map((match) => match[0].replace(/\s+/g, " "));
  return [...new Set(found)].slice(0, 6).join(" · ").slice(0, 180);
}

function cleanDescription(value: string): string {
  return value
    .replace(/\s*[|]\s*/g, " ")
    .replace(/^[•\-–*]\s*/, "")
    .replace(/\b(?:qtd|qtde|quant\.?|quantidade)\b\s*[:.]?\s*\d+/gi, " ")
    .replace(/^[\d.,]+\s*/, "")
    .replace(/\s*[-–]\s*(?=R\$)/g, " ")
    .replace(/[\s:;,\-–]+$/, "")
    .replace(/[\s:;,]+/g, " ")
    .trim()
    .slice(0, 180);
}

type ParsedRow = Omit<CompetitorItem, "id" | "scope" | "scopeName" | "sourceFile">;

/**
 * Interpreta uma linha do orçamento concorrente.
 * Aceita tanto linhas em texto corrido quanto colunas separadas pelo layout:
 * [descrição] [qtd] [un] [unitário] [total].
 */
function parseRow(cells: string[], fileHint: string): ParsedRow | null {
  const values = cells.map((cell) => cell.trim()).filter(Boolean);
  if (!values.length || headerish(values)) return null;
  const joined = values.join(" | ");
  if (IGNORE_LABEL.test(joined) && !TOTAL_LABEL.test(joined)) return null;

  const numericCells: { index: number; values: number[] }[] = [];
  values.forEach((cell, index) => {
    const money = moneyValues(cell);
    if (money.length) numericCells.push({ index, values: money });
  });
  if (!numericCells.length) return null;

  // Quantidade: célula inteira (sem preço) entre a descrição e os valores.
  const firstMoneyIndex = numericCells[0].index;
  let qty: number | null = null;
  let qtyIndex = -1;
  for (let index = 0; index < firstMoneyIndex; index += 1) {
    const cell = values[index];
    const integer = cell.match(/^(\d{1,4})(?:\s*(?:x|un|und|unid|pç|pc|portas?|pontos?|cams?|câmeras?))?$/i);
    if (integer) {
      const candidate = Number(integer[1]);
      if (candidate > 0 && candidate <= 5000) {
        qty = candidate;
        qtyIndex = index;
      }
    }
  }

  // Unidade: célula curta e reconhecida, ou sufixo no texto da descrição.
  let unit = "un";
  let unitFromCell = false;
  for (let index = 0; index < values.length; index += 1) {
    if (index === qtyIndex) continue;
    const cell = values[index];
    if (UNIT_CELL.test(cell)) {
      unit = /mes|mês/i.test(cell) ? "mês" : /^(m|mt|m²|m2)$/i.test(cell) ? "m" : cell.toLowerCase().replace(".", "");
      unitFromCell = true;
      break;
    }
  }
  if (!unitFromCell) {
    const suffix = joined.match(/(\d{1,4})\s*(portas?|pontos?|metros?|m\b|cams?|câmeras?|horas?)/i);
    if (suffix) {
      qty = qty ?? Number(suffix[1]);
      unit = /porta/i.test(suffix[2]) ? "porta" : /ponto/i.test(suffix[2]) ? "ponto" : /metro|m\b/i.test(suffix[2]) ? "m" : /hora/i.test(suffix[2]) ? "h" : "un";
    }
  }

  // Descrição: células que não são quantidade, unidade nem preço.
  const descriptionCells = values.filter(
    (_, index) => index !== qtyIndex && !numericCells.some((cell) => cell.index === index) && !UNIT_CELL.test(values[index]),
  );
  const description = cleanDescription(descriptionCells.join(" "));
  if (description.length < 4) return null;

  const money = numericCells.flatMap((cell) => cell.values);
  let unitPrice = money[0];
  let lineTotal = money[0];
  if (money.length >= 2) {
    const first = money[0];
    const last = money[money.length - 1];
    const implied = last / first;
    if (last > first && Math.abs(implied - Math.round(implied)) < 0.05 && implied >= 2 && implied <= 5000) {
      qty = qty ?? Math.round(implied);
      lineTotal = last;
      unitPrice = first;
    } else if (qty && qty > 1 && Math.abs(first * qty - last) < Math.max(1, last * 0.02)) {
      unitPrice = first;
      lineTotal = last;
    } else {
      unitPrice = last;
      lineTotal = last;
    }
  }
  if (qty && qty > 1) unitPrice = Math.round((lineTotal / qty) * 100) / 100;
  else qty = 1;

  const scope = classifyScope(`${description} ${fileHint}`);
  const recurring = /\/\s*m[eê]s|por m[eê]s|mensal|\bm[eê]s\b/i.test(joined) && (scope === "monitoramento" || scope === "manutencao" || unit === "mês");

  return {
    description,
    spec: extractSpec(joined),
    qty: Math.max(1, Math.round(qty ?? 1)),
    unit: recurring ? "mês" : unit,
    unitPrice: Math.round(unitPrice * 100) / 100,
    lineTotal: Math.round(lineTotal * 100) / 100,
    recurring,
    rawLine: joined.slice(0, 400),
  };
}

/* -------------------------------------------------------------------------- */
/* Análise por documento                                                      */
/* -------------------------------------------------------------------------- */

function textToCells(line: string): string[] {
  if (line.includes("|")) return line.split("|").map((cell) => cell.trim()).filter(Boolean);
  // Texto corrido: separa preços e quantidades sem perder a descrição.
  return [line];
}

function analyzeDocument(doc: ReferenceDocumentInput) {
  const manual = (doc.manualText ?? "").trim();
  const source = manual || (doc.extractedText ?? "").trim();
  const usedManualText = manual.length > 0;
  const layout = !manual && doc.layoutRows && doc.layoutRows.length >= 3 ? doc.layoutRows : null;
  const usedLayout = Boolean(layout);

  const rows: string[][] = [];
  if (layout) rows.push(...layout);
  else {
    for (const line of source.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      rows.push(textToCells(trimmed));
    }
  }

  const items: ParsedRow[] = [];
  const conditions: string[] = [];
  let declaredTotal: number | null = null;

  for (const cells of rows) {
    const joined = cells.join(" | ");
    if (TOTAL_LABEL.test(joined) && !IGNORE_LABEL.test(joined.replace(TOTAL_LABEL, ""))) {
      const money = moneyValues(joined);
      if (money.length) declaredTotal = Math.max(declaredTotal ?? 0, money[money.length - 1]);
      continue;
    }
    const parsed = parseRow(cells, doc.fileName);
    if (parsed) {
      // "Instalação" duplicada em colunas separadas: mantém apenas a linha com valor.
      items.push(parsed);
      continue;
    }
    if (!moneyValues(joined) && joined.length < 240 && /pagamento|prazo|validade|garantia|frete|condi|observ|imposto|parcel/i.test(joined)) {
      if (conditions.length < 16) conditions.push(prazoLimpo(joined));
    }
  }

  // Remoção de duplicidade exata (mesma descrição e valor).
  const unique: ParsedRow[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${normalize(item.description).slice(0, 70)}|${item.lineTotal}|${item.qty}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  const itemsTotal = Math.round(unique.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
  return { items: unique, declaredTotal, itemsTotal, conditions, hasText: source.length > 0, usedManualText, usedLayout };
}

function prazoLimpo(value: string) {
  return value.replace(/\s+/g, " ").replace(/\s*[|]\s*/g, " ").trim().slice(0, 220);
}

/* -------------------------------------------------------------------------- */
/* Consolidação                                                               */
/* -------------------------------------------------------------------------- */

export function analyzeCompetitorDocuments(docs: ReferenceDocumentInput[]): CompetitorAnalysis {
  const documents: CompetitorDocument[] = [];
  const items: CompetitorItem[] = [];
  const conditions: string[] = [];
  const warnings: string[] = [];
  let matchedValue = 0;
  let monthlyValue = 0;

  for (const doc of docs) {
    const parsed = analyzeDocument(doc);
    const adoptedTotal = Math.max(parsed.declaredTotal ?? 0, parsed.itemsTotal);
    matchedValue += adoptedTotal;
    monthlyValue += parsed.items.filter((item) => item.recurring).reduce((sum, item) => sum + item.lineTotal, 0);
    parsed.items.forEach((item, index) => {
      const scope = classifyScope(`${item.description} ${doc.fileName}`);
      items.push({
        ...item,
        id: `ref-${doc.id}-${index}`,
        scope,
        scopeName: scopeName(scope),
        sourceFile: doc.fileName,
      });
    });
    parsed.conditions.forEach((line) => {
      if (conditions.length < 18 && !conditions.includes(line)) conditions.push(line);
    });

    documents.push({
      id: doc.id,
      fileName: doc.fileName,
      hasText: parsed.hasText,
      usedManualText: parsed.usedManualText,
      usedLayout: parsed.usedLayout,
      pages: doc.pages,
      itemCount: parsed.items.length,
      declaredTotal: parsed.declaredTotal,
      detectedItemsTotal: parsed.itemsTotal,
      adoptedTotal,
      conditions: parsed.conditions,
    });

    if (!parsed.hasText) {
      warnings.push(`"${doc.fileName}" não tem texto legível (PDF escaneado ou imagem). Use “Transcrever” e cole os itens com quantidade e valor.`);
    } else if (!parsed.items.length) {
      warnings.push(`"${doc.fileName}": nenhum equipamento com valor foi identificado. Confira a transcrição para separar descrição, quantidade e preço.`);
    }
    if (parsed.declaredTotal !== null && parsed.itemsTotal > parsed.declaredTotal * 1.02) {
      warnings.push(`Em "${doc.fileName}", a soma dos itens (${brl(parsed.itemsTotal)}) ficou acima do total declarado (${brl(parsed.declaredTotal)}). O valor do concorrente foi mantido e os itens foram ajustados proporcionalmente, sem alterar quantidades.`);
    }
    if (parsed.declaredTotal !== null && parsed.declaredTotal > parsed.itemsTotal * 1.02 && parsed.items.length) {
      warnings.push(`Em "${doc.fileName}", o total declarado (${brl(parsed.declaredTotal)}) é maior que a soma dos itens identificados (${brl(parsed.itemsTotal)}). A diferença foi lançada como item de equalização, sem inventar equipamentos.`);
    }
  }

  // Equalização positiva: mantém o valor do concorrente com um item explícito.
  for (const doc of documents) {
    const difference = Math.round((doc.adoptedTotal - doc.detectedItemsTotal) * 100) / 100;
    if (difference > 0.5 && doc.itemCount > 0) {
      const scope: ScopeId = "outros";
      items.push({
        id: `equal-${doc.id}`,
        description: `Serviços e complementos não detalhados — equalização com ${doc.fileName}`,
        spec: "Diferença entre o total declarado e os itens lidos. Revise antes de enviar.",
        qty: 1,
        unit: "vb",
        unitPrice: difference,
        lineTotal: difference,
        scope,
        scopeName: scopeName(scope),
        sourceFile: doc.fileName,
        recurring: false,
        rawLine: "Equalização de valor",
      });
    } else if (!doc.itemCount && doc.adoptedTotal > 0) {
      const scope: ScopeId = "outros";
      items.push({
        id: `single-${doc.id}`,
        description: `Escopo da proposta de referência — ${doc.fileName}`,
        spec: "Sem itens detalhados no arquivo; transcreva para discriminar equipamentos.",
        qty: 1,
        unit: "vb",
        unitPrice: doc.adoptedTotal,
        lineTotal: doc.adoptedTotal,
        scope,
        scopeName: scopeName(scope),
        sourceFile: doc.fileName,
        recurring: false,
        rawLine: "Total declarado",
      });
    }
  }

  // Equalização negativa: se a leitura somou mais que o total, ajusta proporcionalmente
  // para o total exato do concorrente, preservando quantidades e descrições.
  const target = Math.round(matchedValue * 100) / 100;
  let itemsValue = Math.round(items.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
  if (target > 0 && Math.abs(itemsValue - target) > 0.02) {
    const factor = target / itemsValue;
    for (const item of items) {
      item.unitPrice = Math.round(item.unitPrice * factor * 100) / 100;
      item.lineTotal = Math.round(item.qty * item.unitPrice * 100) / 100;
    }
    itemsValue = Math.round(items.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
    const residual = Math.round((target - itemsValue) * 100) / 100;
    if (Math.abs(residual) >= 0.01 && items.length) {
      const last = items[items.length - 1];
      last.lineTotal = Math.round((last.lineTotal + residual) * 100) / 100;
      last.unitPrice = Math.round((last.lineTotal / last.qty) * 100) / 100;
      itemsValue = Math.round(items.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
    }
    if (items.length && documents.some((doc) => doc.itemCount)) {
      warnings.push("Os itens lidos somavam mais que o total do concorrente; os preços unitários foram ajustados proporcionalmente para o mesmo total, mantendo descrições e quantidades.");
    }
  }

  const scopes: CompetitorScope[] = SCOPE_DEFINITIONS.map((definition) => {
    const scopeItems = items.filter((item) => item.scope === definition.id);
    return {
      id: definition.id,
      name: definition.name,
      items: scopeItems,
      subtotal: Math.round(scopeItems.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100,
      service: definition.service,
    };
  }).filter((scope) => scope.items.length > 0);

  const hasCftvAndAccess = scopes.some((scope) => scope.id === "cftv") && scopes.some((scope) => scope.id === "acesso");
  if (!docs.length) warnings.push("Nenhum arquivo de referência enviado.");
  if (docs.length > 1) {
    warnings.push(`${docs.length} arquivos foram tratados como documentos complementares do mesmo concorrente. Se forem propostas alternativas, exclua as que não devem compor a igualdade.`);
  }
  const layouts = documents.filter((doc) => doc.usedLayout).length;
  if (layouts) warnings.push(`${layouts} arquivo(s) lidos pela posição das colunas (descrição, quantidade, unitário e total), o que melhora a leitura de tabelas.`);

  return {
    documents,
    items,
    scopes,
    conditions,
    matchedValue: target,
    itemsValue,
    monthlyValue: Math.round(monthlyValue * 100) / 100,
    note: `Valores iguais aos da proposta de referência (${brl(target)}). Nenhum desconto ou preço menor foi aplicado — edite os preços no editor depois de salvar.`,
    warnings,
    hasCftvAndAccess,
    source: "Motor de análise Cipriano · colunas do PDF, equipamentos, quantidades e escopos",
  };
}

/* -------------------------------------------------------------------------- */
/* Proposta igualada                                                          */
/* -------------------------------------------------------------------------- */

export type MatchedProposalInput = {
  analysis: CompetitorAnalysis;
  type: ProposalType;
  clientName: string;
  contact: string;
  clientEmail: string;
  site: string;
  validityDays: number;
  settings: GeneratorSettings;
};

export function buildMatchedProposal(input: MatchedProposalInput): ProposalDraft {
  const { analysis, type, settings } = input;
  const scopeService = new Map(SCOPE_DEFINITIONS.map((scope) => [scope.id, scope.service]));
  const items: ProposalItem[] = analysis.items.map((item, index) => ({
    id: `matched-${index}`,
    kind: scopeService.get(item.scope) ? "servico" : "equipamento",
    desc: item.description,
    spec: [item.spec, `Escopo: ${item.scopeName}`, `Ref.: ${item.sourceFile}`].filter(Boolean).join(" · "),
    unit: item.unit,
    qty: item.qty,
    price: item.unitPrice,
    scope: item.scopeName,
  }));

  const sections: ProposalSection[] = [];
  const add = (
    id: string,
    title: string,
    body: string,
    kind: ProposalSection["kind"] = "text",
    extra: Partial<ProposalSection> = {},
  ) => sections.push({ id, title, body, enabled: true, kind, ...extra });

  const scopeNames = analysis.scopes.map((scope) => scope.name).join(", ") || "escopo a detalhar";
  add(
    "objeto",
    "Objeto",
    `Proposta comercial de segurança eletrônica para ${input.clientName || "o cliente"}, elaborada com escopo e valor equivalentes à documentação de referência apresentada.\n\nEscopos: ${scopeNames}.\n\nLocal: ${input.site || "a confirmar"}.\n\nValor total igualado à referência: ${brl(analysis.matchedValue)}. Nenhum desconto foi aplicado automaticamente; os preços permanecem editáveis.`,
  );

  if (type === "completa") {
    add(
      "empresa",
      "Cipriano Tech & Security",
      `${settings.companyName} atua em projetos, instalação, manutenção e monitoramento de segurança eletrônica. Responsável técnico: ${settings.director} · ${settings.crea} · CNPJ ${settings.cnpj}.`,
    );
    add(
      "objetivo",
      "Objetivo",
      "Apresentar proposta equivalente à referência, com os mesmos equipamentos, quantidades e valores, organizada por disciplina técnica para facilitar a conferência e a comparação pelo cliente.",
    );
  }

  // Resumo dos escopos em tabela, com subtotal por disciplina.
  const summaryRows: SectionTableRow[] = analysis.scopes.map((scope) => ({
    label: scope.name,
    cipriano: `${scope.items.length} item(ns) · ${brl(scope.subtotal)}`,
    client: scope.items.map((item) => `${item.qty} ${item.unit}`).join(" + ").slice(0, 80),
  }));
  add(
    "resumo-escopos",
    "Resumo por escopo",
    "Os escopos estão separados por disciplina. CFTV IP e Controle de Acesso compartilham a mesma rede, o mesmo rack e a mesma alimentação, porém são apresentados em seções distintas para conferência do cliente, sem duplicidade de infraestrutura.",
    "table",
    {
      rows: summaryRows,
      columns: ["Escopo", "Itens e subtotal", "Quantidades"],
    },
  );

  for (const scope of analysis.scopes) {
    const lines = scope.items.map(
      (item) =>
        `• ${item.qty} ${item.unit} — ${item.description}${item.spec ? ` (${item.spec})` : ""} · unitário ${brl(item.unitPrice)} · subtotal ${brl(item.lineTotal)}.`,
    );
    add(`escopo-${scope.id}`, `Escopo · ${scope.name}`, `${lines.join("\n")}\n\nSubtotal do escopo: ${brl(scope.subtotal)}.`);
  }

  add(
    "integracao",
    "Integração entre os escopos",
    analysis.hasCftvAndAccess
      ? "CFTV IP e Controle de Acesso são escopos distintos, apresentados separadamente para melhor visualização das quantidades e dos valores. Ambos utilizam a mesma infraestrutura de rede, cabeamento estruturado, rack, nobreak e alimentação — itens compartilhados aparecem uma única vez, sem cobrança em duplicidade."
      : "Os escopos foram separados por disciplina técnica. Quando compartilham rede, cabeamento, rack ou alimentação, tais itens aparecem uma única vez, evitando duplicidade de cobrança. Equipamentos e quantidades permanecem discriminados em cada seção.",
    "text",
  );

  add(
    "equipamentos",
    "Lista de Equipamentos e Serviços",
    "Itens agrupados por escopo, com as mesmas quantidades, descrições e valores da proposta de referência. Confira cada linha antes de enviar.",
    "items",
  );

  add(
    "valor",
    "Valor",
    `Valor total igualado à referência: ${brl(analysis.matchedValue)}. Não houve redução automática de preço. Alterações de valor são feitas no editor da proposta, item a item.`,
    "totals",
  );

  const conditionBullets = analysis.conditions.length
    ? analysis.conditions.slice(0, 10).map((line) => `• ${line}`)
    : [
        `• Pagamento: ${settings.defaultPaymentTerms}`,
        `• Prazo de execução: ${settings.defaultDeliveryTime}`,
        `• Garantia: ${settings.defaultWarranty}`,
        `• Validade da proposta: ${input.validityDays} dias corridos a partir da emissão`,
      ];
  add("condicoes", "Condições Comerciais", conditionBullets.join("\n"), "terms");

  if (type === "completa") {
    add(
      "responsabilidades",
      "Responsabilidades e exclusões",
      `A ${settings.companyName} executa fornecimento, instalação, configuração e comissionamento conforme os escopos discriminados. O cliente disponibiliza acesso, pontos de energia, infraestrutura de rede quando necessária e responsável para aprovações. Obras civis, pontos elétricos e itens não listados dependem de orçamento complementar aprovado por escrito.`,
    );
    add(
      "validade",
      "Validade e Aceite",
      `Validade de ${input.validityDays} dias corridos a partir da emissão. O aceite deve ser formalizado por escrito; a execução se inicia após a liberação da obra.`,
    );
  }

  add("aceite", "Aceite", "Ao assinar, o cliente declara estar de acordo com os escopos, equipamentos, quantidades e valores desta proposta.");

  const briefing: Briefing = {
    ...defaultBriefing,
    purpose: "projeto",
    maintenance: false,
    monitoring: analysis.scopes.some((scope) => scope.id === "monitoramento"),
    notes: analysis.note,
  };

  return {
    type,
    clientName: input.clientName.trim(),
    contact: input.contact,
    clientEmail: input.clientEmail,
    site: input.site,
    validityDays: input.validityDays,
    discountPct: 0,
    items,
    sections,
    paymentTerms: settings.defaultPaymentTerms,
    deliveryTime: settings.defaultDeliveryTime,
    warranty: settings.defaultWarranty,
    artIncluded: false,
    briefing,
  };
}

export function matchedInsights(analysis: CompetitorAnalysis, totals: { totalCents: number }) {
  const out: { tone: "info" | "warn" | "ok"; title: string; detail: string }[] = [
    {
      tone: Math.abs(totals.totalCents / 100 - analysis.matchedValue) < 0.05 ? "ok" : "warn",
      title: "Valores iguais à referência, sem desconto",
      detail: `Referência ${brl(analysis.matchedValue)} · proposta ${brl(totals.totalCents / 100)}. Quantidades preservadas; altere os preços no editor depois de salvar.`,
    },
    {
      tone: "info",
      title: `${analysis.items.length} itens em ${analysis.scopes.length} escopo(s)`,
      detail: analysis.scopes.map((scope) => `${scope.name}: ${scope.items.length} item(ns) · ${brl(scope.subtotal)}`).join(" | "),
    },
  ];
  if (analysis.hasCftvAndAccess) {
    out.push({
      tone: "info",
      title: "CFTV IP e Controle de Acesso separados",
      detail: "Cada disciplina tem sua própria seção e tabela. O bloco de integração explica a rede compartilhada sem duplicar infraestrutura.",
    });
  }
  for (const warning of analysis.warnings.slice(0, 2)) out.push({ tone: "warn", title: "Confira a leitura", detail: warning });
  return out;
}
