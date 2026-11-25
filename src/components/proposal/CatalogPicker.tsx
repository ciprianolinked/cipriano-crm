"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { brl } from "@/lib/brand";

export type PickerEntry = {
  id: string;
  kind: string;
  category: string;
  description: string;
  spec: string | null;
  unit: string;
  priceCents: number;
};

/** Modal com todo o catálogo: busca, filtro por categoria, quantidade e inclusão múltipla. */
export function CatalogPicker({
  open,
  onClose,
  entries,
  onAdd,
  title = "Catálogo de produtos e serviços",
}: {
  open: boolean;
  onClose: () => void;
  entries: PickerEntry[];
  onAdd: (entry: PickerEntry, qty: number) => void;
  title?: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [added, setAdded] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const categories = useMemo(
    () => ["Todas", ...Array.from(new Set(entries.map((entry) => entry.category))).sort((a, b) => a.localeCompare(b, "pt-BR"))],
    [entries],
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (category !== "Todas" && entry.category !== category) return false;
      if (!term) return true;
      return [entry.description, entry.category, entry.spec ?? ""].some((value) => value.toLowerCase().includes(term));
    });
  }, [entries, query, category]);

  if (!open) return null;

  function add(entry: PickerEntry) {
    const qty = Math.max(1, Math.round(quantities[entry.id] ?? 1));
    onAdd(entry, qty);
    setAdded((prev) => ({ ...prev, [entry.id]: (prev[entry.id] ?? 0) + 1 }));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="card flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line/50 p-4">
          <div>
            <div className="label-mono text-signal">Catálogo</div>
            <h2 className="mt-1 font-display text-[16px] font-semibold text-white">{title}</h2>
            <p className="mt-1 text-[11px] text-steel">Inclua quantos itens precisar; a janela continua aberta até você concluir.</p>
          </div>
          <button type="button" onClick={onClose} className="btn px-2 py-1.5" aria-label="Fechar catálogo">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3 border-b border-line/40 p-4">
          <label className="flex items-center gap-2 rounded-lg border border-line/60 bg-abyss2/60 px-3 py-2">
            <Search size={14} className="text-steel" />
            <input
              autoFocus
              className="w-full bg-transparent text-[13px] text-silver outline-none placeholder:text-steel"
              placeholder="Buscar por descrição, especificação ou categoria…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setCategory(name)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  category === name ? "border-signal/60 bg-signal/10 text-white" : "border-line/60 text-steel hover:text-silver"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="p-6 text-center text-[12px] text-steel">Nenhum item encontrado para este filtro.</p>
          ) : (
            <ul className="divide-y divide-line/40">
              {visible.map((entry) => (
                <li key={entry.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-navy2/40">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="chip !text-[9px]">{entry.category}</span>
                      <span className="chip !text-[9px]">{entry.kind === "servico" ? "Serviço" : "Equipamento"}</span>
                    </div>
                    <div className="mt-1 text-[13px] font-medium text-white">{entry.description}</div>
                    {entry.spec ? <div className="mt-0.5 text-[11px] leading-relaxed text-steel">{entry.spec}</div> : null}
                    <div className="mt-1 font-mono text-[11px] text-signal">
                      {brl(entry.priceCents / 100)} <span className="text-steel">/ {entry.unit}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-[10px] text-steel">
                      Qtd
                      <input
                        type="number"
                        min={1}
                        className="field w-16 py-1 text-center text-[12px]"
                        value={quantities[entry.id] ?? 1}
                        onChange={(event) => setQuantities((prev) => ({ ...prev, [entry.id]: Number(event.target.value) || 1 }))}
                      />
                    </label>
                    <button type="button" className="btn btn-primary px-3 py-1.5 text-[11.5px]" onClick={() => add(entry)}>
                      <Plus size={13} /> Incluir
                    </button>
                  </div>
                  {added[entry.id] ? (
                    <div className="col-span-2 -mt-1 flex items-center gap-1 text-[10.5px] text-armed">
                      <Check size={12} /> Incluído {added[entry.id]}× nesta proposta
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line/50 p-3">
          <span className="text-[11px] text-steel">{visible.length} de {entries.length} itens</span>
          <button type="button" className="btn btn-primary px-4 py-2 text-[12px]" onClick={onClose}>
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
