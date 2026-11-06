"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, FileText, Scale, Sparkles } from "lucide-react";
import { brl } from "@/lib/brand";
import { suggestedMonthlyValue } from "@/lib/contract-draft";
import type { ProposalItem } from "@/lib/proposal/types";
import type { IndexComparison } from "@/lib/indices";
import { IndexComparisonPanel } from "@/components/maintenance/IndexComparison";

type ProposalOption = { id: string; number: string; revision: number; clientName: string; items: ProposalItem[]; site: string | null };

export function NewContractForm({ proposals, initialProposalId, comparison, aiEnabled, today }: { proposals: ProposalOption[]; initialProposalId: string; comparison: IndexComparison; aiEnabled: boolean; today: string }) {
  const router = useRouter();
  const initial = proposals.find((p) => p.id === initialProposalId);
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const [monthly, setMonthly] = useState(initial ? String(suggestedMonthlyValue(initial.items) || "") : "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today);
  const [indexName, setIndexName] = useState("IPCA");
  const [customIndex, setCustomIndex] = useState("");
  const [useAi, setUseAi] = useState(aiEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = useMemo(() => proposals.find((p) => p.id === selectedId), [proposals, selectedId]);
  const amount = Number(monthly.replace(",", "."));

  async function submit() {
    setError("");
    if (!selected) { setError("Selecione uma proposta salva."); return; }
    if (!date) { setError("Informe a data de início."); return; }
    if (indexName === "OUTRO" && !customIndex.trim()) { setError("Informe o nome do índice personalizado."); return; }
    if (monthly.trim() && (!Number.isFinite(amount) || amount < 0)) { setError("Informe uma mensalidade válida."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/maintenance/from-proposal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proposalId: selected.id, monthlyValue: monthly.trim() ? amount : 0, title: title || `Manutenção mensal — ${selected.clientName}`, description, startDate: date, indexName: indexName === "OUTRO" ? customIndex : indexName, useAi }) });
      const data = await response.json() as { error?: string; contract?: { id: string } };
      if (!response.ok || !data.contract) throw new Error(data.error ?? "Não foi possível criar o contrato.");
      router.push(`/manutencao/${data.contract.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível criar o contrato."); }
    finally { setBusy(false); }
  }

  return <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
    <div className="space-y-4">
      <section className="card p-5"><Step number="01" title="Escolha a proposta" subtitle="Seus dados são aproveitados no contrato."/><label className="mt-4 block"><span className="label-mono mb-1.5 block">Proposta de origem</span><select className="field" value={selectedId} onChange={(e) => { const p = proposals.find((x) => x.id === e.target.value); setSelectedId(e.target.value); setMonthly(p ? String(suggestedMonthlyValue(p.items) || "") : ""); }}><option value="">Selecione uma proposta salva...</option>{proposals.map((p) => <option key={p.id} value={p.id}>{p.number} · Rev. {String(p.revision).padStart(2, "0")} · {p.clientName}</option>)}</select></label>{selected ? <div className="mt-3 flex flex-wrap gap-2 text-[11px]"><span className="chip !border-signal/30 !text-signal">{selected.number} · Rev. {String(selected.revision).padStart(2, "0")}</span><span className="chip !normal-case !tracking-normal">{selected.clientName}</span><span className="text-steel">{selected.site || "Local não informado"}</span></div> : proposals.length === 0 ? <p className="mt-3 text-[11px] text-steel">Ainda não há proposta cadastrada. <Link href="/propostas/nova" className="text-signal hover:underline">Criar uma proposta →</Link></p> : null}</section>
      <section className="card p-5"><Step number="02" title="Condições de manutenção" subtitle="Confirme apenas o que será cobrado todos os meses."/><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Título interno"><input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Manutenção mensal"/></Field><Field label="Início do contrato"><input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)}/></Field><Field label="Mensalidade (R$)"><input className="field" type="number" min="0" step="0.01" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="Informe o valor mensal"/></Field><Field label="Índice previsto"><select className="field" value={indexName} onChange={(e) => setIndexName(e.target.value)}><option>IPCA</option><option>IGP-M</option><option>INPC</option><option value="OUTRO">Outro índice (informar)</option></select></Field>{indexName === "OUTRO" ? <Field label="Nome do índice"><input className="field" value={customIndex} onChange={(e) => setCustomIndex(e.target.value)} placeholder="Índice contratual escolhido"/></Field> : null}<label className="block sm:col-span-2"><span className="label-mono mb-1.5 block">Escopo de manutenção (opcional)</span><textarea className="field min-h-[80px] leading-relaxed" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o que foi acordado: equipamentos, visitas, atendimento e exclusões."/></label></div><p className="mt-3 rounded-lg border border-amber/25 bg-amber/5 p-2.5 text-[10.5px] leading-relaxed text-steel">{selected && suggestedMonthlyValue(selected.items) > 0 ? <>Sugerimos <b className="text-silver">{brl(suggestedMonthlyValue(selected.items))}/mês</b> pelos itens mensais da proposta. Confira o valor: itens de instalação e pagamento único não são mensalidade.</> : "Nenhum valor mensal foi identificado na proposta. Informe-o ou deixe pendente para completar na minuta."}</p></section>
      <section className="card p-5"><Step number="03" title="Escolha com informação" subtitle="Compare as opções, mas confira sempre o que será pactuado."/><div className="mt-4"><IndexComparisonPanel comparison={comparison} selected={indexName} onSelect={setIndexName} monthlyCents={Math.round((Number.isFinite(amount) ? amount : 0) * 100)}/></div><div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-line/40 bg-abyss2/40 p-2.5 text-[10.5px] text-steel"><span>Para atualizar os dados ou lançar índices manualmente, acesse a carteira.</span><Link href="/manutencao" className="shrink-0 text-signal hover:underline">Atualizar índices</Link></div></section>
      <div className="flex flex-wrap items-center gap-3"><button className="btn btn-primary px-5 py-3" disabled={busy || !selectedId} onClick={submit}><Sparkles size={15}/>{busy ? "Preparando minuta..." : "Criar minuta do contrato"}<ArrowRight size={14}/></button><Link href="/manutencao" className="btn py-3">Cancelar</Link></div>{error ? <p role="alert" className="rounded-lg border border-alarm/40 bg-alarm/5 p-3 text-[11px] text-alarm">{error}</p> : null}
    </div>
    <aside className="space-y-3"><div className="card p-4"><div className="flex items-center gap-2 text-signal"><Sparkles size={15}/><span className="label-mono !text-signal">Assistente de redação</span></div><h2 className="mt-2 font-display text-[15px] font-semibold text-white">Um bom ponto de partida</h2><p className="mt-2 text-[11.5px] leading-relaxed text-steel">A minuta usa informações da proposta e aborda escopo, responsabilidades, pagamento, reajuste, LGPD, rescisão e assinaturas.</p><label className="mt-4 flex items-start gap-2 rounded-lg border border-line/60 bg-abyss2/50 p-2.5 text-[11px] text-silver"><input type="checkbox" checked={useAi} disabled={!aiEnabled} onChange={(e) => setUseAi(e.target.checked)} className="mt-0.5"/><span>{aiEnabled ? "Redigir com IA generativa" : "IA generativa não configurada; usar minuta estruturada"}<small className="mt-1 block leading-relaxed text-steel">{aiEnabled ? "O texto e os dados da proposta serão enviados ao provedor configurado." : "Configure OPENAI_API_KEY no servidor para habilitar a redação e a reescrita por IA."}</small></span></label></div><div className="rounded-xl border border-amber/25 bg-amber/5 p-4"><div className="flex items-center gap-2 text-amber"><Scale size={16}/><span className="font-display text-[13px] font-semibold">Revisão jurídica necessária</span></div><p className="mt-2 text-[11px] leading-relaxed text-steel">A minuta é um apoio à redação, não substitui advogado. Confira dados, cláusulas, valores e responsabilidades antes de assinar.</p></div><div className="card p-4"><div className="flex items-center gap-2 text-silver"><BadgeCheck size={16} className="text-signal"/><span className="font-display text-[13px] font-semibold text-white">Você mantém o controle</span></div><p className="mt-2 text-[11px] leading-relaxed text-steel">O contrato começa como rascunho. Nada é enviado ao cliente ou ativado automaticamente.</p></div></aside>
  </div>;
}
function Step({ number, title, subtitle }: { number: string; title: string; subtitle: string }) { return <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-signal/30 bg-signal/10 font-mono text-[11px] text-signal">{number}</span><div><h2 className="font-display text-[15px] font-semibold text-white">{title}</h2><p className="text-[10.5px] text-steel">{subtitle}</p></div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="label-mono mb-1.5 block">{label}</span>{children}</label>; }
