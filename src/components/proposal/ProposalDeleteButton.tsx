"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";

export function ProposalDeleteButton({ id, number, revisionCount = 1, compact = false }: { id: string; number: string; revisionCount?: number; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    const scope = revisionCount > 1 ? `Esta proposta tem ${revisionCount} versões.` : "";
    const confirmed = window.confirm(`${scope}\n\nExcluir ${number} e todas as versões ligadas a ela? Os contratos serão preservados como documentos históricos, mas perderão o vínculo com esta proposta. Propostas, versões e atividades do CRM serão excluídas definitivamente.`);
    if (!confirmed) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/proposals/${id}`, { method: "DELETE" });
      const data = await res.json() as { error?: string; deletedCount?: number };
      if (!res.ok) throw new Error(data.error || "Não foi possível excluir a proposta.");
      router.push("/propostas");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="flex flex-col items-end gap-1"><button type="button" onClick={remove} disabled={busy} className={`btn !border-alarm/35 !text-alarm hover:!border-alarm/65 ${compact ? "px-2 py-1 text-[10px]" : ""}`} aria-label={`Excluir proposta ${number}`}>{busy ? <LoaderCircle size={13} className="animate-spin"/> : <Trash2 size={13}/>} {busy ? "Excluindo…" : compact ? "Excluir" : "Excluir proposta"}</button>{error ? <span role="alert" className="max-w-[210px] text-right text-[10px] text-alarm">{error}</span> : null}</div>;
}
