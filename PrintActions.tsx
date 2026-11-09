"use client";

import { useState } from "react";
import { FileDown, Printer } from "lucide-react";
import type { PdfProposalData, PdfSettings } from "@/lib/pdf-documents";

export function PrintActions({ filename, doc, settings }: { filename: string; doc: PdfProposalData; settings: PdfSettings }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const [{ jsPDF }, pdfKit] = await Promise.all([import("jspdf"), import("@/lib/pdf-documents")]);
      const logo = await pdfKit.loadBrandLogo();
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
      pdfKit.renderProposalPdf(pdf, doc, settings, logo);
      pdf.save(`${filename}.pdf`);
    } catch (err) {
      console.error(err);
      setError("Não foi possível gerar o PDF. Tente novamente ou use a impressão do navegador.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={download} disabled={busy} className="btn btn-primary no-print">
        <FileDown size={14} />
        {busy ? "Gerando PDF A4…" : "Baixar PDF"}
      </button>
      <button type="button" onClick={() => window.print()} className="btn no-print">
        <Printer size={14} />
        Imprimir
      </button>
      {error ? <p role="alert" className="w-full text-[11px] text-alarm">{error}</p> : null}
    </div>
  );
}
