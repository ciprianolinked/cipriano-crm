"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Check, FileCheck2, FileText, Scale, Sparkles, Wrench } from "lucide-react";
import { brl } from "@/lib/brand";
import { suggestedMonthlyValue, type ContractKind } from "@/lib/contract-draft";
import { getMaintenancePlan, isMaintenanceProposal } from "@/lib/proposal/maintenance-plan";
import type { ProposalItem } from "@/lib/proposal/types";
import type { IndexComparison } from "@/lib/indices";
import { IndexComparisonPanel } from "@/components/maintenance/IndexComparison";

type ProposalOption = { id: string; number: string; revision: number; clientName: string; items: ProposalItem[]; site: string | null; totalCents?: number; discountPct?: number; briefing?: Record<string, unknown> | null };

export function NewContractForm({ proposals, initialProposalId, comparison, aiEnabled, today, defaultKind }: { proposals: ProposalOption[]; initialProposalId: string; comparison: IndexComparison; aiEnabled: boolean; today: string; defaultKind?: ContractKind }) {
  const router = useRouter();
  const initial = proposals.find((p) => p.id === initialProposalId);
  const initialPlan = getMaintenancePlan(initial?.briefing);
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const [kind, setKind] = useState<ContractKind>(defaultKind ?? (isMaintenanceProposal(initial?.briefing) ? "manutencao" : "proposta"));
  const [monthly, setMonthly] = useState(initial ? String(suggestedMonthlyValue(initial.items, initial.briefing, initial.discountPct) || "") : "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(initialPlan?.startDate || today);
  const [indexName, setIndexName] = useState(initialPlan?.indexName || "IPCA");
  const [customIndex, setCustomIndex] = useState("");
  const [clientOptIn, setClientOptIn] = useState(initial?.briefing?.wantsContract === true);
  const [useAi, setUseAi] = useState(aiEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = proposals.find((p) => p.id === selectedId);
  const amount = Number(monthly.replace(",", "."));
  const maintenance = kind === "manutencao";
  function chooseProposal(id: string) {
    const p = proposals.find((p) => p.id === id);
    const plan = getMaintenancePlan(p?.briefing);
    setSelectedId(id); setKind(defaultKind ?? (plan ? "manutencao" : "proposta"));
    setMonthly(p ? String(suggestedMonthlyValue(p.items, p.briefing, p.discountPct) || "") : "");
    setClientOptIn(p?.briefing?.wantsContract === true); setDate(plan?.startDate || today); setIndexName(plan?.indexName || "IPCA"); setTitle(""); setDescription(""); setError("");
  }
  async function submit() {
    setError("");
    if (!selected) { setError("Selecione uma proposta salva."); return; }
    if (!clientOptIn) { setError("Confirme que o cliente deseja formalizar a proposta em contrato."); return; }
    if (!date) { setError("Informe a data de início."); return; }
    if (maintenance && indexName === "OUTRO" && !customIndex.trim()) { setError("Informe o nome do índice."); return; }
    if (maintenance && monthly.trim() && (!Number.isFinite(amount) || amount < 0)) { setError("Informe uma mensalidade válida."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/contracts/from-proposal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proposalId: selected.id, contractKind: kind, clientOptIn, monthlyValue: maintenance && monthly.trim() ? amount : 0, title: title || `${maintenance ? "Manutenção mensal" : "Contrato da proposta"} — ${selected.clientName}`, description, startDate: date, indexName: indexName === "OUTRO" ? customIndex : indexName, useAi }) });
      const data = await res.json() as { error?: string; contract?: { id: string } };
      if (!res.ok || !data.contract) throw new Error(data.error ?? "Não foi possível criar a minuta.");
      router.push(`/contratos/${data.contract.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao criar contrato."); }
    finally { setBusy(false); }
  }
  return <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
    <div className="space-y-4">
      <section className="card p-5"><Step number="01" title="Proposta de origem" subtitle="A versão escolhida ficará registrada no contrato."/><label className="mt-4 block"><span className="label-mono mb-1.5 block">Proposta</span><select className="field" value={selectedId} onChange={(e) => chooseProposal(e.target.value)}><option value="">Selecione uma proposta salva…</option>{proposals.map((p) => <option key={p.id} value={p.id}>{p.number} · Rev. {String(p.revision).padStart(2, "0")} · {p.clientName}</option>)}</select></label>{selected ? <div className="mt-3 flex flex-wrap gap-2"><span className="chip !border-signal/30 !text-signal">{selected.number} · R{String(selected.revision).padStart(2, "0")}</span><span className="chip !tracking-normal !normal-case">{selected.clientName}</span></div> : !proposals.length ? <p className="mt-3 text-[11px] text-steel">Nenhuma proposta cadastrada. <Link href="/propostas/nova" className="text-signal hover:underline">Elabore a primeira proposta →</Link></p> : null}</section>
      <section className="card p-5"><Step number="02" title="Modalidade do contrato" subtitle="Use um contrato compatível com o que foi proposto."/><div className="mt-4 grid gap-3 sm:grid-cols-2">{([{ id: "proposta", label: "Fornecimento / serviços", hint: "Instalação, produtos ou serviços avulsos. Sem cobrança mensal automática.", Icon: FileText }, { id: "manutencao", label: "Manutenção mensal", hint: "Preventiva e/ou corretiva. Mensalidade e ciclo anual de reajuste.", Icon: Wrench }] as const).map(({ id, label, hint, Icon }) => <button type="button" key={id} onClick={() => setKind(id)} className={`rounded-xl border p-3 text-left ${kind === id ? "border-signal/55 bg-signal/5" : "border-line/60 bg-abyss2/40"}`}><div className="flex items-center justify-between"><Icon size={17} className="text-signal"/>{kind === id ? <Check size={14} className="text-signal"/> : null}</div><div className="mt-2 text-[12px] font-semibold text-white">{label}</div><p className="mt-1 text-[10.5px] leading-relaxed text-steel">{hint}</p></button>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Título interno"><input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={maintenance ? "Manutenção mensal" : "Contrato da proposta"}/></Field><Field label="Início previsto"><input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)}/></Field>{maintenance ? <><Field label="Mensalidade (R$)"><input className="field" type="number" min={0} step="0.01" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="Valor mensal"/></Field><Field label="Índice pactuado"><select className="field" value={indexName} onChange={(e) => setIndexName(e.target.value)}><option>IPCA</option><option>IGP-M</option><option>INPC</option><option value="OUTRO">Outro índice</option></select></Field>{indexName === "OUTRO" ? <Field label="Nome do índice"><input className="field" value={customIndex} onChange={(e) => setCustomIndex(e.target.value)}/></Field> : null}</> : <div className="rounded-xl border border-signal/25 bg-signal/5 p-3 sm:col-span-2"><div className="label-mono">Valor total da proposta</div><div className="mt-1 font-display text-xl font-semibold text-signal">{brl((selected?.totalCents ?? 0) / 100)}</div><p className="mt-1 text-[10.5px] text-steel">Itens, desconto, pagamento, entrega e garantia são aproveitados da revisão salva. Confira no editor antes de assinar.</p></div>}<label className="block sm:col-span-2"><span className="label-mono mb-1.5 block">Complemento de escopo (opcional)</span><textarea className="field min-h-[75px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deixe vazio para usar o escopo da proposta. Se preencher, confira os limites e condições informados."/></label></div>{maintenance ? <p className="mt-3 text-[10.5px] leading-relaxed text-steel">A mensalidade considera o desconto e os itens recorrentes da proposta. Confira: compra de equipamentos não deve virar mensalidade.</p> : null}</section>
      {maintenance ? <section className="card p-5"><Step number="03" title="Compare o índice" subtitle="A escolha deve ser acordada com o cliente."/><div className="mt-4"><IndexComparisonPanel comparison={comparison} selected={indexName} onSelect={setIndexName} monthlyCents={Math.round((Number.isFinite(amount) ? amount : 0) * 100)}/></div><Link href="/manutencao" className="mt-3 inline-block text-[11px] text-signal hover:underline">Atualizar índices na carteira de manutenção →</Link></section> : null}
      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${clientOptIn ? "border-signal/40 bg-signal/5" : "border-line/60 bg-navy/30"}`}><input type="checkbox" checked={clientOptIn} onChange={(e) => setClientOptIn(e.target.checked)} className="mt-1 accent-cyan-400"/><div><span className="flex items-center gap-2 font-display text-[13px] font-semibold text-white"><FileCheck2 size={15} className="text-signal"/> O cliente deseja formalizar esta proposta em contrato</span><p className="mt-1 text-[11px] leading-relaxed text-steel">Esta confirmação autoriza apenas a elaboração da minuta. Não representa assinatura, pagamento ou aceite automático.</p></div></label>
      {error ? <div role="alert" className="rounded-lg border border-alarm/30 bg-alarm/5 p-3 text-[12px] text-alarm">{error}</div> : null}
      <div className="flex flex-wrap gap-2"><button type="button" className="btn btn-primary px-5 py-3" disabled={busy || !selectedId || !clientOptIn} onClick={submit}><Sparkles size={15}/>{busy ? "Elaborando minuta…" : "Gerar contrato para revisão"}<ArrowRight size={14}/></button><Link className="btn" href="/contratos">Cancelar</Link></div>
    </div>
    <aside className="space-y-3"><section className="card p-4"><div className="flex items-center gap-2 text-signal"><Sparkles size={16}/><span className="label-mono !text-signal">Redação assistida</span></div><p className="mt-3 text-[11.5px] leading-relaxed text-steel">A minuta aproveita o cadastro do cliente, inclusive CNPJ, a proposta escolhida e sua revisão. Você poderá editar o texto integral e baixar o PDF.</p><label className="mt-3 flex items-start gap-2 rounded-lg border border-line/50 p-2.5 text-[11px] text-silver"><input type="checkbox" checked={useAi} disabled={!aiEnabled} onChange={(e) => setUseAi(e.target.checked)} className="mt-0.5"/><span>{aiEnabled ? "Refinar a minuta com IA" : "Usar minuta estruturada"}<small className="mt-1 block text-[10px] leading-relaxed text-steel">{aiEnabled ? "Os dados do contrato serão enviados ao provedor de IA configurado." : "Configure OPENAI_API_KEY para habilitar a redação e a reescrita por IA. A edição manual permanece disponível."}</small></span></label></section><section className="rounded-xl border border-amber/25 bg-amber/5 p-4"><div className="flex items-center gap-2 font-display text-[13px] font-semibold text-amber"><Scale size={16}/> Revisão jurídica</div><p className="mt-2 text-[11px] leading-relaxed text-steel">O documento começa como rascunho. Revise dados, valores e cláusulas com um advogado antes de assinar. Nenhum serviço é ativado automaticamente.</p></section></aside>
  </div>;
}
function Step({ number, title, subtitle }: { number: string; title: string; subtitle: string }) { return <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-signal/30 bg-signal/10 font-mono text-[11px] text-signal">{number}</span><div><h2 className="font-display text-[15px] font-semibold text-white">{title}</h2><p className="text-[10.5px] text-steel">{subtitle}</p></div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="label-mono mb-1.5 block">{label}</span>{children}</label>; }
