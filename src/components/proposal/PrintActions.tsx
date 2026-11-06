"use client";

import { useState } from "react";

export function PrintActions({
  filename,
  compact = false,
}: {
  filename: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    const element = document.getElementById("proposal-document");
    if (!element) return;
    setBusy(true);
    setError(null);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      if (document.fonts?.ready) await document.fonts.ready;
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        windowWidth: element.scrollWidth,
      });
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
      const pageWidthMm = 210;
      const pageHeightMm = 297;
      const pxPerMm = canvas.width / pageWidthMm;
      const pageHeightPx = Math.floor(pageHeightMm * pxPerMm);
      let rendered = 0;
      let page = 0;

      while (rendered < canvas.height) {
        const sliceHeight = Math.min(pageHeightPx, canvas.height - rendered);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceHeight;
        const ctx = slice.getContext("2d");
        if (!ctx) break;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, rendered, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
        const image = slice.toDataURL("image/jpeg", 0.94);
        if (page > 0) pdf.addPage();
        pdf.addImage(image, "JPEG", 0, 0, pageWidthMm, sliceHeight / pxPerMm, undefined, "FAST");
        rendered += sliceHeight;
        page += 1;
      }
      pdf.save(`${filename}.pdf`);
    } catch (err) {
      console.error(err);
      setError("Não foi possível gerar o PDF. Use “Imprimir / PDF” e escolha Salvar como PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "flex flex-wrap gap-2" : "flex flex-wrap gap-2"}>
      <button type="button" onClick={download} disabled={busy} className="btn btn-primary no-print">
        {busy ? "Gerando PDF…" : "Baixar PDF"}
      </button>
      <button type="button" onClick={() => window.print()} className="btn no-print">
        Imprimir / PDF A4
      </button>
      {error ? <p className="w-full text-[11px] text-alarm">{error}</p> : null}
    </div>
  );
}
