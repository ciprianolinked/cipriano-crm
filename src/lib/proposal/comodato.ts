import { brl } from "@/lib/brand";
import type { ComodatoConfig, ProposalItem, ProposalSection } from "@/lib/proposal/types";

export const DEFAULT_COMODATO_TERM = 36;
export const COMODATO_SECTION_PREFIX = "comodato-";

export function defaultComodato(): ComodatoConfig {
  return { enabled: false, termMonths: DEFAULT_COMODATO_TERM, monthlyCents: null, residualCents: 0 };
}

/** Valor de referência dos equipamentos (sem serviços), em centavos. */
export function equipmentBaseCents(items: ProposalItem[]): number {
  return items
    .filter((item) => item.kind === "equipamento")
    .reduce((sum, item) => sum + Math.round(item.price * 100) * Math.max(0, item.qty), 0);
}

export function comodatoSummary(config: ComodatoConfig | undefined, items: ProposalItem[]) {
  const termMonths = Math.min(120, Math.max(1, Math.round(Number(config?.termMonths) || DEFAULT_COMODATO_TERM)));
  const equipmentCents = equipmentBaseCents(items);
  const monthlyCents =
    config?.monthlyCents !== null && config?.monthlyCents !== undefined
      ? Math.max(0, Math.round(config.monthlyCents))
      : Math.ceil(equipmentCents / termMonths);
  return {
    termMonths,
    equipmentCents,
    monthlyCents,
    totalCents: monthlyCents * termMonths,
    residualCents: Math.max(0, Math.round(config?.residualCents ?? 0)),
  };
}

/** Seções da versão comodato. O bloco de valores é derivado; cláusulas são texto livre. */
export function buildComodatoSections(input: {
  config: ComodatoConfig;
  items: ProposalItem[];
  clientName: string;
  site?: string | null;
  companyName: string;
}): ProposalSection[] {
  const s = comodatoSummary(input.config, input.items);
  const client = input.clientName.trim() || "o cliente";
  const location = input.site?.trim() || "o local de instalação";
  const residualText =
    s.residualCents > 0
      ? `${brl(s.residualCents / 100)} ao final do prazo, a critério do cliente`
      : "ao final do prazo, devolução dos equipamentos ou aquisição por valor a combinar por escrito";

  const objeto = `Versão comodato: caso o cliente opte por esta modalidade, os equipamentos listados na proposta são cedidos em comodato a ${client}, pelo prazo de ${s.termMonths} meses, para uso no local ${location}.\n\nDurante todo o período, os equipamentos permanecem de propriedade da ${input.companyName}, que responde pela instalação, configuração, garantia do fabricante e manutenção conforme o contrato de manutenção. Esta modalidade substitui a aquisição dos equipamentos; instalação, comissionamento e treinamento seguem os valores da proposta.`;

  const valor = [
    `• Mensalidade de comodato: ${brl(s.monthlyCents / 100)} por mês, pelo prazo de ${s.termMonths} meses`,
    `• Valor total do comodato: ${brl(s.totalCents / 100)} ao longo do prazo`,
    `• Valor de referência dos equipamentos: ${brl(s.equipmentCents / 100)}`,
    "• Vencimento: todo dia 10 de cada mês, a partir da assinatura",
    "• Reajuste: anual, pelo IPCA acumulado, a partir do 13º mês",
    `• Aquisição: ${residualText}`,
  ].join("\n");

  const clausulas = [
    "• Uso e guarda: o cliente utiliza os equipamentos somente para os fins da segurança do local indicado, com zelo e conforme as orientações técnicas.",
    "• Vedações: não é permitido ceder, locar, emprestar, retirar do local ou alterar a configuração dos equipamentos sem autorização por escrito.",
    "• Infraestrutura: energia, rede, ambiente climatizado e acesso técnico são de responsabilidade do cliente, conforme o escopo da proposta.",
    "• Seguro: os equipamentos devem constar na apólice de seguro do cliente contra furto, roubo, incêndio e danos elétricos.",
    "• Manutenção: a manutenção preventiva e corretiva segue o contrato de manutenção, quando contratado; danos por mau uso ou intervenção de terceiros são cobrados à parte.",
    "• Inadimplência: atraso superior a 15 dias autoriza a suspensão do comodato após notificação por e-mail, sem prejuízo dos encargos legais.",
    "• Devolução: ao término ou na rescisão, o cliente devolve os equipamentos em bom estado, admitido o desgaste natural, em local combinado.",
    "• Dados e imagens: o tratamento de dados pessoais e imagens segue a LGPD (Lei 13.709/2018), sendo o cliente o controlador dos dados.",
  ].join("\n");

  return [
    { id: "comodato-objeto", title: "Versão comodato · Objeto", body: objeto, enabled: true, kind: "text" },
    { id: "comodato-valor", title: "Versão comodato · Valores e prazo", body: valor, enabled: true, kind: "terms" },
    { id: "comodato-clausulas", title: "Versão comodato · Cláusulas", body: clausulas, enabled: true, kind: "text" },
  ];
}

/**
 * Insere (ou remove, se desativado) as seções de comodato antes do bloco de aceite.
 * Preserva as cláusulas editadas quando apenas os valores mudam.
 */
export function applyComodato(
  sections: ProposalSection[],
  input: Parameters<typeof buildComodatoSections>[0],
): ProposalSection[] {
  const current = sections.filter((s) => !s.id.startsWith(COMODATO_SECTION_PREFIX));
  if (!input.config.enabled) return current;
  const fresh = buildComodatoSections(input);
  const previous = sections.filter((s) => s.id.startsWith(COMODATO_SECTION_PREFIX));
  const merged = fresh.map((section) => {
    const old = previous.find((p) => p.id === section.id);
    // Cláusulas e objeto podem ter sido editados pelo usuário: mantém o texto atual.
    if (old && (section.id === "comodato-clausulas" || section.id === "comodato-objeto")) {
      return { ...section, body: old.body, enabled: old.enabled, title: old.title };
    }
    if (old && section.id === "comodato-valor") return { ...section, enabled: old.enabled, title: old.title };
    return section;
  });
  const aceiteIndex = current.findIndex((s) => s.id === "aceite");
  if (aceiteIndex < 0) return [...current, ...merged];
  return [...current.slice(0, aceiteIndex), ...merged, ...current.slice(aceiteIndex)];
}
