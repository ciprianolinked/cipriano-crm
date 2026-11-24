"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarClock, FileText, Plus, Search, Wrench } from "lucide-react";
import { brl, fmtDate } from "@/lib/brand";
import { fetchJson } from "@/lib/api-client";
import {
  OS_KINDS,
  OS_PRIORITIES,
  OS_STATUSES,
  OPEN_OS_STATUSES,
  osKindLabel,
  osPriority,
  osStatus,
  soPartsCents,
} from "@/lib/service-orders";
import type { ServiceOrderItem } from "@/db/schema";

export type OsListItem = {
  id: string;
  number: string;
  kind: string;
  status: string;
  priority: string;
  clientName: string;
  site: string | null;
  description: string;
  technician: string;
  scheduledAt: string | null;
  items: ServiceOrderItem[];
  laborCents: number;
  budgetProposalId: string | null;
  budgetProposalNumber: string | null;
  budgetTotalCents: number;
  originProposalNumber: string | null;
  createdAt: string;
};

const TABS: { id: "abertas" | "campo" | "orcamento" | "concluidas" | "todas"; label: string }[] = [
  { id: "abertas", label: "Abertas" },
  { id: "campo", label: "Em campo" },
  { id: "orcamento", label: "Com orçamento" },
  { id: "concluidas", label: "Concluídas" },
  { id: "todas", label: "Todas" },
];

