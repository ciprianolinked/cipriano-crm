"use client";
import { CheckCircle2, CalendarClock, Wrench } from "lucide-react";
import type { MaintenancePlan } from "@/lib/proposal/types";

export function MaintenancePlanFields({ value: p, onChange }: { value: MaintenancePlan; onChange: (p: MaintenancePlan) => void }) {
  const set = <K extends keyof MaintenancePlan>(key: K, v: MaintenancePlan[K]) => onChange({ ...p, [key]: v });
  return <div className="space-y-4">
    <div className="grid gap-2 sm:grid-cols-2">{([["preventive", "Preventiva", "Rotinas programadas e acompanhamento dos sistemas.", CheckCircle2], ["corrective", "Corretiva", "Diagnóstico e correção de falhas por chamado.", Wrench]] as const).map(([key, title, hint, Icon]) => <label key={key} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${p[key] ? "border-signal/40 bg-signal/5" : "border-line/50 bg-abyss2/40"}`}><input type="checkbox" className="mt-1 accent-cyan-400" checked={p[key]} onChange={(e) => set(key, e.target.checked)}/><div className="min-w-0"><span className="flex items-center gap-1.5 font-medium text-[12px] text-white"><Icon size={14} className="text-signal"/>{title}</span><p className="mt-1 text-[10.5px] leading-relaxed text-steel">{hint}</p></div></label>)}</div>
    <label className="block"><span className="label-mono mb-1.5 block">Sistemas e equipamentos cobertos *</span><textarea className="field min-h-[75px] leading-relaxed" value={p.coveredEquipment} onChange={(e) => set("coveredEquipment", e.target.value)} placeholder="Descreva os equipamentos existentes, quantidades, locais e limites da cobertura."/></label>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <NumberField label="Mensalidade (R$) *" value={p.monthlyPrice || ""} step="0.01" min={0.01} onChange={(v) => set("monthlyPrice", v)} />
      <NumberField label="Vigência (meses)" value={p.termMonths} min={1} max={60} onChange={(v) => set("termMonths", v)} />
      <NumberField label="Vencimento (dia)" value={p.dueDay} min={1} max={28} onChange={(v) => set("dueDay", v)} />
      {p.preventive ? <NumberField label="Visitas preventivas / mês" value={p.visitsPerMonth} min={1} max={31} onChange={(v) => set("visitsPerMonth", v)} /> : null}
      {p.corrective ? <NumberField label="Visitas corretivas incluídas / mês" value={p.correctiveVisitsPerMonth} min={1} max={31} onChange={(v) => set("correctiveVisitsPerMonth", v)} /> : null}
      <NumberField label="Resposta inicial (horas úteis)" value={p.responseHours} min={1} max={720} onChange={(v) => set("responseHours", v)} />
      <label className="block"><span className="label-mono mb-1.5 block">Data de início (opcional)</span><input className="field" type="date" value={p.startDate} onChange={(e) => set("startDate", e.target.value)}/></label>
      <label className="block"><span className="label-mono mb-1.5 block">Índice de reajuste anual</span><select className="field" value={p.indexName} onChange={(e) => set("indexName", e.target.value)}><option>IPCA</option><option>IGP-M</option><option>INPC</option></select></label>
    </div>
    <label className="block"><span className="label-mono mb-1.5 block">Horário de atendimento *</span><input className="field" value={p.serviceHours} onChange={(e) => set("serviceHours", e.target.value)}/></label>
    <label className="block"><span className="label-mono mb-1.5 block">Peças, materiais e exclusões *</span><textarea className="field min-h-[70px] leading-relaxed" value={p.partsCoverage} onChange={(e) => set("partsCoverage", e.target.value)}/></label>
    <div className="flex gap-2 rounded-lg border border-line/50 bg-abyss2/40 p-3 text-[10.5px] leading-relaxed text-steel"><CalendarClock size={14} className="mt-0.5 shrink-0 text-signal"/><span>O prazo é de resposta inicial, não de resolução definitiva. O reajuste será anual, mesmo que a vigência informada seja menor. Nenhum equipamento novo será acrescentado automaticamente.</span></div>
  </div>;
}
function NumberField({ label, value, onChange, min, max, step = "1" }: { label: string; value: number | string; onChange: (v: number) => void; min?: number; max?: number; step?: string }) { return <label className="block"><span className="label-mono mb-1.5 block">{label}</span><input className="field" type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))}/></label>; }
