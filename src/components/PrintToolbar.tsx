"use client";

import Link from "next/link";
import { ArrowLeftIcon, PrinterIcon } from "./icons";

type PrintToolbarProps = {
  /** Uso no mapa de cotação. Opcional ao usar backHref/label. */
  quotationId?: string;
  /** Uso no mapa de cotação. Opcional ao usar backHref/label. */
  protocol?: string;
  /** Destino do botão de voltar em outras páginas. */
  backHref?: string;
  /** Texto do botão de voltar em outras páginas. */
  backLabel?: string;
  /** Descrição exibida no lugar do número do protocolo. */
  label?: string;
};

/**
 * Barra de ações acima da versão imprimível de uma página.
 * Aceita o formato do mapa (quotationId + protocol) e o formato genérico
 * usado por outras páginas (backHref + backLabel + label).
 */
export function PrintToolbar({ quotationId, protocol, backHref, backLabel, label }: PrintToolbarProps) {
  const resolvedHref = backHref ?? (quotationId ? `/mapas/${quotationId}` : "/");
  const resolvedLabel = backLabel ?? "Voltar";
  const description = label ?? (protocol ? `Documento ${protocol} · formato A4` : "Formato A4");

  return (
    <div className="no-print sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Link href={resolvedHref} className="btn btn-ghost">
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            {resolvedLabel}
          </Link>
          <span className="hidden text-[11px] font-semibold text-slate-500 sm:inline">{description}</span>
        </div>
        <button type="button" onClick={() => window.print()} className="btn btn-brand">
          <PrinterIcon className="h-4 w-4" />
          Imprimir / salvar em PDF
        </button>
      </div>
    </div>
  );
}
