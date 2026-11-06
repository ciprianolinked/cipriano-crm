import type { ClientRow, ProposalRow, SettingsRow } from "@/db/schema";
import type { ProposalItem } from "@/lib/proposal/types";
import { brl, fmtDate } from "@/lib/brand";

export function recurringItems(items: ProposalItem[]) {
  return items.filter((item) => /^(m[eê]s|mensal|meses)$/i.test(item.unit.trim()));
}

/** O preço unitário mensal é tomado uma vez; qty pode representar os 12 meses do contrato. */
export function suggestedMonthlyValue(items: ProposalItem[]): number {
  return recurringItems(items).reduce((sum, item) => sum + Math.max(0, item.price), 0);
}

export function proposalSnapshot(proposal: ProposalRow) {
  return {
    id: proposal.id,
    number: proposal.number,
    revision: proposal.revision,
    clientName: proposal.clientName,
    contact: proposal.contact,
    clientEmail: proposal.clientEmail,
    site: proposal.site,
    items: proposal.items,
    sections: proposal.sections,
    paymentTerms: proposal.paymentTerms,
    warranty: proposal.warranty,
    issuedAt: proposal.issuedAt.toISOString(),
  };
}

export function makeContractDraft(input: {
  proposal: ProposalRow;
  client: ClientRow | null;
  settings: SettingsRow;
  monthlyCents: number;
  startDate: Date;
  indexName: string;
  description: string;
}): string {
  const { proposal: p, client, settings, monthlyCents, startDate, indexName, description } = input;
  const recurring = recurringItems(p.items);
  const scopeSection = p.sections.find((s) => s.enabled && /escopo/i.test(s.title));
  const clientName = client?.company || p.clientName;
  const clientDocument = client?.document || "[CNPJ/CPF DO CLIENTE A PREENCHER]";
  const clientAddress = [client?.address, client?.city, client?.state].filter(Boolean).join(" — ") || p.site || "[ENDEREÇO DO CLIENTE A PREENCHER]";
  const scope = description.trim() || recurring.map((item) => `${item.desc}${item.spec ? `: ${item.spec}` : ""}`).join("; ") || "[DESCREVER OS SERVIÇOS DE MANUTENÇÃO CONTRATADOS]";
  const inheritedScope = scopeSection?.body ? `\nTrecho do escopo da proposta para conferência (somente o que for contratado abaixo):\n${scopeSection.body}` : "";
  const monthly = monthlyCents > 0 ? brl(monthlyCents / 100) : "[VALOR MENSAL A DEFINIR]";
  const recurringText = recurring.length
    ? recurring.map((item) => `• ${item.desc} — valor unitário mensal da proposta: ${brl(item.price)}. ${item.spec || ""}`).join("\n")
    : "[NENHUM ITEM MENSAL IDENTIFICADO NA PROPOSTA — CONFERIR ESCOPO E VALOR]";

  return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE MANUTENÇÃO MENSAL\n\nPARTES CONTRATANTES\n\nCONTRATADA: ${settings.legalName}, nome fantasia ${settings.companyName}, inscrita no CNPJ sob nº ${settings.cnpj}, com endereço em ${settings.address}, neste ato representada por ${settings.director}, ${settings.role}, contato ${settings.email}, telefone ${settings.phone}.\n\nCONTRATANTE: ${clientName}, inscrito(a) no CNPJ/CPF sob nº ${clientDocument}, com endereço em ${clientAddress}, representado(a) por ${p.contact || "[NOME E QUALIFICAÇÃO DO REPRESENTANTE]"}, e-mail ${p.clientEmail || "[E-MAIL DO CLIENTE]"}.\n\nAs partes celebram o presente instrumento, vinculado à proposta ${p.number}, revisão ${String(p.revision).padStart(2, "0")}, que o integra como anexo, observadas as condições a seguir. Havendo divergência, prevalecerá o texto deste contrato, salvo ajuste escrito posterior.\n\n1. OBJETO E LOCAL\n\nPrestação de serviços contínuos de manutenção de sistemas de segurança eletrônica, no endereço ${p.site || "[LOCAL DE PRESTAÇÃO DOS SERVIÇOS]"}, conforme os serviços expressamente contratados neste instrumento e na proposta anexa.\n\n2. ESCOPO DOS SERVIÇOS\n\n${scope}\n\nItens recorrentes identificados na proposta:\n${recurringText}\n${inheritedScope}\n\nA frequência das visitas preventivas, as rotinas de teste, os equipamentos cobertos e os chamados corretivos deverão ser confirmados pelas partes: [DETALHAR FREQUÊNCIA, INVENTÁRIO E SERVIÇOS INCLUÍDOS]. Qualquer serviço fora desses limites dependerá de orçamento e aprovação prévios.\n\n3. PRAZOS DE ATENDIMENTO E COMUNICAÇÃO\n\nOs chamados serão abertos pelos canais ${settings.phone} e ${settings.email}, nos horários acordados. Prazo de resposta: [DEFINIR SLA E HORÁRIO]. Prazo de visita técnica: [DEFINIR PRAZO E ÁREA DE COBERTURA]. O prazo poderá ser revisto quando houver necessidade de peças, acesso, terceiros ou condição técnica fora do controle da contratada, mediante comunicação ao cliente.\n\n4. OBRIGAÇÕES DA CONTRATADA\n\nExecutar os serviços pactuados com profissionais capacitados e observar as normas aplicáveis à atividade; informar ao cliente os defeitos encontrados; registrar visitas e recomendações; e apresentar orçamento prévio para materiais ou serviços não incluídos. A contratada não assume obrigação de vigilância patrimonial, pronto atendimento policial ou garantia de ausência de falhas e incidentes.\n\n5. OBRIGAÇÕES DA CONTRATANTE\n\nPermitir acesso seguro aos equipamentos e disponibilizar responsável autorizado, energia elétrica, conectividade e infraestrutura necessárias; fornecer informações sobre alterações no sistema; comunicar falhas prontamente; efetuar os pagamentos; e manter a guarda de credenciais e imagens conforme sua política de acesso e a legislação aplicável.\n\n6. EXCLUSÕES E SERVIÇOS ADICIONAIS\n\nPeças, reposição de equipamentos, licenças, obras civis, infraestrutura não prevista, deslocamentos extraordinários, modificações por terceiros e atendimentos fora do escopo somente estarão incluídos quando descritos expressamente. Os serviços adicionais serão executados mediante orçamento e aceite escrito da contratante.\n\n7. PREÇO, FATURAMENTO E PAGAMENTO\n\nA contratante pagará à contratada o valor de ${monthly} por mês, com vencimento no dia [DIA DE VENCIMENTO], por [FORMA DE PAGAMENTO], mediante emissão de documento fiscal aplicável. Condições especiais, tributos e encargos por atraso: [DEFINIR E CONFERIR ANTES DA ASSINATURA]. O valor de instalação ou fornecimento de equipamentos da proposta não se confunde com a mensalidade.\n\n8. REAJUSTE ANUAL\n\nApós cada período de 12 (doze) meses, o valor poderá ser reajustado pela variação acumulada do ${indexName}, considerando os 12 meses encerrados no mês anterior ao aniversário contratual, conforme disponibilidade da série oficial. Em caso de índice negativo, indisponibilidade ou extinção, as partes definirão o tratamento e eventual índice substituto por escrito: [COMPLEMENTAR REGRA CONTRATUAL]. A alteração do índice pactuado depende de acordo entre as partes. A contratada comunicará previamente o valor calculado e a data de vigência do reajuste.\n\n9. VIGÊNCIA, RENOVAÇÃO E RESCISÃO\n\nO contrato tem início previsto em ${fmtDate(startDate)} e vigência de [PRAZO A DEFINIR]. Condições de renovação, aviso prévio, rescisão e eventuais penalidades devem ser negociadas e preenchidas: [CONDIÇÕES A DEFINIR]. Valores de serviços realizados e despesas previamente aprovadas serão apurados até a data efetiva de encerramento.\n\n10. RESPONSABILIDADE E GARANTIA\n\nCada parte responderá pelos danos que comprovadamente causar, observados os limites legais e as condições aqui negociadas. A cobertura e a garantia dos serviços, bem como as condições dos equipamentos de terceiros, serão definidas expressamente: [DETALHAR GARANTIA]. A existência deste contrato não substitui seguro, vigilância humana ou obrigações de terceiros.\n\n11. DADOS PESSOAIS E CONFIDENCIALIDADE\n\nAs partes comprometem-se a proteger informações técnicas, credenciais e dados pessoais a que tiverem acesso, observando a Lei nº 13.709/2018 (LGPD), conforme os papéis e instruções efetivamente aplicáveis. Acesso a imagens e dados deve limitar-se ao necessário para executar o objeto. Procedimentos para incidentes, retenção e compartilhamento: [PREENCHER]. A obrigação de confidencialidade permanece pelo prazo que as partes acordarem ou enquanto a lei exigir.\n\n12. ALTERAÇÕES E DISPOSIÇÕES GERAIS\n\nAlterações de escopo, preço ou condições deverão ser formalizadas por escrito. A eventual tolerância de uma parte não implica renúncia de direitos. Situações de força maior ou impedimentos técnicos serão comunicados e tratados conforme a legislação e o ajuste entre as partes.\n\n13. FORO\n\nAs partes elegem o foro de [COMARCA A DEFINIR], observadas as regras legais aplicáveis, especialmente eventual competência obrigatória e direitos do consumidor.\n\nE, por estarem de acordo, assinam o presente instrumento.\n\n[LOCAL], ____ de __________________ de ______.\n\n________________________________________\n${settings.legalName} — CONTRATADA\n${settings.director}\n\n________________________________________\n${clientName} — CONTRATANTE\n[REPRESENTANTE LEGAL]\n\n________________________________________\nTestemunha 1 — Nome e CPF\n\n________________________________________\nTestemunha 2 — Nome e CPF`;
}
