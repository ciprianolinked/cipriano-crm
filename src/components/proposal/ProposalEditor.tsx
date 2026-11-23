"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { brl, fmtDate, fmtDateTime } from "@/lib/brand";
import { calcTotals } from "@/lib/proposal/catalog";
import {
  clampEntryPct,
  clampInstallments,
  MAX_INSTALLMENTS,
  paymentRows,
  paymentTermsText,
  resolveValueBlock,
} from "@/lib/proposal/value-block";
import { STAGES, type ComodatoConfig, type ProposalItem, type ProposalSection, type ValueBlockConfig } from "@/lib/proposal/types";
import { SECTION_LIBRARY } from "@/lib/proposal/generate";
import {
  applyComodato,
  COMODATO_SECTION_PREFIX,
  comodatoSummary,
  defaultComodato,
} from "@/lib/proposal/comodato";
import { useLiveList } from "@/lib/use-live-list";
import { ProposalDocument, type DocData, type DocEdit, type DocSettings } from "@/components/proposal/ProposalDocument";
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
const toDateInput = (value: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : "");

export function ProposalEditor({
  initial,
  settings,
  catalog: catalogInitial,
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
  // Catálogo recarregado ao voltar para a aba: itens cadastrados em outra aba aparecem aqui.
  const catalogLive = useLiveList<EditorCatalogItem>(
    "/api/catalog",
    (d) =>
      ((d as { items?: (EditorCatalogItem & { active?: boolean })[] }).items ?? []).filter((i) => i.active !== false),
    catalogInitial,
  );
  const catalog = catalogLive.items;
  const [revisions, setRevisions] = useState<EditorRevision[]>(initialRevisions);
  const [revisionBusy, setRevisionBusy] = useState(false);
  const [miscPctInput, setMiscPctInput] = useState(8);
  const [infraPctInput, setInfraPctInput] = useState(10);
  const [marginPctInput, setMarginPctInput] = useState(5);
  const [laborValueInput, setLaborValueInput] = useState(2800);

  const maintenanceProposal = isMaintenanceProposal(proposal.briefing);
  const monthly = maintenanceSummary(proposal.items, proposal.discountPct, proposal.briefing);
  const valueBlock = useMemo(
    () =>
      resolveValueBlock({
        briefing: proposal.briefing,
        maintenance: maintenanceProposal,
        itemCount: proposal.items.length,
        discountPct: proposal.discountPct,
        months: monthly.months,
      }),
    [proposal.briefing, maintenanceProposal, proposal.items.length, proposal.discountPct, monthly.months],
  );
  const totals = useMemo(
    () => calcTotals(proposal.items, proposal.discountPct, valueBlock.installments),
    [proposal.items, proposal.discountPct, valueBlock.installments],
  );

  function update(patch: Partial<EditorProposal>) {
    setProposal((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }

  /** Atualização baseada no estado mais recente: edições rápidas não se sobrescrevem. */
  function updateWith(fn: (prev: EditorProposal) => Partial<EditorProposal>) {
    setProposal((prev) => ({ ...prev, ...fn(prev) }));
    setDirty(true);
  }

  function patchSection(id: string, patch: Partial<ProposalSection>) {
    updateWith((prev) => ({ sections: prev.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  }

  /** Condições de pagamento: ao mudar entrada ou parcelas, o texto de pagamento acompanha. */
  function patchValueBlock(patch: Partial<ValueBlockConfig>) {
    updateWith((prev) => {
      const briefing = (prev.briefing ?? {}) as Record<string, unknown>;
      const current = (briefing.valueBlock ?? {}) as ValueBlockConfig;
      const next: ValueBlockConfig = { ...current, ...patch };
      if ("installments" in patch) next.installments = clampInstallments(patch.installments);
      if ("entryPct" in patch) next.entryPct = clampEntryPct(patch.entryPct);
      const paymentChanged = "installments" in patch || "entryPct" in patch;
      return {
        briefing: { ...briefing, valueBlock: next },
        ...(paymentChanged
          ? {
              paymentTerms: paymentTermsText(clampEntryPct(next.entryPct), clampInstallments(next.installments)),
            }
          : {}),
      };
    });
  }

  /** Volta os textos do bloco de valor ao padrão, mantendo parcelas e entrada. */
  function resetValueTexts() {
    updateWith((prev) => {
      const briefing = (prev.briefing ?? {}) as Record<string, unknown>;
      const current = (briefing.valueBlock ?? {}) as ValueBlockConfig;
      return {
        briefing: {
          ...briefing,
          valueBlock: { installments: current.installments, entryPct: current.entryPct },
        },
      };
    });
  }

  const comodatoCfg: ComodatoConfig = {
    ...defaultComodato(),
    ...((proposal.briefing ?? {}) as { comodato?: Partial<ComodatoConfig> }).comodato,
  };
  const comodatoInfo = comodatoSummary(comodatoCfg, proposal.items);

  function setComodato(patch: Partial<ComodatoConfig>) {
    updateWith((prev) => {
      const briefing = (prev.briefing ?? {}) as Record<string, unknown>;
      const current = { ...defaultComodato(), ...((briefing.comodato ?? {}) as Partial<ComodatoConfig>) };
      return { briefing: { ...briefing, comodato: { ...current, ...patch } } };
    });
  }

  // Mantém a versão comodato coerente com os itens, o prazo e a mensalidade.
  // Cláusulas editadas pelo usuário são preservadas; apenas o bloco de valores é recalculado.
  useEffect(() => {
    setProposal((prev) => {
      const briefing = (prev.briefing ?? {}) as Record<string, unknown>;
      const cfg = { ...defaultComodato(), ...((briefing.comodato ?? {}) as Partial<ComodatoConfig>) };
      const hasComodato = prev.sections.some((s) => s.id.startsWith(COMODATO_SECTION_PREFIX));
      if (!cfg.enabled && !hasComodato) return prev;
      const next = applyComodato(prev.sections, {
        config: cfg,
        items: prev.items,
        clientName: prev.clientName,
        site: prev.site,
        companyName: settings.companyName,
      });
      const same =
        next.length === prev.sections.length &&
        next.every(
          (s, i) => s.id === prev.sections[i].id && s.body === prev.sections[i].body && s.enabled === prev.sections[i].enabled,
        );
      return same ? prev : { ...prev, sections: next };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal.items, comodatoCfg.enabled, comodatoCfg.termMonths, comodatoCfg.monthlyCents, comodatoCfg.residualCents, settings.companyName]);

  function moveSection(id: string, dir: -1 | 1) {
    const index = proposal.sections.findIndex((s) => s.id === id);
    const target = index + dir;
    if (index < 0 || target < 0 || target >= proposal.sections.length) return;
    const next = [...proposal.sections];
    [next[index], next[target]] = [next[target], next[index]];
    update({ sections: next });
  }

  function patchItem(id: string, patch: Partial<ProposalItem>) {
    updateWith((prev) => ({ items: prev.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  }

  /** Ações de edição direta usadas pelo documento: cada texto alterado atualiza o painel ao lado. */
  const docEdit: DocEdit = {
    section: (id, patch) => patchSection(id, patch),
    row: (sectionId, index, patch) =>
      updateWith((prev) => ({
        sections: prev.sections.map((s) =>
          s.id === sectionId ? { ...s, rows: (s.rows ?? []).map((r, i) => (i === index ? { ...r, ...patch } : r)) } : s,
        ),
      })),
    proposal: (patch) => updateWith(() => patch),
    value: (patch) => patchValueBlock(patch),
    item: (id, patch) => patchItem(id, patch),
    briefing: (patch) => updateWith((prev) => ({ briefing: { ...(prev.briefing ?? {}), ...patch } })),
  };

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
          scope: item.category,
        },
      ],
    });
    setCatalogPick("");
  }

  function addRowToTableSection(sectionId: string) {
    const section = proposal.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const currentRows = section.rows ?? [];
    patchSection(sectionId, {
      rows: [...currentRows, { label: "Nova frente", cipriano: "Escopo Cipriano", client: "A cargo do cliente" }],
    });
  }

  function removeRowFromTableSection(sectionId: string, index: number) {
    const section = proposal.sections.find((s) => s.id === sectionId);
    if (!section || !section.rows) return;
    patchSection(sectionId, {
      rows: section.rows.filter((_, i) => i !== index),
    });
  }

  function patchRowInTableSection(
    sectionId: string,
    index: number,
    patch: { label?: string; cipriano?: string; client?: string },
  ) {
    const section = proposal.sections.find((s) => s.id === sectionId);
    if (!section || !section.rows) return;
    patchSection(sectionId, {
      rows: section.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    });
  }

  function patchColumnsInTableSection(sectionId: string, colIndex: number, value: string) {
    const section = proposal.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const cols = [...(section.columns ?? ["Frente de trabalho", "Cipriano Tech & Security", "Cliente"])];
    cols[colIndex] = value;
    patchSection(sectionId, { columns: cols });
  }

  function applyEngineeringCosts(miscPct = 8, infraPct = 10, marginPct = 5, laborVal = 2800) {
    const baseEquipment = proposal.items.filter(
      (it) =>
        it.kind === "equipamento" &&
        !it.desc.startsWith("Miscelâneas") &&
        !it.desc.startsWith("Infraestrutura seca") &&
        !it.desc.startsWith("Margem de segurança"),
    );
    const equipSubtotal = baseEquipment.reduce((sum, it) => sum + it.qty * it.price, 0);

    const otherItems = proposal.items.filter(
      (it) =>
        !it.desc.startsWith("Miscelâneas") &&
        !it.desc.startsWith("Infraestrutura seca") &&
        !it.desc.startsWith("Margem de segurança") &&
        !it.desc.startsWith("Mão de obra técnica"),
    );

    const newItems = [...otherItems];
    if (equipSubtotal > 0) {
      if (miscPct > 0) {
        newItems.push({
          id: uid(),
          kind: "equipamento",
          desc: "Miscelâneas de instalação e fixação",
          spec: `Conectores blindados, buchas, parafusos, abraçadeiras, caixas de passagem e vedação (${miscPct}% sobre equipamentos)`,
          unit: "vb",
          qty: 1,
          price: Math.round((equipSubtotal * miscPct) / 100),
          scope: "Rede e Infraestrutura",
        });
      }
      if (infraPct > 0) {
        newItems.push({
          id: uid(),
          kind: "equipamento",
          desc: "Infraestrutura seca, eletrodutos e canaletas",
          spec: `Eletrodutos rígidos/flexíveis, canaletas de proteção, curvas, conexões e suportes (${infraPct}% sobre equipamentos)`,
          unit: "vb",
          qty: 1,
          price: Math.round((equipSubtotal * infraPct) / 100),
          scope: "Rede e Infraestrutura",
        });
      }
      if (marginPct > 0) {
        newItems.push({
          id: uid(),
          kind: "equipamento",
          desc: "Margem de segurança e contingência técnica",
          spec: `Reserva técnica para adequações de campo, sobras de cabos e tolerância técnica (${marginPct}% sobre equipamentos)`,
          unit: "vb",
          qty: 1,
          price: Math.round((equipSubtotal * marginPct) / 100),
          scope: "Itens Complementares",
        });
      }
    }
    if (laborVal > 0) {
      newItems.push({
        id: uid(),
        kind: "servico",
        desc: "Mão de obra técnica de instalação e comissionamento",
        spec: "Fixação física, passagem de cabos, conectorização, configuração de software, testes e entrega técnica",
        unit: "vb",
        qty: 1,
        price: laborVal,
        scope: "Projeto e Serviços Técnicos",
      });
    }
    update({ items: newItems });
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
              href={`/propostas/${proposal.id}/termo`}
              className={`btn ${proposal.status === "ganho" ? "btn-primary" : "!border-armed/40 !text-armed"}`}
              onClick={(event) => {
                if (dirty) {
                  event.preventDefault();
                  window.alert("Salve as alterações da proposta antes de abrir o termo de entrega.");
                }
              }}
              title={proposal.status === "ganho" ? "Proposta ganha: formalize a entrega técnica" : "Elaborar termo de entrega e comissionamento"}
            >
              Termo de entrega
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
        <div className="print-area scroll-thin overflow-x-auto rounded-xl border border-line/50 bg-[#0b1728] p-4">
          <div className="mx-auto w-[794px]">
            <ProposalDocument proposal={proposal} settings={settings} edit={docEdit} />
          </div>
        </div>

        <aside className="no-print space-y-3">
          {typeof (proposal.briefing as { osId?: unknown } | null)?.osId === "string" ? (
            <Link
              href={`/os/${(proposal.briefing as { osId?: string }).osId}`}
              className="flex items-start gap-2 rounded-xl border border-armed/40 bg-armed/5 p-3 transition hover:border-armed/70"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-armed/40 text-[12px] text-armed">⌗</span>
              <span className="min-w-0">
                <span className="block text-[11.5px] font-medium text-white">
                  Orçamento da OS {(proposal.briefing as { osNumber?: string }).osNumber ?? ""}
                </span>
                <span className="mt-0.5 block text-[10.5px] leading-relaxed text-steel">
                  Esta proposta foi gerada por uma ordem de serviço. Ao salvar, o valor da OS é atualizado. Abra a OS →
                </span>
              </span>
            </Link>
          ) : null}
          <section className="rounded-xl border border-signal/25 bg-signal/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="label-mono text-signal">Resumo ao vivo</span>
              <span className="text-[10px] text-steel">clique nos textos do documento para editar</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px]">
              <span className="text-steel">Itens</span>
              <span className="text-right text-silver">{proposal.items.length === 1 ? "1 item" : `${proposal.items.length} itens`}</span>
              <span className="text-steel">Subtotal</span>
              <span className="text-right text-silver">{brl(totals.subtotalCents / 100)}</span>
              <span className="text-steel">Desconto</span>
              <span className="text-right text-silver">{proposal.discountPct}%</span>
              <span className="text-steel">{maintenanceProposal ? "Mensalidade" : "Total"}</span>
              <span className="text-right font-semibold text-signal">
                {maintenanceProposal ? `${brl(monthly.monthlyCents / 100)}/mês` : brl(totals.totalCents / 100)}
              </span>
              {!maintenanceProposal ? (
                <>
                  <span className="text-steel">
                    {valueBlock.installments}× {valueBlock.installmentLabel}
                  </span>
                  <span className="text-right text-silver">{brl(totals.installmentCents / 100)}</span>
                  <span className="text-steel">Entrada · {valueBlock.entryPct}%</span>
                  <span className="text-right text-silver">{brl(Math.round((totals.totalCents * valueBlock.entryPct) / 100) / 100)}</span>
                </>
              ) : null}
              {comodatoCfg.enabled ? (
                <>
                  <span className="text-steel">Comodato</span>
                  <span className="text-right text-silver">
                    {brl(comodatoInfo.monthlyCents / 100)}/mês · {comodatoInfo.termMonths} meses
                  </span>
                </>
              ) : null}
            </div>
          </section>
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
                <div className="text-[11px] text-steel">{maintenanceProposal ? `${brl(monthly.monthlyCents / 100)}/mês · ${monthly.months} meses · total ${brl(totals.totalCents / 100)}` : `${valueBlock.installments}× de ${brl(totals.installmentCents / 100)}`}</div>
              </Panel>

              <Panel title="Condições de pagamento" hint="Entrada, parcelas de 1 a 60 e saldo na entrega técnica">
                <div className="grid grid-cols-2 gap-2">
                  <Field label={`Parcelas no cartão (1–${MAX_INSTALLMENTS})`}>
                    <input
                      type="number"
                      min={1}
                      max={MAX_INSTALLMENTS}
                      className="field"
                      value={valueBlock.installments}
                      onChange={(e) => {
                        if (e.target.value !== "") patchValueBlock({ installments: Number(e.target.value) });
                      }}
                    />
                  </Field>
                  <Field label="Entrada na assinatura (%)">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="field"
                      value={valueBlock.entryPct}
                      onChange={(e) => {
                        if (e.target.value !== "") patchValueBlock({ entryPct: Number(e.target.value) });
                      }}
                    />
                  </Field>
                </div>
                {!maintenanceProposal ? (
                  <div className="space-y-1.5 rounded-lg border border-signal/25 bg-signal/5 p-2.5 text-[11.5px]">
                    {paymentRows(valueBlock, totals.totalCents).map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-3">
                        <span className="text-steel">{label}</span>
                        <span className="text-right text-silver">{value}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <p className="text-[10.5px] leading-relaxed text-steel">
                  O texto de pagamento das condições comerciais acompanha entrada e parcelas. Títulos, rótulos e observações são editados direto no documento.
                </p>
                <button className="btn w-full text-[11px]" onClick={resetValueTexts}>
                  Restaurar textos padrão do bloco
                </button>
              </Panel>

              {!maintenanceProposal ? (
                <Panel title="Versão comodato" hint="Equipamentos cedidos ao cliente com mensalidade (opcional)">
                  <label className="flex items-center gap-2 text-[12px] text-silver">
                    <input type="checkbox" checked={comodatoCfg.enabled} onChange={(e) => setComodato({ enabled: e.target.checked })} />
                    Incluir versão comodato na proposta
                  </label>
                  {comodatoCfg.enabled ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Prazo (meses)">
                          <input
                            type="number"
                            min={1}
                            max={120}
                            className="field"
                            value={comodatoCfg.termMonths}
                            onChange={(e) => {
                              if (e.target.value !== "") setComodato({ termMonths: Number(e.target.value) });
                            }}
                          />
                        </Field>
                        <Field label="Mensalidade (R$)">
                          <input
                            type="number"
                            min={0}
                            step={10}
                            className="field"
                            value={comodatoInfo.monthlyCents / 100}
                            onChange={(e) => {
                              if (e.target.value !== "") setComodato({ monthlyCents: Math.round(Number(e.target.value) * 100) });
                            }}
                          />
                        </Field>
                      </div>
                      <Field label="Aquisição ao final do prazo (R$, opcional)">
                        <input
                          type="number"
                          min={0}
                          step={100}
                          className="field"
                          value={comodatoCfg.residualCents / 100}
                          onChange={(e) => {
                            if (e.target.value !== "") setComodato({ residualCents: Math.round(Number(e.target.value) * 100) });
                          }}
                        />
                      </Field>
                      <div className="text-[11px] text-steel">
                        Total do comodato: {brl(comodatoInfo.totalCents / 100)} · referência dos equipamentos:{" "}
                        {brl(comodatoInfo.equipmentCents / 100)}
                      </div>
                      {comodatoCfg.monthlyCents !== null ? (
                        <button className="btn w-full text-[11px]" onClick={() => setComodato({ monthlyCents: null })}>
                          Voltar à mensalidade automática
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </Panel>
              ) : null}

              {!maintenanceProposal ? (
                <Panel title="Custos indiretos e mão de obra" hint="Calculados sobre os equipamentos desta proposta">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Miscelâneas (%)">
                      <input type="number" min={0} max={100} className="field" value={miscPctInput} onChange={(e) => setMiscPctInput(Number(e.target.value))} />
                    </Field>
                    <Field label="Infraestrutura (%)">
                      <input type="number" min={0} max={100} className="field" value={infraPctInput} onChange={(e) => setInfraPctInput(Number(e.target.value))} />
                    </Field>
                    <Field label="Margem de segurança (%)">
                      <input type="number" min={0} max={100} className="field" value={marginPctInput} onChange={(e) => setMarginPctInput(Number(e.target.value))} />
                    </Field>
                    <Field label="Mão de obra (R$)">
                      <input type="number" min={0} step={50} className="field" value={laborValueInput} onChange={(e) => setLaborValueInput(Number(e.target.value))} />
                    </Field>
                  </div>
                  <button
                    className="btn btn-primary w-full text-[11px]"
                    onClick={() => applyEngineeringCosts(miscPctInput, infraPctInput, marginPctInput, laborValueInput)}
                  >
                    Aplicar custos indiretos e mão de obra
                  </button>
                  <p className="text-[10.5px] leading-relaxed text-steel">
                    Recria as linhas de miscelâneas, infraestrutura, margem e mão de obra a partir dos equipamentos atuais.
                  </p>
                </Panel>
              ) : null}

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
