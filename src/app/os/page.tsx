import Link from "next/link";
import { desc } from "drizzle-orm";
import { ArrowRight, Plus } from "lucide-react";
import { db } from "@/db";
import { serviceOrders } from "@/db/schema";
import { ensureSchema } from "@/lib/db-migrations";
import { ensureBootstrap } from "@/lib/data";
import { ServiceOrderManager, type OsListItem } from "@/components/os/ServiceOrderManager";
import { loadDatabasePage } from "@/components/system/load-database-page";

export const dynamic = "force-dynamic";

export default async function OsPage() {
  const loaded = await loadDatabasePage(async () => {
    await ensureSchema();
    await ensureBootstrap();
    return db.select().from(serviceOrders).orderBy(desc(serviceOrders.createdAt));
  });
  if (!loaded.ok) return loaded.recovery;

  const orders: OsListItem[] = loaded.data.map((os) => ({
    id: os.id,
    number: os.number,
    kind: os.kind,
    status: os.status,
    priority: os.priority,
    clientName: os.clientName,
    site: os.site,
    description: os.description,
    technician: os.technician,
    scheduledAt: os.scheduledAt ? os.scheduledAt.toISOString() : null,
    items: os.items,
    laborCents: os.laborCents,
    budgetProposalId: os.budgetProposalId,
    budgetProposalNumber: os.budgetProposalNumber,
    budgetTotalCents: os.budgetTotalCents,
    originProposalNumber: os.originProposalNumber,
    createdAt: os.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-4 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-steel">
        <Link href="/" className="hover:text-signal">Painel</Link>
        <span className="text-line">/</span>
        <span className="text-signal">Ordens de serviço</span>
      </div>

      <header className="relative overflow-hidden rounded-2xl border border-line/60 bg-gradient-to-r from-[#0b2038] via-[#0c1d32] to-[#071523] px-5 py-6 sm:px-7 sm:py-7">
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-signal/[0.05] blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-signal">
              <span className="h-1.5 w-1.5 rounded-full bg-armed" /> Operação em campo
            </div>
            <h1 className="font-display text-[clamp(1.65rem,3vw,2.2rem)] font-semibold leading-tight tracking-tight text-white">
              Ordens de serviço
            </h1>
            <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-steel">
              Controle a execução técnica do começo ao fim. Quando a OS exigir peças ou mão de obra extra,
              o orçamento é gerado automaticamente como proposta e fica vinculado à OS para correção.
            </p>
          </div>
          <Link href="/os/nova" className="btn btn-primary">
            <Plus size={15} /> Nova OS <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <div className="mt-5">
        <ServiceOrderManager orders={orders} />
      </div>
    </div>
  );
}
