import type { ClientRow, ProposalRow, SettingsRow } from "@/db/schema";
import type { ProposalItem } from "@/lib/proposal/types";
import { brl, fmtDate } from "@/lib/brand";
import { getMaintenancePlan, isMaintenanceProposal, maintenanceSummary } from "@/lib/proposal/maintenance-plan";

export type ContractKind = "manutencao" | "proposta";
export function recurringItems(items: ProposalItem[]) { return items.filter((i) => /^(m[eê]s|mensal|meses)$/i.test(i.unit.trim())); }
export function suggestedMonthlyValue(items: ProposalItem[], briefing?: unknown, discountPct = 0): number {
  if (isMaintenanceProposal(briefing)) return maintenanceSummary(items, discountPct, briefing).monthlyCents / 100;
  return Math.round(recurringItems(items).reduce((sum, item) => sum + Math.max(0, item.price), 0) * (1 - discountPct / 100) * 100) / 100;
}
export function proposalSnapshot(p: ProposalRow) {
  return { id: p.id, number: p.number, revision: p.revision, type: p.type, clientName: p.clientName, contact: p.contact, clientEmail: p.clientEmail, site: p.site, items: p.items, sections: p.sections, paymentTerms: p.paymentTerms, deliveryTime: p.deliveryTime, warranty: p.warranty, totalCents: p.totalCents, discountPct: p.discountPct, briefing: p.briefing, issuedAt: p.issuedAt.toISOString() };
}

