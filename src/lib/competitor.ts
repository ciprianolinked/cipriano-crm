import { PDFParse } from "pdf-parse";
import type { CompetitorAnalysis, CompetitorDetectedItem, CompetitorFile, Briefing } from "@/lib/proposal/types";

export const MAX_COMPETITOR_FILES = 6;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB por arquivo

/**
 * Extrai texto bruto de um arquivo enviado (PDF ou texto puro).
 * Imagens retornam indicação para processamento multimodal.
 */
export async function extractTextFromFile(file: CompetitorFile): Promise<{ text: string; isImage: boolean }> {
  try {
    const rawBase64 = file.base64.includes(",") ? file.base64.split(",")[1] : file.base64;
    const buffer = Buffer.from(rawBase64, "base64");
    const mime = (file.type || "").toLowerCase();
    const name = file.name.toLowerCase();

    if (mime.includes("pdf") || name.endsWith(".pdf")) {
      try {
        const parser = new PDFParse({ data: buffer });
        const res = await parser.getText();
        await parser.destroy().catch(() => {});
        const extracted = (res.text || "").trim();
        return {
          text: extracted.length > 0 ? extracted : `[PDF sem texto selecionável: ${file.name}]`,
          isImage: false,
        };
      } catch (e) {
        return {
          text: `[Erro ao ler PDF ${file.name}: ${e instanceof Error ? e.message : "formato não suportado"}]`,
          isImage: false,
        };
      }
    }

    if (
      mime.includes("image") ||
      name.endsWith(".png") ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".webp")
    ) {
      return { text: `[Imagem: ${file.name}]`, isImage: true };
    }

    // Arquivos de texto puro
    const str = buffer.toString("utf8");
    return { text: str.slice(0, 50000), isImage: false };
  } catch {
    return { text: `[Falha ao processar arquivo ${file.name}]`, isImage: false };
  }
}

/**
 * Análise de proposta do concorrente via IA (OpenAI multimodal / text-based)
 */
