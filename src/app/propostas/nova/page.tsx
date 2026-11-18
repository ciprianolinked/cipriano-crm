import { ensureBootstrap, listCatalog, listClients } from "@/lib/data";
import { NewProposalWizard } from "@/components/proposal/NewProposalWizard";
import { loadDatabasePage } from "@/components/system/load-database-page";

export const dynamic = "force-dynamic";

export default async function NewProposalPage() {
  const loaded = await loadDatabasePage(async () => {
    await ensureBootstrap();
    const [clientsList, catalogList] = await Promise.all([listClients(), listCatalog()]);
    return { clients: clientsList, catalog: catalogList };
  });
  if (!loaded.ok) return loaded.recovery;
  const { clients, catalog } = loaded.data;
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 lg:px-7 lg:py-7">
      <header className="border-b border-line/50 pb-4">
        <div className="label-mono text-signal">Motor de propostas</div>
        <h1 className="mt-2 font-display text-[clamp(1.5rem,2.6vw,2rem)] font-semibold text-white">
          Nova proposta em três etapas
        </h1>
        <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-steel">
          Elabore uma proposta de projeto, produtos ou serviços, ou um plano de manutenção mensal preventiva e corretiva.
          Revise os valores e, se o cliente optar, prepare também um contrato vinculado.
        </p>
      </header>
      <div className="mt-4">
        <NewProposalWizard
          aiEnabled={Boolean(process.env.OPENAI_API_KEY)}
          clients={clients.map((c) => ({
            id: c.id,
            name: c.name,
            contactName: c.contactName,
            email: c.email,
            address: c.address,
            city: c.city,
            state: c.state,
          }))}
          catalog={catalog.filter((item) => item.active).map((item) => ({
            id: item.id,
            kind: item.kind,
            category: item.category,
            description: item.description,
            spec: item.spec,
            unit: item.unit,
            priceCents: item.priceCents,
          }))}
        />
      </div>
    </div>
  );
}