export function makeContractDraft(input: {
  proposal: ProposalRow; client: ClientRow | null; settings: SettingsRow; monthlyCents: number; startDate: Date;
  indexName: string; description: string; contractKind?: ContractKind;
}): string {
  const { proposal: p, client, settings, monthlyCents, startDate, indexName, description } = input;
  const kind = input.contractKind ?? "manutencao";
  const maintenance = kind === "manutencao";
  const plan = getMaintenancePlan(p.briefing);
  const clientName = client?.company || p.clientName;
  const clientDocument = client?.document || "[CNPJ/CPF DO CLIENTE A PREENCHER]";
  const clientAddress = [client?.address, client?.city, client?.state].filter(Boolean).join(" — ") || p.site || "[ENDEREÇO DO CLIENTE A PREENCHER]";
  const recurring = recurringItems(p.items);
  const scope = p.sections.find((s) => s.enabled && /escopo/i.test(s.title))?.body || "[CONFERIR ESCOPO NA PROPOSTA]";
  const object = p.sections.find((s) => s.id === "objeto" && s.enabled)?.body || "[DESCREVER OBJETO DA PROPOSTA]";
  const exclusions = p.sections.find((s) => s.id === "fora_escopo" && s.enabled)?.body || "Serviços e materiais não expressamente listados dependem de orçamento e aprovação prévios.";
  const itemText = (maintenance ? recurring : p.items).map((item) => `• ${item.desc} — ${item.qty} ${item.unit} × ${brl(item.price)}. ${item.spec || ""}`).join("\n") || "[CONFERIR ITENS CONTRATADOS]";
  const monthly = monthlyCents > 0 ? brl(monthlyCents / 100) : "[VALOR MENSAL A DEFINIR]";
  const total = brl(p.totalCents / 100);
  const scopeText = description.trim() || (maintenance && plan ? `${plan.coveredEquipment}\n\n${scope}` : scope);
  const payment = maintenance
    ? `A contratante pagará ${monthly} por mês, com vencimento no dia ${plan?.dueDay ?? "[A DEFINIR]"}, mediante emissão de documento fiscal aplicável. A forma de pagamento é a constante da proposta anexa, se compatível com esta cobrança mensal, ou [FORMA A DEFINIR]. Encargos de atraso serão expressamente negociados: [DEFINIR]. O valor de instalação ou fornecimento avulso não se confunde com esta mensalidade.`
    : `O valor total de referência é ${total}, conforme os itens, quantidades e desconto da proposta ${p.number}, revisão ${p.revision}. Pagamento: ${p.paymentTerms || "[CONDIÇÕES A DEFINIR]"}. Tributos, frete e deslocamentos seguirão o que estiver expressamente indicado na proposta; encargos de atraso e demais condições: [DEFINIR]. Nenhuma cobrança de manutenção mensal é criada por este instrumento, salvo previsão expressa no seu escopo.`;
  const sla = maintenance && plan
    ? `Resposta inicial em até ${plan.responseHours} hora(s) úteis. Horário contratado: ${plan.serviceHours}. ${plan.preventive ? `${plan.visitsPerMonth} visita(s) preventiva(s) por mês.` : "Sem preventiva incluída."} ${plan.corrective ? `Até ${plan.correctiveVisitsPerMonth} visita(s) corretiva(s) por mês.` : "Sem corretiva incluída."} A resposta inicial não é prazo garantido de solução; intervenções que exigem peças ou terceiros serão reprogramadas após diagnóstico e comunicação.`
    : maintenance ? "Prazos de resposta, horários, frequência preventiva e limites dos chamados corretivos: [CONFIRMAR COM O CLIENTE]." : `Prazo de entrega/execução: ${p.deliveryTime || "[PRAZO A DEFINIR]"}. As condições para início e o cronograma deverão ser confirmados por escrito, incluindo liberações de acesso e infraestrutura necessárias. Entrega técnica e aceite: [DEFINIR CRITÉRIOS E RESPONSÁVEL].`;

  return `${maintenance ? "CONTRATO DE MANUTENÇÃO MENSAL PREVENTIVA E/OU CORRETIVA" : "CONTRATO DE FORNECIMENTO E/OU PRESTAÇÃO DE SERVIÇOS"}

PARTES CONTRATANTES

CONTRATADA: ${settings.legalName}, nome fantasia ${settings.companyName}, CNPJ ${settings.cnpj}, endereço ${settings.address}, representada por ${settings.director}, ${settings.role}. Contato: ${settings.email} · ${settings.phone}.

CONTRATANTE: ${clientName}, CNPJ/CPF ${clientDocument}, endereço ${clientAddress}, representada por ${p.contact || client?.contactName || "[NOME E QUALIFICAÇÃO DO REPRESENTANTE]"}. Contato: ${p.clientEmail || client?.email || "[E-MAIL A PREENCHER]"}.

As partes celebram este instrumento por opção de formalização da proposta ${p.number}, revisão ${String(p.revision).padStart(2, "0")}, emitida em ${fmtDate(p.issuedAt)}. A proposta e seus anexos integram este contrato. A geração desta minuta não equivale a assinatura, aceite ou ativação dos serviços. Em divergências, prevalece o ajuste escrito final firmado entre as partes.

1. OBJETO E LOCAL

${maintenance ? `Prestação de manutenção mensal sobre os sistemas existentes no local ${p.site || "[LOCAL A DEFINIR]"}, exclusivamente no escopo descrito a seguir.` : object}

2. ESCOPO CONTRATADO

${scopeText}

Itens de referência da proposta:
${itemText}

${maintenance ? "Quantidades em meses indicam vigência estimada, não número de equipamentos. A mensalidade final está na cláusula de preço." : "Os itens listados serão conferidos no aceite técnico; substituições exigem autorização escrita."}

3. PRAZOS, ATENDIMENTO E ACEITE

${sla}

As comunicações serão feitas pelos canais indicados na qualificação das partes. Mudanças de escopo ou indisponibilidade de acesso deverão ser registradas por escrito.

4. OBRIGAÇÕES DA CONTRATADA

Executar o objeto com equipe capacitada, observar as normas aplicáveis, registrar os serviços e comunicar as pendências encontradas. Solicitar aprovação prévia para serviços ou materiais adicionais. Não prometer ausência de falhas, furtos ou incidentes; a prestação técnica não substitui vigilância patrimonial, seguro ou obrigações de terceiros.

5. OBRIGAÇÕES DA CONTRATANTE

Disponibilizar acesso seguro, responsável autorizado, infraestrutura e informações necessárias; informar modificações no sistema; efetuar os pagamentos acordados; e manter a guarda de credenciais e dados. Restrições operacionais que afetem o atendimento ou cronograma deverão ser informadas em tempo hábil.

6. PEÇAS, EXCLUSÕES E ADICIONAIS

${maintenance && plan ? plan.partsCoverage : exclusions}

Toda ampliação ou despesa fora do escopo depende de orçamento e aprovação por escrito antes da execução. Obrigações não confirmadas deverão ser descritas no anexo técnico, sem inclusão automática de serviços.

7. PREÇO E PAGAMENTO

${payment}

8. VIGÊNCIA ${maintenance ? "E REAJUSTE ANUAL" : "E ALTERAÇÕES DE VALORES"}

Início previsto: ${fmtDate(startDate)}. ${maintenance && plan ? `Vigência proposta: ${plan.termMonths} mês(es).` : "Vigência: [CONFIRMAR PRAZO]."} Condições de renovação e continuidade: [DEFINIR].

${maintenance ? `O reajuste só poderá ocorrer após período mínimo de 12 meses, pela variação acumulada do ${indexName}, na janela de 12 meses encerrada no mês anterior ao aniversário contratual, conforme disponibilidade dos dados oficiais. Tratamento de índice negativo, indisponível ou extinto: [PACTUAR]. A substituição de índice depende de acordo escrito. O cliente será comunicado previamente do novo valor e data de vigência.` : "O preço, o cronograma e o escopo só serão alterados por acordo escrito. Não há reajuste recorrente automático. Eventual recomposição ou novo serviço dependerá de orçamento complementar e consentimento das partes."}

9. GARANTIA E RESPONSABILIDADE

${p.warranty || "[CONFERIR GARANTIA DOS SERVIÇOS E EQUIPAMENTOS]"}

Cada parte responderá pelos danos que comprovadamente causar, observados a legislação aplicável e os direitos que não podem ser afastados por contrato. Garantias de equipamentos de terceiros e limites de cobertura serão especificados, sem excluir direitos legais obrigatórios.

10. RESCISÃO E ENCERRAMENTO

As partes definirão as hipóteses de rescisão, aviso prévio, prazo para sanar inadimplemento e eventuais penalidades proporcionais: [PREENCHER ANTES DA ASSINATURA]. Valores relativos a entregas e serviços realizados e despesas previamente aprovadas serão apurados até o encerramento. A devolução de acessos e documentação será registrada.

11. CONFIDENCIALIDADE E DADOS PESSOAIS

As partes protegerão informações técnicas, credenciais, imagens e dados pessoais, limitando o acesso ao necessário à execução do objeto, conforme a Lei nº 13.709/2018 (LGPD) e os papéis efetivamente desempenhados. Procedimentos de retenção, comunicação de incidentes e compartilhamento deverão ser acordados: [DEFINIR]. O dever de confidencialidade persiste pelo prazo pactuado ou legalmente exigível.

12. DISPOSIÇÕES GERAIS E FORO

A tolerância não implica renúncia de direitos. Alterações deverão ser documentadas e aceitas por ambas as partes. Elegem o foro de [COMARCA A DEFINIR], respeitadas as competências obrigatórias e as normas de proteção ao consumidor, quando aplicáveis.

[LOCAL], ____ de __________________ de ______.

________________________________________
${settings.legalName} — CONTRATADA
${settings.director}

________________________________________
${clientName} — CONTRATANTE
[REPRESENTANTE LEGAL]

________________________________________
Testemunha 1 — Nome e CPF

________________________________________
Testemunha 2 — Nome e CPF`;
}
