"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtDate } from "@/lib/brand";

export type FollowUpItem = {
  id: string;
  proposalId: string;
  content: string;
  dueAt: string | null;
  clientName: string;
  number: string;
};

export function FollowUps({ items, compact = false }: { items: FollowUpItem[]; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);

  async function complete(id: string) {
    setBusy(id);
    await fetch(`/api/activities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: true }),
    });
    setHidden((prev) => [...prev, id]);
    setBusy(null);
    router.refresh();
  }

  const visible = items.filter((i) => !hidden.includes(i.id)).slice(0, compact ? 5 : 30);

  if (visible.length === 0) {
    return (
      <div className="rounded-lg border border-armed/30 bg-armed/5 p-3 text-[11.5px] text-silver">
        Nenhum follow-up em aberto. Agende o próximo lembrete ao enviar cada proposta.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visible.map((item) => {
        const late = item.dueAt ? new Date(item.dueAt).getTime() < Date.now() : false;
        const today = item.dueAt ? new Date(item.dueAt).toDateString() === new Date().toDateString() : false;
        return (
          <div
            key={item.id}
            className={`rounded-lg border p-2.5 ${
              late ? "border-alarm/50 bg-alarm/5" : today ? "border-amber/50 bg-amber/5" : "border-line/60 bg-abyss2/50"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <Link href={`/propostas/${item.proposalId}`} className="truncate text-[12px] font-medium text-white hover:text-signal">
                {item.clientName}
              </Link>
              <span className={`font-mono text-[9px] uppercase tracking-[0.12em] ${late ? "text-alarm" : today ? "text-amber" : "text-steel"}`}>
                {late ? "atrasado" : today ? "hoje" : fmtDate(item.dueAt)}
              </span>
            </div>
            <div className="font-mono text-[9px] tracking-[0.12em] text-steel">{item.number}</div>
            <p className="mt-1 text-[11px] leading-snug text-silver">{item.content}</p>
            <div className="mt-1.5 flex gap-2">
              <button
                onClick={() => complete(item.id)}
                disabled={busy === item.id}
                className="rounded border border-signal/40 bg-signal/10 px-2 py-0.5 text-[10px] text-signal transition hover:bg-signal/20"
              >
                {busy === item.id ? "…" : "concluir"}
              </button>
              <Link
                href={`/propostas/${item.proposalId}`}
                className="rounded border border-line/60 px-2 py-0.5 text-[10px] text-steel transition hover:text-silver"
              >
                abrir
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
