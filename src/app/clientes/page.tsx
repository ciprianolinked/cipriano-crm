import { ensureBootstrap, listClients, listProposals } from "@/lib/data";
import { ClientManager, type ClientRecord } from "@/components/clients/ClientManager";
import { loadDatabasePage } from "@/components/system/load-database-page";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const loaded = await loadDatabasePage(async () => {
    await ensureBootstrap();
    const [clients, proposals] = await Promise.all([listClients(), listProposals(true)]);
    return { clients, proposals };
  });
  if (!loaded.ok) return loaded.recovery;
  const { clients, proposals } = loaded.data;
  const records: ClientRecord[] = clients.map((c) => {
    const linked = proposals.filter((p) => p.clientId === c.id);
    return {
      id: c.id,
      name: c.name,
      company: c.company,
      contactName: c.contactName,
      email: c.email,
      phone: c.phone,
      document: c.document,
      address: c.address,
      city: c.city,
      state: c.state,
      segment: c.segment,
      source: c.source,
      notes: c.notes,
      proposals: linked.length,
      pipelineCents: linked
        .filter((p) => p.status !== "ganho" && p.status !== "perdido")
        .reduce((a, p) => a + p.totalCents, 0),
    };
  });

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 lg:px-7 lg:py-7">
      <header className="border-b border-line/50 pb-4">
        <div className="label-mono text-signal">Base comercial</div>
        <h1 className="mt-2 font-display text-[clamp(1.5rem,2.6vw,2rem)] font-semibold text-white">Clientes e oportunidades</h1>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-steel">
          Consulte um CNPJ para preencher os dados públicos da empresa ou cadastre manualmente. Contatos, endereço e
          histórico de propostas ficam organizados para sua próxima venda.
        </p>
      </header>
      <div className="mt-4">
        <ClientManager clients={records} />
      </div>
    </div>
  );
}
