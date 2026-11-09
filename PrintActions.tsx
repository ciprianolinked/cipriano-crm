"use client";

import { useEffect, useState } from "react";
import { downloadA4Pdf, printA4Document, waitForDocument } from "@/components/documents/export";

export function PrintActions({
  filename,
  compact = false,
  targetId = "proposal-document",
  title,
}: {
  filename: string;
  compact?: boolean;
  targetId?: string;
  title?: string;
}) {
  const [busy, setBusy] = useState<"pdf" | "print" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    const update = () => {
      const root = document.getElementById(targetId);
      setReady(root?.dataset.ready === "true");
      setPageCount(Number(root?.dataset.pageCount ?? 0));
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-ready", "data-page-count"] });
    window.addEventListener("a4-document-ready", update);
    return () => { observer.disconnect(); window.removeEventListener("a4-document-ready", update); };
  }, [targetId]);

  async function download() {
    setBusy("pdf"); setError(null);
    try {
      const root = await waitForDocument(targetId);
      await downloadA4Pdf(root, filename, { title: title ?? filename, subject: "Documento A4 com rodapé numerado", author: "Cipriano Tech & Security" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o PDF A4. Tente novamente.");
    } finally { setBusy(null); }
  }

  async function print() {
    setBusy("print"); setError(null);
    try { await printA4Document(targetId); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível preparar a impressão A4."); }
    finally { setBusy(null); }
  }

  return (
    <div className={compact ? "flex flex-wrap items-center gap-2" : "flex flex-wrap items-center gap-2"}>
      <button type="button" onClick={download} disabled={busy !== null || !ready} className="btn btn-primary no-print">
        {busy === "pdf" ? "Gerando PDF A4…" : "Baixar PDF A4"}
      </button>
      <button type="button" onClick={print} disabled={busy !== null || !ready} className="btn no-print">
        {busy === "print" ? "Preparando impressão…" : "Imprimir A4"}
      </button>
      <span className="no-print text-[10px] text-steel">{ready ? `${pageCount} página${pageCount === 1 ? "" : "s"} · 210 × 297 mm` : "Paginando documento…"}</span>
      {error ? <p role="alert" className="w-full text-[11px] text-alarm">{error}</p> : null}
    </div>
  );
}
