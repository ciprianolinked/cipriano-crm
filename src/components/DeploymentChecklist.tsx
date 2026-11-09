"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "gerencial-publicacao-checklist-v1";
const ITEMS = [
  { id: "fonte", label: "Separei os arquivos do projeto", href: "#preparacao" },
  { id: "github", label: "Enviei o código ao GitHub", href: "#github" },
  { id: "neon", label: "Criei o banco no Neon", href: "#neon" },
  { id: "tabelas", label: "Preparei as tabelas", href: "#tabelas" },
  { id: "vercel", label: "Publiquei na Vercel", href: "#vercel" },
  { id: "protecao", label: "Protegi e testei o acesso", href: "#seguranca" },
];

export function DeploymentChecklist() {
  const [completed, setCompleted] = useState<string[]>([]);
  const [storageAvailable, setStorageAvailable] = useState(true);

  useEffect(() => {
    let active = true;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const allowed = ITEMS.map((item) => item.id);
          const safe = parsed.filter((item): item is string => typeof item === "string" && allowed.includes(item));
          queueMicrotask(() => {
            if (active) setCompleted(safe);
          });
        }
      }
    } catch {
      queueMicrotask(() => {
        if (active) setStorageAvailable(false);
      });
    }
    return () => {
      active = false;
    };
  }, []);

  function toggle(id: string) {
    const next = completed.includes(id) ? completed.filter((item) => item !== id) : [...completed, id];
    setCompleted(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setStorageAvailable(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm" aria-labelledby="checklist-heading">
      <div className="border-b border-line px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-dark">Seu progresso</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <h2 id="checklist-heading" className="text-[15px] font-bold text-ink">Checklist de publicação</h2>
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-brand-dark">
            {completed.length}/{ITEMS.length}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Progresso no guia de publicação"
          aria-valuemin={0}
          aria-valuemax={ITEMS.length}
          aria-valuenow={completed.length}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper"
        >
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(completed.length / ITEMS.length) * 100}%` }} />
        </div>
      </div>
      <ul className="space-y-3 px-5 py-4">
        {ITEMS.map((item) => (
          <li key={item.id} className="flex items-start gap-2.5">
            <input
              id={`check-${item.id}`}
              type="checkbox"
              checked={completed.includes(item.id)}
              onChange={() => toggle(item.id)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#181447]"
            />
            <div className="text-[12px] leading-snug text-slate-600">
              <label htmlFor={`check-${item.id}`} className="cursor-pointer">{item.label}</label>{" "}
              <a href={item.href} className="font-bold text-brand-dark underline decoration-brand/60 underline-offset-2">
                Ver etapa
              </a>
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-line bg-paper/70 px-5 py-3 text-[10.5px] leading-relaxed text-slate-500">
        {storageAvailable
          ? "As marcações ficam apenas neste navegador. Elas não conectam os serviços automaticamente."
          : "Não foi possível guardar as marcações neste navegador. Elas continuarão visíveis até a página ser recarregada."}
      </p>
    </section>
  );
}
