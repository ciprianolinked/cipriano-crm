"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, LoaderCircle, Sparkles } from "lucide-react";
import { fetchJson } from "@/lib/api-client";

export function GenerateTermButton({ proposalId, aiEnabled }: { proposalId: string; aiEnabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const data = await fetchJson<{ term: { id: string }; aiNote?: string }>("/api/delivery-terms", {
        method: "POST",
        body: JSON.stringify({ proposalId }),
      });
      router.push(`/termos/${data.term.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar o termo.");
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-2">
      <button type="button" className="btn btn-primary px-5 py-3" disabled={busy} onClick={generate}>
        {busy ? <LoaderCircle size={15} className="animate-spin" /> : aiEnabled ? <Sparkles size={15} /> : <FileCheck2 size={15} />}
        {busy ? "Elaborando termo…" : aiEnabled ? "Elaborar termo com IA" : "Elaborar termo de entrega"}
      </button>
      {error ? (
        <span role="alert" className="text-[11px] text-alarm">
          {error}
        </span>
      ) : null}
    </span>
  );
}
