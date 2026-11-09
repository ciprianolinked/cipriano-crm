"use client";

import { useState } from "react";
import { CheckIcon, FileIcon } from "./icons";

type GuideCopyButtonProps = {
  label: string;
  value?: string;
  fileUrl?: string;
  className?: string;
};

export function GuideCopyButton({ label, value, fileUrl, className = "btn btn-primary" }: GuideCopyButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle");

  async function copy() {
    setState("loading");
    try {
      let text = value;
      if (fileUrl) {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error("Arquivo indisponível");
        text = await response.text();
      }
      if (!text || !navigator.clipboard?.writeText) throw new Error("Área de transferência indisponível");
      await navigator.clipboard.writeText(text);
      setState("copied");
      window.setTimeout(() => setState("idle"), 4000);
    } catch {
      setState("error");
    }
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={copy} disabled={state === "loading"} className={className}>
        {state === "copied" ? <CheckIcon className="h-4 w-4" /> : <FileIcon className="h-4 w-4" />}
        {state === "loading" ? "Copiando…" : state === "copied" ? "Copiado!" : label}
      </button>
      <span role="status" aria-live="polite" className="text-[11px] font-semibold text-amber-800">
        {state === "error"
          ? fileUrl
            ? "Não foi possível copiar. Abra o arquivo ao lado e copie manualmente."
            : "Não foi possível copiar. Selecione e copie o texto manualmente."
          : ""}
      </span>
    </div>
  );
}
