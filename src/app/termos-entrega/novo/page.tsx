import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { proposals } from "@/db/schema";
import { getSettings } from "@/lib/data";
import { DeliveryTermWorkspace } from "@/components/delivery-term/DeliveryTermWorkspace";

export const dynamic = "force-dynamic";

export default async function NewDeliveryTermPage({ searchParams }: { searchParams: Promise<{ proposta?: string }> }) {
  const { proposta } = await searchParams;
  const settings = await getSettings();
  if (!proposta) {
    const won = await db.select().from(proposals).where(eq(proposals.status, "ganho")).orderBy(desc(proposals.updatedAt));
    return (
      <div className="mx-auto max-w-5xl px-4 py-7 lg:px-7">
        <header className="mb-5 flex items-end justify-between gap-4 border-b border-line/50 pb-4"><div><div className="label-mono text-signal">Criar documento</div><h1 className="mt-1 font-display text-2xl font-semibold text-white">Selecione uma proposta ganha</h1><p className="mt-2 text-[12px] text-steel">O termo copia automaticamente cliente, local, condições e itens da proposta escolhida.</p></div><Link href="/termos-entrega" className="btn">Voltar</Link></header>
        <section className="card p-5">
          {won.length ? <div className="space-y-2">{won.map((proposal) => <Link key={proposal.id} href={`/termos-entrega/novo?proposta=${proposal.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/50 bg-abyss2/40 p-4 transition hover:border-signal/50"><span><strong className="block text-sm text-white">{proposal.clientName}</strong><span className="font-mono text-[10px] text-steel">{proposal.number} · {proposal.sections.find((s) => s.id === "objeto")?.title ?? proposal.type} · R$ {(proposal.totalCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></span><span className="btn btn-primary">Criar termo →</span></Link>)}</div> : <p className="rounded-xl border border-dashed border-line/60 p-7 text-center text-sm text-steel">Ainda não há propostas ganhas. Abra uma proposta, mova a etapa para “Ganho” e volte aqui.</p>}
        </section>
      </div>
    );
  }

  const rows = await db.select().from(proposals).where(eq(proposals.id, proposta)).limit(1);
  const proposal = rows[0];
  if (!proposal) {
    return <div className="mx-auto max-w-4xl px-4 py-10"><section className="card p-5"><h1 className="font-display text-xl text-white">Proposta não encontrada</h1><Link href="/propostas" className="btn mt-4">Ir para propostas</Link></section></div>;
  }
  if (proposal.status !== "ganho") {
    return <div className="mx-auto max-w-4xl px-4 py-10"><section className="card p-5"><h1 className="font-display text-xl text-white">A proposta ainda não está ganha</h1><p className="mt-2 text-sm text-steel">Marque a proposta como “Ganho” antes de elaborar o termo de entrega.</p><Link href={`/propostas/${proposal.id}`} className="btn btn-primary mt-4">Abrir proposta</Link></section></div>;
  }

  return <DeliveryTermWorkspace
    proposal={{ id: proposal.id, number: proposal.number, revision: proposal.revision, status: proposal.status, clientName: proposal.clientName, contact: proposal.contact, clientEmail: proposal.clientEmail, site: proposal.site, warranty: proposal.warranty, deliveryTime: proposal.deliveryTime, items: proposal.items }}
    settings={{ companyName: settings.companyName, legalName: settings.legalName, cnpj: settings.cnpj, crea: settings.crea, address: settings.address, phone: settings.phone, email: settings.email }}
  />;
}
