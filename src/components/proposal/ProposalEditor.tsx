"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { brl, fmtDate, fmtDateTime } from "@/lib/brand";
import { calcTotals } from "@/lib/proposal/catalog";
import { STAGES, type ProposalItem, type ProposalSection } from "@/lib/proposal/types";
import { SECTION_LIBRARY } from "@/lib/proposal/generate";
import { ProposalDocument, type DocData, type DocSettings } from "@/components/proposal/ProposalDocument";
import { PrintActions } from "@/components/proposal/PrintActions";
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
const toDateInput = (value: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : "");

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

  const totals = useMemo(() => calcTotals(proposal.items, proposal.discountPct), [proposal.items, proposal.discountPct]);
  const maintenanceProposal = isMaintenanceProposal(proposal.briefing);
  const monthly = maintenanceSummary(proposal.items, proposal.discountPct, proposal.briefing);

  function update(patch: Partial<EditorProposal>) {
    setProposal((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }

  function patchSection(id: string, patch: Partial<ProposalSection>) {
    update({ sections: proposal.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  }

  function moveSection(id: string, dir: -1 | 1) {
    const index = proposal.sections.findIndex((s) => s.id === id);
    const target = index + dir;
    if (index < 0 || target < 0 || target >= proposal.sections.length) return;
    const next = [...proposal.sections];
    [next[index], next[target]] = [next[target], next[index]];
    update({ sections: next });
  }

  function patchItem(id: string, patch: Partial<ProposalItem>) {
    update({ items: proposal.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  }

  function removeItem(id: string) {
    update({ items: proposal.items.filter((i) => i.id !== id) });
  }

  function addFromCatalog(id: string) {
    const item = catalog.find((c) => c.id === id);
    if (!item) return;
    update({
      items: [
        ...proposal.items,
        {
          id: uid(),
          kind: item.kind === "servico" ? "servico" : "equipamento",
          desc: item.description,
          spec: item.spec ?? "",
          unit: item.unit,
          qty: 1,
          price: item.priceCents / 100,
        },
      ],
    });
    setCatalogPick("");
  }

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
    } catch {
      setSavedAt("erro ao salvar");
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
    const res = await fetch(`/api/proposals/${proposal.id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision: true }),
    });
    const data = (await res.json()) as { proposal?: { id: string }; isRevision?: boolean };
    if (data.proposal) {
      const rev: EditorRevision = {
        id: data.proposal.id,
        number: proposal.number,
        revision: (proposal.revision ?? 1) + 1,
        status: "novo",
        totalCents: totals.totalCents,
        createdAt: new Date().toISOString(),
        issuedAt: new Date().toISOString(),
      };
      setRevisions((prev) => [rev, ...prev]);
      setRevisionBusy(false);
      router.push(`/propostas/${data.proposal.id}`);
    } else {
      setRevisionBusy(false);
    }
  }

  async function toggleArchive() {
    const archived = !proposal.archived;
    update({ archived });
    await save({ archived });
    router.push("/propostas");
  }

  async function deleteProposal() {
    if (!window.confirm(`Excluir a proposta ${proposal.number} de ${proposal.clientName}?\n\nEsta ação apaga a proposta e o histórico dela e não pode ser desfeita.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      router.push("/propostas");
      router.refresh();
    } catch {
      setSaving(false);
      window.alert("Não foi possível excluir a proposta. Tente novamente.");
    }
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
                  <span className="chip text-signal">R${proposal.revision}</span>
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
            <Link
              href={`/propostas/nova?reformular=${proposal.id}`}
              className="btn !border-signal/35 !text-signal"
              onClick={(event) => {
                if (dirty) {
                  event.preventDefault();
                  window.alert("Salve as alterações antes de reformular, ou descarte-as recarregando a página.");
                }
              }}
            >
              Reformular
            </Link>
            <button className="btn" onClick={duplicate} disabled={saving}>
              Duplicar
            </button>
            <button
              className="btn"
              onClick={createRevision}
              disabled={saving || revisionBusy}
            >
              {revisionBusy ? "Revisando…" : "Nova revisão"}
            </button>
            <button className="btn" onClick={toggleArchive} disabled={saving}>
              {proposal.archived ? "Restaurar" : "Arquivar"}
            </button>
            <button className="btn !border-alarm/45 !text-alarm" onClick={deleteProposal} disabled={saving}>
              Excluir
            </button>
            <button className="btn btn-primary" onClick={() => save()} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <PrintActions filename={`${proposal.number}-${proposal.clientName.replace(/\s+/g, "-")}`} />
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
        <div className="print-area scroll-thin overflow-x-auto rounded-xl border border-line/50 bg-[#0b1728] p-4">
          <div className="mx-auto w-[794px]">
            <ProposalDocument proposal={proposal} settings={settings} />
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
                    <input className="field" value={fmtDate(proposal.issuedAt)} readOnly />
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
                <button
                  className="btn mt-2 w-full"
                  onClick={() =>
                    update({
                      sections: [
                        ...proposal.sections,
                        { id: uid(), title: "Novo bloco", body: "Descreva o conteúdo deste bloco.", enabled: true, kind: "text" },
                      ],
                    })
                  }
                >
                  + Adicionar bloco em branco
                </button>
              </Panel>

              {revisions.length > 0 ? (
                <Panel title="Histórico de revisões" hint="Todas as versões desta proposta">
                  <div className="space-y-2">
                    {revisions.map((rev) => (
                      <div
                        key={rev.id}
                        className={`rounded-lg border p-2 ${
                          rev.id === proposal.id ? "border-signal/50 bg-signal/10" : "border-line/60 bg-abyss2/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            href={`/propostas/${rev.id}`}
                            className="truncate font-medium text-[11.5px] text-white hover:text-signal"
                          >
                            {rev.number} · Revisão {rev.revision}
                          </Link>
                          <span className="chip">{rev.status}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="font-mono text-[10px] text-signal">{brl(rev.totalCents / 100)}</span>
                          <span className="font-mono text-[10px] text-steel">{fmtDate(rev.issuedAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              ) : null}
            </div>
          ) : null}

          {tab === "itens" ? (
            <div className="space-y-3">
              <Panel title={maintenanceProposal ? "Mensalidade e vigência" : "Investimento"} hint="Calculado em tempo real">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="Subtotal" value={brl(totals.subtotalCents / 100)} />
                  <Stat label="Desconto" value={`${proposal.discountPct}%`} />
                  <Stat label="Total" value={brl(totals.totalCents / 100)} accent />
                </div>
                <Field label="Desconto comercial (%)">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="field"
                    value={proposal.discountPct}
                    onChange={(e) => update({ discountPct: Number(e.target.value) })}
                  />
                </Field>
                <div className="text-[11px] text-steel">{maintenanceProposal ? `${brl(monthly.monthlyCents / 100)}/mês · ${monthly.months} meses · total ${brl(totals.totalCents / 100)}` : `12× de ${brl(totals.installmentCents / 100)}`}</div>
              </Panel>

              <Panel title="Itens da proposta" hint="Equipamentos e serviços">
                <div className="flex gap-1.5">
                  <select className="field" value={catalogPick} onChange={(e) => setCatalogPick(e.target.value)}>
                    <option value="">Adicionar do catálogo…</option>
                    {catalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.category} · {c.description}
                      </option>
                    ))}
                  </select>
                  <button className="btn px-3" onClick={() => addFromCatalog(catalogPick)} disabled={!catalogPick}>
                    +
                  </button>
                </div>

                <div className="space-y-2">
                  {proposal.items.map((item) => (
                    <div key={item.id} className="rounded-lg border border-line/60 bg-abyss2/50 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <select
                          className="field w-auto py-1 text-[11px]"
                          value={item.kind}
                          onChange={(e) => patchItem(item.id, { kind: e.target.value as ProposalItem["kind"] })}
                        >
                          <option value="equipamento">Equipamento</option>
                          <option value="servico">Serviço</option>
                        </select>
                        <button className="text-[11px] text-alarm" onClick={() => removeItem(item.id)}>
                          remover
                        </button>
                      </div>
                      <input
                        className="field mt-1.5 text-[12px]"
                        value={item.desc}
                        onChange={(e) => patchItem(item.id, { desc: e.target.value })}
                        placeholder="Descrição"
                      />
                      <input
                        className="field mt-1.5 text-[11px]"
                        value={item.spec}
                        onChange={(e) => patchItem(item.id, { spec: e.target.value })}
                        placeholder="Especificação técnica"
                      />
                      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                        <input
                          className="field text-[11px]"
                          value={item.unit}
                          onChange={(e) => patchItem(item.id, { unit: e.target.value })}
                          placeholder="un"
                        />
                        <input
                          type="number"
                          className="field text-[11px]"
                          value={item.qty}
                          onChange={(e) => patchItem(item.id, { qty: Number(e.target.value) })}
                          placeholder="qtd"
                        />
                        <input
                          type="number"
                          step="0.01"
                          className="field text-[11px]"
                          value={item.price}
                          onChange={(e) => patchItem(item.id, { price: Number(e.target.value) })}
                          placeholder="preço"
                        />
                      </div>
                      <div className="mt-1 text-right font-mono text-[10.5px] text-signal">
                        {brl(item.qty * item.price)}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  className="btn mt-2 w-full"
                  onClick={() =>
                    update({
                      items: [
                        ...proposal.items,
                        { id: uid(), kind: "equipamento", desc: "Novo item", spec: "", unit: "un", qty: 1, price: 0 },
                      ],
                    })
                  }
                >
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
          <PrintActions filename={`${proposal.number}-${proposal.clientName.replace(/\s+/g, "-")}`} compact />
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