async function analyzeWithOpenAI(
  files: CompetitorFile[],
  extractedTexts: string[],
  clientNameHint?: string
): Promise<CompetitorAnalysis | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  try {
    const base = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

    // Constrói mensagens incluindo imagens se houver
    const contentParts: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" } }
    > = [];

    contentParts.push({
      type: "text",
      text: `Você é um diretor comercial e engenheiro sênior da CIPRIANO TECH & SECURITY (especializada em segurança eletrônica IP, CFTV 4K, controle de acesso facial, cerca elétrica e monitoramento NOC 24h em São José dos Campos e região).
O cliente nos forneceu ${files.length} arquivo(s) com a proposta comercial do concorrente para elaborarmos uma CONTRAPROPOSTA IMBATÍVEL em valores e qualidade técnica.

Cliente da oportunidade: ${clientNameHint || "A definir"}

Textos extraídos dos documentos:
${extractedTexts.join("\n\n--- PRÓXIMO ARQUIVO ---\n\n")}

Analise minuciosamente os arquivos e responda ESTRITAMENTE em formato JSON válido com as seguintes chaves:
{
  "competitorName": "Nome da empresa concorrente identificada no documento (ou 'Concorrente')",
  "detectedTotal": 0.00 (valor total da proposta do concorrente em número decimal em reais),
  "detectedMonthly": 0.00 (se houver mensalidade de monitoramento/manutenção, senão 0),
  "detectedPaymentTerms": "Condições de pagamento do concorrente (ex: 3x sem juros, entrada + saldo)",
  "detectedWarranty": "Garantia ofertada pelo concorrente (ex: 12 meses)",
  "detectedSummary": "Resumo objetivo do que o concorrente orçou (equipamentos, marcas, serviços e totais)",
  "detectedItems": [
    { "desc": "Item orçado pelo concorrente", "qty": 1, "price": 0.00, "note": "marca/modelo e se o preço é unitário ou total" }
  ],
  "weaknesses": [
    "Ponto fraco ou omissão grave 1 (ex: não especificou cabeamento blindado, deixando sujeito a ruídos)",
    "Ponto fraco 2 (ex: garantia de apenas 1 ano vs 2 anos da Cipriano)",
    "Ponto fraco 3 (ex: NVR subdimensionado para a quantidade de câmeras)",
    "Ponto fraco 4 (ex: ausência de nobreak com autonomia e laudo de aterramento/ART)"
  ],
  "ciprianoStrategy": "Estratégia comercial exata para a Cipriano vencer esta negociação em valores (como compor o preço mais agressivo, qual margem aplicar e como demonstrar custo-benefício superior)",
  "ciprianoRecommendedTotal": 0.00 (valor total recomendado para a Cipriano que seja mais vantajoso que o concorrente ou empate com escopo muito superior),
  "savingsVsCompetitor": {
    "diff": 0.00 (economia em reais para o cliente ao escolher a Cipriano),
    "pct": 0.0 (porcentagem de economia direta, ex: 8.5)
  },
  "talkingPoints": [
    "Argumento comercial matador 1 para falar com o síndico/decisor",
    "Argumento 2 comparando diretamente a qualidade vs o preço do concorrente",
    "Argumento 3 abordando custo de manutenção futura e confiabilidade"
  ],
  "recommendedBriefing": {
    "cameras": 0,
    "doors": 0,
    "fenceMeters": 0,
    "alarm": false,
    "intercom": false,
    "monitoring": true,
    "network": true,
    "maintenance": false,
    "priority": "orcamento",
    "notes": "Resumo do escopo calibrado para bater a proposta do concorrente"
  },
  "recommendedDiscountPct": 5
}`,
    });

    // Se houver imagens entre os arquivos, anexa as imagens para multimodalidade
    for (const file of files) {
      const mime = (file.type || "").toLowerCase();
      const name = file.name.toLowerCase();
      if (
        mime.includes("image") ||
        name.endsWith(".png") ||
        name.endsWith(".jpg") ||
        name.endsWith(".jpeg") ||
        name.endsWith(".webp")
      ) {
        const dataUrl = file.base64.startsWith("data:")
          ? file.base64
          : `data:${file.type || "image/jpeg"};base64,${file.base64}`;
        contentParts.push({
          type: "image_url",
          image_url: { url: dataUrl, detail: "high" },
        });
      }
    }

    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Você é um especialista em vendas e engenharia da Cipriano Tech & Security. Analise propostas concorrentes com precisão cirúrgica de valores, marcas e cláusulas, retornando apenas JSON estruturado.",
          },
          {
            role: "user",
            content: contentParts,
          },
        ],
      }),
      signal: AbortSignal.timeout(35000),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const parsed = JSON.parse(content) as Partial<CompetitorAnalysis>;
    if (!parsed.detectedSummary && !parsed.detectedTotal) return null;

    const detectedTotal = Number(parsed.detectedTotal) || 0;
    const ciprianoRec = Number(parsed.ciprianoRecommendedTotal) || (detectedTotal > 0 ? detectedTotal * 0.92 : 0);
    const diff = detectedTotal > 0 && ciprianoRec < detectedTotal ? detectedTotal - ciprianoRec : 0;
    const pct = detectedTotal > 0 ? Math.round((diff / detectedTotal) * 1000) / 10 : 0;

    return {
      competitorName: String(parsed.competitorName || "Concorrente"),
      detectedTotal: Math.round(detectedTotal * 100) / 100,
      detectedMonthly: parsed.detectedMonthly ? Math.round(Number(parsed.detectedMonthly) * 100) / 100 : undefined,
      detectedPaymentTerms: parsed.detectedPaymentTerms ? String(parsed.detectedPaymentTerms) : undefined,
      detectedWarranty: parsed.detectedWarranty ? String(parsed.detectedWarranty) : undefined,
      detectedSummary: String(parsed.detectedSummary || "Proposta concorrente analisada."),
      detectedItems: Array.isArray(parsed.detectedItems)
        ? (parsed.detectedItems as CompetitorDetectedItem[])
        : [],
      weaknesses: Array.isArray(parsed.weaknesses)
        ? parsed.weaknesses.map(String)
        : ["Omissão de itens essenciais de infraestrutura e proteção elétrica."],
      ciprianoStrategy: String(
        parsed.ciprianoStrategy ||
          "Apresentar proposta técnica superior com 24 meses de garantia e preço equivalente ou mais competitivo."
      ),
      ciprianoRecommendedTotal: Math.round(ciprianoRec * 100) / 100,
      savingsVsCompetitor: {
        diff: Math.round(diff * 100) / 100,
        pct,
      },
      talkingPoints: Array.isArray(parsed.talkingPoints) ? parsed.talkingPoints.map(String) : [],
      recommendedBriefing: parsed.recommendedBriefing,
      recommendedDiscountPct: Number(parsed.recommendedDiscountPct) || 5,
      fileCount: files.length,
      analyzedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Erro na análise OpenAI do concorrente:", err);
    return null;
  }
}

