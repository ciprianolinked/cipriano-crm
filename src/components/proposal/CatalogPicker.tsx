"use client";

import { useMemo, useState } from "react";
import { PackagePlus, Plus, Search, Trash2 } from "lucide-react";
import { brl } from "@/lib/brand";
import type { ProposalItem } from "@/lib/proposal/types";

export type PickerCatalogItem = {
  id: string;
  kind: string;
  category: string;
  description: string;
  spec: string | null;
  unit: string;
  priceCents: number;
};

/** Linha escolhida no catálogo: um item de proposta que lembra de qual produto veio. */
export type PickedLine = ProposalItem & { catalogId: string };

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function CatalogPicker({
  catalog,
  picked,
  onAdd,
  onPatch,
  onRemove,
}: {
  catalog: PickerCatalogItem[];
  picked: PickedLine[];
  onAdd: (entry: PickerCatalogItem) => void;
  onPatch: (id: string, patch: Partial<ProposalItem>) => void;
  onRemove: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const categories = useMemo(() => [...new Set(catalog.map((item) => item.category))].sort(), [catalog]);
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return catalog.filter(
      (item) =>
        (!category || item.category === category) &&
        (!q || normalize(`${item.description} ${item.spec ?? ""} ${item.category}`).includes(q)),
    );
  }, [catalog, query, category]);
  const total = picked.reduce((sum, line) => sum + line.qty * line.price, 0);

  return (
    <div className="mb-5 rounded-xl border border-line/60 bg-abyss2/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="label-mono text-signal">Produtos do catálogo</div>
          <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-steel">
            Escolha os produtos já cadastrados — descrição, especificação, unidade e preço de venda entram prontos e
            continuam editáveis depois.
          </p>
        </div>
        <span className="chip !border-signal/40 !text-signal">{picked.length} no escopo</span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_190px]">
        <label className="relative block">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel" />
          <input
            className="field pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produto, especificação ou categoria"
          />
        </label>
        <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categories.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </div>

      <div className="scroll-thin mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-line/50 bg-abyss/40 p-1.5">
        {catalog.length === 0 ? (
          <p className="p-3 text-center text-[11px] text-steel">
            O catálogo está vazio. Cadastre produtos em <b className="text-silver">Catálogo</b> para usá-los aqui.
          </p>
        ) : filtered.length === 0 ? (
          <p className="p-3 text-center text-[11px] text-steel">Nenhum produto encontrado para este filtro.</p>
        ) : (
          filtered.map((item) => {
            const count = picked.filter((line) => line.catalogId === item.id).length;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onAdd(item)}
                className="group flex w-full items-center gap-3 rounded-md border border-transparent px-2.5 py-2 text-left transition hover:border-signal/40 hover:bg-signal/[0.05]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line/60 bg-navy text-signal group-hover:border-signal/50">
                  <Plus size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-silver">{item.description}</span>
                  <span className="block truncate text-[10px] text-steel">
                    {item.category}
                    {item.spec ? ` · ${item.spec}` : ""}
                  </span>
                </span>
                {count > 0 ? <span className="chip !border-armed/40 !text-armed">+{count}</span> : null}
                <span className="shrink-0 font-mono text-[11px] text-signal">
                  {item.priceCents > 0 ? `${brl(item.priceCents / 100)} / ${item.unit}` : `sem preço / ${item.unit}`}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label-mono">Itens selecionados</span>
          <span className="font-mono text-[11px] text-signal">{brl(total)}</span>
        </div>
        {picked.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-line/60 p-3 text-[11px] text-steel">
            <PackagePlus size={15} className="shrink-0" /> Clique nos produtos acima para incluí-los na proposta.
          </div>
        ) : (
          <div className="space-y-2">
            {picked.map((line) => (
              <div key={line.id} className="rounded-lg border border-line/60 bg-abyss2/50 p-2">
                <div className="flex items-center gap-2">
                  <input
                    className="field flex-1 text-[12px]"
                    value={line.desc}
                    onChange={(e) => onPatch(line.id, { desc: e.target.value })}
                    aria-label="Descrição"
                  />
                  <button
                    type="button"
                    onClick={() => onRemove(line.id)}
                    className="rounded-lg border border-line/60 p-2 text-steel transition hover:border-alarm/50 hover:text-alarm"
                    aria-label={`Remover ${line.desc}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="mt-1.5 grid grid-cols-[1fr_70px_80px_110px] items-center gap-1.5">
                  <input
                    className="field text-[11px]"
                    value={line.spec}
                    onChange={(e) => onPatch(line.id, { spec: e.target.value })}
                    placeholder="Especificação"
                    aria-label="Especificação"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="field text-[11px]"
                    value={line.qty}
                    onChange={(e) => onPatch(line.id, { qty: Number(e.target.value) })}
                    aria-label="Quantidade"
                  />
                  <input
                    className="field text-[11px]"
                    value={line.unit}
                    onChange={(e) => onPatch(line.id, { unit: e.target.value })}
                    aria-label="Unidade"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="field text-[11px]"
                    value={line.price}
                    onChange={(e) => onPatch(line.id, { price: Number(e.target.value) })}
                    aria-label="Preço unitário"
                  />
                </div>
                <div className="mt-1 text-right font-mono text-[10.5px] text-signal">{brl(line.qty * line.price)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
