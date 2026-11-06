"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BellRing, CalendarClock, CheckCircle2, FilePlus2, FileText, RefreshCw, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { brl, fmtDate } from "@/lib/brand";
import { formatPct, type DerivedContract } from "@/lib/maintenance";
import { formatIndexPct, formatMonth, INDEXES, type IndexComparison, type IndexObservation } from "@/lib/indices";
import { IndexComparisonPanel } from "@/components/maintenance/IndexComparison";

type RecentReadjust = { id: string; clientName: string; title: string; readjustAt: string; oldMonthlyCents: number; newMonthlyCents: number; ipcaPct: number; percentMilli: number | null; indexName: string; source: string; note: string | null };

export function MaintenanceManager({ contracts, observations, comparison, recentReadjusts }: {
  contracts: DerivedContract[];
  observations: IndexObservation[];
  comparison: IndexComparison;
  recentReadjusts: RecentReadjust[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ indexName: "IPCA", month: "", pct: "" });
  const didSync = useRef(false);
  const active = contracts.filter((c) => c.status === "ativo");
  const alerts = active.filter((c) => c.alert).sort((a, b) => a.daysToReadjust - b.daysToReadjust);
  const monthly = active.reduce((sum, c) => sum + c.monthlyCents, 0);
  const sorted = [...contracts].sort((a, b) => a.nextReadjustAt.localeCompare(b.nextReadjustAt));

  async function sync() {
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/indices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync" }) });
      const data = await res.json() as { results?: { indexName: string; saved: number; error: string | null }[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Não foi possível atualizar os índices.");
      const succeeded = (data.results ?? []).filter((r) => !r.error).map((r) => r.indexName);
      const failed = (data.results ?? []).filter((r) => r.error).map((r) => r.indexName);
      setMessage(`${succeeded.length ? `Atualizados: ${succeeded.join(", ")}.` : "Não foi possível acessar o BCB."}${failed.length ? ` Indisponíveis: ${failed.join(", ")}. Você pode lançar valores manualmente.` : ""}`);
      router.refresh();
    } catch { setMessage("Não foi possível consultar o BCB. Use o lançamento manual ou tente novamente."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (observations.length === 0 && !didSync.current) { didSync.current = true; void sync(); }
    // A busca inicial ocorre uma única vez; atualizações posteriores são manuais.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveManual() {
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/indices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(manual) });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar.");
      setManual({ ...manual, pct: "" }); setMessage("Índice mensal registrado. Valores manuais são preservados na sincronização."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao salvar."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric icon={<FileText size={17} />} label="CONTRATOS ATIVOS" value={String(active.length).padStart(2, "0")} hint={`${contracts.length} na carteira`} />
        <Metric icon={<Wallet size={17} />} label="RECEITA MENSAL" value={brl(monthly / 100)} hint="contratos ativos" accent />
        <Metric icon={<CalendarClock size={17} />} label="REAJUSTES PRÓXIMOS" value={String(alerts.length).padStart(2, "0")} hint="aviso com 30 dias de antecedência" warn={alerts.length > 0} />
        <Metric icon={<ShieldCheck size={17} />} label="MINUTAS" value={String(contracts.filter((c) => c.hasDocument).length).padStart(2, "0")} hint="documentos vinculados" />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/50 p-5">
              <div><div className="label-mono text-signal">Sua carteira</div><h2 className="mt-1 font-display text-[17px] font-semibold text-white">Contratos de manutenção</h2><p className="mt-1 text-[11.5px] text-steel">Minutas, mensalidades e próximos reajustes em um só lugar.</p></div>
              <Link href="/manutencao/novo" className="btn btn-primary"><FilePlus2 size={15} /> Novo contrato</Link>
            </div>
            {sorted.length === 0 ? (
              <div className="flex min-h-[225px] flex-col items-center justify-center px-5 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-signal/20 bg-signal/5 text-signal"><FileText size={20} /></div>
                <h3 className="mt-3 font-display text-[15px] font-medium text-white">Sua carteira começa aqui</h3>
                <p className="mt-1 max-w-sm text-[11.5px] leading-relaxed text-steel">Escolha uma proposta salva para criar sua primeira minuta de manutenção mensal.</p>
                <Link href="/manutencao/novo" className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-signal hover:underline">Criar contrato a partir de proposta <ArrowRight size={13}/></Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[12px]">
                  <thead><tr className="bg-navy/25 font-mono text-[9px] uppercase tracking-[0.13em] text-steel"><th className="px-5 py-3">Cliente / contrato</th><th className="px-4 py-3">Mensalidade</th><th className="px-4 py-3">Índice</th><th className="px-4 py-3">Próximo reajuste</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3" /></tr></thead>
                  <tbody>{sorted.map((c) => (
                    <tr key={c.id} className="border-t border-line/35 hover:bg-navy/30">
                      <td className="px-5 py-3"><Link href={`/manutencao/${c.id}`} className="font-medium text-white hover:text-signal">{c.clientName}</Link><div className="mt-0.5 text-[10.5px] text-steel">{c.title} {c.proposalNumber ? `· ${c.proposalNumber} / R${String(c.proposalRevision ?? 1).padStart(2, "0")}` : ""}</div></td>
                      <td className="px-4 py-3 font-medium text-silver">{brl(c.monthlyCents / 100)}</td>
                      <td className="px-4 py-3"><span className="chip !normal-case !tracking-normal">{c.indexName}</span></td>
                      <td className="px-4 py-3"><span className={c.alert ? "text-amber" : "text-silver"}>{fmtDate(c.nextReadjustAt)}</span>{c.alert ? <div className="mt-0.5 text-[10px] text-amber">{c.overdue ? "Aguardando reajuste" : `Em ${c.daysToReadjust} dias`}</div> : null}</td>
                      <td className="px-4 py-3"><Status status={c.status} /></td>
                      <td className="px-4 py-3 text-right"><Link href={`/manutencao/${c.id}`} className="inline-flex items-center gap-1 text-signal hover:underline">Abrir <ArrowUpRight size={13}/></Link></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div><div className="label-mono text-signal">Inteligência de reajuste</div><h2 className="mt-1 font-display text-[17px] font-semibold text-white">Compare antes de escolher</h2><p className="mt-1 text-[11.5px] text-steel">Veja o menor acumulado em uma mesma janela de 12 meses.</p></div>
              <div className="flex flex-wrap gap-2"><button type="button" className="btn py-1.5" onClick={() => setManualOpen(!manualOpen)}>Lançar índice</button><button type="button" className="btn py-1.5" disabled={busy} onClick={sync}><RefreshCw size={13} className={busy ? "animate-spin" : ""}/>{busy ? "Atualizando..." : "Atualizar do BCB"}</button></div>
            </div>
            {message ? <div role="status" className="mb-3 rounded-lg border border-line/60 bg-navy/40 p-2.5 text-[11px] text-silver">{message}</div> : null}
            {manualOpen ? <div className="mb-4 grid gap-2 rounded-xl border border-line/60 bg-abyss2/50 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"><label><span className="label-mono mb-1 block">Índice</span><select className="field" value={manual.indexName} onChange={(e) => setManual({ ...manual, indexName: e.target.value })}>{INDEXES.map((i) => <option key={i.id}>{i.id}</option>)}</select></label><label><span className="label-mono mb-1 block">Mês de referência</span><input type="month" className="field" value={manual.month} onChange={(e) => setManual({ ...manual, month: e.target.value })}/></label><label><span className="label-mono mb-1 block">Variação mensal %</span><input className="field" value={manual.pct} onChange={(e) => setManual({ ...manual, pct: e.target.value })} placeholder="Ex.: 0,45 ou -0,20"/></label><button className="btn btn-primary self-end" disabled={busy} onClick={saveManual}>Salvar mês</button></div> : null}
            <IndexComparisonPanel comparison={comparison} />
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-4">
            <div className="flex items-center justify-between"><div><div className="label-mono text-signal">Acompanhe de perto</div><h2 className="mt-1 font-display text-[15px] font-semibold text-white">Próximos reajustes</h2></div><span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${alerts.length ? "border-amber/30 bg-amber/10 text-amber" : "border-line/60 bg-navy/50 text-steel"}`}><BellRing size={16}/></span></div>
            <div className="mt-4 space-y-2">{alerts.length ? alerts.slice(0, 5).map((c) => <Link key={c.id} href={`/manutencao/${c.id}#reajuste`} className="block rounded-lg border border-amber/30 bg-amber/5 p-3 transition hover:border-amber/60"><div className="flex items-start justify-between gap-2"><div className="text-[12px] font-medium text-white">{c.clientName}</div><span className="text-[10px] text-amber">{c.overdue ? "Atrasado" : `${c.daysToReadjust} dias`}</span></div><div className="mt-1 text-[10.5px] text-steel">{c.indexName} · {fmtDate(c.nextReadjustAt)}</div><div className="mt-2 flex items-center justify-between text-[11px] text-silver"><span>{brl(c.monthlyCents / 100)}/mês</span><span className="text-signal">Ver cálculo →</span></div></Link>) : <div className="rounded-lg border border-line/50 bg-abyss2/40 p-3"><CheckCircle2 size={16} className="text-armed"/><p className="mt-2 text-[11px] leading-relaxed text-steel">Tudo em dia. Os contratos ativos aparecem aqui 30 dias antes do aniversário.</p></div>}</div>
          </section>
          <section className="relative overflow-hidden rounded-xl border border-signal/20 bg-gradient-to-br from-[#0d2d42] via-[#0a1c31] to-[#081422] p-4">
            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-signal/5 blur-2xl"/><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal/10 text-signal"><Sparkles size={17}/></div><h2 className="mt-3 font-display text-[15px] font-semibold text-white">Da proposta ao contrato</h2><p className="mt-1.5 text-[11px] leading-relaxed text-steel">Aproveite cliente, serviços e condições da proposta. Ajuste a minuta, solicite alterações à IA e salve versões.</p><Link href="/manutencao/novo" className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-signal hover:underline">Criar minha minuta <ArrowRight size={13}/></Link>
          </section>
          <section className="card p-4"><div className="label-mono">Histórico recente</div><h2 className="mt-1 font-display text-[15px] font-semibold text-white">Reajustes aplicados</h2><div className="mt-3 space-y-2">{recentReadjusts.length ? recentReadjusts.slice(0, 4).map((r) => <div key={r.id} className="rounded-lg border border-line/50 bg-abyss2/40 p-2.5"><div className="flex justify-between gap-2"><span className="truncate text-[11.5px] text-white">{r.clientName}</span><span className="font-mono text-[10px] text-signal">{r.indexName} {r.percentMilli !== null ? formatIndexPct(r.percentMilli / 1000) : formatPct(r.ipcaPct)}</span></div><div className="mt-1 flex justify-between text-[10.5px] text-steel"><span>{brl(r.oldMonthlyCents / 100)} → {brl(r.newMonthlyCents / 100)}</span><span>{fmtDate(r.readjustAt)}</span></div></div>) : <p className="text-[11px] leading-relaxed text-steel">Os reajustes confirmados aparecerão aqui com a fonte e o índice utilizado.</p>}</div></section>
        </aside>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-steel"><span className="h-1.5 w-1.5 rounded-full bg-armed"/> Índices mensais públicos · Fontes: IBGE/FGV, distribuídos pelo Banco Central. {observations.length ? `${observations.length} observações salvas.` : "Nenhuma observação salva ainda."} {comparison.provisional ? `Prévia até ${formatMonth(comparison.periodEnd)}.` : ""}</div>
    </div>
  );
}

function Metric({ icon, label, value, hint, accent = false, warn = false }: { icon: React.ReactNode; label: string; value: string; hint: string; accent?: boolean; warn?: boolean }) {
  return <div className="card min-h-[120px] p-4"><div className="flex items-start justify-between"><span className="font-mono text-[9px] tracking-[0.14em] text-steel">{label}</span><span className={`${warn ? "text-amber" : "text-signal/80"}`}>{icon}</span></div><div className={`mt-3 font-display text-[23px] font-semibold tracking-tight ${warn ? "text-amber" : accent ? "text-signal" : "text-white"}`}>{value}</div><div className="mt-1 text-[10.5px] text-steel">{hint}</div></div>;
}
function Status({ status }: { status: string }) {
  const color = status === "ativo" ? "!border-armed/30 !text-armed" : status === "rascunho" ? "!border-amber/30 !text-amber" : "!text-steel";
  return <span className={`chip !text-[9px] ${color}`}><span className="h-1.5 w-1.5 rounded-full bg-current"/>{status}</span>;
}
