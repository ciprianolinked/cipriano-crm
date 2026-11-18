import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { deliveryTerms } from "@/db/schema";
import { ensureSchema } from "@/lib/db-migrations";
import { ensureBootstrap, proposalWithClient } from "@/lib/data";
import { GenerateTermButton } from "@/components/delivery/GenerateTermButton";
import { loadDatabasePage } from "@/components/system/load-database-page";

export const dynamic = "force-dynamic";

export default async function ProposalTermoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadDatabasePage(async () => {
    await ensureSchema();
    await ensureBootstrap();
    const result = await proposalWithClient(id);
    if (!result) notFound();
    const terms = await db
      .select({ id: deliveryTerms.id, termNumber: deliveryTerms.termNumber, status: deliveryTerms.status, createdAt: deliveryTerms.createdAt })
      .from(deliveryTerms)
      .where(eq(deliveryTerms.proposalId, id))
      .orderBy(desc(deliveryTerms.createdAt));
    return { proposal: result.proposal, terms };
  });
  if (!loaded.ok) return loaded.recovery;
  const { proposal, terms } = loaded.data;

  // Se já existe termo, abre direto o mais recente.
  if (terms.length > 0) redirect(`/termos/${terms[0].id}`);

  const isWon = proposal.status === "ganho";
  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 lg:px-7">
      <div className="label-mono text-signal">Termo de entrega e comissionamento</div>
      <h1 className="mt-2 font-display text-[clamp(1.4rem,2.4vw,1.9rem)] font-semibold text-white">
        Gerar termo para {proposal.number}
      </h1>
      <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-steel">
        Cliente <b className="text-silver">{proposal.clientName}</b>
        {proposal.site ? <> · {proposal.site}</> : null}. O termo é elaborado com IA a partir dos{" "}
        {proposal.items.length} itens da proposta, com checklist de entrega, testes de comissionamento,
        garantia e campos de assinatura — tudo editável antes de imprimir ou gerar o PDF.
      </p>

      {!isWon ? (
        <div role="note" className="mt-4 rounded-lg border border-amber/30 bg-amber/5 p-3 text-[12px] leading-relaxed text-amber">
          Esta proposta está em “{proposal.status}”. O termo de entrega normalmente é gerado após o ganho,
          mas você pode elaborá-lo agora como rascunho.
        </div>
      ) : null}

      <div className="card mt-5 p-5">
        <div className="label-mono mb-2">O que será gerado</div>
        <ul className="space-y-1.5 text-[12px] leading-relaxed text-silver">
          <li>✓ Identificação da entrega com dados da proposta e do responsável técnico</li>
          <li>✓ Escopo entregue + checklist item a item com nº de série e conferência</li>
          <li>✓ Testes de comissionamento por disciplina (CFTV, acesso, perímetro, rede)</li>
          <li>✓ Pendências, garantia e observações — todos os textos editáveis</li>
          <li>✓ Assinaturas do técnico e do recebedor + PDF A4 no timbrado</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <GenerateTermButton proposalId={proposal.id} aiEnabled={Boolean(process.env.OPENAI_API_KEY)} />
          <Link href={`/propostas/${proposal.id}`} className="btn">
            Voltar à proposta
          </Link>
        </div>
      </div>
    </div>
  );
}
