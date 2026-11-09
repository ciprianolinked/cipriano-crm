import Link from "next/link";
import { brl, fmtDate } from "@/lib/brand";
import { ensureBootstrap, listProposals } from "@/lib/data";
import { STAGES, PROPOSAL_TYPES } from "@/lib/proposal/types";
import { isMaintenanceProposal } from "@/lib/proposal/maintenance-plan";
import { loadDatabasePage } from "@/components/system/load-database-page";
import { ProposalDeleteButton } from "@/components/proposal/ProposalDeleteButton";

export const dynamic = "force-dynamic";

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ arquivadas?: string; tipo?: string }>;
}) {
  const loaded = await loadDatabasePage(async () => {
    await ensureBootstrap();
    return listProposals(true);
  });
  if (!loaded.ok) return loaded.recovery;
  const params = await searchParams;
  const includeArchived = params.arquivadas === "1";
  const typeFilter = params.tipo ?? "todos";
  const allRows = loaded.data;
  const rows = allRows
    .filter((p) => (includeArchived || !p.archived) && (typeFilter === "todos" || p.type === typeFilter))
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
  const total = rows.reduce((a, p) => a + p.totalCents, 0);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 lg:px-7 lg:py-7">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line/50 pb-4">
        <div>
          <div className="label-mono text-signal">Documentos</div>
          <h1 className="mt-2 font-display text-[clamp(1.5rem,2.6vw,2rem)] font-semibold text-white">
            Propostas comerciais
          </h1>
          <p className="mt-1 text-[12.5px] text-steel">
            {rows.length} documentos · {brl(total / 100)} em valor emitido. Edite, duplique e baixe em PDF A4.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/propostas/nova" className="btn btn-primary">
            Nova proposta
          </Link>
          <Link href={includeArchived ? "/propostas" : "/propostas?arquivadas=1"} className="btn">
            {includeArchived ? "Ocultar arquivadas" : "Ver arquivadas"}
          </Link>
        </div>
      </header>

      <nav className="mt-3 flex flex-wrap gap-1.5">
        <Link
          href={`/propostas${includeArchived ? "?arquivadas=1" : ""}`}
          className={`chip ${typeFilter === "todos" ? "!border-signal/60 !text-signal" : ""}`}
        >
          Todos os formatos
        </Link>
        {PROPOSAL_TYPES.map((type) => (
          <Link
            key={type.id}
            href={`/propostas?tipo=${type.id}${includeArchived ? "&arquivadas=1" : ""}`}
            className={`chip ${typeFilter === type.id ? "!border-signal/60 !text-signal" : ""}`}
          >
            {type.label}
          </Link>
        ))}
      </nav>

      <section className="card mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[12px]">
            <thead>
              <tr className="bg-navy/50 font-mono text-[9px] uppercase tracking-[0.14em] text-steel">
                <th className="px-4 py-2.5">Número</th>
                <th className="px-4 py-2.5">Cliente</th>
                <th className="px-4 py-2.5">Formato</th>
                <th className="px-4 py-2.5">Etapa</th>
                <th className="px-4 py-2.5 text-right">Valor</th>
                <th className="px-4 py-2.5">Emissão</th>
                <th className="px-4 py-2.5">Validade</th>
                <th className="px-4 py-2.5">Próxima ação</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const stage = STAGES.find((s) => s.id === p.status);
                const groupId = p.revisionGroupId ?? p.id;
                const revisionCount = allRows.filter((row) => (row.revisionGroupId ?? row.id) === groupId).length;
                const expiry = new Date(new Date(p.issuedAt).getTime() + p.validityDays * 86_400_000);
                const expired = expiry.getTime() < Date.now() && p.status !== "ganho" && p.status !== "perdido";
                return (
                  <tr key={p.id} className="border-t border-line/40 text-silver hover:bg-navy/25">
                    <td className="px-4 py-2.5 font-mono text-[10.5px] text-signal">
                      <Link href={`/propostas/${p.id}`}>{p.number}</Link>
                      {p.archived ? <span className="ml-1 text-steel">· arq</span> : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/propostas/${p.id}`} className="hover:text-signal">
                        {p.clientName}
                      </Link>
                      <div className="text-[10px] text-steel">{p.contact}</div>
                      {isMaintenanceProposal(p.briefing) ? <span className="chip mt-1 !border-signal/30 !text-signal !text-[8px]">Manutenção mensal</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-steel">{p.type.replace("_", " & ")}</td>
                    <td className="px-4 py-2.5">
                      <span className="chip" style={{ borderColor: `${stage?.accent}66`, color: stage?.accent }}>
                        {stage?.label.split(" ")[0]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">{brl(p.totalCents / 100)}</td>
                    <td className="px-4 py-2.5 text-[11px] text-steel">{fmtDate(p.issuedAt)}</td>
                    <td className={`px-4 py-2.5 text-[11px] ${expired ? "text-amber" : "text-steel"}`}>{fmtDate(expiry)}</td>
                    <td className="px-4 py-2.5 text-[11px] text-steel">{p.nextActionNote ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex flex-col items-end gap-2">
                        <Link href={`/propostas/${p.id}`} className="text-[10.5px] text-signal hover:underline">
                          Abrir / reformular
                        </Link>
                        <ProposalDeleteButton id={p.id} number={p.number} revisionCount={revisionCount} compact />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[12px] text-steel">
                    Nenhuma proposta neste filtro. <Link href="/propostas/nova" className="text-signal">Gerar agora</Link>.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-3 grid gap-2 sm:grid-cols-3">
        {PROPOSAL_TYPES.map((type) => {
          const count = rows.filter((p) => p.type === type.id).length;
          return (
            <div key={type.id} className="card p-3">
              <div className="flex items-center justify-between">
                <span className="font-display text-[12.5px] font-semibold text-white">{type.label}</span>
                <span className="chip">{count}</span>
              </div>
              <p className="mt-1 text-[10.5px] leading-snug text-steel">{type.pages} · {type.description}</p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
