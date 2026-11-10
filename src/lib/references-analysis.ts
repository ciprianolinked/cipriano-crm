import { brl } from "@/lib/brand";
import { calcTotals, defaultBriefing } from "@/lib/proposal/catalog";
import type { GeneratorSettings } from "@/lib/proposal/generate";
import type { Briefing, ProposalDraft, ProposalItem, ProposalSection, ProposalType } from "@/lib/proposal/types";
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

export const SCOPE_DEFINITIONS: {
  id: ScopeId;
  name: string;
  keywords: RegExp[];
  service: boolean;
}[] = [
  {
    id: "cftv",
    name: "CFTV IP",
    service: false,
    keywords: [/c[aâ]mera/, /cftv/, /nvr/, /dvr/, /bullet/, /dome/, /lente/, /gravad/, /video/, /v[ií]deo/, /4k/, /ip67/, /colorvu/, /hd de vigil[aâ]ncia/, /poe/],
  },
  {
    id: "acesso",
    name: "Controle de Acesso",
    service: false,
    keywords: [/acesso/, /facial/, /biom[eé]tr/, /fechadura/, /eletro[ií]m[aã]/, /catraca/, /rfid/, /cart[aã]o/, /botoeira/, /controlador/, /interfonia/, /portaria remota/, /torniquete/],
  },
  {
    id: "perimetro",
    name: "Perímetro e Alarme",
    service: false,
    keywords: [/cerca/, /per[ií]metro/, /haste/, /fio de a[cç]o/, /central de choque/, /sirene/, /alarme/, /sensor/, /ivp/, /cftv.*perimet/],
  },
  {
    id: "rede",
    name: "Rede e Infraestrutura",
    service: false,
    keywords: [/switch/, /rack/, /nobreak/, /cabeamento/, /cat6/, /cat5/, /patch/, /dps/, /aterramento/, /fibra/, /roteador/, /energia/, /quadro/, /vlan/, /servidor/, /storage/],
  },
  {
    id: "monitoramento",
    name: "Monitoramento e NOC",
    service: true,
    keywords: [/monitoramento/, /noc/, /ronda virtual/, /central de monitoramento/, /24h/, /suporte remoto/, /app cipriano/, /visualiza[cç][aã]o remota/],
  },
  {
    id: "manutencao",
    name: "Manutenção Mensal",
    service: true,
    keywords: [/manuten[cç][aã]o/, /preventiva/, /corretiva/, /visita t[eé]cnica/, /hora t[eé]cnica/, /atendimento mensal/, /contrato de manuten/],
  },
  {
    id: "servicos",
    name: "Projeto e Serviços Técnicos",
    service: true,
    keywords: [/instala[cç][aã]o/, /configura[cç][aã]o/, /comissionamento/, /projeto/, /art\b/, /as[- ]built/, /memorial/, /treinamento/, /laudo/, /m[aã]o de obra/, /configura/, /testes/],
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
  pages: number | null;
  textLength: number;
  itemCount: number;
  declaredTotal: number | null;
  detectedItemsTotal: number;
  adoptedTotal: number;
  conditionLines: string[];
  notes: string[];
};

export type CompetitorScope = {
  id: ScopeId;
  name: string;
  items: CompetitorItem[];
  subtotal: number;
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

const PRICE_RE = /R\$\s*([\d]{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/g;
const TOTAL_RE = /\b(total|valor total|total geral|investimento|valor global|or[cç]amento total|total do projeto|total da proposta|grand total)\b/i;
const CONDITION_RE = /^(pagamento|prazo|validade|garantia|entrega|frete|condi[cç][õo]es|impostos?|observa[cç][õo]es|desconto|parcelamento|forma de pagamento)\b/i;
const UNIT_RE = /(\d+)\s*(?:x\s*)?(?:unidades?|un\.?|und\.?|unid\.?|p[cç]\.?|pe[cç]as?|c[aâ]meras?|cams?|portas?|pontos?|metros?|m\b|vb|conjuntos?|kits?|licen[cç]as?|meses|m[eê]s|mensal)/i;
const QTY_FIELD_RE = /(?:qtd|qtde|quant\.?|quantidade)\s*[:.]?\s*(\d+)/i;
const SPEC_RE = /\b(?:DS-[A-Z0-9-]+|4K|8TB|4TB|2TB|IP6[67]|IK10|PoE|CAT6|CAT5E?|NVR|DVR|WDR|RAID\s?1|H\.265\+?|Wi-?Fi|RFID|TCP\/IP|ONVIF|12\s?V|127\/220\s?V|\d+\s?TB)\b/gi;

function norm(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function classifyScope(description: string, fileName: string): ScopeId {
  let best: ScopeId = "outros";
  let bestScore = 0;
  for (const def of SCOPE_DEFINITIONS) {
    let score = 0;
    for (const keyword of def.keywords) {
      // A descrição do item vale mais que o nome do arquivo na classificação.
      const probe = new RegExp(keyword.source, "i");
      if (probe.test(description)) score += 2;
      else if (probe.test(fileName)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = def.id;
    }
  }
  if (best === "outros") {
    // Nome do arquivo é uma dica útil quando a linha é genérica.
    const fileHint = norm(fileName);
    if (/camera|cftv|nvr|video/.test(fileHint)) return "cftv";
    if (/acesso|facial|biometr|catraca|rfid/.test(fileHint)) return "acesso";
    if (/cerca|alarme|perimetr/.test(fileHint)) return "perimetro";
    if (/rede|infraestrutura|switch/.test(fileHint)) return "rede";
    if (/monitoramento|noc/.test(fileHint)) return "monitoramento";
    if (/manutencao/.test(fileHint)) return "manutencao";
  }
  return best;
}

function scopeName(id: ScopeId) {
  return SCOPE_DEFINITIONS.find((scope) => scope.id === id)?.name ?? "Itens Complementares";
}

function cleanDescription(line: string, prices: string[]): string {
  let value = line.replace(/\s+/g, " ").trim();
  for (const price of prices) value = value.replace(price, " ");
  value = value
    .replace(/^[\d]+[.)-]\s*/, "")
    .replace(/^[•\-–*]\s*/, "")
    .replace(/\b(?:qtd|qtde|quant\.?|quantidade)\s*[:.]?\s*\d+/gi, " ")
    .replace(/\b(?:un|und|unid|p[cç]|vb|m[eê]s|portas?|pontos?)\b\s*[:.]?/gi, " ")
    .replace(/\s*[-–]\s*/g, " ")
    .replace(/^\d+\s+/, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s:;|,\-.]+$/, "")
    .replace(/^[\s:;|,.]+/, "")
    .trim();
  return value.slice(0, 160);
}

function extractSpec(line: string): string {
  const matches = [...line.matchAll(SPEC_RE)].map((match) => match[0]);
  const unique = [...new Set(matches)].slice(0, 6);
  const model = line.match(/\b[A-Z]{2,}[A-Z0-9-]{3,}\b/)?.[0];
  if (model && !unique.includes(model)) unique.unshift(model);
  return unique.join(" · ").slice(0, 180);
}

function linePrices(line: string): { raw: string; value: number }[] {
  return [...line.matchAll(PRICE_RE)].map((match) => ({ raw: match[0], value: parseBrl(match[1]) })).filter((p) => p.value > 0);
}

/** Títulos e cabeçalhos de página não devem virar parte da descrição de um item. */
function isHeaderLine(line: string) {
  const letters = line.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (!letters || line.length < 7) return true;
  const upper = (line.match(/[A-ZÀ-Ý]/g) ?? []).length;
  return upper / letters.length > 0.85;
}

/** Une linhas de tabela onde descrição e preço ficaram separados pelo extrator de PDF. */
function joinLines(text: string): string[] {
  const original = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const result: string[] = [];
  let pending = "";
  for (const line of original) {
    const hasPrice = linePrices(line).length > 0;
    if (hasPrice) {
      result.push(pending && pending.length < 180 ? `${pending} ${line}` : line);
      pending = "";
    } else if (/^(total|valor total|investimento|subtotal|total geral)/i.test(line)) {
      // O valor do total pode estar na linha seguinte.
      pending = line;
    } else if (!isHeaderLine(line) && line.length >= 8) {
      pending = line.slice(0, 180);
    } else {
      pending = "";
    }
  }
  return result;
}

function quantityFrom(line: string): { qty: number; unit: string } {
  const field = line.match(QTY_FIELD_RE);
  const unitMatch = line.match(UNIT_RE);
  const qty = field ? Number(field[1]) : unitMatch ? Number(unitMatch[1]) : 1;
  const unitToken = (unitMatch?.[0] ?? "").toLowerCase();
  let unit = "un";
  if (/\/\s*m\b|por metro|metro linear/.test(line)) unit = "m";
  else if (/m[eê]s|mensal|meses/.test(unitToken)) unit = "mês";
  else if (/metro|\bm\b/.test(unitToken)) unit = "m";
  else if (/porta|ponto|c[aâ]mera|cam\b/.test(unitToken)) unit = unitToken.replace(/^\d+\s*/, "").slice(0, 12);
  return { qty: Number.isFinite(qty) && qty > 0 && qty <= 10000 ? Math.round(qty) : 1, unit };
}

function parseDocument(doc: ReferenceDocumentInput): {
  items: CompetitorItem[];
  declaredTotal: number | null;
  itemsTotal: number;
  conditions: string[];
  hasText: boolean;
  usedManualText: boolean;
  textLength: number;
} {
  const manual = (doc.manualText ?? "").trim();
  const text = manual || (doc.extractedText ?? "").trim();
  const usedManualText = manual.length > 0;
  const lines = joinLines(text);
  const items: CompetitorItem[] = [];
  const conditions: string[] = [];
  let declaredTotal: number | null = null;
  const seen = new Set<string>();

  for (const raw of lines) {
    const prices = linePrices(raw);
    const isTotal = TOTAL_RE.test(raw);
    if (isTotal && prices.length) {
      const candidate = prices[prices.length - 1].value;
      declaredTotal = Math.max(declaredTotal ?? 0, candidate);
      continue;
    }
    if (!prices.length) {
      if (CONDITION_RE.test(raw) && raw.length < 300 && conditions.length < 14) conditions.push(raw);
      continue;
    }

    const description = cleanDescription(raw, prices.map((p) => p.raw));
    if (description.length < 3) continue;
    const scope = classifyScope(description, doc.fileName);
    const { qty: foundQty, unit } = quantityFrom(raw);
    const recurring = /\/(?:m[eê]s|mes)\b|por m[eê]s|mensal|\bm[eê]s\b/i.test(raw) && (scope === "monitoramento" || scope === "manutencao" || /manuten|monitor/i.test(description));

    let qty = foundQty;
    let unitPrice = prices[0].value;
    let lineTotal = prices[0].value;

    if (prices.length >= 2) {
      const first = prices[0].value;
      const last = prices[prices.length - 1].value;
      const implied = last / first;
      if (implied >= 1.5 && Math.abs(implied - Math.round(implied)) < 0.08 && implied <= 10000) {
        qty = Math.round(implied);
        lineTotal = last;
      } else {
        lineTotal = last;
        qty = 1;
      }
    } else if (foundQty > 1) {
      // Preço único: pode ser unitário com quantidade na linha. Só multiplica se houver indício explícito de "unitário".
      lineTotal = /unit[aá]rio|cada|\bun\.?\b|cada unidade/i.test(raw) ? prices[0].value * foundQty : prices[0].value;
      unitPrice = lineTotal / qty;
    }

    const key = `${scope}|${norm(description).slice(0, 90)}|${Math.round(unitPrice * 100)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      id: `ref-${doc.id}-${items.length}`,
      description: description || "Item da proposta de referência",
      spec: extractSpec(raw),
      qty,
      unit: recurring ? "mês" : unit,
      unitPrice: Math.round(unitPrice * 100) / 100,
      lineTotal: Math.round(lineTotal * 100) / 100,
      scope,
      scopeName: scopeName(scope),
      sourceFile: doc.fileName,
      recurring,
      rawLine: raw.slice(0, 400),
    });
    if (items.length >= 120) break;
  }

  const itemsTotal = Math.round(items.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
  return { items, declaredTotal, itemsTotal, conditions, hasText: text.length > 0, usedManualText, textLength: text.length };
}

export function analyzeCompetitorDocuments(docs: ReferenceDocumentInput[]): CompetitorAnalysis {
  const documents: CompetitorDocument[] = [];
  const items: CompetitorItem[] = [];
  const conditions: string[] = [];
  const warnings: string[] = [];
  let matchedValue = 0;
  let monthlyValue = 0;

  for (const doc of docs) {
    const parsed = parseDocument(doc);
    const adoptedTotal = Math.max(parsed.declaredTotal ?? 0, parsed.itemsTotal);
    matchedValue += adoptedTotal;
    monthlyValue += parsed.items.filter((item) => item.recurring).reduce((sum, item) => sum + item.lineTotal, 0);
    items.push(...parsed.items);
    for (const condition of parsed.conditions) {
      if (!conditions.includes(condition) && conditions.length < 20) conditions.push(condition);
    }
    documents.push({
      id: doc.id,
      fileName: doc.fileName,
      hasText: parsed.hasText,
      usedManualText: parsed.usedManualText,
      pages: doc.pages,
      textLength: parsed.textLength,
      itemCount: parsed.items.length,
      declaredTotal: parsed.declaredTotal,
      detectedItemsTotal: parsed.itemsTotal,
      adoptedTotal,
      conditionLines: parsed.conditions,
      notes: doc.note ? [doc.note] : [],
    });

    if (!parsed.hasText) {
      warnings.push(`"${doc.fileName}" não tem texto legível (PDF escaneado ou imagem). Abra o arquivo e transcreva os itens no campo "Texto digitado" para uma análise completa.`);
    }
    if (parsed.declaredTotal !== null && parsed.itemsTotal > parsed.declaredTotal * 1.02 && parsed.itemsTotal > 0) {
      warnings.push(`Em "${doc.fileName}", a soma dos itens (${brl(parsed.itemsTotal)}) superou o total declarado (${brl(parsed.declaredTotal)}). Usamos a soma dos itens para não reduzir valor; confira a leitura.`);
    }
    if (parsed.declaredTotal !== null && parsed.itemsTotal > 0 && parsed.declaredTotal > parsed.itemsTotal * 1.02) {
      warnings.push(`Em "${doc.fileName}", o total declarado (${brl(parsed.declaredTotal)}) é maior que os itens identificados (${brl(parsed.itemsTotal)}). A diferença foi mantida como item de equalização, sem inventar equipamentos.`);
    }
  }

  // Itens de equalização: preservam o valor do concorrente quando a leitura não alcança o total.
  for (const doc of documents) {
    const difference = Math.round((doc.adoptedTotal - doc.detectedItemsTotal) * 100) / 100;
    if (difference > 0.5 && doc.itemCount > 0) {
      items.push({
        id: `equal-${doc.id}`,
        description: `Complementos de escopo e serviços — equalização com o total declarado em ${doc.fileName}`,
        spec: "Diferença entre o total do orçamento de referência e os itens lidos; revise antes de enviar ao cliente.",
        qty: 1,
        unit: "vb",
        unitPrice: difference,
        lineTotal: difference,
        scope: "outros",
        scopeName: scopeName("outros"),
        sourceFile: doc.fileName,
        recurring: false,
        rawLine: "Equalização de valores identificada automaticamente",
      });
    }
    if (difference > 0.5 && doc.itemCount === 0) {
      items.push({
        id: `single-${doc.id}`,
        description: `Escopo conforme proposta de referência — ${doc.fileName}`,
        spec: "Transcreva os itens no campo de texto para detalhar equipamentos e quantidades.",
        qty: 1,
        unit: "vb",
        unitPrice: difference,
        lineTotal: difference,
        scope: "outros",
        scopeName: scopeName("outros"),
        sourceFile: doc.fileName,
        recurring: false,
        rawLine: "Total declarado sem itens identificados",
      });
    }
  }

  const scopes: CompetitorScope[] = SCOPE_DEFINITIONS.map((scope) => {
    const scopeItems = items.filter((item) => item.scope === scope.id);
    return {
      id: scope.id,
      name: scope.name,
      items: scopeItems,
      subtotal: Math.round(scopeItems.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100,
    };
  }).filter((scope) => scope.items.length > 0);

  const itemsValue = Math.round(items.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
  const hasCftvAndAccess = scopes.some((scope) => scope.id === "cftv") && scopes.some((scope) => scope.id === "acesso");
  if (!docs.length) warnings.push("Nenhum arquivo de referência enviado.");
  if (docs.length && !items.length) warnings.push("Não foi possível identificar itens. Transcreva o texto do arquivo ou revise os valores manualmente na proposta.");
  if (docs.length > 1) {
    warnings.push(`${docs.length} arquivos considerados como documentos complementares do mesmo concorrente; os totais foram somados. Se forem propostas alternativas, exclua as que não devem compor a equalização.`);
  }

  return {
    documents,
    items,
    scopes,
    conditions,
    matchedValue: Math.round(matchedValue * 100) / 100,
    itemsValue,
    monthlyValue: Math.round(monthlyValue * 100) / 100,
    note: "Valores igualados à proposta de referência — nenhum desconto ou preço melhor foi aplicado. Ajuste os valores no editor depois de salvar.",
    warnings,
    hasCftvAndAccess,
    source: "Motor de análise Cipriano · leitura estruturada de equipamentos, quantidades e escopos",
  };
}

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
  const items: ProposalItem[] = analysis.items.map((item, index) => ({
    id: `matched-${index}`,
    kind: SCOPE_DEFINITIONS.find((scope) => scope.id === item.scope)?.service ? "servico" : "equipamento",
    desc: item.description,
    spec: [item.spec, `Origem: ${item.sourceFile}`, `Escopo: ${item.scopeName}`].filter(Boolean).join(" · "),
    unit: item.unit,
    qty: item.qty,
    price: item.unitPrice,
  }));

  const sections: ProposalSection[] = [];
  const add = (id: string, title: string, body: string, kind: ProposalSection["kind"] = "text") =>
    sections.push({ id, title, body, enabled: true, kind });

  const scopeNames = analysis.scopes.map((scope) => scope.name).join(", ") || "escopo a detalhar";
  add(
    "objeto",
    "Objeto",
    `Proposta comercial de segurança eletrônica para ${input.clientName || "o cliente"}, elaborada em equalização de escopo e valor com a documentação de referência apresentada.\n\nEscopos identificados: ${scopeNames}.\n\nLocal: ${input.site || "a confirmar"}. Os valores abaixo foram igualados aos valores de referência; nenhuma redução automática de preço foi aplicada.`,
  );

  if (type === "completa") {
    add(
      "empresa",
      "Cipriano Tech & Security",
      `${settings.companyName} atua em projetos, instalação, manutenção e monitoramento de sistemas de segurança eletrônica. Responsável técnico: ${settings.director} · ${settings.crea} · CNPJ ${settings.cnpj}.`,
    );
    add(
      "objetivo",
      "Objetivo",
      "Apresentar escopo equivalente ao da proposta de referência, organizado por disciplina técnica para facilitar a comparação pelo cliente, com os mesmos equipamentos, quantidades e valores identificados.",
    );
  }

  for (const scope of analysis.scopes) {
    const bullets = scope.items.map((item) =>
      `• ${item.qty} ${item.unit} — ${item.description}${item.spec ? ` (${item.spec})` : ""} · unitário ${brl(item.unitPrice)} · subtotal ${brl(item.lineTotal)}.`,
    );
    add(
      `escopo-${scope.id}`,
      `Escopo · ${scope.name}`,
      `${bullets.join("\n")}\n\nSubtotal do escopo: ${brl(scope.subtotal)}.`,
    );
  }

  if (analysis.hasCftvAndAccess) {
    add(
      "integracao",
      "Integração entre os escopos",
      "CFTV IP e Controle de Acesso estão apresentados em seções separadas para melhor visualização e conferência do cliente. Ambos compartilham a mesma infraestrutura de rede, cabeamento estruturado, alimentação e rack, sem duplicidade de infraestrutura ou cobrança em duplicidade por esse motivo.",
    );
  } else if (analysis.scopes.length > 1) {
    add(
      "integracao",
      "Integração entre os escopos",
      "Os escopos foram separados por disciplina técnica para facilitar a conferência do cliente. Quando aplicável, compartilham a mesma rede, cabeamento, energia e rack, sem duplicidade de infraestrutura. Equipamentos e quantidades permanecem discriminados em cada seção.",
    );
  }

  add(
    "equipamentos",
    "Lista de Equipamentos e Serviços",
    "A tabela abaixo reproduz os itens identificados na proposta de referência, com quantidades e valores unitários iguais aos do concorrente. Confira cada linha antes de enviar.",
    "items",
  );

  add(
    "valor",
    "Valor",
    `Valor total igualado à proposta de referência: ${brl(analysis.matchedValue)}. Não foi aplicado desconto nem preço inferior. O valor é totalmente editável no editor da proposta.`,
    "totals",
  );

  const conditionBullets = analysis.conditions.length
    ? analysis.conditions.slice(0, 10)
    : [
        `Pagamento: ${settings.defaultPaymentTerms}`,
        `Prazo de execução: ${settings.defaultDeliveryTime}`,
        `Garantia: ${settings.defaultWarranty}`,
        `Validade da proposta: ${input.validityDays} dias corridos a partir da emissão`,
      ];
  add("condicoes", "Condições Comerciais", conditionBullets.map((line) => `• ${line}`).join("\n"), "terms");

  if (type === "completa") {
    add(
      "responsabilidades",
      "Responsabilidades",
      `A ${settings.companyName} executa fornecimento, instalação, configuração e comissionamento conforme os escopos discriminados. O cliente disponibiliza acesso, pontos de energia, infraestrutura de rede quando necessária e um responsável para aprovações. Itens não listados dependem de orçamento complementar aprovado por escrito.`,
    );
    add(
      "validade",
      "Validade e Aceite",
      `Validade de ${input.validityDays} dias corridos a partir da emissão. O aceite deve ser formalizado por escrito; a execução se inicia após a liberação da obra.`,
    );
  }

  add(
    "aceite",
    "Aceite",
    "Ao assinar, o cliente declara estar de acordo com os escopos, equipamentos, quantidades e valores desta proposta.",
  );

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

export function matchedInsights(analysis: CompetitorAnalysis, totals: ReturnType<typeof calcTotals>) {
  const out: { tone: "info" | "warn" | "ok"; title: string; detail: string }[] = [
    {
      tone: "ok",
      title: "Valores igualados, não reduzidos",
      detail: `Total de referência ${brl(analysis.matchedValue)}; total gerado ${brl(totals.totalCents / 100)}. Nenhum desconto automático foi aplicado. Você pode alterar os preços no editor depois de salvar.`,
    },
    {
      tone: "info",
      title: `${analysis.items.length} itens em ${analysis.scopes.length} escopo(s)`,
      detail: analysis.scopes.map((scope) => `${scope.name}: ${scope.items.length} item(ns)`).join(" · ") || "Nenhum escopo identificado; transcreva o texto para melhorar a leitura.",
    },
  ];
  if (analysis.hasCftvAndAccess) {
    out.push({
      tone: "info",
      title: "CFTV e acesso separados",
      detail: "As duas disciplinas ganharam seções próprias no documento. A rede compartilhada foi explicada em um bloco de integração, sem criar cobrança em duplicidade.",
    });
  }
  for (const warning of analysis.warnings.slice(0, 2)) out.push({ tone: "warn", title: "Confira a leitura", detail: warning });
  return out;
}