export function ServiceOrderManager({ orders }: { orders: OsListItem[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("abertas");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((os) => {
      if (kind && os.kind !== kind) return false;
      if (tab === "abertas" && !OPEN_OS_STATUSES.includes(os.status as never)) return false;
      if (tab === "campo" && os.status !== "em_execucao") return false;
      if (tab === "orcamento" && !os.budgetProposalId) return false;
      if (tab === "concluidas" && os.status !== "concluida") return false;
      if (!term) return true;
      return (
        os.number.toLowerCase().includes(term) ||
        os.clientName.toLowerCase().includes(term) ||
        (os.site ?? "").toLowerCase().includes(term) ||
        os.description.toLowerCase().includes(term) ||
        (os.budgetProposalNumber ?? "").toLowerCase().includes(term)
      );
    });
  }, [orders, tab, kind, search]);

  const stats = useMemo(() => {
    const open = orders.filter((o) => OPEN_OS_STATUSES.includes(o.status as never));
    return {
      open: open.length,
      field: orders.filter((o) => o.status === "em_execucao").length,
      waiting: orders.filter((o) => o.status === "aguardando_orcamento").length,
      withBudget: orders.filter((o) => o.budgetProposalId).length,
      openValue: open.reduce((sum, o) => sum + soPartsCents(o).totalCents, 0),
      budgetValue: orders.reduce((sum, o) => sum + (o.budgetTotalCents || 0), 0),
    };
  }, [orders]);

  async function changeStatus(os: OsListItem, status: string) {
    setBusy(os.id);
    setMessage("");
    try {
      await fetchJson(`/api/service-orders/${os.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setMessage(`OS ${os.number} atualizada para “${osStatus(status).label}”.`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Falha ao atualizar a OS.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="OS em aberto" value={String(stats.open)} hint={`${stats.field} em campo`} />
        <Kpi label="Aguardando orçamento" value={String(stats.waiting)} hint="precisam de proposta" accent />
        <Kpi label="Carteira em aberto" value={brl(stats.openValue / 100)} hint="peças + mão de obra" />
        <Kpi label="Orçamentos vinculados" value={String(stats.withBudget)} hint={`${brl(stats.budgetValue / 100)} emitidos`} />
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line/50 p-3">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-2.5 py-1.5 text-[11.5px] transition ${
                  tab === t.id ? "bg-signal/15 text-white" : "text-steel hover:text-silver"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <select className="field ml-auto w-auto py-1.5 text-[11.5px]" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Todos os tipos</option>
            {OS_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 rounded-lg border border-line/60 px-2 py-1.5">
            <Search size={13} className="text-steel" />
            <input
              className="w-44 bg-transparent text-[11.5px] text-silver outline-none placeholder:text-steel"
              placeholder="Cliente, OS, orçamento…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <Link href="/os/nova" className="btn btn-primary px-3 py-1.5 text-[11.5px]">
            <Plus size={13} /> Nova OS
          </Link>
        </div>

        {message ? <div className="border-b border-line/40 bg-signal/5 px-3 py-2 text-[11.5px] text-silver">{message}</div> : null}

        {rows.length === 0 ? (
          <div className="p-8 text-center">
            <Wrench size={22} className="mx-auto text-steel/70" />
            <p className="mt-2 text-[13px] text-silver">Nenhuma OS neste filtro.</p>
            <p className="mt-1 text-[11.5px] text-steel">Abra uma nova ordem de serviço ou ajuste os filtros acima.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-line/50 font-mono text-[9px] uppercase tracking-[0.16em] text-steel">
                  <th className="px-3 py-2.5">OS</th>
                  <th className="px-3 py-2.5">Cliente / local</th>
                  <th className="px-3 py-2.5">Tipo</th>
                  <th className="px-3 py-2.5">Agenda</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Valor</th>
                  <th className="px-3 py-2.5">Orçamento</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((os) => {
                  const st = osStatus(os.status);
                  const pr = osPriority(os.priority);
                  const total = soPartsCents(os).totalCents;
                  return (
                    <tr key={os.id} className="border-b border-line/40 align-top transition hover:bg-navy2/40">
                      <td className="px-3 py-2.5">
                        <Link href={`/os/${os.id}`} className="font-mono text-[11.5px] text-signal hover:underline">
                          {os.number}
                        </Link>
                        <div className="mt-0.5 text-[10px] text-steel">{os.technician || "sem técnico"}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-silver">{os.clientName}</div>
                        <div className="mt-0.5 max-w-[220px] truncate text-[10px] text-steel">{os.site || "—"}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="chip !text-[9px]">{osKindLabel(os.kind)}</span>
                        <div className="mt-1">
                          <span className={`chip !text-[9px] ${pr.tone}`}>{pr.label}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[10.5px] text-steel">
                        {os.scheduledAt ? fmtDate(os.scheduledAt) : "a agendar"}
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          className={`field w-auto py-1 text-[10.5px] ${st.tone}`}
                          value={os.status}
                          disabled={busy === os.id}
                          onChange={(e) => void changeStatus(os, e.target.value)}
                        >
                          {OS_STATUSES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[11px] text-silver">{brl(total / 100)}</td>
                      <td className="px-3 py-2.5">
                        {os.budgetProposalId ? (
                          <Link
                            href={`/propostas/${os.budgetProposalId}`}
                            className="inline-flex items-center gap-1 font-mono text-[10.5px] text-signal hover:underline"
                            title="Abrir orçamento para correção"
                          >
                            <FileText size={11} /> {os.budgetProposalNumber}
                          </Link>
                        ) : (
                          <span className="text-[10.5px] text-steel">não emitido</span>
                        )}
                        {os.budgetTotalCents > 0 ? (
                          <div className="mt-0.5 font-mono text-[10px] text-steel">{brl(os.budgetTotalCents / 100)}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link href={`/os/${os.id}`} className="btn px-2 py-1 text-[10.5px]">
                          Abrir <ArrowRight size={11} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="flex items-center gap-2 text-[11px] text-steel">
        <CalendarClock size={13} /> OS com orçamento em aberto ficam em “Aguardando aprovação” até o cliente responder. Ao corrigir a proposta, o valor da OS é atualizado automaticamente.
      </p>
    </div>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-signal/35 bg-signal/5" : "border-line/60 bg-abyss2/40"}`}>
      <div className="label-mono">{label}</div>
      <div className={`mt-1 font-display text-[20px] font-semibold ${accent ? "text-signal" : "text-white"}`}>{value}</div>
      {hint ? <div className="mt-0.5 text-[10.5px] text-steel">{hint}</div> : null}
    </div>
  );
}
