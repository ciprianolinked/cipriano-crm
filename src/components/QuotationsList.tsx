"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { QuotationStatus } from "@/lib/types";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/constants";
import { formatCurrency, formatDateBR } from "@/lib/quotation";
import { ArrowRightIcon, SearchIcon } from "./icons";

export type QuotationListItem = {
  id: string;
  protocol: string;
  condominium: string;
  service: string;
  category: string;
  kind: string;
  analysisDate: string;
  status: QuotationStatus;
  supplierCount: number;
  itemCount: number;
  bestName: string | null;
  bestTotal: number | null;
  savings: number;
};

const FILTERS: { value: "todos" | QuotationStatus; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "em_analise", label: "Em análise" },
  { value: "concluido", label: "Concluídos" },
  { value: "rascunho", label: "Rascunhos" },
];

export function QuotationsList({ items }: { items: QuotationListItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"todos" | QuotationStatus>("todos");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter = filter === "todos" || item.status === filter;
      const matchesTerm =
        !term ||
        [item.protocol, item.condominium, item.service, item.category].some((value) =>
          value.toLowerCase().includes(term),
        );
      return matchesFilter && matchesTerm;
    });
  }, [items, query, filter]);

  return (
    <section className="card overflow-hidden" id="mapas">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div>
          <h2 className="text-[15px] font-extrabold text-ink">Mapas de cotação</h2>
          <p className="text-[11.5px] text-slate-500">
            {items.length} processo(s) · histórico comparativo por condomínio
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar condomínio, objeto ou protocolo"
              className="field w-[230px] !py-1.5 pl-8 text-[12px]"
              aria-label="Buscar mapas de cotação"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-line bg-[#fbfcfc] px-4 py-2.5 sm:px-5">
        {FILTERS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => setFilter(entry.value)}
            className={`rounded-full px-3 py-1 text-[11.5px] font-bold transition ${
              filter === entry.value
                ? "bg-ink text-white"
                : "bg-white text-slate-500 ring-1 ring-line hover:text-ink"
            }`}
          >
            {entry.label}
          </button>
        ))}
        <span className="ml-auto self-center text-[10.5px] font-semibold text-slate-400">
          {filtered.length} resultado(s)
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-[13px] font-bold text-ink">Nenhum mapa encontrado</p>
          <p className="mt-1 text-[12px] text-slate-500">
            Ajuste a busca ou crie uma nova cotação a partir de propostas em PDF e imagem.
          </p>
          <Link href="/mapas/novo" className="btn btn-brand mt-3">
            Nova cotação com IA
          </Link>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-white text-left">
                  {["Protocolo", "Condomínio / objeto", "Análise", "Propostas", "Melhor proposta", "Economia", "Status", ""].map(
                    (header, index) => (
                      <th
                        key={`${header}-${index}`}
                        className="border-b border-line px-3 py-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-400"
                      >
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="group transition hover:bg-brand-soft/40">
                    <td className="border-b border-line px-3 py-2.5 align-middle">
                      <span className="rounded-md bg-paper px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-slate-600">
                        {item.protocol}
                      </span>
                    </td>
                    <td className="border-b border-line px-3 py-2.5">
                      <Link href={`/mapas/${item.id}`} className="block">
                        <span className="block font-bold text-ink group-hover:text-brand-dark">{item.condominium}</span>
                        <span className="block max-w-[280px] truncate text-[11px] text-slate-500">{item.service || "Sem objeto definido"}</span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap border-b border-line px-3 py-2.5 text-[11.5px] text-slate-600">
                      {formatDateBR(item.analysisDate)}
                    </td>
                    <td className="border-b border-line px-3 py-2.5 text-[11.5px] text-slate-600">
                      {item.supplierCount} forn. · {item.itemCount} itens
                    </td>
                    <td className="border-b border-line px-3 py-2.5">
                      <span className="block text-[11.5px] font-bold text-ink">{item.bestName ?? "—"}</span>
                      <span className="block text-[11px] text-slate-500">{formatCurrency(item.bestTotal)}</span>
                    </td>
                    <td className="border-b border-line px-3 py-2.5">
                      <span className={`text-[11.5px] font-extrabold ${item.savings > 0 ? "text-brand-dark" : "text-slate-400"}`}>
                        {item.savings > 0 ? formatCurrency(item.savings) : "—"}
                      </span>
                    </td>
                    <td className="border-b border-line px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${STATUS_STYLE[item.status]}`}
                      >
                        {STATUS_LABEL[item.status]}
                      </span>
                    </td>
                    <td className="border-b border-line px-2 py-2.5">
                      <Link
                        href={`/mapas/${item.id}`}
                        className="grid h-6 w-6 place-items-center rounded-md text-slate-400 transition hover:bg-ink hover:text-white"
                        aria-label={`Abrir ${item.protocol}`}
                      >
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-line md:hidden">
            {filtered.map((item) => (
              <li key={item.id}>
                <Link href={`/mapas/${item.id}`} className="block px-4 py-3 transition hover:bg-brand-soft/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-extrabold text-ink">{item.condominium}</p>
                      <p className="truncate text-[11.5px] text-slate-500">{item.service || "Sem objeto definido"}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold ring-1 ring-inset ${STATUS_STYLE[item.status]}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-slate-500">
                    <span className="font-mono">{item.protocol}</span>
                    <span>{formatDateBR(item.analysisDate)}</span>
                    <span>{item.supplierCount} fornecedores</span>
                    <span className="font-bold text-brand-dark">{formatCurrency(item.bestTotal)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
