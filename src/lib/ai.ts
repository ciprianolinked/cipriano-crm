import type { Briefing, ProposalItem, ProposalSection, ProposalType } from "@/lib/proposal/types";

const normalized = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Extrai quantidades e tecnologias de um briefing em texto livre (WhatsApp, e-mail, visita). */
export function analyzeBriefingNotes(notes: string, base: Briefing): Briefing {
  const text = normalized(notes);
  const next: Briefing = { ...base };
  const grab = (patterns: string[]) => {
    for (const p of patterns) {
      const re = new RegExp(`(\\d{1,4})\\s*(?:${p})`, "i");
      const m = text.match(re);
      if (m) return Number(m[1]);
    }
    return null;
  };

  const cams = grab(["cameras?", "camera", "cams?", "pontos de camera", "cftv"]);
  const doors = grab(["portas?", "acessos?"]);
  const fence = grab(["metros?", "m\\b", "m de cerca", "cerca"]);
  if (cams !== null) next.cameras = Math.min(256, cams);
  if (doors !== null) next.doors = Math.min(64, doors);
  if (fence !== null && fence > 5) next.fenceMeters = Math.min(3000, fence);

  if (/(alarme|sensor|sirene|intrusao)/.test(text)) next.alarm = true;
  if (/(interfone|interfonia|video porteiro|videoporteiro)/.test(text)) next.intercom = true;
  if (/(monitoramento|noc|24h|24 horas|ronda)/.test(text)) next.monitoring = true;
  if (/(manutencao|preventiva|contrato)/.test(text)) next.maintenance = true;
  if (/(rede|switch|cabeamento|poe|rack|fibra)/.test(text)) next.network = true;
  if (/(condominio)/.test(text)) next.segment = "Condomínio residencial";
  else if (/(industria|galpao|fabrica)/.test(text)) next.segment = "Indústria / galpão";
  else if (/(loja|varejo|supermercado)/.test(text)) next.segment = "Varejo / loja";
  else if (/(escola|colegio|creche)/.test(text)) next.segment = "Escola";
  else if (/(clinica|consultorio|escritorio)/.test(text)) next.segment = "Escritório / clínica";
  else if (/(casa|residencia|residencial)/.test(text)) next.segment = "Residência de alto padrão";

  if (/(urgente|prazo|semana que vem|rapido)/.test(text)) next.priority = "prazo";
  if (/(barato|orcamento|econom|enxuto|menor valor)/.test(text)) next.priority = "orcamento";
  if (/(norma|art|crea|projeto|laudo|engenheiro)/.test(text)) next.priority = "tecnica";

  next.notes = notes;
  return next;
}

export type Insight = {
  tone: "info" | "warn" | "danger" | "ok";
  title: string;
  detail: string;
};

export function buildInsights(input: {
  type: ProposalType;
  briefing: Briefing;
  items: ProposalItem[];
  sections: ProposalSection[];
  discountPct: number;
  totalCents: number;
  status: string;
  validityDays: number;
}): Insight[] {
  const out: Insight[] = [];
  const hasMonitoring = input.items.some((i) => /nOC|monitoramento/i.test(i.desc));
  const hasMaintenance = input.items.some((i) => /manuten/i.test(i.desc));
  const art = input.sections.find((s) => s.id === "art");

  if (input.type === "completa" && art && !art.enabled) {
    out.push({
      tone: "warn",
      title: "ART desativada em proposta completa",
      detail: "Para obras acima de R$ 20 mil, incluir ART e as-built reduz objeção técnica. Ative o bloco “ART e Projeto”.",
    });
  }
  if (!hasMonitoring && (input.briefing.cameras >= 8 || input.briefing.segment.includes("Condomínio"))) {
    out.push({
      tone: "info",
      title: "Oportunidade de recorrência: NOC 24h",
      detail: "Com 8+ câmeras o cliente já tem operação crítica. Ofereça monitoramento: aumenta o ticket mensal e a retenção.",
    });
  }
  if (!hasMaintenance && input.briefing.cameras >= 4) {
    out.push({
      tone: "info",
      title: "Ofereça manutenção preventiva",
      detail: "Contrato de 12 meses protege a garantia e gera previsibilidade. Média de adesão em condomínios: 62%.",
    });
  }
  if (input.discountPct > 12) {
    out.push({
      tone: "danger",
      title: `Desconto de ${input.discountPct}% acima da política`,
      detail: "Acima de 12% exige aprovação da diretoria. Troque desconto por escopo faseado ou por prazo de pagamento.",
    });
  }
  if (input.totalCents > 0 && input.totalCents < 300000) {
    out.push({
      tone: "info",
      title: "Ticket baixo para proposta completa",
      detail: "Até R$ 3.000 use a proposta simples ou de produtos/serviços: fecha mais rápido e reduz atrito.",
    });
  }
  if (input.status === "enviada") {
    out.push({
      tone: "ok",
      title: "Follow-up em D+2 agendado",
      detail: "A maioria dos fechamentos acontece entre o 2º e o 5º dia após o envio. Confirme recebimento e pergunte quem decide.",
    });
  }
  if (input.validityDays > 30) {
    out.push({
      tone: "warn",
      title: "Validade longa demais",
      detail: "Acima de 30 dias o preço fica exposto a reajuste de equipamentos. Padrão recomendado: 15 dias.",
    });
  }
  if (out.length === 0) {
    out.push({
      tone: "ok",
      title: "Proposta equilibrada",
      detail: "Escopo, valor e condições estão coerentes. Envie com follow-up agendado e registre o feedback no CRM.",
    });
  }
  return out;
}

