"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { brl, fmtDate, fmtDateTime } from "@/lib/brand";
import { calcTotals } from "@/lib/proposal/catalog";
import { STAGES, type ItemKind, type ProposalItem, type ProposalSection } from "@/lib/proposal/types";
import { SECTION_LIBRARY } from "@/lib/proposal/generate";
import { ProposalDocument, type DocData, type DocEdit, type DocSettings } from "@/components/proposal/ProposalDocument";
import { ExtrasFields } from "@/components/proposal/ExtrasFields";
import { DEFAULT_EXTRAS, applyExtras, readExtras, type ProposalExtras } from "@/lib/proposal/extras";
import { readDocTexts } from "@/lib/proposal/doc-text";
import { getPaymentInstallments, installmentAmount } from "@/lib/proposal/payment";
import { PrintActions } from "@/components/proposal/PrintActions";
import { ProposalDeleteButton } from "@/components/proposal/ProposalDeleteButton";
import { isMaintenanceProposal, maintenanceSummary } from "@/lib/proposal/maintenance-plan";

export type EditorActivity = {
  id: string;
  kind: string;
  content: string;
  dueAt: string | null;
  doneAt: string | null;
  createdAt: string;
};

export type EditorCatalogItem = {
  id: string;
  kind: string;
  category: string;
  description: string;
  spec: string | null;
  unit: string;
  priceCents: number;
};

export type EditorRevision = {
  id: string;
  number: string;
  revision: number;
  status: string;
  totalCents: number;
  createdAt: string;
  issuedAt: string;
};

export type EditorProposal = DocData & {
  id: string;
  status: string;
  archived: boolean;
  revision: number;
  revisionGroupId: string | null;
  nextActionAt: string | null;
  nextActionNote: string | null;
  lossReason: string | null;
  briefing?: Record<string, unknown> | null;
};

const uid = () => `x-${Math.random().toString(36).slice(2, 9)}`;
const toDateInput = (value: string | Date | null) => (value ? new Date(value).toISOString().slice(0, 10) : "");

