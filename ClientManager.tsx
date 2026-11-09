"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Building2, CheckCircle2, FilePenLine, LoaderCircle, Plus, Search, UserRound, X } from "lucide-react";
import { brl } from "@/lib/brand";
import { formatCnpj, isValidCnpj, normalizeDocument, type CnpjCompany } from "@/lib/cnpj";

export type ClientRecord = {
  id: string; name: string; company: string | null; contactName: string | null; email: string | null;
  phone: string | null; document: string | null; address: string | null; city: string | null; state: string | null;
  segment: string | null; source: string | null; notes: string | null; proposals: number; pipelineCents: number;
};
const emptyForm = { name: "", company: "", contactName: "", email: "", phone: "", document: "", address: "", city: "", state: "", segment: "", source: "", notes: "" };
type FormState = typeof emptyForm;
const fields: [keyof FormState, string, string][] = [
  ["name", "Nome / nome fantasia *", "Como você identifica o cliente"], ["company", "Razão social", "Nome registrado da empresa"],
  ["contactName", "Contato / cargo", "Nome da pessoa responsável"], ["email", "E-mail", "E-mail para contato"],
  ["phone", "Telefone / WhatsApp", "Telefone comercial"], ["address", "Endereço completo", "Logradouro, número, complemento, bairro e CEP"],
  ["city", "Cidade", "Cidade"], ["state", "UF", "UF"], ["segment", "Segmento / atividade", "Atividade da empresa"], ["source", "Origem do lead", "Como o cliente chegou até você"],
];

