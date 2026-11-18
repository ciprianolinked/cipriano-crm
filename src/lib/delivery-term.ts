import { fmtDate } from "@/lib/brand";
import { maybePolishWithLLM } from "@/lib/ai";
import type { DeliveryTermItem } from "@/db/schema";
import type { ProposalItem } from "@/lib/proposal/types";

export type DeliveryTermSettings = {
  companyName: string;
  legalName: string;
  director: string;
  role: string;
  phone: string;
  email: string;
  site: string;
  address: string;
  cnpj: string;
  crea: string;
};

export type DeliveryTermSource = {
  id: string;
  number: string;
  type: string;
  clientName: string;
  contact: string | null;
  site: string | null;
  totalCents: number;
  warranty: string | null;
  deliveryTime: string | null;
  items: ProposalItem[];
};

export type DeliveryTermDraft = {
  termNumber: string;
  clientName: string;
  site: string;
  technician: string;
  receiverName: string;
  receiverDoc: string;
  items: DeliveryTermItem[];
  intro: string;
  scopeSummary: string;
  tests: string;
  pendencies: string;
  warranty: string;
  observations: string;
};

const uid = () => `dt-${Math.random().toString(36).slice(2, 9)}`;

export function nextTermNumber(existing: string[]): string {
  const year = new Date().getFullYear();
  const re = new RegExp(`^TRM-${year}-(\\d{1,6})$`);
  let max = 0;
  for (const n of existing) {
    const m = n.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `TRM-${year}-${String(max + 1).padStart(4, "0")}`;
}

function itemLines(items: ProposalItem[]): string[] {
  const groups = new Map<string, ProposalItem[]>();
  for (const item of items) {
    const key = item.scope?.trim() || (item.kind === "servico" ? "Serviços" : "Equipamentos");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  const lines: string[] = [];
  for (const [scope, rows] of groups) {
    lines.push(`${scope}:`);
    for (const row of rows) {
      lines.push(`• ${row.qty} ${row.unit} — ${row.desc}${row.spec ? ` (${row.spec})` : ""}.`);
    }
  }
  return lines;
}

function testLines(items: ProposalItem[]): string[] {
  const desc = items.map((i) => `${i.desc} ${i.spec}`.toLowerCase()).join(" | ");
  const out: string[] = [];
  if (/câmera|camera|cftv|nvr|dvr/.test(desc))
    out.push("CFTV IP: imagem de todas as câmeras verificada no monitor e no acesso remoto; gravação contínua e por evento testada; retenção de 30 dias configurada.");
  if (/acesso|facial|rfid|catraca|fechadura|leitor/.test(desc))
    out.push("Controle de acesso: leitores, fechaduras, botoeiras e sensores de porta testados porta a porta; cadastro de usuários e perfis de horário validados.");
  if (/cerca|perimet|alarme|sirene|sensor/.test(desc))
    out.push("Perímetro e alarme: disparo, sirene, sensores e centrais testados; sinalização e aterramento conferidos.");
  if (/interfon/.test(desc))
    out.push("Interfonia IP: chamadas de áudio e vídeo testadas entre postos externos e internos.");
  if (/rede|switch|rack|nobreak|fibra|cat6|poe/.test(desc))
    out.push("Rede e energia: pontos certificados, PoE medido, nobreak com teste de autonomia e DPS/DR verificados.");
  out.push("Comissionamento geral: checklist de campo assinado, fotos de cada etapa registradas e treinamento operacional de 4 h realizado.");
  return out;
}

/** Minuta profissional local. A IA (quando configurada) refina a redação sem alterar números. */
export function buildDeliveryTermDraft(
  proposal: DeliveryTermSource,
  settings: DeliveryTermSettings,
  termNumber: string,
): DeliveryTermDraft {
  const location = proposal.site?.trim() || "endereço da obra conforme proposta";
  const items: DeliveryTermItem[] = proposal.items.map((item) => ({
    id: uid(),
    desc: item.desc,
    spec: item.spec,
    unit: item.unit,
    qty: item.qty,
    checked: false,
    serial: "",
    obs: "",
  }));
  const intro =
    `Pelo presente instrumento, ${settings.legalName} (CNPJ ${settings.cnpj}), declara ter concluído a instalação, configuração e comissionamento do sistema de segurança eletrônica contratado na proposta ${proposal.number}, nas dependências de ${proposal.clientName}, localizadas em ${location}.\n\n` +
    `O presente termo formaliza a entrega técnica do escopo: os equipamentos foram instalados conforme projeto aprovado, os testes de funcionamento foram executados e aprovados em campo e o responsável pelo cliente foi orientado quanto à operação do sistema.`;
  const scopeSummary = itemLines(proposal.items).join("\n") || "Escopo executado conforme proposta de referência.";
  const tests = testLines(proposal.items)
    .map((line) => `• ${line}`)
    .join("\n");
  return {
    termNumber,
    clientName: proposal.clientName,
    site: location,
    technician: `${settings.director} · ${settings.crea}`,
    receiverName: proposal.contact?.trim() || "",
    receiverDoc: "",
    items,
    intro,
    scopeSummary,
    tests,
    pendencies: "Nenhuma pendência registrada no ato da entrega. Caso surja algum apontamento, será tratado como chamado de garantia, sem custo, dentro do prazo de cobertura.",
    warranty: proposal.warranty?.trim() || "24 meses para equipamentos e 12 meses para mão de obra, contados da assinatura deste termo.",
    observations:
      `Responsável técnico da execução: ${settings.director} (${settings.role}) · ${settings.crea}.\n` +
      `Atendimento de garantia: ${settings.phone} · ${settings.email}.\n` +
      `Data de referência da entrega: ${fmtDate(new Date())}. A garantia não cobre vandalismo, furto, descargas atmosféricas, intervenção de terceiros ou falta de manutenção preventiva.`,
  };
}

const BLOCK_MARK = "@@@BLOCO@@@";

/**
 * Refina a redação com a IA do servidor (quando OPENAI_API_KEY existe).
 * Preserva números, quantidades e escopo; retorna null se indisponível.
 */
export async function polishDeliveryTermWithAI(
  draft: DeliveryTermDraft,
  proposal: DeliveryTermSource,
): Promise<Pick<DeliveryTermDraft, "intro" | "scopeSummary" | "tests"> | null> {
  const prompt =
    `Proposta ${proposal.number} · Cliente ${proposal.clientName} · Local ${draft.site}.\n\n` +
    `INTRODUÇÃO:\n${draft.intro}\n\n${BLOCK_MARK}\n\n` +
    `ESCOPO ENTREGUE:\n${draft.scopeSummary}\n\n${BLOCK_MARK}\n\n` +
    `TESTES EXECUTADOS:\n${draft.tests}`;
  const polished = await maybePolishWithLLM({
    system:
      "Você é um engenheiro de segurança eletrônica redigindo um termo de entrega e comissionamento em português formal e objetivo. Reescreva os TRÊS blocos (introdução, escopo entregue, testes executados) mantendo TODOS os números, quantidades, modelos e locais exatamente como estão. Não invente equipamentos, testes ou pendências. Separe os blocos reescritos com a linha exata @@@BLOCO@@@, sem títulos extras.",
    prompt,
  });
  if (!polished || !polished.includes(BLOCK_MARK)) return null;
  const parts = polished.split(BLOCK_MARK).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  return { intro: parts[0], scopeSummary: parts[1], tests: parts.slice(2).join(`\n${BLOCK_MARK}\n`) };
}
