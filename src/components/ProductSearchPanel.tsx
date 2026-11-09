"use client";

import { useState } from "react";
import type { ProductSearchResult } from "@/lib/types";
import { TRUSTED_STORES } from "@/lib/constants";
import { formatCurrency } from "@/lib/quotation";
import { CloseIcon, FileIcon, SearchIcon, SparklesIcon } from "./icons";

type Props = {
  condominium?: string;
  /** Adiciona o produto e o link como novo item do mapa. */
  onAddItem: (result: ProductSearchResult) => void;
  /** Vincula o link a um fornecedor já cadastrado (e-commerce). */
  onAttachToSupplier: (result: ProductSearchResult) => void;
  hasSuppliers: boolean;
};

/** Busca online de produtos sem precisar anexar arquivos. */
export function ProductSearchPanel({ condominium, onAddItem, onAttachToSupplier, hasSuppliers }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProductSearchResult[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function search() {
    const descriptions = query
      .split(/\n|;/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 2)
      .slice(0, 8);
    if (descriptions.length === 0) {
      setError("Digite o nome do produto (marca e modelo ajudam a encontrar o link certo).");
      return;
    }
    setLoading(true);
    setError(null);
    setWarnings([]);
    setResults(null);
    try {
      const response = await fetch("/api/ai/product-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: descriptions, condominium }),
      });
      const data = (await response.json()) as { results?: ProductSearchResult[]; warnings?: string[]; error?: string };
      if (!response.ok || !data.results) throw new Error(data.error || "Não foi possível pesquisar.");
      setResults(data.results);
      setWarnings(data.warnings ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha na pesquisa online.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost !py-1.5">
        <SearchIcon className="h-3.5 w-3.5" />
        Buscar produto online (sem anexo)
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-white px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-extrabold text-ink">Buscar produto online</p>
          <p className="mt-0.5 text-[10.5px] leading-snug text-slate-500">
            Digite um produto por linha. A busca usa o Google e prioriza {TRUSTED_STORES.length} lojas conhecidas — sem
            precisar anexar arquivos.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-paper hover:text-ink" aria-label="Fechar busca online">
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <textarea
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          rows={2}
          placeholder={"Ex.: Luminária Solar Integrada Intelbras LSI 4800\nTubo PVC soldável 25 mm"}
          className="field flex-1 resize-y text-[12px]"
        />
        <button type="button" onClick={search} disabled={loading} className="btn btn-brand self-start">
          <SparklesIcon className={loading ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
          {loading ? "Pesquisando…" : "Buscar online"}
        </button>
      </div>

      {error && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[11.5px] font-semibold text-red-700">{error}</p>}

      {results && (
        <ul className="mt-3 space-y-2">
          {results.map((result) => (
            <li key={`${result.index}-${result.purchaseUrl}`} className="rounded-lg border border-line bg-[#fffdf6] px-2.5 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="min-w-0 flex-1 text-[11.5px] font-bold text-ink">{result.description}</span>
                {result.trusted ? (
                  <span className="rounded-full bg-success-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.05em] text-success">Loja confiável</span>
                ) : result.found ? (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.05em] text-amber-700">Não verificada</span>
                ) : null}
              </div>
              {result.found ? (
                <>
                  <p className="mt-1 text-[11px] text-slate-600">
                    {result.productName || "Produto encontrado"}
                    {result.store ? ` · ${result.store}` : ""}
                    {result.price !== null ? ` · ${formatCurrency(result.price)}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <a href={result.purchaseUrl} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-[10.5px] font-semibold text-brand-dark underline underline-offset-2">
                      {result.purchaseUrl}
                    </a>
                    <button type="button" onClick={() => onAddItem(result)} className="btn btn-ghost !px-2 !py-1 text-[10.5px]">Adicionar como item</button>
                    {hasSuppliers && (
                      <button type="button" onClick={() => onAttachToSupplier(result)} className="btn btn-ghost !px-2 !py-1 text-[10.5px]">Vincular a fornecedor</button>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-1 text-[10.5px] text-slate-500">{result.note || "Nenhum link encontrado."}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <ul className="mt-2 space-y-1">
          {warnings.map((warning) => (
            <li key={warning} className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[10.5px] leading-snug text-amber-800">{warning}</li>
          ))}
        </ul>
      )}
      <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-snug text-slate-400">
        <FileIcon className="mt-0.5 h-3 w-3 shrink-0" />
        A pesquisa não envia propostas nem arquivos: usa apenas o texto digitado.
      </p>
    </div>
  );
}
