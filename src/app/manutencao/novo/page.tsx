import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ensureBootstrap, listProposals } from "@/lib/data";
import { getIndexObservations } from "@/lib/indices-db";
import { compareIndexes } from "@/lib/indices";
import { NewContractForm } from "@/components/maintenance/NewContractForm";

export const dynamic = "force-dynamic";

export default async function NewContractPage({ searchParams }: { searchParams: Promise<{ proposta?: string }> }) {
  await ensureBootstrap();
  const [params, proposals, observations] = await Promise.all([searchParams, listProposals(true), getIndexObservations()]);
  return <div className="mx-auto max-w-[1200px] px-4 py-6 lg:px-8 lg:py-8">
    <Link href="/manutencao" className="inline-flex items-center gap-2 text-[11.5px] text-steel hover:text-signal"><ArrowLeft size={14}/> Voltar para manutenção</Link>
    <header className="mb-6 mt-5"><div className="label-mono text-signal">Novo documento</div><h1 className="mt-2 font-display text-[clamp(1.6rem,3vw,2.15rem)] font-semibold tracking-tight text-white">Criar contrato de manutenção</h1><p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-steel">Use uma proposta como ponto de partida. Você poderá editar cada cláusula e revisar tudo antes da assinatura.</p></header>
    <NewContractForm proposals={proposals.map((p) => ({ id: p.id, number: p.number, revision: p.revision, clientName: p.clientName, items: p.items, site: p.site }))} initialProposalId={params.proposta ?? ""} comparison={compareIndexes(observations)} aiEnabled={Boolean(process.env.OPENAI_API_KEY)} today={new Date().toISOString().slice(0, 10)} />
  </div>;
}
