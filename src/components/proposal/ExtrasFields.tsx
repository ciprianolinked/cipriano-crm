"use client";

import { Layers } from "lucide-react";
import { brl } from "@/lib/brand";
import { extrasBreakdown, type ProposalExtras } from "@/lib/proposal/extras";
import type { ProposalItem } from "@/lib/proposal/types";

/**
 * Adicionais de toda proposta de projeto: miscelâneas, infraestrutura e margem de segurança
 * (percentuais sobre os equipamentos) e mão de obra (valor de cada proposta).
 */
export function ExtrasFields({
  value,
  onChange,
  items,
  note,
}: {
  value: ProposalExtras;
  onChange: (next: ProposalExtras) => void;
  items: ProposalItem[];
  note?: string;
}) {
  const breakdown = extrasBreakdown(items, value);
  const set = (patch: Partial<ProposalExtras>) => onChange({ ...value, ...patch });
  const pct = (label: string, key: "miscPct" | "infraPct" | "safetyPct", amount: number) => (
    <label className="block">
      <span className="label-mono mb-1.5 block">{label}</span>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            className="field pr-7"
            value={value[key]}
            disabled={!value.enabled}
            onChange={(e) => set({ [key]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-steel">%</span>
        </div>
        <span className="w-24 text-right font-mono text-[11px] text-signal">{value.enabled ? brl(amount) : "—"}</span>
      </div>
    </label>
  );

  return (
    <div className="rounded-xl border border-line/60 bg-abyss2/30 p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 accent-cyan-400"
          checked={value.enabled}
          onChange={(e) => set({ enabled: e.target.checked })}
        />
        <span>
          <span className="flex items-center gap-2 font-display text-[14px] font-semibold text-white">
            <Layers size={15} className="text-signal" /> Adicionais do projeto
          </span>
          <span className="mt-1 block text-[11px] leading-relaxed text-steel">
            Miscelâneas, infraestrutura e margem de segurança incidem como percentual sobre o valor dos equipamentos; a
            mão de obra é um valor próprio de cada proposta. Entram como linhas separadas e se recalculam sozinhas.
          </span>
        </span>
      </label>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {pct("Miscelâneas", "miscPct", breakdown.misc)}
        {pct("Infraestrutura", "infraPct", breakdown.infra)}
        {pct("Margem de segurança", "safetyPct", breakdown.safety)}
        <label className="block">
          <span className="label-mono mb-1.5 block">Mão de obra (R$)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className="field"
            value={value.laborValue}
            disabled={!value.enabled}
            onChange={(e) => set({ laborValue: Math.max(0, Number(e.target.value) || 0) })}
            placeholder="Valor desta proposta"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line/50 bg-abyss/40 px-3 py-2 text-[11px]">
        <span className="text-steel">
          Base de cálculo (equipamentos): <b className="font-mono text-silver">{brl(breakdown.base)}</b>
        </span>
        <span className="text-steel">
          Adicionais:{" "}
          <b className="font-mono text-signal">
            {brl(value.enabled ? breakdown.misc + breakdown.infra + breakdown.safety + breakdown.labor : 0)}
          </b>
        </span>
      </div>
      {note ? <p className="mt-2 text-[10.5px] leading-relaxed text-steel">{note}</p> : null}
    </div>
  );
}
