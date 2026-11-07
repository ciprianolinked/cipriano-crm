import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, clients, maintenanceContracts, proposals } from "@/db/schema";
import { getSettings } from "@/lib/data";
import { makeContractDraft, proposalSnapshot, suggestedMonthlyValue, type ContractKind } from "@/lib/contract-draft";
import { getMaintenancePlan, isMaintenanceProposal } from "@/lib/proposal/maintenance-plan";
import { maybePolishWithLLM } from "@/lib/ai";
import { addMonths } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as { proposalId?: string; contractKind?: string; clientOptIn?: boolean; monthlyValue?: number; startDate?: string; indexName?: string; description?: string; title?: string; useAi?: boolean };
  if (!body.proposalId || !/^[0-9a-f-]{36}$/i.test(body.proposalId)) return NextResponse.json({ error: "Selecione uma proposta válida." }, { status: 400 });
  if (body.clientOptIn !== true) return NextResponse.json({ error: "Confirme que o cliente deseja formalizar esta proposta em contrato." }, { status: 400 });
  if (body.contractKind && body.contractKind !== "manutencao" && body.contractKind !== "proposta") return NextResponse.json({ error: "Modalidade de contrato inválida." }, { status: 400 });
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, body.proposalId)).limit(1);
  if (!proposal) return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  const kind: ContractKind = body.contractKind === "proposta" ? "proposta" : body.contractKind === "manutencao" || isMaintenanceProposal(proposal.briefing) ? "manutencao" : "proposta";
  const maintenance = kind === "manutencao";
  const plan = getMaintenancePlan(proposal.briefing);
  const client = proposal.clientId ? (await db.select().from(clients).where(eq(clients.id, proposal.clientId)).limit(1))[0] ?? null : null;
  const settings = await getSettings();
  const monthlyValue = maintenance ? body.monthlyValue === undefined ? suggestedMonthlyValue(proposal.items, proposal.briefing, proposal.discountPct) : Number(body.monthlyValue) : 0;
  if (!Number.isFinite(monthlyValue) || monthlyValue < 0 || monthlyValue > 1_000_000) return NextResponse.json({ error: "Valor mensal inválido." }, { status: 400 });
  const dateText = body.startDate || (maintenance ? plan?.startDate : "");
  const startDate = dateText ? new Date(`${dateText}T12:00:00Z`) : new Date();
  if (Number.isNaN(startDate.getTime())) return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  const indexName = maintenance ? String(body.indexName || plan?.indexName || "IPCA").trim().slice(0, 50) : "Sem reajuste automático";
  if (indexName === "OUTRO") return NextResponse.json({ error: "Informe o nome do índice." }, { status: 400 });
  const description = String(body.description ?? "").trim().slice(0, 10000);
  const title = String(body.title || `${maintenance ? "Manutenção mensal" : "Contrato da proposta"} — ${proposal.clientName}`).trim().slice(0, 200);
  const draft = makeContractDraft({ proposal, client, settings, monthlyCents: Math.round(monthlyValue * 100), startDate, indexName, description, contractKind: kind });
  let contractText = draft;
  let generationSource = "modelo";
  if (body.useAi !== false && process.env.OPENAI_API_KEY) {
    const ai = await maybePolishWithLLM({ system: "Você é assistente de redação de minutas contratuais brasileiras. Redija com rigor e clareza, sem afirmar ser advogado, sem inventar dados, serviços, prazos ou garantias. Preserve as partes, números, campos pendentes, modalidade e condições da minuta. Retorne somente o texto integral do contrato, com assinaturas. A minuta precisa ser revisada por advogado antes da assinatura.", prompt: `Modalidade: ${maintenance ? "manutenção mensal" : "fornecimento e/ou serviços avulsos, sem mensalidade automática"}. Proposta ${proposal.number}, revisão ${proposal.revision}. Preserve os valores e todas as condições da minuta. Não acrescente compromissos não confirmados.\n\nMINUTA:\n${draft}` });
    if (ai) { contractText = ai; generationSource = "ia"; }
  }
  const row = await db.transaction(async (tx) => {
    const [contract] = await tx.insert(maintenanceContracts).values({
      contractKind: kind, contractValueCents: proposal.totalCents,
      clientId: proposal.clientId, clientName: proposal.clientName, title, description: description || null,
      proposalId: proposal.id, proposalNumber: proposal.number, proposalRevision: proposal.revision, proposalSnapshot: proposalSnapshot(proposal),
      monthlyCents: Math.round(monthlyValue * 100), startDate, nextReadjustAt: maintenance ? addMonths(startDate, 12) : null,
      cycleMonths: 12, indexName, status: "rascunho", contractText, generationSource,
    }).returning();
    await tx.insert(activities).values({ proposalId: proposal.id, kind: "sistema", content: `Minuta contratual ${maintenance ? "de manutenção mensal" : "de fornecimento/serviços"} criada a pedido do cliente, vinculada à revisão ${proposal.revision}. Aguardando conferência e formalização.`, doneAt: new Date() });
    return contract;
  });
  return NextResponse.json({ contract: row, source: generationSource }, { status: 201 });
}
