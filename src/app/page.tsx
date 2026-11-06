import Link from "next/link";
import { brl, fmtDate, fmtDateTime } from "@/lib/brand";
import { dashboardStats, getSettings } from "@/lib/data";
import { FollowUps, type FollowUpItem } from "@/components/crm/FollowUps";
import { STAGES } from "@/lib/proposal/types";

export const dynamic = "force-dynamic";

const PALETTE = [
  { name: "Navy profundo", hex: "#0A192F" },
  { name: "Ciano sinal", hex: "#00E5FF" },
  { name: "Azul rede", hex: "#2F80FF" },
  { name: "Prata", hex: "#C6D2E0" },
  { name: "Âmbar cerca", hex: "#FFB020" },
];

export default async function DashboardPage() {
  const [stats, settings] = await Promise.all([dashboardStats(), getSettings()]);
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
  const recent = [...stats.rows].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);
  const expiring = stats.open.filter(
    (p) => new Date(p.issuedAt).getTime() + p.validityDays * 86_400_000 < Date.now(),
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 lg:px-7 lg:py-7">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line/50 pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-signal">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-armed" /> Central comercial
          </div>
          <h1 className="mt-2 font-display text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-tight text-white">
            Propostas e CRM da Cipriano Tech &amp; Security
          </h1>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-steel">
            Timbrado oficial, três formatos de proposta, geração assistida por IA, PDF em A4 e controle de funil com
            lembretes de follow-up. {settings.hours}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/propostas/nova" className="btn btn-primary">
            Gerar proposta em 60s
          </Link>
          <Link href="/crm" className="btn">
            Abrir CRM
          </Link>
        </div>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <Kpi label="Pipeline aberto" value={brl(stats.pipelineCents / 100)} hint={`${stats.open.length} propostas ativas`} accent />
        <Kpi label="Ganho acumulado" value={brl(stats.wonCents / 100)} hint={`${stats.won.length} contratos fechados`} />
        <Kpi label="Taxa de conversão" value={`${stats.winRate}%`} hint={`${stats.closedCount} negócios encerrados`} />
        <Kpi label="Ticket médio" value={brl(stats.ticketCents / 100)} hint={`${stats.rows.length} documentos emitidos`} />
        <Kpi
          label="Follow-ups atrasados"
          value={String(stats.overdue.length)}
          hint={`${stats.stale.length} propostas sem movimento há 5+ dias`}
          danger={stats.overdue.length > 0}
        />
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="label-mono text-signal">Foco de hoje</div>
                <h2 className="font-display text-[15px] font-semibold text-white">Onde o dinheiro está parado</h2>
              </div>
              <Link href="/crm" className="btn py-1 text-[11px]">
                ver funil
              </Link>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <FocusCard
                title="Lembretes vencidos"
                items={stats.overdue.map((f) => {
                  const p = stats.rows.find((x) => x.id === f.proposalId);
                  return `${p?.clientName ?? "Cliente"} · ${fmtDate(f.dueAt)}`;
                })}
                tone="danger"
              />
              <FocusCard
                title="Validade vencida"
                items={expiring.map((p) => `${p.clientName} · ${p.validityDays} dias`)}
                tone="warn"
                empty="Nenhuma proposta vencida. Bom controle."
              />
              <FocusCard
                title="Sem movimento (5+ dias)"
                items={stats.stale.map((p) => `${p.clientName} · ${fmtDate(p.updatedAt)}`)}
                tone="info"
                empty="Todas as propostas têm movimento recente."
              />
            </div>
          </section>

          <section className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="label-mono">Funil comercial</div>
                <h2 className="font-display text-[15px] font-semibold text-white">Distribuição por etapa</h2>
              </div>
              <span className="font-mono text-[10px] text-steel">arraste os cards no CRM</span>
            </div>
            <div className="mt-3 space-y-2">
              {STAGES.map((stage) => {
                const rows = stats.rows.filter((p) => p.status === stage.id);
                const value = rows.reduce((a, p) => a + p.totalCents, 0);
                const max = Math.max(1, ...STAGES.map((s) => stats.rows.filter((p) => p.status === s.id).reduce((a, p) => a + p.totalCents, 0)));
                return (
                  <div key={stage.id} className="grid grid-cols-[130px_minmax(0,1fr)_92px] items-center gap-2">
                    <span className="truncate text-[11.5px] text-silver">{stage.label}</span>
                    <div className="h-2.5 overflow-hidden rounded-full bg-navy/60">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.max(3, (value / max) * 100)}%`, background: stage.accent }}
                      />
                    </div>
                    <span className="text-right font-mono text-[10.5px] text-steel">
                      {rows.length} · {brl(value / 100)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between p-4 pb-2">
              <div>
                <div className="label-mono">Documentos recentes</div>
                <h2 className="font-display text-[15px] font-semibold text-white">Últimas propostas</h2>
              </div>
              <Link href="/propostas" className="btn py-1 text-[11px]">
                todas
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-[12px]">
                <thead>
                  <tr className="bg-navy/40 font-mono text-[9px] uppercase tracking-[0.14em] text-steel">
                    <th className="px-4 py-2">Número</th>
                    <th className="px-4 py-2">Cliente</th>
                    <th className="px-4 py-2">Tipo</th>
                    <th className="px-4 py-2 text-right">Valor</th>
                    <th className="px-4 py-2">Etapa</th>
                    <th className="px-4 py-2">Próxima ação</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((p) => {
                    const stage = STAGES.find((s) => s.id === p.status);
                    return (
                      <tr key={p.id} className="border-t border-line/40 text-silver hover:bg-navy/25">
                        <td className="px-4 py-2 font-mono text-[10px] text-signal">
                          <Link href={`/propostas/${p.id}`}>{p.number}</Link>
                        </td>
                        <td className="px-4 py-2">
                          <Link href={`/propostas/${p.id}`} className="hover:text-signal">
                            {p.clientName}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-[11px] text-steel">{p.type.replace("_", " & ")}</td>
                        <td className="px-4 py-2 text-right font-medium">{brl(p.totalCents / 100)}</td>
                        <td className="px-4 py-2">
                          <span className="chip" style={{ borderColor: `${stage?.accent}66`, color: stage?.accent }}>
                            {stage?.label.split(" ")[0]}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-[10.5px] text-steel">{fmtDateTime(p.nextActionAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-3">
          <section className="card p-4">
            <div className="flex items-center justify-between">
              <div className="label-mono text-signal">Sua agenda de vendas</div>
              <span className="chip">{stats.followUps.length} abertos</span>
            </div>
            <div className="mt-2">
              <FollowUps items={followItems} compact />
            </div>
            <Link href="/crm" className="btn mt-2 w-full py-1 text-[11px]">
              Gerenciar follow-ups
            </Link>
          </section>

          <section className="card p-4">
            <div className="label-mono">Identidade aplicada</div>
            <h2 className="font-display text-[15px] font-semibold text-white">Papel timbrado oficial</h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-steel">
              Cabeçalho navy com assinatura completa, filete ciano, tabelas técnicas e rodapé com CREA, CNPJ e contatos.
            </p>
            <div className="mt-3 flex overflow-hidden rounded-lg border border-line/60">
              {PALETTE.map((color) => (
                <div key={color.hex} className="h-9 flex-1" style={{ background: color.hex }} title={`${color.name} ${color.hex}`} />
              ))}
            </div>
            <div className="mt-2 grid gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-steel">
              <span>Space Grotesk · display</span>
              <span>IBM Plex Sans · texto</span>
              <span>IBM Plex Mono · dados técnicos</span>
            </div>
            <Link href="/configuracoes" className="btn mt-3 w-full py-1 text-[11px]">
              Editar dados do timbrado
            </Link>
          </section>

          <section className="card p-4">
            <div className="label-mono text-signal">Otimização de tempo</div>
            <h2 className="font-display text-[15px] font-semibold text-white">O que já está automatizado</h2>
            <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-steel">
              <li><b className="text-silver">Briefing em 60s:</b> 4 atalhos + leitura de texto livre do WhatsApp.</li>
              <li><b className="text-silver">Catálogo:</b> item, especificação e preço entram sem redigitar.</li>
              <li><b className="text-silver">Biblioteca de cláusulas:</b> normas, SLA, LGPD, aterramento e ART prontos.</li>
              <li><b className="text-silver">Duplicar + editar:</b> proposta nova a partir da anterior em 2 cliques.</li>
              <li><b className="text-silver">PDF A4:</b> timbrado oficial sem montar documento no Word.</li>
            </ul>
          </section>

          <section className="card p-4">
            <div className="label-mono text-signal">Rotina para não perder feedback</div>
            <ol className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-steel">
              <li><b className="text-silver">1.</b> Enviou? Mova para “Proposta enviada” — o CRM já agenda D+2.</li>
              <li><b className="text-silver">2.</b> D+2: confirme recebimento e pergunte quem decide.</li>
              <li><b className="text-silver">3.</b> D+5: envie um dado novo (cronograma, laudo, ART).</li>
              <li><b className="text-silver">4.</b> D+10: proponha reunião de ajuste de escopo.</li>
              <li><b className="text-silver">5.</b> Fechou ou perdeu? Registre o motivo e arquive.</li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  accent = false,
  danger = false,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="card p-3">
      <div className="label-mono">{label}</div>
      <div
        className={`mt-1 font-display text-[clamp(1rem,1.6vw,1.35rem)] font-bold leading-tight ${
          danger ? "text-alarm" : accent ? "text-signal" : "text-white"
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10.5px] leading-snug text-steel">{hint}</div>
    </div>
  );
}

function FocusCard({
  title,
  items,
  tone,
  empty = "Nada pendente aqui.",
}: {
  title: string;
  items: string[];
  tone: "danger" | "warn" | "info";
  empty?: string;
}) {
  const color = tone === "danger" ? "#FF3B5C" : tone === "warn" ? "#FFB020" : "#2F80FF";
  return (
    <div className="rounded-lg border p-2.5" style={{ borderColor: `${color}55`, background: `${color}0d` }}>
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-medium text-silver">{title}</span>
        <span className="font-mono text-[10px]" style={{ color }}>
          {items.length}
        </span>
      </div>
      <div className="mt-1 space-y-0.5">
        {items.length === 0 ? <p className="text-[10.5px] text-steel">{empty}</p> : null}
        {items.slice(0, 3).map((item) => (
          <p key={item} className="truncate text-[10.5px] text-steel">
            {item}
          </p>
        ))}
        {items.length > 3 ? <p className="text-[10px] text-steel">+{items.length - 3} outros</p> : null}
      </div>
    </div>
  );
}
