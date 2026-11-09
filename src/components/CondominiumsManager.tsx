"use client";

import Link from "next/link";
import { useState } from "react";
import type { CondominiumRecord } from "@/lib/types";
import { ArrowLeftIcon, ArrowRightIcon, BuildingIcon, CheckIcon, FileIcon, PlusIcon, SearchIcon, TrashIcon } from "./icons";

type CondoWithCount = CondominiumRecord & { mapCount: number };
type FormState = { name: string; city: string; manager: string; contactEmail: string };
const blank: FormState = { name: "", city: "", manager: "", contactEmail: "" };

export function CondominiumsManager({ initial, dbError }: { initial: CondoWithCount[]; dbError?: boolean }) {
  const [items, setItems] = useState(initial);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(blank);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const search = query.trim().toLocaleLowerCase("pt-BR");
  const filtered = items.filter((item) => [item.name, item.city ?? "", item.manager ?? "", item.contactEmail ?? ""].some((value) => value.toLocaleLowerCase("pt-BR").includes(search)));
  const selected = items.find((item) => item.id === editingId);
  const formOpen = creating || Boolean(editingId);

  function startCreate() {
    setEditingId(null);
    setCreating(true);
    setForm(blank);
    setMessage(null);
  }

  function startEdit(item: CondoWithCount) {
    setEditingId(item.id);
    setCreating(false);
    setForm({ name: item.name, city: item.city ?? "", manager: item.manager ?? "", contactEmail: item.contactEmail ?? "" });
    setMessage(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(editingId ? `/api/condominios/${editingId}` : "/api/condominios", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json() as { condominium?: CondominiumRecord; error?: string };
      if (!response.ok || !data.condominium) throw new Error(data.error || "Não foi possível salvar.");
      const saved = data.condominium;
      setItems((current) => {
        const existing = current.find((item) => item.id === saved.id);
        return [...current.filter((item) => item.id !== saved.id), { ...saved, mapCount: existing?.mapCount ?? 0 }]
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      });
      setEditingId(saved.id);
      setCreating(false);
      setForm({ name: saved.name, city: saved.city ?? "", manager: saved.manager ?? "", contactEmail: saved.contactEmail ?? "" });
      setMessage({ type: "success", text: "Condomínio salvo. O nome foi atualizado nos mapas vinculados." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Não foi possível salvar." });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selected || !window.confirm(`Excluir o cadastro de ${selected.name}?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/condominios/${selected.id}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível excluir.");
      setItems((current) => current.filter((item) => item.id !== selected.id));
      setEditingId(null);
      setMessage({ type: "success", text: "Cadastro removido." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Não foi possível excluir." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-ink"><ArrowLeftIcon className="h-3.5 w-3.5" />Voltar ao painel</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-dark">Base de clientes</p><h1 className="font-display mt-1 text-[30px] leading-tight text-ink sm:text-[34px]">Condomínios e associações</h1><p className="mt-1 text-[13px] text-slate-500">Consulte os cadastros, atualize os dados e acompanhe os mapas de cada condomínio.</p></div>
        <button type="button" onClick={startCreate} className="btn btn-brand"><PlusIcon /> Cadastrar condomínio</button>
      </div>
      {dbError && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-800">Não foi possível carregar os cadastros. Verifique a conexão e atualize a página.</p>}
      {message && <div role="status" className={`mt-4 rounded-xl px-4 py-3 text-[12px] font-semibold ${message.type === "success" ? "border border-green-200 bg-green-50 text-green-800" : "border border-red-200 bg-red-50 text-red-700"}`}>{message.text}</div>}

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_370px]">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div><h2 className="text-[14px] font-extrabold text-ink">Condomínios cadastrados</h2><p className="mt-0.5 text-[11px] text-slate-500">{items.length} cadastro(s) na base Gerencial</p></div>
            <div className="relative"><SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="field w-full !py-2 pl-9 text-[12px] sm:w-60" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar condomínio ou síndico" aria-label="Buscar condomínios" /></div>
          </div>
          {filtered.length === 0 ? (
            <div className="px-5 py-14 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-paper text-ink"><BuildingIcon className="h-6 w-6" /></span><p className="mt-3 text-[13px] font-bold text-ink">{items.length ? "Nenhum condomínio encontrado" : "Nenhum condomínio cadastrado"}</p><p className="mt-1 text-[11.5px] text-slate-500">{items.length ? "Tente buscar por outro nome." : "Comece cadastrando seu primeiro condomínio ou salve uma cotação."}</p>{!items.length && <button type="button" onClick={startCreate} className="btn btn-ghost mt-4"><PlusIcon /> Cadastrar condomínio</button>}</div>
          ) : (
            <ul className="divide-y divide-line">
              {filtered.map((item) => (
                <li key={item.id} className={`flex flex-wrap items-center gap-3 px-5 py-4 transition hover:bg-paper/60 ${editingId === item.id ? "bg-brand-soft/40" : ""}`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-brand"><BuildingIcon className="h-5 w-5" /></span>
                  <div className="min-w-[180px] flex-1"><p className="text-[13px] font-extrabold text-ink">{item.name}</p><p className="mt-0.5 text-[11px] text-slate-500">{[item.city, item.manager].filter(Boolean).join(" · ") || "Cidade e responsável não informados"}</p></div>
                  <span className="rounded-full bg-paper px-2.5 py-1 text-[10px] font-bold text-slate-500">{item.mapCount} mapa(s)</span>
                  <button type="button" onClick={() => startEdit(item)} className="btn btn-ghost !px-3 !py-1.5">Editar <ArrowRightIcon className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="space-y-4">
          <section className="card overflow-hidden">
            <div className="border-b border-line bg-paper/60 px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-dark">Cadastro</p><h2 className="mt-1 text-[15px] font-extrabold text-ink">{creating ? "Novo condomínio" : selected ? "Editar condomínio" : "Dados do condomínio"}</h2><p className="mt-1 text-[11px] leading-relaxed text-slate-500">{formOpen ? "Os dados ficam disponíveis para novos mapas." : "Selecione um cadastro na lista para visualizar ou editar."}</p></div>
            {formOpen ? (
              <form onSubmit={save} className="space-y-3 px-5 py-4">
                <label className="block"><span className="label">Nome do condomínio / associação *</span><input required minLength={3} maxLength={200} className="field mt-1" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nome completo" /></label>
                <label className="block"><span className="label">Cidade / UF</span><input maxLength={120} className="field mt-1" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="Ex.: São José dos Campos / SP" /></label>
                <label className="block"><span className="label">Síndico(a) / responsável</span><input maxLength={160} className="field mt-1" value={form.manager} onChange={(event) => setForm({ ...form, manager: event.target.value })} placeholder="Nome do responsável" /></label>
                <label className="block"><span className="label">E-mail de contato</span><input type="email" className="field mt-1" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} placeholder="contato@condominio.com.br" /></label>
                <p className="text-[10.5px] leading-relaxed text-slate-500">Alterar o nome também atualiza os mapas já vinculados a este cadastro.</p>
                <div className="flex flex-wrap gap-2 pt-1"><button type="submit" disabled={busy} className="btn btn-primary"><CheckIcon /> {busy ? "Salvando…" : "Salvar cadastro"}</button><button type="button" disabled={busy} onClick={() => { setEditingId(null); setCreating(false); setMessage(null); }} className="btn btn-ghost">Cancelar</button></div>
                {selected && <div className="border-t border-line pt-3"><button type="button" onClick={remove} disabled={busy} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-600 hover:underline disabled:opacity-50"><TrashIcon className="h-3.5 w-3.5" /> Excluir cadastro</button><p className="mt-1 text-[10px] leading-relaxed text-slate-400">A exclusão é bloqueada se houver mapas vinculados.</p></div>}
              </form>
            ) : <div className="px-5 py-8 text-center"><p className="text-[12px] leading-relaxed text-slate-500">Clique em <strong>Editar</strong> em um condomínio ou adicione um novo cadastro.</p></div>}
          </section>
          <Link href="/indicadores" className="card group flex items-center gap-3 px-4 py-4"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand-dark"><FileIcon className="h-4.5 w-4.5" /></span><span className="flex-1"><span className="block text-[12px] font-bold text-ink">Indicadores para assembleia</span><span className="block text-[10.5px] text-slate-500">Visualize as economias por condomínio.</span></span><ArrowRightIcon className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1" /></Link>
        </aside>
      </div>
    </main>
  );
}
