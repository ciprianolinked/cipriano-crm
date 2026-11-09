"use client";

import { Check, Info, TrendingDown } from "lucide-react";
import { formatIndexPct, formatMonth, INDEXES, type IndexComparison, type IndexName } from "@/lib/indices";
import { brl } from "@/lib/brand";

export function IndexComparisonPanel({
  comparison,
  selected,
  onSelect,
  monthlyCents,
}: {
  comparison: IndexComparison;
  selected?: string;
  onSelect?: (name: IndexName) => void;
  monthlyCents?: number;
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[12px] text-silver">
            Período comparado: <b className="text-white">{formatMonth(comparison.periodStart)} a {formatMonth(comparison.periodEnd)}</b>
          </div>
          <div className="mt-0.5 text-[10.5px] text-steel">Acumulado composto em 12 meses · fontes: IBGE e FGV, via BCB/SGS</div>
        </div>
        {comparison.provisional ? <span className="chip !border-amber/40 !text-amber">prévia · ciclo incompleto</span> : <span className="chip !border-armed/30 !text-armed">mesma janela</span>}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {comparison.results.map((row) => {
          const lowest = comparison.lowest === row.indexName;
          const info = INDEXES.find((i) => i.id === row.indexName)!;
          const isSelected = selected === row.indexName;
          const projected = row.accumulatedPct !== null && monthlyCents !== undefined
            ? Math.round(monthlyCents * (1 + row.accumulatedPct / 100))
            : null;
          return (
            <button
              type="button"
              key={row.indexName}
              onClick={() => onSelect?.(row.indexName)}
              className={`relative rounded-xl border p-3 text-left transition ${onSelect ? "cursor-pointer hover:border-signal/60" : "cursor-default"} ${isSelected ? "border-signal/65 bg-signal/[0.07]" : "border-line/60 bg-abyss2/55"}`}
            >
              <div className="flex items-start justify-between gap-1">
                <div><div className="font-display text-[14px] font-semibold text-white">{row.indexName}</div><div className="text-[10px] text-steel">{row.publisher} · série {info.series}</div></div>
                {isSelected ? <Check className="h-4 w-4 text-signal" /> : lowest ? <TrendingDown className="h-4 w-4 text-armed" /> : null}
              </div>
              <div className={`mt-3 font-display text-[20px] font-semibold tracking-tight ${row.accumulatedPct === null ? "text-steel" : lowest ? "text-armed" : "text-white"}`}>
                {formatIndexPct(row.accumulatedPct)}
              </div>
              <div className="mt-0.5 text-[10px] text-steel">{row.accumulatedPct === null ? `${row.missingMonths.length} mês(es) sem dados` : lowest ? "Menor dos índices disponíveis" : "acumulado no período"}</div>
              {projected !== null ? <div className="mt-2 border-t border-line/50 pt-2 text-[11px] text-silver">Simulação: <b className="text-white">{brl(projected / 100)}/mês</b></div> : null}
              {onSelect ? <div className={`mt-2 text-[10px] ${isSelected ? "text-signal" : "text-steel"}`}>{isSelected ? "✓ Selecionado" : "Selecionar índice →"}</div> : null}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2 rounded-lg border border-line/50 bg-navy/25 p-2.5 text-[10.5px] leading-relaxed text-steel">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal" />
        <p>
          {comparison.provisional ? `Prévia com os últimos dados comparáveis. A janela contratual é ${formatMonth(comparison.contractualStart)} a ${formatMonth(comparison.contractualEnd)} e pode não estar publicada. ` : ""}
          O menor índice é uma referência, não uma substituição automática do índice pactuado. Confirme com o cliente e revise a cláusula antes de alterar um contrato assinado.
        </p>
      </div>
    </div>
  );
}
