import { calcTotals } from "@/lib/proposal/catalog";
import type { Briefing, MaintenancePlan, ProposalDraft, ProposalItem, ProposalSection, ProposalType } from "@/lib/proposal/types";
import type { GeneratorSettings } from "@/lib/proposal/generate";

export const defaultMaintenancePlan: MaintenancePlan = {
  preventive: true, corrective: true, visitsPerMonth: 1, correctiveVisitsPerMonth: 1,
  responseHours: 24, serviceHours: "Segunda a sexta, das 8h às 18h, exceto feriados",
  coveredEquipment: "", partsCoverage: "Peças, baterias e equipamentos de reposição não estão incluídos. Serão orçados e aprovados separadamente.",
  monthlyPrice: 0, termMonths: 12, dueDay: 10, startDate: "", indexName: "IPCA",
};

export function isMaintenanceProposal(briefing: unknown): boolean {
  return Boolean(briefing && typeof briefing === "object" && "purpose" in briefing && briefing.purpose === "manutencao_mensal");
}
export function getMaintenancePlan(briefing: unknown): MaintenancePlan | null {
  if (!isMaintenanceProposal(briefing)) return null;
  const plan = (briefing as { maintenancePlan?: unknown }).maintenancePlan;
  return plan && typeof plan === "object" ? { ...defaultMaintenancePlan, ...plan } as MaintenancePlan : null;
}
export function validateMaintenancePlan(value: unknown): MaintenancePlan {
  if (!value || typeof value !== "object") throw new Error("Preencha os dados de manutenção mensal.");
  const input = value as Record<string, unknown>;
  const number = (key: keyof MaintenancePlan, min: number, max: number, integer = false) => {
    const n = Number(input[key]);
    if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw new Error(`Confira o campo de manutenção: ${({ monthlyPrice: "mensalidade", termMonths: "vigência", dueDay: "dia de vencimento", visitsPerMonth: "visitas preventivas", correctiveVisitsPerMonth: "visitas corretivas", responseHours: "prazo de resposta" } as Record<string, string>)[key] || key}.`);
    return n;
  };
  const text = (key: keyof MaintenancePlan, required = false) => {
    const v = String(input[key] ?? "").trim();
    if (v.length > 5000 || (required && !v)) throw new Error(`Preencha ${key === "coveredEquipment" ? "os sistemas e equipamentos cobertos" : key === "serviceHours" ? "o horário de atendimento" : key === "indexName" ? "o índice de reajuste" : "as condições de manutenção"}.`);
    return v;
  };
  const preventive = input.preventive === true;
  const corrective = input.corrective === true;
  if (!preventive && !corrective) throw new Error("Selecione manutenção preventiva, corretiva ou ambas.");
  const startDate = text("startDate");
  if (startDate && (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(Date.parse(startDate)))) throw new Error("Data de início inválida.");
  return { preventive, corrective,
    visitsPerMonth: number("visitsPerMonth", preventive ? 1 : 0, 31, true),
    correctiveVisitsPerMonth: number("correctiveVisitsPerMonth", corrective ? 1 : 0, 31, true),
    responseHours: number("responseHours", 1, 720, true),
    serviceHours: text("serviceHours", true), coveredEquipment: text("coveredEquipment", true), partsCoverage: text("partsCoverage", true),
    monthlyPrice: Math.round(number("monthlyPrice", 0.01, 1_000_000) * 100) / 100,
    termMonths: number("termMonths", 1, 60, true), dueDay: number("dueDay", 1, 28, true),
    startDate, indexName: text("indexName", true).slice(0, 50),
  };
}

export function maintenanceSummary(items: ProposalItem[], discount: number, briefing: unknown) {
  const plan = getMaintenancePlan(briefing);
  const months = plan?.termMonths || 12;
  const recurring = items.filter((i) => /^(mês|mes|meses|mensal)$/i.test(i.unit.trim()));
  const monthlyCents = Math.round(calcTotals(recurring, discount).totalCents / months);
  return { monthlyCents, months, totalCents: calcTotals(items, discount).totalCents };
}

