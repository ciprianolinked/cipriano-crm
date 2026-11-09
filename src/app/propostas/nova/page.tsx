import { ensureBootstrap, getProposal, listClients } from "@/lib/data";
import { NewProposalWizard, type ReformulateData } from "@/components/proposal/NewProposalWizard";
import { isProposalType } from "@/lib/proposal/types";
import { loadDatabasePage } from "@/components/system/load-database-page";

export const dynamic = "force-dynamic";

export default async function NewProposalPage({ searchParams }: { searchParams: Promise<{ reformular?: string }> }) {
  const params = await searchParams;
  const reformulateId = params.reformular && /^[0-9a-f-]{36}$/i.test(params.reformular) ? params.reformular : null;
  const loaded = await loadDatabasePage(async () => {
    await ensureBootstrap();
    const clients = await listClients();
    const proposal = reformulateId ? await getProposal(reformulateId) : null;
    return { clients, proposal };
  });
  if (!loaded.ok) return loaded.recovery;
  const { clients, proposal } = loaded.data;
  const reformulate: ReformulateData | undefined = proposal
    ? {
        id: proposal.id,
        number: proposal.number,
        type: isProposalType(proposal.type) ? proposal.type : "completa",
        clientId: proposal.clientId,
        clientName: proposal.clientName,
        contact: proposal.contact,
        clientEmail: proposal.clientEmail,
        site: proposal.site,
        validityDays: proposal.validityDays,
        artIncluded: proposal.artIncluded,
        briefing: proposal.briefing,
      }
    : undefined;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 lg:px-7 lg:py-7">
      <header className="border-b border-line/50 pb-4">
        <div className="label-mono text-signal">{reformulate ? `Reformular · ${reformulate.number}` : "Motor de propostas"}</div>
        <h1 className="mt-2 font-display text-[clamp(1.5rem,2.6vw,2rem)] font-semibold text-white">
          {reformulate ? "Reformular proposta" : "Nova proposta em três etapas"}
        </h1>
        <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-steel">
          {reformulate
            ? "Os dados da proposta atual já estão carregados. Ajuste o objetivo, cliente, escopo e valores, gere a prévia e salve para substituir esta versão."
            : "Elabore uma proposta de projeto, produtos ou serviços, ou um plano de manutenção mensal preventiva e corretiva. Revise os valores e, se o cliente optar, prepare também um contrato vinculado."}
        </p>
      </header>
      <div className="mt-4">
        <NewProposalWizard
          aiEnabled={Boolean(process.env.OPENAI_API_KEY)}
          reformulate={reformulate}
          clients={clients.map((c) => ({
            id: c.id,
            name: c.name,
            contactName: c.contactName,
            email: c.email,
            address: c.address,
            city: c.city,
            state: c.state,
          }))}
        />
      </div>
    </div>
  );
}
