"use client";

import { useState } from "react";

export function CopyButton({ value, label = "copiar" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded border border-line/70 bg-navy2/80 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-steel transition hover:border-signal/60 hover:text-signal"
    >
      {copied ? "copiado ✓" : label}
    </button>
  );
}

export function CodeBlock({ title, code, language }: { title: string; code: string; language?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line/60 bg-abyss2/80">
      <div className="flex items-center justify-between border-b border-line/50 px-3 py-1.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-steel">
          {title}
          {language ? ` · ${language}` : ""}
        </span>
        <CopyButton value={code} />
      </div>
      <pre className="scroll-thin overflow-x-auto px-3 py-2.5 text-[11px] leading-relaxed text-silver">
        <code>{code}</code>
      </pre>
    </div>
  );
}