export function ProposalEditor({
  initial,
  settings,
  catalog,
  activities: initialActivities,
  revisions: initialRevisions = [],
  contracts = [],
}: {
  initial: EditorProposal;
  settings: DocSettings;
  catalog: EditorCatalogItem[];
  activities: EditorActivity[];
  revisions?: EditorRevision[];
  contracts?: { id: string; title: string; kind: string; status: string; revision: number }[];
}) {
  const router = useRouter();
  const [proposal, setProposal] = useState<EditorProposal>(initial);
  const [activities, setActivities] = useState<EditorActivity[]>(initialActivities);
  const [tab, setTab] = useState<"documento" | "itens" | "crm">("documento");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [newActivity, setNewActivity] = useState({ kind: "seguimento", content: "", dueAt: "" });
  const [catalogPick, setCatalogPick] = useState("");
  const [revisions, setRevisions] = useState<EditorRevision[]>(initialRevisions);
  const [revisionBusy, setRevisionBusy] = useState(false);
  const [editMode, setEditMode] = useState(true);

  const totals = useMemo(() => calcTotals(proposal.items, proposal.discountPct), [proposal.items, proposal.discountPct]);
  const maintenanceProposal = isMaintenanceProposal(proposal.briefing);
  const monthly = maintenanceSummary(proposal.items, proposal.discountPct, proposal.briefing);
  const paymentInstallments = getPaymentInstallments(proposal.briefing);

  function mutate(fn: (prev: EditorProposal) => EditorProposal) {
    setProposal(fn);
    setDirty(true);
  }

  function update(patch: Partial<EditorProposal>) {
    mutate((prev) => ({ ...prev, ...patch }));
  }

  /** Recalcula miscelâneas, infraestrutura, margem de segurança e mão de obra a partir dos equipamentos atuais. */
  function recompute(prev: EditorProposal, change: { items?: ProposalItem[]; extras?: Partial<ProposalExtras> }): EditorProposal {
    let items = change.items ?? prev.items;
    let briefing = prev.briefing;
    if (!isMaintenanceProposal(prev.briefing)) {
      const current = readExtras(prev.briefing);
      if (change.extras || current) {
        const merged: ProposalExtras = { ...(current ?? { ...DEFAULT_EXTRAS, enabled: false }), ...(change.extras ?? {}) };
        briefing = { ...(prev.briefing ?? {}), extras: merged };
        items = applyExtras(items, merged);
      }
    }
    return { ...prev, items, briefing };
  }

  function changeItems(fn: (items: ProposalItem[]) => ProposalItem[]) {
    mutate((prev) => recompute(prev, { items: fn(prev.items) }));
  }

  function changeExtras(patch: Partial<ProposalExtras>) {
    mutate((prev) => recompute(prev, { extras: patch }));
  }

  function patchSection(id: string, patch: Partial<ProposalSection>) {
    mutate((prev) => ({ ...prev, sections: prev.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  }

  function moveSection(id: string, dir: -1 | 1) {
    mutate((prev) => {
      const index = prev.sections.findIndex((s) => s.id === id);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= prev.sections.length) return prev;
      const next = [...prev.sections];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, sections: next };
    });
  }

  function patchItem(id: string, patch: Partial<ProposalItem>) {
    changeItems((items) => items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function removeItem(id: string) {
    changeItems((items) => items.filter((i) => i.id !== id));
  }

  /** Remover uma linha automática significa zerar o percentual (ou o valor) que a gera. */
  function removeFromDocument(item: ProposalItem) {
    if (!item.auto) return removeItem(item.id);
    const patch: Partial<ProposalExtras> =
      item.auto === "misc" ? { miscPct: 0 } : item.auto === "infra" ? { infraPct: 0 } : item.auto === "safety" ? { safetyPct: 0 } : { laborValue: 0 };
    changeExtras(patch);
  }

  function addItem(kind: ItemKind) {
    changeItems((items) => [
      ...items,
      { id: uid(), kind, desc: kind === "servico" ? "Novo serviço" : "Novo item", spec: "", unit: "un", qty: 1, price: 0 },
    ]);
  }

  function renameScope(from: string, to: string) {
    changeItems((items) => items.map((i) => (!i.auto && (i.scope?.trim() || "Itens Complementares") === from ? { ...i, scope: to } : i)));
  }

  function setDocText(key: string, value: string) {
    mutate((prev) => ({ ...prev, briefing: { ...(prev.briefing ?? {}), docText: { ...readDocTexts(prev.briefing), [key]: value } } }));
  }

  function addFromCatalog(id: string) {
    const item = catalog.find((c) => c.id === id);
    if (!item) return;
    changeItems((items) => [
      ...items,
      {
        id: uid(),
        kind: item.kind === "servico" ? "servico" : "equipamento",
        desc: item.description,
        spec: item.spec ?? "",
        unit: item.unit,
        qty: 1,
        price: item.priceCents / 100,
      },
    ]);
    setCatalogPick("");
  }

  const docEdit: DocEdit = {
    text: setDocText,
    field: (patch) => {
      const { paymentInstallments: count, ...fields } = patch;
      if (count !== undefined) {
        update({
          ...fields,
          briefing: { ...(proposal.briefing ?? {}), paymentInstallments: Math.min(60, Math.max(1, Math.round(count))) },
        });
      } else {
        update(fields);
      }
    },
    section: patchSection,
    item: patchItem,
    removeItem: removeFromDocument,
    addItem,
    renameScope,
    extras: changeExtras,
  };
  const extrasValue: ProposalExtras = readExtras(proposal.briefing) ?? { ...DEFAULT_EXTRAS, enabled: false };

  async function save(extra?: Partial<EditorProposal>) {
    setSaving(true);
    const payload = {
      clientName: proposal.clientName,
      contact: proposal.contact,
      clientEmail: proposal.clientEmail,
      site: proposal.site,
      validityDays: proposal.validityDays,
      discountPct: proposal.discountPct,
      items: proposal.items,
      sections: proposal.sections,
      paymentTerms: proposal.paymentTerms,
      deliveryTime: proposal.deliveryTime,
      warranty: proposal.warranty,
      artIncluded: proposal.artIncluded,
      briefing: proposal.briefing,
      status: proposal.status,
      archived: proposal.archived,
      lossReason: proposal.lossReason,
      type: proposal.type,
      issuedAt: proposal.issuedAt,
      ...extra,
    };
    try {
      const res = await fetch(`/api/proposals/${proposal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("save failed");
      await res.json();
      setProposal((prev) => ({ ...prev, ...extra }));
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString("pt-BR"));
      router.refresh();
      return true;
    } catch {
      setSavedAt("erro ao salvar");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function generateSection(section: ProposalSection) {
    setAiBusy(section.id);
    try {
      const res = await fetch("/api/ai/section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: section.title,
          clientName: proposal.clientName,
          briefing: proposal.briefing,
        }),
      });
      const data = (await res.json()) as { body?: string; source?: string };
      if (data.body) patchSection(section.id, { body: data.body });
    } finally {
      setAiBusy(null);
    }
  }

  async function addActivity(done = false) {
    if (!newActivity.content.trim()) return;
    const res = await fetch(`/api/proposals/${proposal.id}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: newActivity.kind,
        content: newActivity.content,
        dueAt: newActivity.dueAt ? new Date(newActivity.dueAt).toISOString() : null,
        done,
      }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { activity: EditorActivity };
    setActivities((prev) => [data.activity, ...prev]);
    setNewActivity({ kind: newActivity.kind, content: "", dueAt: "" });
    if (newActivity.kind === "seguimento" && newActivity.dueAt) {
      update({ nextActionAt: new Date(newActivity.dueAt).toISOString(), nextActionNote: newActivity.content });
    }
    router.refresh();
  }

  async function finishActivity(id: string, done: boolean) {
    const res = await fetch(`/api/activities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { activity: EditorActivity };
    setActivities((prev) => prev.map((a) => (a.id === id ? data.activity : a)));
    router.refresh();
  }

  async function changeStage(status: string) {
    update({ status });
    setProposal((prev) => ({ ...prev, status }));
    await fetch(`/api/proposals/${proposal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSavedAt(new Date().toLocaleTimeString("pt-BR"));
    router.refresh();
  }

  async function duplicate() {
    setSaving(true);
    const res = await fetch(`/api/proposals/${proposal.id}/duplicate`, { method: "POST" });
    const data = (await res.json()) as { proposal?: { id: string } };
    if (data.proposal) router.push(`/propostas/${data.proposal.id}`);
    setSaving(false);
  }

  async function createRevision() {
    setRevisionBusy(true);
    try {
      if (dirty) {
        setSavedAt("Salvando a versão atual…");
        const saved = await save();
        if (!saved) throw new Error("Não foi possível salvar as alterações. A nova revisão não foi criada.");
      }
      const res = await fetch(`/api/proposals/${proposal.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: true }),
      });
      const data = (await res.json()) as { proposal?: { id: string }; error?: string };
      if (!res.ok || !data.proposal) throw new Error(data.error || "Não foi possível criar uma revisão.");
      router.push(`/propostas/${data.proposal.id}`);
      router.refresh();
    } catch (err) {
      setSavedAt(err instanceof Error ? err.message : "Falha ao criar revisão");
    } finally {
      setRevisionBusy(false);
    }
  }

  async function toggleArchive() {
    const archived = !proposal.archived;
    update({ archived });
    await save({ archived });
    router.push("/propostas");
  }

  const stage = STAGES.find((s) => s.id === proposal.status) ?? STAGES[0];

  return (
    <div className="min-h-screen bg-abyss">
      <header className="no-print sticky top-0 z-30 border-b border-line/60 bg-abyss/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/propostas" className="btn px-2.5 py-1.5 text-[11px]">
              ←
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-[0.18em] text-signal">{proposal.number}</span>
                {proposal.revision && proposal.revision > 1 ? (
                  <span className="chip text-signal">R{proposal.revision}</span>
                ) : null}
                <span className="chip">{proposal.type.replace("_", " & ")}</span>
                {proposal.archived ? <span className="chip text-amber">arquivada</span> : null}
              </div>
              <h1 className="truncate font-display text-[17px] font-semibold text-white">{proposal.clientName}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`hidden text-[11px] sm:block ${dirty ? "text-amber" : "text-steel"}`}>
              {dirty ? "Alterações não salvas" : savedAt ? `Salvo ${savedAt}` : "Tudo salvo"}
            </span>
            {proposal.status === "ganho" ? (
              <Link href={`/termos-entrega/novo?proposta=${proposal.id}`} className="btn !border-armed/40 !text-armed">
                Elaborar termo de entrega
              </Link>
            ) : null}
            <Link
              href={`/contratos/novo?proposta=${proposal.id}`}
              className="btn !border-signal/35 !text-signal"
              onClick={(event) => {
                if (dirty) {
                  event.preventDefault();
                  window.alert("Salve as alterações da proposta antes de gerar o contrato.");
                }
              }}
            >
              Gerar contrato (opcional)
            </Link>
            <button className="btn" onClick={duplicate} disabled={saving || revisionBusy}>
              Duplicar
            </button>
            <button
              className="btn btn-primary"
              onClick={createRevision}
              disabled={saving || revisionBusy}
              title="Salva as alterações e cria a próxima revisão"
            >
              {revisionBusy ? "Preparando revisão…" : "Reformular em nova revisão"}
            </button>
            <ProposalDeleteButton id={proposal.id} number={proposal.number} revisionCount={Math.max(revisions.length, 1)} />
            <button className="btn" onClick={toggleArchive} disabled={saving}>
              {proposal.archived ? "Restaurar" : "Arquivar"}
            </button>
            <button className="btn btn-primary" onClick={() => save()} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <PrintActions filename={`${proposal.number}-${proposal.clientName.replace(/\s+/g, "-")}`} doc={proposal} settings={settings} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line/40 px-4 py-2 lg:px-6">
          <span className="label-mono">Etapa do funil</span>
          <select className="field max-w-[220px] py-1.5 text-[12px]" value={proposal.status} onChange={(e) => changeStage(e.target.value)}>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-steel">{stage.hint}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="label-mono">Total</span>
            <span className="font-display text-sm font-semibold text-signal">{brl(totals.totalCents / 100)}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-6">
        <div className="min-w-0 space-y-3">
          <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/60 bg-navy/30 px-3 py-2">
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-silver">
                {editMode ? "Edição direta ligada" : "Edição direta desligada"}
              </div>
              <div className="text-[10.5px] leading-relaxed text-steel">
                {editMode
                  ? "Clique em qualquer texto, rótulo, valor, tabela, assinatura ou rodapé do documento para alterar. Enter confirma, Esc cancela."
                  : "Visualização limpa, como no PDF. Ligue a edição para alterar o documento."}
              </div>
            </div>
            <button type="button" className={`btn ${editMode ? "!border-signal/50 !text-signal" : ""}`} onClick={() => setEditMode((v) => !v)}>
              {editMode ? "Desligar edição" : "Editar no documento"}
            </button>
          </div>
          <div className="print-area scroll-thin overflow-x-auto rounded-xl border border-line/50 bg-[#0b1728] p-4">
            <div className="mx-auto w-[794px]">
              <ProposalDocument proposal={proposal} settings={settings} edit={editMode ? docEdit : undefined} />
            </div>
          </div>
        </div>

        <aside className="no-print space-y-3">
          <Panel title="Contratos da proposta" hint="Formalização opcional · não ativa serviços automaticamente">
            {contracts.length ? <div className="space-y-2">{contracts.map((c) => <Link key={c.id} href={`/contratos/${c.id}`} className="block rounded-lg border border-line/50 bg-abyss2/40 p-2.5 hover:border-signal/40"><div className="text-[12px] font-medium text-silver">{c.title}</div><div className="mt-1 text-[10px] text-steel">{c.kind === "manutencao" ? "Manutenção mensal" : "Fornecimento / serviços"} · {c.status} · Minuta R{c.revision}</div></Link>)}</div> : <p className="text-[11px] leading-relaxed text-steel">Sem contrato vinculado. Se o cliente optar, use “Gerar contrato” após salvar esta revisão.</p>}
          </Panel>
          <div className={`rounded-xl border p-3 ${dirty ? "border-amber/50 bg-amber/5" : "border-line/60 bg-navy/30"}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="label-mono">Próxima ação</div>
                <div className="mt-1 text-[12.5px] text-silver">
                  {proposal.nextActionNote || "Nenhum follow-up agendado — agende antes de enviar."}
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-signal">{fmtDateTime(proposal.nextActionAt)}</div>
              </div>
              <button className="btn py-1 text-[11px]" onClick={() => setTab("crm")}>
                CRM
              </button>
            </div>
          </div>

          <div className="flex gap-1 rounded-lg border border-line/60 bg-navy/30 p-1">
            {(
              [
                ["documento", "Documento"],
                ["itens", "Itens & valores"],
                ["crm", "CRM"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 rounded-md px-2 py-1.5 text-[12px] transition ${
                  tab === id ? "bg-signal/15 text-white" : "text-steel hover:text-silver"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "documento" ? (
            <div className="space-y-3">
              <Panel title="Cliente e escopo" hint="Alimenta o cabeçalho do timbrado">
                <Field label="Cliente">
                  <input className="field" value={proposal.clientName} onChange={(e) => update({ clientName: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Contato">
                    <input className="field" value={proposal.contact ?? ""} onChange={(e) => update({ contact: e.target.value })} />
                  </Field>
                  <Field label="E-mail">
                    <input className="field" value={proposal.clientEmail ?? ""} onChange={(e) => update({ clientEmail: e.target.value })} />
                  </Field>
                </div>
                <Field label="Local da instalação">
                  <input className="field" value={proposal.site ?? ""} onChange={(e) => update({ site: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Validade (dias)">
                    <input
                      type="number"
                      className="field"
                      value={proposal.validityDays}
                      onChange={(e) => update({ validityDays: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Emissão">
                    <input type="date" className="field" value={toDateInput(proposal.issuedAt)} onChange={(e) => { if (e.target.value) update({ issuedAt: new Date(`${e.target.value}T12:00:00`).toISOString() }); }} />
                  </Field>
                </div>
              </Panel>

              <Panel title="Condições comerciais" hint="Usadas no bloco de condições e no resumo de valor">
                <Field label="Pagamento">
                  <textarea
                    className="field min-h-[54px]"
                    value={proposal.paymentTerms ?? ""}
                    onChange={(e) => update({ paymentTerms: e.target.value })}
                  />
                </Field>
                {!maintenanceProposal ? (
                  <Field label="Número de parcelas no resumo">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      className="field"
                      value={paymentInstallments}
                      onChange={(e) => {
                        const count = Math.max(1, Math.min(60, Math.round(Number(e.target.value) || 1)));
                        update({ briefing: { ...(proposal.briefing ?? {}), paymentInstallments: count } });
                      }}
                    />
                    <span className="mt-1 block text-[10px] text-steel">
                      O valor do resumo e do PDF é recalculado pelo total atual ÷ {paymentInstallments}.
                    </span>
                  </Field>
                ) : null}
                <Field label="Prazo de entrega">
                  <input className="field" value={proposal.deliveryTime ?? ""} onChange={(e) => update({ deliveryTime: e.target.value })} />
                </Field>
                <Field label="Garantia">
                  <input className="field" value={proposal.warranty ?? ""} onChange={(e) => update({ warranty: e.target.value })} />
                </Field>
                <label className="flex items-center gap-2 text-[12px] text-silver">
                  <input
                    type="checkbox"
                    checked={proposal.artIncluded}
                    onChange={(e) => update({ artIncluded: e.target.checked })}
                  />
                  Incluir ART, projeto executivo e as-built
                </label>
              </Panel>

              <Panel title={`Blocos do documento (${proposal.sections.filter((s) => s.enabled).length})`} hint="Ative, reordene e edite cada bloco">
                <div className="space-y-2">
                  {proposal.sections.map((section, index) => (
                    <details key={section.id} className="rounded-lg border border-line/60 bg-abyss2/60">
                      <summary className="flex cursor-pointer items-center gap-2 px-2.5 py-2">
                        <input
                          type="checkbox"
                          checked={section.enabled}
                          onChange={(e) => patchSection(section.id, { enabled: e.target.checked })}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="font-mono text-[10px] text-steel">{String(index + 1).padStart(2, "0")}</span>
                        <span className={`flex-1 truncate text-[12px] ${section.enabled ? "text-silver" : "text-steel line-through"}`}>
                          {section.title}
                        </span>
                        {section.kind === "items" ? <span className="chip">tabela</span> : null}
                        {section.kind === "totals" ? <span className="chip">valor</span> : null}
                      </summary>
                      <div className="space-y-2 border-t border-line/50 p-2.5">
                        <input
                          className="field"
                          value={section.title}
                          onChange={(e) => patchSection(section.id, { title: e.target.value })}
                        />
                        <textarea
                          className="field min-h-[120px] font-sans text-[12px] leading-relaxed"
                          value={section.body}
                          onChange={(e) => patchSection(section.id, { body: e.target.value })}
                        />
                        <div className="flex flex-wrap gap-1.5">
                          <button className="btn px-2 py-1 text-[11px]" onClick={() => moveSection(section.id, -1)}>
                            ↑ Subir
                          </button>
                          <button className="btn px-2 py-1 text-[11px]" onClick={() => moveSection(section.id, 1)}>
                            ↓ Descer
                          </button>
                          <button
                            className="btn px-2 py-1 text-[11px]"
                            onClick={() => generateSection(section)}
                            disabled={aiBusy === section.id}
                          >
                            {aiBusy === section.id ? "Gerando…" : "Reescrever com IA"}
                          </button>
                          <button
                            className="btn px-2 py-1 text-[11px] text-alarm"
                            onClick={() => update({ sections: proposal.sections.filter((s) => s.id !== section.id) })}
                          >
                            Remover
                          </button>
                        </div>
                        <p className="text-[10.5px] leading-relaxed text-steel">
                          Use uma linha por parágrafo e “• ” para bullets. O bloco de valor e a tabela de itens são gerados
                          automaticamente a partir dos itens.
                        </p>
                      </div>
                    </details>
                  ))}
                </div>
                <div className="mt-2 grid gap-1.5">
                  <span className="label-mono">Biblioteca de blocos prontos</span>
                  <div className="flex flex-wrap gap-1.5">
                    {SECTION_LIBRARY.map((block) => (
                      <button
                        key={block.title}
                        className="chip hover:border-signal/50 hover:text-signal"
                        onClick={() =>
                          update({
                            sections: [
                              ...proposal.sections,
                              {
                                id: uid(),
                                title: block.title,
                                body: block.body,
                                enabled: true,
                                kind: block.kind ?? "text",
                              },
                            ],
                          })
                        }
                      >
                        + {block.title}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="btn mt-2 w-full" onClick={() => addItem("equipamento")}>
                  + Item personalizado
                </button>
              </Panel>
            </div>
          ) : null}

          {tab === "crm" ? (
            <div className="space-y-3">
              <Panel title="Follow-up e feedback" hint="Registre cada interação para não perder retorno">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Tipo">
                    <select
                      className="field"
                      value={newActivity.kind}
                      onChange={(e) => setNewActivity((p) => ({ ...p, kind: e.target.value }))}
                    >
                      <option value="seguimento">Lembrete / follow-up</option>
                      <option value="ligacao">Ligação</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">E-mail</option>
                      <option value="reuniao">Reunião / visita</option>
                      <option value="nota">Nota</option>
                    </select>
                  </Field>
                  <Field label="Data">
                    <input
                      type="date"
                      className="field"
                      value={newActivity.dueAt}
                      onChange={(e) => setNewActivity((p) => ({ ...p, dueAt: e.target.value }))}
                    />
                  </Field>
                </div>
                <Field label="O que ficou combinado?">
                  <textarea
                    className="field min-h-[60px]"
                    value={newActivity.content}
                    onChange={(e) => setNewActivity((p) => ({ ...p, content: e.target.value }))}
                    placeholder="Ex.: síndico vai levar para assembleia dia 12; retornar na quinta."
                  />
                </Field>
                <div className="flex flex-wrap gap-1.5">
                  <button className="btn btn-primary px-2.5 py-1 text-[11px]" onClick={() => addActivity(false)}>
                    Agendar lembrete
                  </button>
                  <button className="btn px-2.5 py-1 text-[11px]" onClick={() => addActivity(true)}>
                    Registrar como feito
                  </button>
                  {[2, 5, 10].map((d) => (
                    <button
                      key={d}
                      className="btn px-2 py-1 text-[10.5px]"
                      onClick={() =>
                        setNewActivity((p) => ({
                          ...p,
                          kind: "seguimento",
                          dueAt: new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10),
                          content: p.content || `Follow-up D+${d}: confirmar recebimento e próximos passos.`,
                        }))
                      }
                    >
                      D+{d}
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel title="Motivo de perda" hint="Só para propostas perdidas">
                <textarea
                  className="field min-h-[50px]"
                  value={proposal.lossReason ?? ""}
                  onChange={(e) => update({ lossReason: e.target.value })}
                  placeholder="Preço, prazo, concorrente, orçamento congelado…"
                />
              </Panel>

              <Panel title={`Histórico (${activities.length})`} hint="Tudo registrado com data">
                <div className="space-y-2">
                  {activities.map((activity) => {
                    const late = activity.dueAt && !activity.doneAt && new Date(activity.dueAt) < new Date();
                    return (
                      <div
                        key={activity.id}
                        className={`rounded-lg border p-2 ${
                          activity.doneAt
                            ? "border-line/40 bg-navy/20 opacity-70"
                            : late
                              ? "border-alarm/50 bg-alarm/5"
                              : "border-line/60 bg-abyss2/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="chip">{activity.kind}</span>
                          <span className="font-mono text-[9.5px] text-steel">
                            {activity.doneAt ? `feito ${fmtDate(activity.doneAt)}` : activity.dueAt ? `para ${fmtDate(activity.dueAt)}` : fmtDate(activity.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-silver">{activity.content}</p>
                        <button
                          className="mt-1 text-[10.5px] text-signal hover:underline"
                          onClick={() => finishActivity(activity.id, !activity.doneAt)}
                        >
                          {activity.doneAt ? "reabrir" : "marcar como feito"}
                        </button>
                      </div>
                    );
                  })}
                  {activities.length === 0 ? <p className="text-[11px] text-steel">Sem atividades ainda.</p> : null}
                </div>
              </Panel>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="no-print sticky bottom-0 z-20 flex items-center justify-between gap-3 border-t border-line/60 bg-abyss/95 px-4 py-2.5 backdrop-blur lg:px-6">
        <span className="text-[11px] text-steel">
          Edite qualquer bloco · personalize condições · baixe em PDF A4 com o papel timbrado Cipriano.
        </span>
        <div className="flex gap-2">
          <PrintActions
            filename={`${proposal.number}-${proposal.clientName.replace(/\s+/g, "-")}`}
            doc={proposal}
            settings={settings}
          />
          <button className="btn btn-primary" onClick={() => save()} disabled={saving}>
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-3">
      <div className="mb-2">
        <h2 className="font-display text-[13px] font-semibold text-white">{title}</h2>
        {hint ? <p className="text-[10.5px] text-steel">{hint}</p> : null}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-mono mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-line/50 bg-abyss2/60 px-2 py-1.5">
      <div className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-steel">{label}</div>
      <div className={`mt-0.5 text-[12.5px] font-semibold ${accent ? "text-signal" : "text-silver"}`}>{value}</div>
    </div>
  );
}

export { toDateInput };
