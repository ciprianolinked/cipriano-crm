"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, CalendarClock, CheckCircle2, ChevronDown, Download, FileText, History, Save, Scale, Sparkles } from "lucide-react";
import { brl, fmtDate } from "@/lib/brand";
import { formatPct, type DerivedContract } from "@/lib/maintenance";
import { calculateIndex, contractualWindow, formatIndexPct, INDEXES, isOfficialIndex, parseManualPct, type IndexObservation } from "@/lib/indices";
import { IndexComparisonPanel } from "@/components/maintenance/IndexComparison";

export type ContractRevision = { id: string; revision: number; body: string; note: string; createdAt: string };
type Contract = DerivedContract & { contractText: string };
type Settings = { companyName: string; phone: string; email: string; cnpj: string };

export function ContractEditor({ initial, observations, revisions, aiEnabled, settings }: { initial: Contract; observations: IndexObservation[]; revisions: ContractRevision[]; aiEnabled: boolean; settings: Settings }) {
  const router = useRouter();
  const maintenance = initial.contractKind === "manutencao";
  const [contract, setContract] = useState(initial);
  const [text, setText] = useState(initial.contractText);
  const [title, setTitle] = useState(initial.title);
  const [monthly, setMonthly] = useState(String((maintenance ? initial.monthlyCents : initial.contractValueCents) / 100));
  const [startDate, setStartDate] = useState(initial.startDate.slice(0, 10));
  const [indexName, setIndexName] = useState(initial.indexName);
  const [status, setStatus] = useState(initial.status);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [instruction, setInstruction] = useState("");
  const [aiApplied, setAiApplied] = useState(false);
  const [readjustIndex, setReadjustIndex] = useState(initial.indexName);
  const [manualPct, setManualPct] = useState("");
  const [readjustNote, setReadjustNote] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [versionNote, setVersionNote] = useState("");

  useEffect(() => {
    // Atualiza cálculos e alertas recebidos após salvar, sem sobrescrever o texto em edição.
    setContract((previous) => ({ ...previous, ...initial, contractText: previous.contractText }));
  }, [initial]);

  function changed() { setDirty(true); setMessage(""); setError(""); }
  async function save() {
    setError(""); setMessage("");
    const amount = Number(monthly.replace(",", "."));
    if (!title.trim() || !Number.isFinite(amount) || amount < 0 || (maintenance && (!indexName.trim() || indexName === "OUTRO"))) { setError("Confira o título, o valor e as condições do contrato."); return; }
    let agreedChange = false;
    if (maintenance && contract.status === "ativo" && indexName !== contract.indexName) {
      agreedChange = window.confirm("A alteração do índice de um contrato ativo deve ser acordada com o cliente. Confirma que verificou isso?");
      if (!agreedChange) return;
    }
    setBusy("save");
    try {
      const res = await fetch(`/api/contracts/${contract.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, monthlyValue: maintenance ? amount : undefined, contractValue: maintenance ? undefined : amount, startDate, indexName: maintenance ? indexName : undefined, status, contractText: text, agreedChange, generationSource: aiApplied ? "ia" : "manual", revisionNote: versionNote || "Edição do contrato" }) });
      const data = await res.json() as { error?: string; contract?: { documentRevision: number; indexName: string; status: string; monthlyCents: number; nextReadjustAt: string } };
      if (!res.ok || !data.contract) throw new Error(data.error || "Erro ao salvar.");
      setContract((c) => ({ ...c, ...data.contract!, contractText: text }));
      setReadjustIndex(data.contract.indexName); setAiApplied(false); setDirty(false); setVersionNote(""); setMessage(`Contrato salvo. Versão ${String(data.contract.documentRevision).padStart(2, "0")}.`); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Erro ao salvar."); }
    finally { setBusy(""); }
  }

  async function rewrite() {
    if (!instruction.trim()) { setError("Descreva o que deseja alterar na minuta."); return; }
    setBusy("ai"); setError(""); setMessage("");
    try {
      const res = await fetch(`/api/contracts/${contract.id}/rewrite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, instruction, indexName }) });
      const data = await res.json() as { text?: string; error?: string };
      if (!res.ok || !data.text) throw new Error(data.error ?? "A IA não retornou uma minuta.");
      setText(data.text); setAiApplied(true); setDirty(true); setMessage("Texto reescrito. Revise as alterações e salve para registrar a versão.");
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível reescrever."); }
    finally { setBusy(""); }
  }

  async function applyReadjust() {
    if (dirty) { setError("Salve as alterações do contrato antes de aplicar o reajuste."); return; }
    if (readjustIndex !== contract.indexName && !agreed) { setError("Confirme que a alteração de índice foi acordada com o cliente."); return; }
    if (!window.confirm("Confirma a aplicação deste reajuste à mensalidade atual? Confira o percentual e a vigência antes de continuar.")) return;
    setBusy("readjust"); setError(""); setMessage("");
    try {
      const res = await fetch(`/api/maintenance/${contract.id}/readjust`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ indexName: readjustIndex, manualPct, note: readjustNote, agreedChange: agreed }) });
      const data = await res.json() as { error?: string; newCents?: number };
      if (!res.ok) throw new Error(data.error ?? "Não foi possível aplicar o reajuste.");
      setMessage(`Reajuste aplicado. Nova mensalidade: ${brl((data.newCents ?? 0) / 100)}. Atualizando o contrato...`);
      window.location.reload();
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível aplicar o reajuste."); }
    finally { setBusy(""); }
  }

  async function downloadPdf() {
    setBusy("pdf"); setError("");
    try {
      const [{ jsPDF }, pdfKit] = await Promise.all([import("jspdf"), import("@/lib/pdf-documents")]);
      const logo = await pdfKit.loadBrandLogo();
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
      pdfKit.renderContractPdf(pdf, {
        text,
        title: maintenance ? "Contrato de manutencao mensal" : "Contrato de fornecimento e/ou servicos",
        reference: contract.proposalNumber || contract.title,
        clientName: contract.clientName,
        revision: contract.documentRevision,
        maintenance,
        settings: {
          companyName: settings.companyName, legalName: settings.companyName, tagline: "",
          director: "", role: "", phone: settings.phone, landline: "", email: settings.email,
          site: "ciprianotech.com.br", address: "", cnpj: settings.cnpj, crea: "", hours: "",
        },
        logo,
      });
      pdf.save(`contrato-${(contract.proposalNumber || contract.clientName).replace(/[^a-z0-9-]/gi, "-")}-rev${String(contract.documentRevision).padStart(2, "0")}.pdf`);
    } catch {
      setError("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setBusy("");
    }
  }

  const manual = parseManualPct(manualPct);
  const autoValue = isOfficialIndex(readjustIndex)
    ? calculateIndex(readjustIndex, contractualWindow(contract.nextReadjustAt).months, observations).accumulatedPct
    : null;
  const chosenPct = manualPct.trim() ? manual : autoValue;
  const projected = chosenPct !== null ? Math.round(contract.monthlyCents * (1 + chosenPct / 100)) : null;

  return <div className="mx-auto max-w-[1500px] px-4 py-6 lg:px-7 lg:py-7">
    <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3"><div><Link href="/contratos" className="inline-flex items-center gap-1.5 text-[11px] text-steel hover:text-signal"><ArrowLeft size={13}/> Voltar à carteira</Link><div className="mt-3 flex flex-wrap items-center gap-2"><span className="label-mono !text-signal">{maintenance ? "Contrato de manutenção" : "Contrato da proposta"}</span><span className="chip !border-signal/30 !text-signal">Rev. {String(contract.documentRevision).padStart(2, "0")}</span><span className="chip">{contract.status}</span></div><h1 className="mt-2 font-display text-[clamp(1.5rem,2.5vw,2rem)] font-semibold tracking-tight text-white">{contract.clientName}</h1><div className="mt-1 text-[11.5px] text-steel">{contract.proposalNumber ? <>Proposta de origem: <Link href={`/propostas/${contract.proposalId}`} className="text-signal hover:underline">{contract.proposalNumber} · Rev. {String(contract.proposalRevision ?? 1).padStart(2, "0")} <ArrowUpRight size={11} className="inline"/></Link></> : "Contrato sem proposta vinculada"}</div></div><div className="flex flex-wrap items-center gap-2"><span className={`mr-1 text-[10.5px] ${dirty ? "text-amber" : "text-steel"}`}>{dirty ? "Alterações não salvas" : "Tudo salvo"}</span><button className="btn" disabled={busy !== "" || !text.trim()} onClick={downloadPdf}><Download size={14}/>{busy === "pdf" ? "Gerando..." : "Baixar PDF"}</button><button className="btn btn-primary" disabled={busy !== ""} onClick={save}><Save size={14}/>{busy === "save" ? "Salvando..." : "Salvar alterações"}</button></div></div>
    {error ? <div role="alert" className="mb-3 rounded-lg border border-alarm/40 bg-alarm/5 p-3 text-[11.5px] text-alarm">{error}</div> : null}{message ? <div role="status" className="mb-3 rounded-lg border border-armed/30 bg-armed/5 p-3 text-[11.5px] text-silver">{message}</div> : null}
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <section className="card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/50 px-5 py-4"><div><div className="label-mono text-signal">Documento editável</div><h2 className="mt-1 font-display text-[15px] font-semibold text-white">Minuta do contrato</h2></div><span className="text-[10.5px] text-steel">Clique no texto para editar qualquer cláusula</span></div><div className="bg-[#091626] p-3 sm:p-5"><div className="mx-auto max-w-[820px] overflow-hidden rounded-sm bg-white shadow-xl"><div className="flex items-center justify-between border-b-[3px] border-[#00d4eb] bg-[#0a192f] px-6 py-4">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/logo-cipriano.svg" alt="Cipriano Tech & Security" style={{ width: 190, height: "auto" }} /><div className="text-right font-mono text-[8px] uppercase tracking-wider text-[#91a6bc]">Minuta contratual<br/>Revisão {String(contract.documentRevision).padStart(2, "0")}</div></div><textarea aria-label="Texto integral do contrato" spellCheck className="min-h-[1050px] w-full resize-y border-0 bg-white px-6 py-6 font-sans text-[12.5px] leading-[1.8] text-[#283a50] outline-none sm:px-10" value={text} onChange={(e) => { setText(e.target.value); setAiApplied(false); changed(); }} placeholder="Digite ou cole aqui o texto integral do contrato. Para gerar uma minuta com base em uma proposta, crie um novo contrato a partir dela."/></div></div><div className="border-t border-line/40 px-5 py-3 text-[10.5px] leading-relaxed text-steel">Os campos entre colchetes são pendências para preencher. Ao salvar, a versão anterior do texto é guardada no histórico.</div></section>
        {maintenance ? <section id="reajuste" className="card p-5 scroll-mt-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="label-mono text-signal">Planejamento anual</div><h2 className="mt-1 font-display text-[16px] font-semibold text-white">Compare e escolha o reajuste</h2><p className="mt-1 text-[11px] text-steel">Próximo aniversário: {fmtDate(contract.nextReadjustAt)} · mensalidade atual {brl(contract.monthlyCents / 100)}</p></div><span className={`chip ${contract.alert ? "!border-amber/40 !text-amber" : "!border-line"}`}><CalendarClock size={11}/>{contract.overdue ? "Aguardando aplicação" : `em ${contract.daysToReadjust} dias`}</span></div><div className="mt-4"><IndexComparisonPanel comparison={contract.comparison} selected={readjustIndex} onSelect={setReadjustIndex} monthlyCents={contract.monthlyCents}/></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><Field label="Índice para este reajuste"><select className="field" value={isOfficialIndex(readjustIndex) ? readjustIndex : "OUTRO"} onChange={(e) => setReadjustIndex(e.target.value === "OUTRO" ? "OUTRO" : e.target.value)}>{INDEXES.map((i) => <option key={i.id} value={i.id}>{i.id} · {i.publisher}</option>)}<option value="OUTRO">Outro índice (manual)</option></select></Field><Field label="Percentual acumulado manual (opcional)"><input className="field" value={manualPct} onChange={(e) => setManualPct(e.target.value)} placeholder="Deixe vazio para usar o índice oficial"/></Field>{!isOfficialIndex(readjustIndex) ? <Field label="Nome do índice"><input className="field" value={readjustIndex === "OUTRO" ? "" : readjustIndex} onChange={(e) => setReadjustIndex(e.target.value || "OUTRO")} placeholder="Nome do índice"/></Field> : null}<Field label="Observação do reajuste"><input className="field" value={readjustNote} onChange={(e) => setReadjustNote(e.target.value)} placeholder="Ex.: acordo comunicado ao cliente"/></Field></div>{readjustIndex !== contract.indexName ? <label className="mt-3 flex items-start gap-2 rounded-lg border border-amber/30 bg-amber/5 p-2.5 text-[11px] leading-relaxed text-silver"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5"/> Confirmo que a mudança do índice pactuado foi acordada com o cliente. Atualize também a cláusula da minuta.</label> : null}<div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/60 bg-abyss2/50 p-3"><div><div className="label-mono">Valor simulado {chosenPct !== null ? `· ${formatIndexPct(chosenPct)}` : ""}</div><div className="mt-1 font-display text-[17px] font-semibold text-white">{projected !== null ? `${brl(projected / 100)} / mês` : "Aguardando dados do período"}</div><div className="mt-1 text-[10px] text-steel">{contract.daysToReadjust > 0 ? "Simulação: o reajuste pode ser aplicado a partir do aniversário." : "Confira o contrato e as condições antes de aplicar."}</div></div><button className="btn btn-primary" disabled={busy !== "" || contract.daysToReadjust > 0 || contract.status !== "ativo" || chosenPct === null} onClick={applyReadjust}><CheckCircle2 size={14}/> Aplicar reajuste</button></div><p className="mt-2 text-[10.5px] leading-relaxed text-steel">Para usar outro índice, insira o percentual acumulado manualmente. A alteração de um índice contratado depende de acordo; os percentuais negativos não são ignorados automaticamente.</p></section> : null}
      </div>
      <aside className="space-y-3"><section className="rounded-xl border border-signal/25 bg-gradient-to-br from-[#0c3040] via-[#0a2035] to-[#071624] p-4"><div className="flex items-center gap-2 text-signal"><Sparkles size={16}/><span className="label-mono !text-signal">Assistente de redação</span></div><h2 className="mt-2 font-display text-[15px] font-semibold text-white">Refaça com suas alterações</h2><p className="mt-1.5 text-[11px] leading-relaxed text-steel">Edite o texto ao lado ou descreva o que deve mudar. A IA considera a versão atual, inclusive suas edições ainda não salvas.</p><textarea className="field mt-3 min-h-[95px] text-[11.5px] leading-relaxed" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Ex.: alterar a frequência para visita trimestral e incluir atendimento remoto."/><button className="btn btn-primary mt-2 w-full" disabled={busy !== "" || !text.trim()} onClick={rewrite}><Sparkles size={14}/>{busy === "ai" ? "Redigindo..." : "Redigir novamente com IA"}</button><p className="mt-2 text-[10px] leading-relaxed text-steel">{aiEnabled ? "O texto do contrato e suas instruções serão enviados ao provedor de IA configurado." : "IA generativa indisponível: configure OPENAI_API_KEY no servidor. A edição manual continua disponível."}</p></section>
        <section className="card p-4"><div className="label-mono text-signal">Controle do contrato</div><h2 className="mt-1 font-display text-[14px] font-semibold text-white">Dados e vigência</h2><div className="mt-3 space-y-2.5">
          <Field label="Título"><input className="field" value={title} onChange={(e) => { setTitle(e.target.value); changed(); }}/></Field>
          <Field label={maintenance ? "Mensalidade (R$)" : "Valor total contratado (R$)"}><input className="field" type="number" min="0" step="0.01" value={monthly} onChange={(e) => { setMonthly(e.target.value); changed(); }}/></Field>
          <Field label="Início previsto"><input className="field" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); changed(); }}/></Field>
          {maintenance ? <><Field label="Índice pactuado"><select className="field" value={isOfficialIndex(indexName) ? indexName : "OUTRO"} onChange={(e) => { setIndexName(e.target.value === "OUTRO" ? "OUTRO" : e.target.value); changed(); }}>{INDEXES.map((i) => <option key={i.id} value={i.id}>{i.id}</option>)}<option value="OUTRO">Outro índice</option></select></Field>{!isOfficialIndex(indexName) ? <Field label="Nome do índice"><input className="field" value={indexName === "OUTRO" ? "" : indexName} onChange={(e) => { setIndexName(e.target.value || "OUTRO"); changed(); }}/></Field> : null}</> : <p className="rounded-lg border border-line/40 p-2 text-[10.5px] leading-relaxed text-steel">Contrato de fornecimento/serviço. Não participa da receita mensal nem dos alertas automáticos de reajuste.</p>}
          <Field label="Situação"><select className="field" value={status} onChange={(e) => { setStatus(e.target.value); changed(); }}><option value="rascunho">Rascunho</option><option value="ativo">Ativo</option><option value="suspenso">Suspenso</option></select></Field>
          <p className="text-[10px] leading-relaxed text-steel">Alterar os dados de controle não modifica automaticamente a redação. Confira as cláusulas e combine mudanças com o cliente. Ative somente após a formalização.</p>
        </div></section>
        <section className="card p-4"><button className="flex w-full items-center justify-between text-left" onClick={() => setShowHistory(!showHistory)}><span className="flex items-center gap-2 font-display text-[14px] font-semibold text-white"><History size={15} className="text-signal"/> Histórico de versões <span className="chip">{revisions.length}</span></span><ChevronDown size={15} className={`text-steel transition ${showHistory ? "rotate-180" : ""}`}/></button>{showHistory ? <div className="mt-3 space-y-2"><Field label="Nota para a próxima versão"><input className="field" value={versionNote} onChange={(e) => setVersionNote(e.target.value)} placeholder="Motivo da alteração"/></Field>{revisions.length ? revisions.map((r) => <div key={r.id} className="rounded-lg border border-line/50 bg-abyss2/40 p-2.5"><div className="flex justify-between text-[11px]"><span className="text-signal">Rev. {String(r.revision).padStart(2, "0")}</span><span className="text-steel">{fmtDate(r.createdAt)}</span></div><p className="mt-1 text-[10.5px] text-steel">{r.note || "Versão anterior"}</p><button className="mt-1.5 text-[10.5px] text-signal hover:underline" onClick={() => { setText(r.body); setAiApplied(false); changed(); setMessage("Versão carregada no editor. Salve para registrar a restauração."); }}>Carregar no editor</button></div>) : <p className="text-[10.5px] text-steel">As versões anteriores aparecerão aqui após salvar alterações no texto.</p>}</div> : null}</section>
        <section className="rounded-xl border border-amber/25 bg-amber/5 p-4"><div className="flex items-center gap-2 text-amber"><Scale size={15}/><span className="font-display text-[13px] font-semibold">Revise antes de assinar</span></div><p className="mt-2 text-[10.5px] leading-relaxed text-steel">Esta minuta é apoio à redação e não substitui a revisão de um advogado. Confirme dados, abrangência, reajuste e validade das cláusulas.</p></section>
        {maintenance && contract.readjusts.length ? <section className="card p-4"><div className="label-mono">Reajustes registrados</div><div className="mt-2 space-y-2">{contract.readjusts.slice(0, 5).map((r) => <div key={r.id} className="rounded-lg border border-line/40 p-2 text-[10.5px]"><div className="flex justify-between text-silver"><span>{r.indexName} · {r.percentMilli !== null ? formatIndexPct(r.percentMilli / 1000) : formatPct(r.ipcaPct)}</span><span className="text-steel">{fmtDate(r.readjustAt)}</span></div><p className="mt-1 text-steel">{brl(r.oldMonthlyCents / 100)} → <b className="text-armed">{brl(r.newMonthlyCents / 100)}</b> · {r.source}</p></div>)}</div></section> : null}
      </aside>
    </div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="label-mono mb-1.5 block">{label}</span>{children}</label>; }