const toneLibrary: Record<string, string> = {
  sla: "• Atendimento remoto em até 4 h úteis e visita técnica em até 24 h úteis na Grande São Paulo.\n• Disponibilidade mensal alvo de 99,5%, com relatório de chamados.\n• Preventivas semestrais inclusas: lentes, conectores, firmware e baterias.",
  treinamento:
    "• Treinamento de 4 h para até 8 operadores, com manual e gravação.\n• Reciclagem anual inclusa em contratos de manutenção.\n• Suporte remoto ilimitado para dúvidas operacionais por 90 dias.",
  lgpd: "• A Cipriano atua como operadora técnica; a base legal é definida pelo cliente.\n• Acesso às imagens restrito a usuários nominados, com trilha de auditoria.\n• Retenção padrão de 30 dias, configurável por escrito.\n• Solicitações de titulares são encaminhadas ao cliente em até 72 h.",
  expansao:
    "• Rack e switch com 30% de folga para novos pontos.\n• Cabeamento identificado permite expansão sem retrabalho.\n• Valores de expansão congelados por 6 meses após o aceite.",
  garantia:
    "• Garantia de 24 meses para equipamentos e 12 meses para mão de obra.\n• Não cobre vandalismo, furto, descargas atmosféricas e intervenção de terceiros.\n• Peças fora de garantia orçadas previamente.",
  padrao:
    "• Execução conforme projeto aprovado, com registro fotográfico de cada etapa.\n• Testes documentados e termo de comissão assinado na entrega.\n• Comunicação por e-mail com registro de todas as decisões.\n• Alterações de escopo somente após orçamento complementar aprovado.",
};

export function localSectionDraft(title: string, briefing: Briefing, clientName: string): string {
  const t = normalized(title);
  let body = toneLibrary.padrao;
  if (/sla|nivel de servico|atendimento/.test(t)) body = toneLibrary.sla;
  else if (/treinamento|capacita/.test(t)) body = toneLibrary.treinamento;
  else if (/lgpd|privacidade|dados/.test(t)) body = toneLibrary.lgpd;
  else if (/expans|futuro|crescimento/.test(t)) body = toneLibrary.expansao;
  else if (/garantia/.test(t)) body = toneLibrary.garantia;

  return `${clientName || "O cliente"} — ${briefing.segment.toLowerCase()} com ${briefing.cameras} câmeras, ${briefing.doors} porta(s) e ${briefing.fenceMeters} m de perímetro.\n\n${body}`;
}

/** Usa LLM quando houver chave configurada; caso contrário mantém o rascunho local. */
export async function maybePolishWithLLM(input: {
  system: string;
  prompt: string;
}): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const base = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.prompt },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text && text.length > 40 ? text : null;
  } catch {
    return null;
  }
}