/**
 * Análise determinística local (caso não haja OpenAI ou para fallback instantâneo)
 */
export function analyzeCompetitorProposalLocal(
  files: CompetitorFile[],
  extractedTexts: string[],
  clientNameHint?: string
): CompetitorAnalysis {
  const combined = extractedTexts.join("\n");

  // Extração robusta de valores monetários (com e sem prefixo R$)
  const parseVal = (raw: string): number => {
    let clean = raw.trim().replace(/[^\d\.,]/g, "").replace(/[\.,]+$/, "");
    if (clean.includes(",") && clean.includes(".")) {
      // Formato brasileiro: 29.900,00
      clean = clean.replace(/\./g, "").replace(",", ".");
    } else if (clean.includes(",")) {
      clean = clean.replace(",", ".");
    }
    const n = Number(clean);
    return Number.isFinite(n) ? n : 0;
  };

  const moneyMatches: number[] = [];

  // Padrão 1: Com R$
  for (const m of combined.matchAll(/R\$\s*([0-9\.,]+)/gi)) {
    const val = parseVal(m[1]);
    if (val > 10 && val < 10000000) moneyMatches.push(val);
  }

  // Padrão 2: Contexto de Total / Valor Total / Subtotal
  for (const m of combined.matchAll(/(?:total|valor\s+total|orçamento|proposta|global)[^\d\n]{1,25}(?:R\$\s*)?([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})|[0-9]{3,}(?:,[0-9]{2})?)/gi)) {
    const val = parseVal(m[1]);
    if (val > 10 && val < 10000000) moneyMatches.push(val);
  }

  // Procura o maior valor plausível como total da proposta
  let detectedTotal = 0;
  if (moneyMatches.length > 0) {
    const sorted = [...new Set(moneyMatches)].sort((a, b) => b - a);
    detectedTotal = sorted[0];
  }

  // Detecta mensalidade se houver (ex: R$ 390/mês ou R$ 450,00 mensais)
  let detectedMonthly: number | undefined = undefined;
  const monthlyMatch = combined.match(/(?:mensal|mensalidade|por\s+mês|mês|locação)[^\d\n]{1,15}(?:R\$\s*)?([0-9\.,]+)/i);
  if (monthlyMatch && monthlyMatch[1]) {
    const mVal = parseVal(monthlyMatch[1]);
    if (mVal > 50 && mVal < 50000) detectedMonthly = mVal;
  }

  // Detecta quantidades de câmeras, portas, cerca
  const grabNum = (pats: RegExp[]) => {
    for (const pat of pats) {
      const m = combined.match(pat);
      if (m && m[1]) {
        const val = Number(m[1]);
        if (Number.isFinite(val) && val > 0 && val < 500) return val;
      }
    }
    return 0;
  };

  const cams = grabNum([
    /(\d+)\s*(?:câmera|camera|cam|cftv)/i,
    /(?:câmera|camera|cam|cftv)[^\d]{1,15}(\d+)/i,
  ]);
  const doors = grabNum([
    /(\d+)\s*(?:porta|acesso|facial|fechadura)/i,
    /(?:porta|acesso)[^\d]{1,15}(\d+)/i,
  ]);
  const fence = grabNum([
    /(\d+)\s*(?:metros|m\b|m de cerca|metro de cerca)/i,
    /(?:cerca elétrica|cerca eletrica)[^\d]{1,15}(\d+)/i,
  ]);

  // Detecta itens
  const detectedItems: CompetitorDetectedItem[] = [];
  if (cams > 0) {
    detectedItems.push({
      desc: `Câmeras de segurança (${cams} unidades detectadas)`,
      qty: cams,
      price: detectedTotal > 0 ? Math.round((detectedTotal * 0.45) / cams) : 0,
      note: "Detectado na proposta do concorrente",
    });
  }
  if (doors > 0) {
    detectedItems.push({
      desc: `Controle de acesso (${doors} ponto(s))`,
      qty: doors,
      note: "Ponto de acesso detectado",
    });
  }
  if (fence > 0) {
    detectedItems.push({
      desc: `Proteção perimetral / cerca (${fence} metros)`,
      qty: fence,
      note: "Metragem de perímetro",
    });
  }

  // Detecta menção de concorrente
  let competitorName = "Concorrente";
  const compMatch = combined.match(/(?:empresa|proposta|contratada|razão social|orçamento):\s*([A-Za-z0-9\s\.\-]{3,40})/i);
  if (compMatch && compMatch[1]) {
    competitorName = compMatch[1].trim();
  }

  // Preço alvo Cipriano: bater o concorrente com 7% a 10% de economia ou demonstrar melhor valor
  const ciprianoTarget = detectedTotal > 0 ? Math.round(detectedTotal * 0.93 * 100) / 100 : 0;
  const diff = detectedTotal > 0 ? detectedTotal - ciprianoTarget : 0;
  const pct = detectedTotal > 0 ? 7.0 : 0;

  const weaknesses = [
    "Garantia frequentemente limitada a 12 meses (A Cipriano oferece 24 meses em equipamentos de primeira linha).",
    "Omissão de nobreak com autonomia mínima e proteção contra surtos (DPS/DR) no rack central.",
    "Utilização frequente de cabeamento de rede comum UTP sem blindagem, suscetível a interferências eletromagnéticas.",
    "Falta de emissão de ART registrada no CREA-SP e documentação as-built ao término da obra.",
  ];

  const talkingPoints = [
    `Economia real: com nossa solução você investe ${diff > 0 ? `R$ ${diff.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} a menos` : "com valor mais equilibrado"} e conta com garantia estendida de 24 meses.`,
    "Engenharia registrada: emitimos ART no CREA-SP e entregamos documentação técnica as-built completa ao final da instalação.",
    "Uptime e infraestrutura: fornecemos cabeamento Cat6 blindado, switch PoE gerenciável e nobreak para que o sistema continue gravando mesmo em queda de energia.",
    "Suporte e NOC: atendimento técnico com SLA definido de até 4h úteis para chamados críticos.",
  ];

  const recommendedBriefing: Partial<Briefing> = {
    cameras: cams > 0 ? cams : 8,
    doors: doors > 0 ? doors : 2,
    fenceMeters: fence > 0 ? fence : 60,
    monitoring: true,
    network: true,
    priority: "orcamento",
    notes: `Contraproposta elaborada com base na análise de ${files.length} arquivo(s) do concorrente (${competitorName}). Valor detectado no concorrente: ${detectedTotal > 0 ? `R$ ${detectedTotal.toLocaleString("pt-BR")}` : "não identificado"}.`,
  };

  return {
    competitorName,
    detectedTotal,
    detectedMonthly,
    detectedSummary: `Análise realizada em ${files.length} arquivo(s): ${files.map((f) => f.name).join(", ")}. ${
      detectedTotal > 0
        ? `Valor identificado no concorrente: R$ ${detectedTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`
        : "Valores do concorrente identificados para balizamento de mercado."
    } ${cams > 0 ? `${cams} câmeras, ` : ""}${doors > 0 ? `${doors} portas de acesso, ` : ""}${fence > 0 ? `${fence}m de cerca.` : ""}`,
    detectedItems,
    weaknesses,
    ciprianoStrategy:
      "Apresentar proposta com tecnologia IP 4K ColorVu, 24 meses de garantia e preço competitivo calibrado para bater a proposta concorrente com melhor BDI e economia direta para o cliente.",
    ciprianoRecommendedTotal: ciprianoTarget,
    savingsVsCompetitor: { diff, pct },
    talkingPoints,
    recommendedBriefing,
    recommendedDiscountPct: 7,
    fileCount: files.length,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Função orquestradora: processa até 6 arquivos e devolve a análise
 */
export async function processCompetitorFiles(
  files: CompetitorFile[],
  clientNameHint?: string
): Promise<CompetitorAnalysis> {
  const validFiles = files.slice(0, MAX_COMPETITOR_FILES);
  const extractedTexts: string[] = [];

  for (const file of validFiles) {
    const res = await extractTextFromFile(file);
    extractedTexts.push(`[ARQUIVO: ${file.name}]\n${res.text}`);
  }

  // Tenta com OpenAI primeiro se houver chave configurada
  const aiResult = await analyzeWithOpenAI(validFiles, extractedTexts, clientNameHint);
  if (aiResult) {
    return aiResult;
  }

  // Fallback determinístico especialista local
  return analyzeCompetitorProposalLocal(validFiles, extractedTexts, clientNameHint);
}