export function generateMaintenanceProposal(input: {
  type: ProposalType; briefing: Briefing; clientName: string; contact: string; clientEmail: string; site: string;
  validityDays?: number; discountPct?: number; settings: GeneratorSettings;
}): ProposalDraft {
  const p = validateMaintenancePlan(input.briefing.maintenancePlan);
  const validity = input.validityDays ?? input.settings.defaultValidityDays;
  const client = input.clientName.trim();
  const coverage = [p.preventive ? "preventiva" : "", p.corrective ? "corretiva" : ""].filter(Boolean).join(" e ");
  const payment = `Mensalidade com vencimento no dia ${p.dueDay} de cada mês, mediante emissão de documento fiscal. Forma de pagamento a combinar.`;
  const preventive = p.preventive
    ? `${p.visitsPerMonth} visita(s) preventiva(s) programada(s) por mês. Inspeção visual, limpeza técnica de componentes acessíveis, verificação de conexões e alimentação, teste funcional dos sistemas cobertos e registro das recomendações. Intervenções respeitam as condições técnicas, o fabricante e o acesso autorizado.`
    : "Manutenção preventiva não incluída nesta contratação.";
  const corrective = p.corrective
    ? `Até ${p.correctiveVisitsPerMonth} visita(s) corretiva(s) por mês, mediante abertura de chamado. Diagnóstico de falhas e correções de configuração ou ajustes nos sistemas cobertos. Visitas excedentes, reposições e serviços adicionais dependem de orçamento e aprovação prévios.`
    : "Manutenção corretiva não incluída. Chamados corretivos dependem de orçamento separado.";
  const sections: ProposalSection[] = [];
  const add = (id: string, title: string, body: string, kind: ProposalSection["kind"] = "text") => sections.push({ id, title, body, kind, enabled: true });
  add("objeto", "Objeto", `Prestação de manutenção mensal ${coverage} para ${client}, no local ${input.site || "a confirmar"}. Esta proposta contempla serviços recorrentes sobre os sistemas existentes descritos abaixo; não constitui fornecimento ou instalação de um novo sistema.`);
  if (input.type === "completa") add("empresa", "Cipriano Tech & Security", `${input.settings.companyName} atua em tecnologia e segurança eletrônica, com serviços de manutenção e suporte conforme o escopo contratado. Responsável informado: ${input.settings.director}. ${input.settings.crea} · CNPJ ${input.settings.cnpj}.`);
  add("inventario", "Sistemas e equipamentos cobertos", p.coveredEquipment);
  add("escopo", "Escopo da manutenção", `PREVENTIVA\n${preventive}\n\nCORRETIVA\n${corrective}\n\nRelatório de atendimento com atividades realizadas, ocorrências, recomendações e pendências. Outros serviços só serão executados após aceite prévio por escrito.`);
  add("atendimento", "Atendimento e limites", `Prazo de resposta inicial: até ${p.responseHours} hora(s) úteis após registro do chamado. A resposta inicial não é promessa de solução definitiva nesse prazo.\n\nHorário contratado: ${p.serviceHours}.\n\nA programação de visitas depende do acesso e do responsável indicado pelo cliente. Falhas que exigem peças ou intervenção de terceiros terão prazo específico informado após diagnóstico.`);
  add("pecas", "Peças e materiais", p.partsCoverage);
  add("fora_escopo", "Fora do escopo", "Novas instalações, ampliações, obras civis, alterações de infraestrutura, licenças não listadas, vigilância patrimonial e monitoramento 24h não estão incluídos, salvo contratação expressa. O serviço de manutenção não garante ausência de incidentes de segurança.");
  if (input.type === "completa") {
    add("responsabilidades", "Responsabilidades", "A Cipriano executará os serviços com equipe capacitada, registrará os atendimentos e solicitará aprovação para adicionais. O cliente disponibilizará acesso, energia, rede quando necessária, credenciais autorizadas e responsável para acompanhar as visitas. Requisitos de segurança e trabalho em altura serão avaliados antes de cada intervenção.");
    add("privacidade", "Confidencialidade e proteção de dados", "O acesso a imagens, configurações e dados será restrito ao necessário para o serviço, observada a LGPD. As partes deverão definir os canais de comunicação, permissões e procedimentos de segurança. Senhas e arquivos do cliente não serão divulgados a terceiros sem autorização ou obrigação legal.");
  }
  add("equipamentos", "Serviços e valores", `O preço unitário abaixo corresponde a uma mensalidade. A quantidade representa os ${p.termMonths} meses da vigência proposta, não o número de equipamentos.`, "items");
  add("valor", "Investimento da manutenção", "A mensalidade e o total de referência do período estão discriminados abaixo. Não se trata de parcelamento de uma instalação.", "totals");
  add("condicoes", "Condições comerciais", payment, "terms");
  add("vigencia", "Vigência e início", `Vigência proposta de ${p.termMonths} mês(es). Início: ${p.startDate ? p.startDate.split("-").reverse().join("/") : "a combinar após aceite"}. Renovação, cancelamento e aviso prévio dependem de acordo expresso entre as partes.`);
  add("reajuste", "Reajuste anual", `Reajuste após cada período mínimo de 12 meses, conforme variação acumulada do ${p.indexName} na janela pactuada. O índice, o tratamento de variações negativas e a eventual substituição devem ser confirmados no contrato. A escolha de outro índice exige acordo escrito.`);
  add("validade", "Validade e formalização", `Validade de ${validity} dias corridos a partir da emissão. Caso o cliente opte por contrato, poderá ser gerada uma minuta vinculada a esta proposta e revisão. A minuta deve ser conferida por ambas as partes antes da assinatura; a geração não equivale ao aceite ou à ativação do serviço.`);
  add("aceite", "Aceite", "O aceite comercial deve ser registrado por escrito. Quando solicitado, o contrato formaliza escopo, valores, vigência e condições, sem modificar a proposta de origem.");
  return {
    type: input.type, clientName: client, contact: input.contact, clientEmail: input.clientEmail, site: input.site,
    validityDays: validity, discountPct: input.discountPct ?? 0,
    items: [{ id: `maintenance-${Date.now().toString(36)}`, kind: "servico", desc: `Manutenção mensal ${coverage}`, spec: `${p.preventive ? `${p.visitsPerMonth} preventiva(s)/mês` : "Sem preventiva"} · ${p.corrective ? `${p.correctiveVisitsPerMonth} corretiva(s)/mês` : "Sem corretiva"} · resposta em ${p.responseHours} h úteis`, unit: "mês", qty: p.termMonths, price: p.monthlyPrice }],
    sections, paymentTerms: payment,
    deliveryTime: `${p.termMonths} meses de serviços recorrentes · início ${p.startDate ? p.startDate.split("-").reverse().join("/") : "a combinar"}`,
    warranty: "Responsabilidade pelos serviços executados conforme escopo e legislação aplicável. Garantia de peças e equipamentos depende de contratação específica.",
    artIncluded: false,
    briefing: { ...input.briefing, purpose: "manutencao_mensal", maintenance: true, maintenancePlan: p },
  };
}
