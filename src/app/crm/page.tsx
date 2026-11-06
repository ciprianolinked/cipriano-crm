import Link from "next/link";
import { brl, fmtDate } from "@/lib/brand";
import { dashboardStats } from "@/lib/data";
import { getMaintenanceData } from "@/lib/maintenance-db";
import { formatPct } from "@/lib/maintenance";
import { Kanban, type KanbanCard } from "@/components/crm/Kanban";
import { FollowUps, type FollowUpItem } from "@/components/crm/FollowUps";
import { STAGES } from "@/lib/proposal/types";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const [stats, maintenance] = await Promise.all([dashboardStats(), getMaintenanceData()]);
  const cards: KanbanCard[] = stats.rows.map((p) => ({
    id: p.id,
    number: p.number,
    clientName: p.clientName,
    type: p.type,
    status: p.status,
    archived: p.archived,
    totalCents: p.totalCents,
    nextActionAt: p.nextActionAt ? p.nextActionAt.toISOString() : null,
    nextActionNote: p.nextActionNote,
    updatedAt: p.updatedAt.toISOString(),
    issuedAt: p.issuedAt.toISOString(),
    validityDays: p.validityDays,
  }));

  const followItems: FollowUpItem[] = stats.followUps.map((f) => {
    const proposal = stats.rows.find((p) => p.id === f.proposalId);
    return {
      id: f.id,
      proposalId: f.proposalId,
      content: f.content,
      dueAt: f.dueAt ? f.dueAt.toISOString() : null,
      clientName: proposal?.clientName ?? "Cliente",
      number: proposal?.number ?? "",
    };
  });

  const weighted = stats.open.reduce((acc, p) => {
    const weight = p.status === "negociacao" ? 0.6 : p.status === "enviada" ? 0.35 : 0.15;
    return acc + p.totalCents * weight;
  }, 0);

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5 lg:px-7 lg:py-7">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line/50 pb-4">
        <div>
          <div className="label-mono text-signal">CRM comercial</div>
          <h1 className="mt-2 font-display text-[clamp(1.5rem,2.6vw,2rem)] font-semibold text-white">
            Funil de propostas e follow-ups
          </h1>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-steel">
            Arraste os cards para mudar a etapa. O sistema agenda follow-up automaticamente ao mover para “enviada” e
            limpa a pendência ao fechar negócio.
          </p>
        </div>
        <Link href="/propostas/nova" className="btn btn-primary">
          Nova proposta
        </Link>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Metric label="Pipeline aberto" value={brl(stats.pipelineCents / 100)} hint={`${stats.open.length} negócios`} />
        <Metric label="Previsão ponderada" value={brl(weighted / 100)} hint="probabilidade por etapa" />
        <Metric label="Ganhos" value={brl(stats.wonCents / 100)} hint={`${stats.winRate}% de conversão`} />
        <Metric label="Lembretes vencidos" value={String(stats.overdue.length)} hint={`${stats.stale.length} sem movimento`} danger={stats.overdue.length > 0} />
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="card p-3">
          <Kanban initialCards={cards} />
        </section>
        <aside className="space-y-3">
          <section className="card p-3">
            <div className="flex items-center justify-between">
              <div className="label-mono text-signal">Follow-ups</div>
              <span className="chip">{followItems.length}</span>
            </div>
            <div className="mt-2">
              <FollowUps items={followItems} />
            </div>
          </section>

          <section
            className={`rounded-xl border p-3 ${
              maintenance.alerts.length > 0 ? "border-amber/50 bg-amber/5" : "border-line/60 bg-navy/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="label-mono text-signal">Manutenção mensal · reajuste anual</div>
              <span className={`chip ${maintenance.alerts.length > 0 ? "!border-amber/60 !text-amber" : ""}`}>
                {maintenance.alerts.length} alerta(s)
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <MiniStat
                label="Contratos ativos"
                value={String(maintenance.contracts.filter((c) => c.status === "ativo").length)}
              />
              <MiniStat label="Receita mensal" value={brl(maintenance.monthlyActiveCents / 100)} />
            </div>

            <div className="mt-2 space-y-1.5">
              {maintenance.alerts.slice(0, 4).map((c) => (
                <div key={c.id} className="rounded border border-amber/40 bg-abyss2/60 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11.5px] text-white">{c.clientName}</span>
                    <span className="font-mono text-[9.5px] text-amber">
                      {c.overdue ? "vencido" : `${c.daysToReadjust}d`}
                    </span>
                  </div>
                  <div className="text-[10px] text-steel">{c.title}</div>
                  <div className="mt-0.5 flex items-center justify-between text-[10px]">
                    <span className="text-steel">
                      {brl(c.monthlyCents / 100)} →{" "}
                      <b className="text-armed">
                        {c.projectedCents !== null ? brl(c.projectedCents / 100) : "—"}
                      </b>
                    </span>
                    <span className="font-mono text-signal">{fmtDate(c.nextReadjustAt)}</span>
                  </div>
                  {c.indexComplete ? (
                    <div className="text-[9.5px] text-steel">{c.indexName} acumulado {formatPct(c.accumulatedPct)}</div>
                  ) : (
                    <div className="text-[9.5px] text-amber/90">
                      {c.indexName}: dados incompletos para o período contratual
                    </div>
                  )}
                </div>
              ))}
              {maintenance.alerts.length === 0 ? (
                <p className="text-[10.5px] leading-snug text-steel">
                  Nenhum reajuste nos próximos 30 dias. O alerta surge um mês antes de fechar os 12 meses.
                </p>
              ) : null}
            </div>

            <Link href="/manutencao" className="btn mt-2 w-full py-1.5 text-[11px]">
              Gerir contratos e índices
            </Link>
          </section>
          <section className="card p-3">
            <div className="label-mono">Regras do funil</div>
            <div className="mt-2 space-y-2">
              {STAGES.map((stage) => (
                <div key={stage.id} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: stage.accent }} />
                  <div>
                    <div className="text-[11.5px] text-silver">{stage.label}</div>
                    <div className="text-[10px] leading-snug text-steel">{stage.hint}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="card p-3">
            <div className="label-mono">Perdidas — aprenda com elas</div>
            <div className="mt-2 space-y-1.5">
              {stats.lost.length === 0 ? <p className="text-[11px] text-steel">Nenhuma perda registrada.</p> : null}
              {stats.lost.slice(0, 4).map((p) => (
                <div key={p.id} className="rounded border border-alarm/30 bg-alarm/5 p-2">
                  <Link href={`/propostas/${p.id}`} className="text-[11.5px] text-silver hover:text-signal">
                    {p.clientName}
                  </Link>
                  <p className="text-[10px] leading-snug text-steel">{p.lossReason || "Motivo não registrado."}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value, hint, danger = false }: { label: string; value: string; hint: string; danger?: boolean }) {
  return (
    <div className="card p-3">
      <div className="label-mono">{label}</div>
      <div className={`mt-1 font-display text-lg font-bold ${danger ? "text-alarm" : "text-signal"}`}>{value}</div>
      <div className="text-[10.5px] text-steel">{hint}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line/50 bg-abyss2/50 px-2 py-1.5">
      <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-steel">{label}</div>
      <div className="mt-0.5 text-[12px] font-semibold text-signal">{value}</div>
    </div>
  );
}
