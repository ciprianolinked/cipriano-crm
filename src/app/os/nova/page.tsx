import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { ensureSchema } from "@/lib/db-migrations";
import { ensureBootstrap, listCatalog, listClients } from "@/lib/data";
import { NewServiceOrderForm } from "@/components/os/NewServiceOrderForm";
import { loadDatabasePage } from "@/components/system/load-database-page";

export const dynamic = "force-dynamic";

export default async function NovaOsPage() {
  const loaded = await loadDatabasePage(async () => {
    await ensureSchema();
    await ensureBootstrap();
    const [clients, catalog, proposalRows] = await Promise.all([
      listClients(),
      listCatalog(),
      db
        .select({ id: proposals.id, number: proposals.number, clientName: proposals.clientName, site: proposals.site, status: proposals.status })
        .from(proposals)
        .orderBy(desc(proposals.updatedAt))
        .limit(80),
    ]);
    return { clients, catalog, proposalRows };
  });
  if (!loaded.ok) return loaded.recovery;
  const { clients, catalog, proposalRows } = loaded.data;
  const proposalsOpen = proposalRows.filter((p) => p.status !== "perdido");

  return (
    <div className="mx-auto max-w-[1300px] px-4 py-5 lg:px-7 lg:py-7">
      <div className="mb-4 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-steel">
        <Link href="/os" className="hover:text-signal">Ordens de serviço</Link>
        <span className="text-line">/</span>
        <span className="text-signal">Nova OS</span>
      </div>
      <header className="border-b border-line/50 pb-4">
        <div className="label-mono text-signal">Operação em campo</div>
        <h1 className="mt-2 font-display text-[clamp(1.5rem,2.6vw,2rem)] font-semibold text-white">Abrir ordem de serviço</h1>
        <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-steel">
          Registre a solicitação, o diagnóstico e as peças. A OS controla a execução; se precisar cobrar peças ou
          mão de obra, gere o orçamento vinculado em um clique e ajuste a proposta depois.
        </p>
      </header>
      <div className="mt-4">
        <NewServiceOrderForm
          clients={clients.map((c) => ({
            id: c.id,
            name: c.name,
            contactName: c.contactName,
            email: c.email,
            phone: c.phone,
            address: c.address,
            city: c.city,
            state: c.state,
          }))}
          catalog={catalog
            .filter((c) => c.active)
            .map((c) => ({
              id: c.id,
              category: c.category,
              description: c.description,
              spec: c.spec,
              unit: c.unit,
              priceCents: c.priceCents,
            }))}
          proposals={proposalsOpen.map((p) => ({
            id: p.id,
            number: p.number,
            clientName: p.clientName,
            site: p.site,
            status: p.status,
          }))}
        />
      </div>
    </div>
  );
}
