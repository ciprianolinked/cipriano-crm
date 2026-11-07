"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Check, FileCheck2, FileText, LoaderCircle, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { brl } from "@/lib/brand";
import { PRIORITIES, SEGMENTS, defaultBriefing } from "@/lib/proposal/catalog";
import { defaultMaintenancePlan, maintenanceSummary, validateMaintenancePlan } from "@/lib/proposal/maintenance-plan";
import { MaintenancePlanFields } from "@/components/proposal/MaintenancePlanFields";
import { PROPOSAL_TYPES, type Briefing, type MaintenancePlan, type ProposalDraft, type ProposalType, type Totals } from "@/lib/proposal/types";
import type { Insight } from "@/lib/ai";

type ClientOption = { id: string; name: string; contactName: string | null; email: string | null; address: string | null; city: string | null; state: string | null };
type Preview = { draft: ProposalDraft; totals: Totals; insights: Insight[]; aiNote: string; error?: string };

export function NewProposalWizard({ clients, aiEnabled = false }: { clients: ClientOption[]; aiEnabled?: boolean }) {
  const router = useRouter();
  const [purpose, setPurpose] = useState<"projeto" | "manutencao_mensal">("projeto");
  const [type, setType] = useState<ProposalType>("completa");
  const [info, setInfo] = useState({ clientId: "", clientName: "", contact: "", clientEmail: "", site: "", validityDays: 15, artIncluded: true });
  const [briefing, setBriefing] = useState<Briefing>(defaultBriefing);
  const [plan, setPlan] = useState<MaintenancePlan>(defaultMaintenancePlan);
  const [rawNotes, setRawNotes] = useState("");
  const [wantsContract, setWantsContract] = useState(false);
  const [polish, setPolish] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const maintenance = purpose === "manutencao_mensal";
  function invalidate() { setPreview(null); setError(""); }
  function updateInfo(patch: Partial<typeof info>) { setInfo((p) => ({ ...p, ...patch })); invalidate(); }
  function updateBriefing(patch: Partial<Briefing>) { setBriefing((p) => ({ ...p, ...patch })); invalidate(); }
  function applyClient(id: string) {
    const c = clients.find((p) => p.id === id);
    if (!c) { updateInfo({ clientId: "", clientName: "", contact: "", clientEmail: "", site: "" }); return; }
    updateInfo({ clientId: id, clientName: c.name, contact: c.contactName ?? "", clientEmail: c.email ?? "", site: [c.address, [c.city, c.state].filter(Boolean).join("/")].filter(Boolean).join(" — ") });
  }
  async function generate() {
    setError("");
    if (!info.clientName.trim()) { setError("Informe o nome do cliente."); return; }
    if (info.validityDays < 1 || info.validityDays > 365) { setError("A validade deve ser de 1 a 365 dias."); return; }
    if (maintenance) { try { validateMaintenancePlan(plan); } catch (err) { setError(err instanceof Error ? err.message : "Confira a manutenção."); return; } }
    setLoading(true);
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...info, type, polish, artIncluded: maintenance ? false : info.artIncluded, briefing: { ...briefing, purpose, wantsContract, ...(maintenance ? { maintenance: true, maintenancePlan: plan } : {}), rawNotes } }) });
      const data = await res.json() as Preview;
      if (!res.ok || !data.draft) throw new Error(data.error || "Não foi possível gerar. Tente novamente.");
      setPreview(data);
    } catch (err) { setError(err instanceof Error ? err.message : "Falha de conexão."); }
    finally { setLoading(false); }
  }
  async function save(status: "novo" | "enviada") {
    if (!preview) return;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/proposals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, clientId: info.clientId || null, status, draft: { ...preview.draft, briefing: { ...preview.draft.briefing, wantsContract } } }) });
      const data = await res.json() as { proposal?: { id: string }; error?: string };
      if (!res.ok || !data.proposal) throw new Error(data.error || "Não foi possível salvar a proposta.");
      router.push(wantsContract ? `/contratos/novo?proposta=${data.proposal.id}` : `/propostas/${data.proposal.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao salvar."); }
    finally { setSaving(false); }
  }
  const monthly = preview ? maintenanceSummary(preview.draft.items, preview.draft.discountPct, preview.draft.briefing) : null;

  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
    <div className="space-y-4">
      <section className="card p-5"><div className="label-mono text-signal">Etapa 1 · objetivo</div><h2 className="mt-1 font-display text-lg font-semibold text-white">Qual proposta vamos elaborar?</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{([{ id: "projeto", title: "Projeto, produtos ou serviços", text: "Fornecimento, instalação ou serviço avulso.", Icon: FileText }, { id: "manutencao_mensal", title: "Manutenção mensal", text: "Preventiva e corretiva, com cobrança recorrente.", Icon: Wrench }] as const).map(({ id, title, text, Icon }) => <button type="button" key={id} className={`rounded-xl border p-4 text-left transition hover:border-signal/50 ${purpose === id ? "border-signal/55 bg-signal/[0.07]" : "border-line/60 bg-abyss2/40"}`} onClick={() => { setPurpose(id); invalidate(); }}><div className="flex items-center justify-between"><Icon size={19} className={purpose === id ? "text-signal" : "text-steel"}/>{purpose === id ? <Check size={15} className="text-signal"/> : null}</div><div className="mt-3 font-display text-[14px] font-semibold text-white">{title}</div><p className="mt-1 text-[11px] leading-relaxed text-steel">{text}</p></button>)}</div><div className="mt-5 border-t border-line/40 pt-4"><div className="label-mono mb-2">Formato do documento</div><div className="grid gap-2 sm:grid-cols-3">{PROPOSAL_TYPES.map((t) => <button type="button" key={t.id} onClick={() => { setType(t.id); invalidate(); }} className={`rounded-lg border p-3 text-left ${type === t.id ? "border-signal/50 bg-signal/5" : "border-line/50"}`}><div className={`text-[12px] font-medium ${type === t.id ? "text-signal" : "text-silver"}`}>{t.short}</div><p className="mt-1 text-[10px] leading-relaxed text-steel">{t.id === "completa" ? "Escopo e condições detalhados" : t.id === "simples" ? "Uma apresentação objetiva" : "Orçamento com itens e condições"}</p></button>)}</div></div></section>
      <section className="card p-5"><div className="label-mono text-signal">Etapa 2 · destinatário</div><h2 className="mt-1 font-display text-lg font-semibold text-white">Cliente e local</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="label-mono mb-1.5 block">Cliente cadastrado</span><select className="field" value={info.clientId} onChange={(e) => applyClient(e.target.value)}><option value="">Digitar cliente manualmente</option>{clients.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select><p className="mt-1.5 text-[10.5px] text-steel">Precisa buscar os dados da empresa? <Link href="/clientes" className="text-signal hover:underline">Cadastre pelo CNPJ em Clientes →</Link></p></label><Field label="Nome do cliente *"><input className="field" value={info.clientName} onChange={(e) => updateInfo({ clientName: e.target.value })} placeholder="Nome do cliente"/></Field><Field label="Contato / cargo"><input className="field" value={info.contact} onChange={(e) => updateInfo({ contact: e.target.value })} placeholder="Responsável"/></Field><Field label="E-mail"><input className="field" type="email" value={info.clientEmail} onChange={(e) => updateInfo({ clientEmail: e.target.value })}/></Field><Field label="Local da prestação de serviços"><input className="field" value={info.site} onChange={(e) => updateInfo({ site: e.target.value })}/></Field><Field label="Validade da proposta (dias)"><input className="field" type="number" min={1} max={365} value={info.validityDays} onChange={(e) => updateInfo({ validityDays: Number(e.target.value) })}/></Field>{!maintenance ? <label className="flex items-center gap-2 text-[12px] text-silver"><input type="checkbox" checked={info.artIncluded} onChange={(e) => updateInfo({ artIncluded: e.target.checked })}/>Incluir ART / projeto executivo</label> : null}</div></section>
      <section className="card p-5"><div className="label-mono text-signal">Etapa 3 · escopo e valores</div><h2 className="mt-1 font-display text-lg font-semibold text-white">{maintenance ? "Plano de manutenção mensal" : "Briefing técnico"}</h2><p className="mt-1 mb-4 text-[11px] leading-relaxed text-steel">{maintenance ? "Defina o que está incluído, os limites de atendimento e o valor de cada mês." : "Informe as quantidades e tecnologias previstas para este projeto."}</p>{maintenance ? <MaintenancePlanFields value={plan} onChange={(p) => { setPlan(p); invalidate(); }}/> : <><div className="grid grid-cols-2 gap-3">{([["cameras", "Câmeras IP"], ["doors", "Portas com acesso"], ["fenceMeters", "Perímetro (m)"]] as const).map(([key, label]) => <Field key={key} label={label}><input className="field" type="number" min={0} value={briefing[key]} onChange={(e) => updateBriefing({ [key]: Number(e.target.value) })}/></Field>)}<Field label="Segmento"><select className="field" value={briefing.segment} onChange={(e) => updateBriefing({ segment: e.target.value })}>{SEGMENTS.map((s) => <option key={s}>{s}</option>)}</select></Field></div><div className="mt-3 flex flex-wrap gap-2">{([["monitoring", "Monitoramento"], ["alarm", "Alarme"], ["intercom", "Interfonia"], ["network", "Rede / rack"], ["maintenance", "Adicionar manutenção"]] as const).map(([key, label]) => <button type="button" key={key} onClick={() => updateBriefing({ [key]: !briefing[key] })} className={`chip ${briefing[key] ? "!border-signal/50 !text-signal bg-signal/10" : ""}`}>{briefing[key] ? "✓ " : "+ "}{label}</button>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Prioridade"><select className="field" value={briefing.priority} onChange={(e) => updateBriefing({ priority: e.target.value as Briefing["priority"] })}>{PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field><Field label="Informações adicionais"><textarea className="field min-h-[75px]" value={rawNotes} onChange={(e) => { setRawNotes(e.target.value); invalidate(); }} placeholder="Descrição da necessidade do cliente"/></Field></div></>}</section>
      <section className="card p-4"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" className="mt-1 accent-cyan-400" checked={wantsContract} onChange={(e) => setWantsContract(e.target.checked)}/><span><span className="flex items-center gap-2 font-display text-[14px] font-semibold text-white"><FileCheck2 size={16} className="text-signal"/> Elaborar contrato após salvar (opcional)</span><span className="mt-1 block text-[11px] leading-relaxed text-steel">Marque se o cliente deseja formalizar a proposta em contrato. Você revisará a minuta em uma etapa separada; nada é ativado ou enviado automaticamente.</span></span></label></section>
      {aiEnabled ? <label className="flex items-center gap-2 text-[11px] text-steel"><input type="checkbox" checked={polish} onChange={(e) => { setPolish(e.target.checked); invalidate(); }}/> Refinar a redação do escopo com a IA configurada no servidor.</label> : null}
      {error ? <div role="alert" className="rounded-lg border border-alarm/35 bg-alarm/5 p-3 text-[12px] text-alarm">{error}</div> : null}
      <div className="flex gap-2"><button type="button" className="btn btn-primary px-5 py-3" disabled={loading || saving} onClick={generate}>{loading ? <LoaderCircle size={15} className="animate-spin"/> : <Sparkles size={15}/>} {loading ? "Elaborando…" : preview ? "Gerar novamente" : "Elaborar proposta"}</button><Link href="/propostas" className="btn">Cancelar</Link></div>
    </div>
    <aside className="space-y-4 xl:sticky xl:top-5"><section className="card overflow-hidden"><div className="border-b border-line/50 p-4"><div className="label-mono text-signal">Resumo</div><h2 className="mt-1 font-display text-[16px] font-semibold text-white">{maintenance ? "Sua proposta de manutenção" : "Sua proposta comercial"}</h2></div><div className="p-4">{preview ? <div className="space-y-4"><div className="rounded-xl border border-signal/25 bg-signal/5 p-4"><div className="label-mono">{maintenance ? "Mensalidade" : "Investimento total"}</div><div className="mt-1 font-display text-[25px] font-semibold text-signal">{brl((maintenance ? monthly!.monthlyCents : preview.totals.totalCents) / 100)}{maintenance ? <span className="ml-1 text-sm font-normal text-steel">/mês</span> : null}</div><div className="mt-2 text-[11px] text-steel">{maintenance ? `${monthly!.months} meses · total do período ${brl(monthly!.totalCents / 100)}` : `${preview.draft.items.length} itens · ${preview.draft.discountPct}% de desconto`}</div></div><div className="space-y-2">{preview.insights.map((i) => <div key={i.title} className="rounded-lg border border-line/50 bg-abyss2/40 p-3"><div className="text-[11.5px] font-medium text-silver">{i.title}</div><p className="mt-1 text-[10.5px] leading-relaxed text-steel">{i.detail}</p></div>)}</div><p className="text-[10.5px] leading-relaxed text-steel">{preview.aiNote}</p><div className="flex flex-wrap gap-1">{preview.draft.sections.filter((s) => s.enabled).map((s) => <span key={s.id} className="chip !text-[8px] !tracking-normal !normal-case">{s.title}</span>)}</div><div className="space-y-2"><button type="button" className="btn btn-primary w-full" disabled={saving || loading} onClick={() => save("novo")}>{saving ? "Salvando…" : wantsContract ? "Salvar e preparar contrato" : "Salvar rascunho e editar"}<ArrowRight size={14}/></button><button type="button" className="btn w-full" disabled={saving || loading} onClick={() => save("enviada")}>Salvar e marcar como enviada</button><p className="text-[10px] leading-relaxed text-steel">“Enviada” é apenas uma etapa do CRM. O sistema não envia e-mail ao cliente.</p></div></div> : <div className="flex min-h-[170px] flex-col items-center justify-center text-center"><FileText size={26} className="text-steel/60"/><p className="mt-3 text-[12px] text-silver">Preencha os dados e elabore a proposta.</p><p className="mt-1 text-[11px] leading-relaxed text-steel">Os valores e blocos aparecem aqui antes de salvar.</p></div>}</div></section><section className="rounded-xl border border-line/60 bg-navy/30 p-4"><ShieldCheck size={18} className="text-signal"/><h3 className="mt-2 font-display text-[14px] font-semibold text-white">Você revisa antes de formalizar</h3><p className="mt-2 text-[11px] leading-relaxed text-steel">Proposta e contrato são documentos separados. Gere o contrato somente se o cliente optar, ajuste as cláusulas e consulte um advogado antes de assinar.</p></section></aside>
  </div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="label-mono mb-1.5 block">{label}</span>{children}</label>; }
