"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProposalRowActions({ id, number, clientName }: { id: string; number: string; clientName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm(`Excluir a proposta ${number} de ${clientName}?\n\nEsta ação não pode ser desfeita.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/proposals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      router.refresh();
    } catch {
      window.alert("Não foi possível excluir a proposta. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-3 whitespace-nowrap">
      <Link href={`/propostas/${id}`} className="text-[10.5px] text-signal hover:underline">editar / PDF</Link>
      <Link href={`/propostas/nova?reformular=${id}`} className="text-[10.5px] text-steel hover:text-signal">reformular</Link>
      <button type="button" onClick={remove} disabled={busy} className="text-[10.5px] text-steel transition hover:text-alarm disabled:opacity-50">
        {busy ? "excluindo…" : "excluir"}
      </button>
    </div>
  );
}