export function ClientManager({ clients }: { clients: ClientRecord[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"cnpj" | "manual">("cnpj");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [looking, setLooking] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const [lookupOk, setLookupOk] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const lastConsulted = useRef("");
  const inFlight = useRef("");

  const filtered = clients.filter((c) => [c.name, c.company, c.city, c.segment, c.contactName, c.document, normalizeDocument(c.document ?? "")].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase()));

  function cancelLookup() { requestId.current++; controller.current?.abort(); inFlight.current = ""; setLooking(false); }
  function setField(key: keyof FormState, value: string) { setForm((prev) => ({ ...prev, [key]: value })); setError(""); }
  function startNew() { cancelLookup(); setForm(emptyForm); setEditingId(null); setOpen(true); setMode("cnpj"); setLookupMessage(""); setLookupOk(false); setError(""); lastConsulted.current = ""; }
  function close() { cancelLookup(); setOpen(false); }

  async function lookup(force = false) {
    const cnpj = normalizeDocument(form.document);
    if (!isValidCnpj(cnpj)) { setLookupOk(false); setLookupMessage("Confira o CNPJ informado ou escolha Cadastro manual. O documento não é obrigatório para salvar."); return; }
    if (inFlight.current === cnpj || (!force && lastConsulted.current === cnpj)) return;
    cancelLookup();
    const currentId = ++requestId.current;
    const abort = new AbortController(); controller.current = abort; inFlight.current = cnpj;
    setLooking(true); setLookupMessage(""); setLookupOk(false);
    try {
      const res = await fetch(`/api/cnpj/${cnpj}`, { signal: abort.signal, cache: "no-store" });
      const data = await res.json() as { company?: CnpjCompany; source?: string; error?: string };
      if (currentId !== requestId.current) return;
      if (!res.ok || !data.company) throw new Error(data.error || "Não foi possível consultar. Preencha os campos manualmente.");
      const c = data.company;
      setForm((prev) => {
        if (normalizeDocument(prev.document) !== cnpj) return prev;
        const next = { ...prev, document: c.document };
        for (const key of ["name", "company", "address", "city", "state", "email", "phone", "segment"] as const) {
          if (!prev[key].trim() && c[key]) next[key] = c[key];
        }
        return next;
      });
      lastConsulted.current = cnpj;
      setLookupOk(true);
      setLookupMessage(`Dados encontrados via ${data.source ?? "BrasilAPI"}${c.registrationStatus ? ` · situação: ${c.registrationStatus}` : ""}. Preenchemos os campos vazios. Confira os dados antes de salvar; a base pública pode estar desatualizada.`);
    } catch (err) {
      if (abort.signal.aborted || currentId !== requestId.current) return;
      setLookupOk(false); setLookupMessage(err instanceof Error ? err.message : "Consulta indisponível. Continue manualmente.");
    } finally {
      if (currentId === requestId.current) { setLooking(false); inFlight.current = ""; }
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (!form.name.trim()) { setError("Informe o nome do cliente."); return; }
    setBusy(true);
    try {
      const res = await fetch(editingId ? `/api/clients/${editingId}` : "/api/clients", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar. Seus dados foram mantidos no formulário.");
      cancelLookup(); setForm(emptyForm); setEditingId(null); setOpen(false); setFlash("Cliente salvo com sucesso."); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao salvar. Tente novamente."); }
    finally { setBusy(false); }
  }
  function edit(c: ClientRecord) { cancelLookup(); setEditingId(c.id); setOpen(true); setMode("manual"); setError(""); setLookupMessage(""); setLookupOk(false); lastConsulted.current = ""; setForm({ name: c.name, company: c.company ?? "", contactName: c.contactName ?? "", email: c.email ?? "", phone: c.phone ?? "", document: c.document ?? "", address: c.address ?? "", city: c.city ?? "", state: c.state ?? "", segment: c.segment ?? "", source: c.source ?? "", notes: c.notes ?? "" }); }
  async function remove(c: ClientRecord) {
    if (!window.confirm(`Excluir o cadastro de ${c.name}? As propostas já emitidas serão preservadas.`)) return;
    try { const res = await fetch(`/api/clients/${c.id}`, { method: "DELETE" }); if (!res.ok) throw new Error(); router.refresh(); setFlash("Cadastro removido."); } catch { setFlash("Não foi possível excluir. Tente novamente."); }
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="relative w-full max-w-sm"><Search size={15} className="absolute left-3 top-3 text-steel"/><input aria-label="Buscar clientes" className="field !pl-9" placeholder="Buscar nome, CNPJ ou cidade…" value={query} onChange={(e) => setQuery(e.target.value)}/></div><div className="flex items-center gap-3"><span className="font-mono text-[10px] text-steel">{filtered.length} clientes</span><button type="button" className="btn btn-primary" onClick={startNew}><Plus size={15}/> Cadastrar cliente</button></div></div>
    {flash ? <div role="status" className="rounded-lg border border-armed/25 bg-armed/5 p-3 text-[12px] text-silver">{flash}</div> : null}
    {open ? <form onSubmit={submit} className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line/50 px-5 py-4"><div><div className="label-mono text-signal">Base comercial</div><h2 className="mt-1 font-display text-lg font-semibold text-white">{editingId ? "Editar cliente" : "Novo cliente"}</h2></div><button type="button" onClick={close} aria-label="Fechar cadastro" className="rounded-lg p-2 text-steel hover:bg-navy2 hover:text-white"><X size={18}/></button></div>
      <div className="p-5">
        <div className="mb-4 flex flex-wrap gap-2"><button type="button" className={`btn ${mode === "cnpj" ? "!border-signal/50 !bg-signal/10 !text-signal" : ""}`} onClick={() => setMode("cnpj")}><Building2 size={14}/> Buscar por CNPJ</button><button type="button" className={`btn ${mode === "manual" ? "!border-signal/50 !bg-signal/10 !text-signal" : ""}`} onClick={() => { cancelLookup(); setMode("manual"); }}><FilePenLine size={14}/> Cadastro manual</button></div>
        <div className={`mb-5 rounded-xl border p-4 ${mode === "cnpj" ? "border-signal/25 bg-signal/[0.04]" : "border-line/50 bg-abyss2/35"}`}>
          <div className="flex flex-wrap items-end gap-3"><label className="block w-full max-w-xs"><span className="label-mono mb-1.5 block">{mode === "cnpj" ? "CNPJ para consulta (opcional)" : "CNPJ / CPF (opcional)"}</span><input className="field font-mono" value={form.document} autoCapitalize="characters" maxLength={18} onChange={(e) => { cancelLookup(); setLookupMessage(""); setLookupOk(false); lastConsulted.current = ""; setField("document", mode === "cnpj" ? formatCnpj(e.target.value) : e.target.value); }} onBlur={() => { if (mode === "cnpj" && isValidCnpj(form.document)) void lookup(); }} placeholder={mode === "cnpj" ? "00.000.000/0000-00" : "Deixe vazio se não tiver"}/></label>{mode === "cnpj" ? <button type="button" className="btn btn-primary" onClick={() => lookup(true)} disabled={looking || busy}>{looking ? <LoaderCircle size={14} className="animate-spin"/> : <Search size={14}/>} {looking ? "Consultando…" : "Consultar CNPJ"}</button> : null}</div>
          <p className="mt-2 text-[11px] leading-relaxed text-steel">{mode === "cnpj" ? "Ao concluir um CNPJ válido e sair do campo, consultamos os dados públicos. Você também pode usar o botão. Não é necessário CNPJ para cadastrar." : "Preencha os dados abaixo livremente. Nome é obrigatório; documento e demais campos são opcionais."}</p>
          {lookupMessage ? <div role="status" className={`mt-3 flex items-start gap-2 rounded-lg border p-2.5 text-[11.5px] leading-relaxed ${lookupOk ? "border-armed/25 bg-armed/5 text-silver" : "border-amber/30 bg-amber/5 text-amber"}`}>{lookupOk ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-armed"/> : null}<span>{lookupMessage}</span></div> : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([key, label, placeholder]) => <label key={key} className={`block ${key === "address" ? "sm:col-span-2 lg:col-span-3" : ""}`}><span className="label-mono mb-1.5 block">{label}</span><input className="field" value={form[key]} type={key === "email" ? "email" : "text"} required={key === "name"} maxLength={key === "state" ? 2 : 1000} placeholder={placeholder} onChange={(e) => setField(key, key === "state" ? e.target.value.toUpperCase() : e.target.value)}/></label>)}<label className="block sm:col-span-2 lg:col-span-3"><span className="label-mono mb-1.5 block">Notas comerciais</span><textarea className="field min-h-[75px]" value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Preferências, necessidades e próximos passos"/></label></div>
        {error ? <p role="alert" className="mt-3 rounded-lg border border-alarm/30 bg-alarm/5 p-3 text-[12px] text-alarm">{error}</p> : null}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line/40 pt-4"><button type="submit" className="btn btn-primary" disabled={busy || looking}>{busy ? <LoaderCircle size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>} {busy ? "Salvando…" : editingId ? "Salvar alterações" : "Salvar cliente"}</button><button type="button" className="btn" onClick={close}>Cancelar</button><span className="ml-auto text-[10.5px] text-steel">Revise os dados antes de salvar.</span></div>
      </div>
    </form> : null}
    {filtered.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((c) => <article key={c.id} className="card p-4"><div className="flex items-start justify-between gap-2"><div className="flex min-w-0 gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line/60 bg-navy text-signal"><Building2 size={17}/></span><div className="min-w-0"><h3 className="truncate font-display text-[14px] font-semibold text-white">{c.name}</h3><p className="truncate text-[10.5px] text-steel">{c.company || c.segment || "Cadastro manual"}</p></div></div><span className="chip shrink-0">{c.proposals} prop.</span></div><div className="mt-3 space-y-1 text-[11.5px] text-steel">{c.document ? <p className="font-mono text-[10.5px] text-silver">{c.document}</p> : null}{c.contactName ? <p className="text-silver">{c.contactName}</p> : null}{c.phone ? <p>{c.phone}</p> : null}{c.email ? <p className="truncate">{c.email}</p> : null}{c.city ? <p>{c.city} / {c.state}</p> : null}</div>{c.notes ? <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-steel">{c.notes}</p> : null}<div className="mt-3 flex items-center justify-between border-t border-line/40 pt-3"><div><div className="label-mono !text-[8px]">Em negociação</div><div className="mt-0.5 text-[12px] text-signal">{brl(c.pipelineCents / 100)}</div></div><div className="flex gap-3 text-[11px]"><button onClick={() => edit(c)} className="text-silver hover:text-signal">Editar</button><button onClick={() => remove(c)} className="text-steel hover:text-alarm">Excluir</button></div></div></article>)}</div> : <div className="card flex min-h-[230px] flex-col items-center justify-center p-6 text-center"><UserRound size={25} className="text-signal/70"/><h3 className="mt-3 font-display text-base font-semibold text-white">{query ? "Nenhum cliente encontrado" : "Sua base começa aqui"}</h3><p className="mt-1 max-w-md text-[12px] leading-relaxed text-steel">{query ? "Tente outro nome, CNPJ ou cidade." : "Cadastre com CNPJ para preencher os dados automaticamente, ou adicione o cliente manualmente."}</p>{!query ? <button className="btn mt-4" onClick={startNew}><Plus size={14}/> Adicionar primeiro cliente</button> : null}</div>}
    <div className="text-[11px] text-steel">Clientes salvos ficam disponíveis na criação de propostas. <Link href="/propostas/nova" className="text-signal hover:underline">Criar uma proposta →</Link></div>
  </div>;
}
