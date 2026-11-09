import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ensureBootstrap, listProposals } from "@/lib/data";
import { getIndexObservations } from "@/lib/indices-db";
import { compareIndexes } from "@/lib/indices";
import { NewContractForm } from "@/components/maintenance/NewContractForm";
import { loadDatabasePage } from "@/components/system/load-database-page";

export const dynamic = "force-dynamic";
export default async function NewContractPage({ searchParams }: { searchParams: Promise<{ proposta?: string; modalidade?: string }> }) {
  const loaded = await loadDatabasePage(async () => {
    await ensureBootstrap();
    const [proposals, observations] = await Promise.all([listProposals(true), getIndexObservations()]);
    return { proposals, observations };
  });
  if (!loaded.ok) return loaded.recovery;
  const { proposals, observations } = loaded.data;
  const params = await searchParams;
  return <div className="mx-auto max-w-[1200px] px-4 py-6 lg:px-8 lg:py-8"><Link href="/contratos" className="inline-flex items-center gap-2 text-[11.5px] text-steel hover:text-signal"><ArrowLeft size={14}/> Voltar para contratos</Link><header className="mb-6 mt-5"><div className="label-mono text-signal">Formalização opcional</div><h1 className="mt-2 font-display text-[clamp(1.6rem,3vw,2.15rem)] font-semibold tracking-tight text-white">Gerar contrato da proposta</h1><p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-steel">Quando o cliente optar por contrato, transforme a proposta em uma minuta editável. Escolha fornecimento/serviços ou manutenção mensal.</p></header><NewContractForm proposals={proposals.map((p) => ({ id: p.id, number: p.number, revision: p.revision, clientName: p.clientName, items: p.items, site: p.site, totalCents: p.totalCents, discountPct: p.discountPct, briefing: p.briefing }))} initialProposalId={params.proposta ?? ""} defaultKind={params.modalidade === "manutencao" ? "manutencao" : undefined} comparison={compareIndexes(observations)} aiEnabled={Boolean(process.env.OPENAI_API_KEY)} today={new Date().toISOString().slice(0, 10)} /></div>;
}
