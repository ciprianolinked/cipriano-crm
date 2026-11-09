"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { brl, fmtDate } from "@/lib/brand";
import { STAGES } from "@/lib/proposal/types";

export type KanbanCard = {
  id: string;
  number: string;
  clientName: string;
  type: string;
  status: string;
  archived: boolean;
  totalCents: number;
  nextActionAt: string | null;
  nextActionNote: string | null;
  updatedAt: string;
  issuedAt: string;
  validityDays: number;
};

const TYPE_LABEL: Record<string, string> = {
  simples: "simples",
  completa: "completa",
  produtos_servicos: "produtos",
};

export function Kanban({ initialCards }: { initialCards: KanbanCard[] }) {
  const router = useRouter();
  const [cards, setCards] = useState(initialCards);
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter(
      (c) =>
        (showArchived || !c.archived) &&
        (!q || c.clientName.toLowerCase().includes(q) || c.number.toLowerCase().includes(q)),
    );
  }, [cards, query, showArchived]);

  async function move(id: string, status: string) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    setBusy(id);
    await fetch(`/api/proposals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
    router.refresh();
  }

  async function archive(id: string, archived: boolean) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, archived } : c)));
    await fetch(`/api/proposals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    router.refresh();
  }

  const openTotal = filtered
    .filter((c) => c.status !== "ganho" && c.status !== "perdido" && !c.archived)
    .reduce((a, c) => a + c.totalCents, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line/60 bg-navy/30 p-1">
          {(["kanban", "lista"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className={`rounded-md px-3 py-1.5 text-[12px] capitalize transition ${
                view === mode ? "bg-signal/15 text-white" : "text-steel hover:text-silver"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <input
          className="field max-w-[260px]"
          placeholder="Buscar cliente ou número…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="flex items-center gap-2 text-[11.5px] text-steel">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          incluir arquivadas
        </label>
        <div className="ml-auto flex items-center gap-2">
          <span className="label-mono">Pipeline filtrado</span>
          <span className="font-display text-sm font-semibold text-signal">{brl(openTotal / 100)}</span>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="scroll-thin -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-2">
          {STAGES.map((stage) => {
            const stageCards = filtered.filter((c) => c.status === stage.id);
            const total = stageCards.reduce((a, c) => a + c.totalCents, 0);
            return (
              <div
                key={stage.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverStage(stage.id);
                }}
                onDragLeave={() => setOverStage(null)}
                onDrop={() => {
                  if (dragId) move(dragId, stage.id);
                  setDragId(null);
                  setOverStage(null);
                }}
                className={`w-[268px] shrink-0 rounded-xl border p-2 transition ${
                  overStage === stage.id ? "border-signal/60 bg-signal/5" : "border-line/60 bg-navy/25"
                }`}
              >
                <div className="flex items-center justify-between px-1 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: stage.accent }} />
                    <span className="text-[12px] font-medium text-silver">{stage.label}</span>
                    <span className="font-mono text-[9.5px] text-steel">{stageCards.length}</span>
                  </div>
                </div>
                <div className="px-1 pb-1.5 font-mono text-[9.5px] tracking-[0.08em] text-signal/90">
                  {brl(total / 100)}
                </div>
                <div className="space-y-1.5">
                  {stageCards.map((card) => {
                    const late = card.nextActionAt ? new Date(card.nextActionAt).getTime() < Date.now() : false;
                    const daysStale = Math.floor((Date.now() - new Date(card.updatedAt).getTime()) / 86_400_000);
                    const expiring =
                      new Date(card.issuedAt).getTime() + card.validityDays * 86_400_000 < Date.now() &&
                      card.status !== "ganho" &&
                      card.status !== "perdido";
                    return (
                      <div
                        key={card.id}
                        draggable
                        onDragStart={() => setDragId(card.id)}
                        onDragEnd={() => setDragId(null)}
                        className={`cursor-grab rounded-lg border bg-abyss2/80 p-2 transition hover:border-signal/40 active:cursor-grabbing ${
                          busy === card.id ? "opacity-60" : "border-line/60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-mono text-[9px] tracking-[0.1em] text-signal">{card.number}</span>
                          <span className="chip !px-1.5 !py-0 !text-[8px]">{TYPE_LABEL[card.type] ?? card.type}</span>
                        </div>
                        <Link href={`/propostas/${card.id}`} className="mt-1 block truncate text-[12px] font-medium text-white hover:text-signal">
                          {card.clientName}
                        </Link>
                        <div className="mt-0.5 font-display text-[12.5px] font-semibold text-silver">{brl(card.totalCents / 100)}</div>
                        {card.nextActionNote ? (
                          <div className={`mt-1 line-clamp-2 text-[10px] leading-snug ${late ? "text-alarm" : "text-steel"}`}>
                            {late ? "⏰ " : "→ "}
                            {card.nextActionNote}
                          </div>
                        ) : null}
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {late ? <span className="chip !border-alarm/50 !text-alarm">atrasado</span> : null}
                          {expiring ? <span className="chip !border-amber/50 !text-amber">validade vencida</span> : null}
                          {daysStale >= 5 && card.status !== "ganho" && card.status !== "perdido" ? (
                            <span className="chip !border-amber/40 !text-amber/90">{daysStale}d parado</span>
                          ) : null}
                          {card.archived ? <span className="chip">arquivada</span> : null}
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[9px] text-steel">
                          <span>{card.nextActionAt ? `ação ${fmtDate(card.nextActionAt)}` : "sem próxima ação"}</span>
                          <button className="hover:text-silver" onClick={() => archive(card.id, !card.archived)}>
                            {card.archived ? "restaurar" : "arquivar"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {stageCards.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-line/50 px-2 py-4 text-center text-[10.5px] text-steel">
                      arraste um card para cá
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line/60">
          <table className="w-full min-w-[760px] text-left text-[12px]">
            <thead className="bg-navy/50">
              <tr className="font-mono text-[9px] uppercase tracking-[0.14em] text-steel">
                <th className="px-3 py-2">Número</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2">Etapa</th>
                <th className="px-3 py-2">Próxima ação</th>
                <th className="px-3 py-2">Atualizado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((card) => {
                const late = card.nextActionAt ? new Date(card.nextActionAt).getTime() < Date.now() : false;
                return (
                  <tr key={card.id} className="border-t border-line/40 text-silver hover:bg-navy/25">
                    <td className="px-3 py-2 font-mono text-[10.5px] text-signal">{card.number}</td>
                    <td className="px-3 py-2">
                      <Link href={`/propostas/${card.id}`} className="hover:text-signal">
                        {card.clientName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-steel">{TYPE_LABEL[card.type] ?? card.type}</td>
                    <td className="px-3 py-2 text-right font-medium">{brl(card.totalCents / 100)}</td>
                    <td className="px-3 py-2">
                      <select
                        className="field py-1 text-[11px]"
                        value={card.status}
                        onChange={(e) => move(card.id, e.target.value)}
                      >
                        {STAGES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={`px-3 py-2 text-[11px] ${late ? "text-alarm" : "text-steel"}`}>
                      {card.nextActionAt ? fmtDate(card.nextActionAt) : "—"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-steel">{fmtDate(card.updatedAt)}</td>
                    <td className="px-3 py-2 text-right">
                      <button className="text-[10.5px] text-steel hover:text-silver" onClick={() => archive(card.id, !card.archived)}>
                        {card.archived ? "restaurar" : "arquivar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
