"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResetDataButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmText }),
      });
      const data = (await res.json()) as { error?: string; removed?: Record<string, number> };
      if (!res.ok) {
        setError(data.error ?? "Não foi possível zerar.");
        return;
      }
      const removed = data.removed ?? {};
      setResult(
        `Zerado: ${removed.proposals ?? 0} propostas, ${removed.clients ?? 0} clientes, ${removed.activities ?? 0} atividades, ${removed.contracts ?? 0} contratos. Numeração reiniciada.`,
      );
      setConfirmText("");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Falha de conexão com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card border-alarm/35 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="label-mono text-alarm">Zona de risco</div>
          <h2 className="font-display text-[15px] font-semibold text-white">Zerar propostas, CRM e clientes</h2>
          <p className="mt-0.5 max-w-xl text-[11px] leading-relaxed text-steel">
            Apaga todas as propostas, clientes, atividades de follow-up e contratos de manutenção, e reinicia a numeração
            em 0. A identidade (timbrado) e o catálogo de itens são preservados. Esta ação não pode ser desfeita.
          </p>
        </div>
        <button className="btn" onClick={() => setOpen((v) => !v)} disabled={busy}>
          {open ? "Cancelar" : "Quero zerar os dados"}
        </button>
      </div>

      {open ? (
        <div className="mt-3 rounded-lg border border-alarm/40 bg-alarm/6 p-3">
          <p className="text-[11.5px] text-silver">
            Digite <b className="font-mono text-alarm">ZERAR</b> para confirmar a exclusão definitiva.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              className="field max-w-[220px] font-mono"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="ZERAR"
            />
            <button
              className="btn btn-primary disabled:opacity-40"
              onClick={reset}
              disabled={busy || confirmText.trim().toUpperCase() !== "ZERAR"}
            >
              {busy ? "Zerando…" : "Apagar tudo agora"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-[11px] text-alarm">{error}</p> : null}
      {result ? <p className="mt-2 text-[11px] text-armed">{result}</p> : null}
    </section>
  );
}
