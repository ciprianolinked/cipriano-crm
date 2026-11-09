"use client";

import { useState } from "react";

export function CopyButton({ value, label = "copiar" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function copy() {
    setError(false);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const area = document.createElement("textarea");
        area.value = value;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand("copy");
        area.remove();
        if (!ok) throw new Error("Clipboard unavailable");
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(true);
    }
  }

  return <div className="flex flex-col items-end gap-1"><button type="button" onClick={copy} className="rounded border border-line/70 bg-navy2/80 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-steel transition hover:border-signal/60 hover:text-signal">{copied ? "copiado ✓" : label}</button>{error ? <span role="status" className="max-w-48 text-right text-[10px] text-amber">Selecione o código e copie manualmente ou baixe o arquivo.</span> : null}</div>;
}

export function CodeBlock({ title, code, language, maxHeight }: { title: string; code: string; language?: string; maxHeight?: number }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-line/60 bg-abyss2/80">
      <div className="flex items-center justify-between gap-3 border-b border-line/50 px-3 py-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-steel">{title}{language ? ` · ${language}` : ""}</span>
        <CopyButton value={code} />
      </div>
      <pre tabIndex={0} style={maxHeight ? { maxHeight } : undefined} className="scroll-thin overflow-auto px-4 py-3 text-[11px] leading-relaxed text-silver"><code>{code}</code></pre>
    </div>
  );
}
