"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  FileCheck2,
  FileText,
  LoaderCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import { brl } from "@/lib/brand";
import { PRIORITIES, SEGMENTS, defaultBriefing } from "@/lib/proposal/catalog";
import { defaultMaintenancePlan, maintenanceSummary, validateMaintenancePlan } from "@/lib/proposal/maintenance-plan";
import { MaintenancePlanFields } from "@/components/proposal/MaintenancePlanFields";
import { ReferencePanel, type AnalysisContext, type AnalysisResponse } from "@/components/proposal/ReferencePanel";
import { fetchJson } from "@/lib/api-client";
import { useLiveList } from "@/lib/use-live-list";
import { comodatoSummary, defaultComodato, DEFAULT_COMODATO_TERM } from "@/lib/proposal/comodato";
import { MAX_INSTALLMENTS, DEFAULT_INSTALLMENTS, DEFAULT_ENTRY_PCT, clampEntryPct, clampInstallments } from "@/lib/proposal/value-block";
import type { CompetitorAnalysis } from "@/lib/references-analysis";
import {
  PROPOSAL_TYPES,
  type Briefing,
  type MaintenancePlan,
  type ProposalDraft,
  type ProposalItem,
  type ProposalType,
  type Totals,
} from "@/lib/proposal/types";
import type { Insight } from "@/lib/ai";

type ClientOption = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
};

export type WizardCatalogItem = {
  id: string;
  kind: string;
  category: string;
  description: string;
  spec: string | null;
  unit: string;
  priceCents: number;
  active?: boolean;
};

type Preview = { draft: ProposalDraft; totals: Totals; insights: Insight[]; aiNote: string; error?: string };

const uid = () => `wiz-${Math.random().toString(36).slice(2, 9)}`;
const timeLabel = (d: Date | null) => (d ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");

export function NewProposalWizard({
  clients: initialClients,
  catalog: initialCatalog = [],
  aiEnabled = false,
}: {
  clients: ClientOption[];
  catalog?: WizardCatalogItem[];
  aiEnabled?: boolean;
}) {
  const router = useRouter();
  // Clientes e catálogo são recarregados ao voltar para a aba: cadastros feitos em outra aba aparecem aqui.
  const clientsLive = useLiveList<ClientOption>(
    "/api/clients",
    (d) => (d as { clients?: ClientOption[] }).clients ?? [],
    initialClients,
  );
  const catalogLive = useLiveList<WizardCatalogItem>(
    "/api/catalog",
    (d) => ((d as { items?: WizardCatalogItem[] }).items ?? []).filter((i) => i.active !== false),
    initialCatalog.filter((i) => i.active !== false),
  );
  const clients = clientsLive.items;
  const catalog = catalogLive.items;

  const [purpose, setPurpose] = useState<"projeto" | "manutencao_mensal">("projeto");
  const [type, setType] = useState<ProposalType>("completa");
  const [info, setInfo] = useState({
    clientId: "",
    clientName: "",
    contact: "",
    clientEmail: "",
    site: "",
    validityDays: 15,
    artIncluded: true,
  });
  const [briefing, setBriefing] = useState<Briefing>({
    ...defaultBriefing,
    monitoring: false,
    valueBlock: { installments: DEFAULT_INSTALLMENTS, entryPct: DEFAULT_ENTRY_PCT },
    comodato: defaultComodato(),
  });
  const [plan, setPlan] = useState<MaintenancePlan>(defaultMaintenancePlan);
  const [rawNotes, setRawNotes] = useState("");
  const [wantsContract, setWantsContract] = useState(false);
  const [polish, setPolish] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<CompetitorAnalysis | null>(null);
  const [source, setSource] = useState<"briefing" | "matched">("briefing");

  // Inserção direta de produtos do catálogo na proposta
  const [catalogPick, setCatalogPick] = useState("");
  const [catalogQty, setCatalogQty] = useState(1);
  const [catalogFilter, setCatalogFilter] = useState("");
  const [selectedCatalogItems, setSelectedCatalogItems] = useState<ProposalItem[]>([]);

  const maintenance = purpose === "manutencao_mensal";
  const comodato = briefing.comodato ?? defaultComodato();
  const entryPct = clampEntryPct(briefing.valueBlock?.entryPct);
  const installments = clampInstallments(briefing.valueBlock?.installments);

  function invalidate() {
    setPreview(null);
    setError("");
    setAnalysis(null);
    setSource("briefing");
  }

  const analysisContext: AnalysisContext = {
    type,
    clientName: info.clientName,
    contact: info.contact,
    clientEmail: info.clientEmail,
    site: info.site,
    validityDays: info.validityDays,
  };

  function applyAnalysis(result: AnalysisResponse) {
    setPreview({ draft: result.draft, totals: result.totals, insights: result.insights, aiNote: result.aiNote });
    setAnalysis(result.analysis);
    setSource("matched");
    setError("");
  }

  function updateInfo(patch: Partial<typeof info>) {
    setInfo((p) => ({ ...p, ...patch }));
    invalidate();
  }

  function updateBriefing(patch: Partial<Briefing>) {
    setBriefing((p) => ({ ...p, ...patch }));
    invalidate();
  }

  function updateValueBlock(patch: { entryPct?: number; installments?: number }) {
    setBriefing((p) => ({ ...p, valueBlock: { ...(p.valueBlock ?? {}), ...patch } }));
    invalidate();
  }

  function updateComodato(patch: Partial<typeof comodato>) {
    setBriefing((p) => ({ ...p, comodato: { ...(p.comodato ?? defaultComodato()), ...patch } }));
    invalidate();
  }

  function applyClient(id: string) {
    const c = clients.find((p) => p.id === id);
    if (!c) {
      updateInfo({ clientId: "", clientName: "", contact: "", clientEmail: "", site: "" });
      return;
    }
    updateInfo({
      clientId: id,
      clientName: c.name,
      contact: c.contactName ?? "",
      clientEmail: c.email ?? "",
      site: [c.address, [c.city, c.state].filter(Boolean).join("/")].filter(Boolean).join(" — "),
    });
  }

  function addCatalogItem() {
    const item = catalog.find((c) => c.id === catalogPick);
    if (!item) return;
    const qty = Math.max(1, catalogQty || 1);
    setSelectedCatalogItems((prev) => [
      ...prev,
      {
        id: uid(),
        kind: item.kind === "servico" ? "servico" : "equipamento",
        desc: item.description,
        spec: item.spec ?? `Categoria: ${item.category}`,
        unit: item.unit,
        qty,
        price: item.priceCents / 100,
        scope: item.category,
      },
    ]);
    setCatalogPick("");
    setCatalogQty(1);
    invalidate();
  }

  function removeCatalogItem(id: string) {
    setSelectedCatalogItems((prev) => prev.filter((i) => i.id !== id));
    invalidate();
  }

  async function generate() {
    setError("");
    if (!info.clientName.trim()) {
      setError("Informe o nome do cliente.");
      return;
    }
    if (info.validityDays < 1 || info.validityDays > 365) {
      setError("A validade deve ser de 1 a 365 dias.");
      return;
    }
    if (maintenance) {
      try {
        validateMaintenancePlan(plan);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Confira a manutenção.");
        return;
      }
    }
    setLoading(true);
    try {
      const data = await fetchJson<Preview>("/api/generate", {
        method: "POST",
        body: JSON.stringify({
          ...info,
          type,
          polish,
          artIncluded: maintenance ? false : info.artIncluded,
          customItems: selectedCatalogItems,
          briefing: {
            ...briefing,
            monitoring: false,
            purpose,
            wantsContract,
            ...(maintenance ? { maintenance: true, maintenancePlan: plan } : {}),
            rawNotes,
          },
        }),
      });
      setPreview(data);
      setAnalysis(null);
      setSource("briefing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha de conexão.");
    } finally {
      setLoading(false);
    }
  }

  async function save(status: "novo" | "enviada") {
    if (!preview) return;
    setSaving(true);
    setError("");
    try {
      const data = await fetchJson<{ proposal?: { id: string } }>("/api/proposals", {
        method: "POST",
        body: JSON.stringify({
          type,
          clientId: info.clientId || null,
          status,
          draft: { ...preview.draft, briefing: { ...preview.draft.briefing, wantsContract } },
        }),
      });
      if (!data.proposal) throw new Error("Não foi possível salvar a proposta.");
      router.push(wantsContract ? `/contratos/novo?proposta=${data.proposal.id}` : `/propostas/${data.proposal.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const monthly = preview ? maintenanceSummary(preview.draft.items, preview.draft.discountPct, preview.draft.briefing) : null;
  const comodatoInfo = comodatoSummary(comodato, preview?.draft.items ?? []);

  const filteredCatalog = catalog.filter((c) => {
    if (!catalogFilter.trim()) return true;
    const term = catalogFilter.toLowerCase();
    return (
      c.description.toLowerCase().includes(term) ||
      c.category.toLowerCase().includes(term) ||
      (c.spec ?? "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        {/* ETAPA 1 */}
        <section className="card p-5">
          <div className="label-mono text-signal">Etapa 1 · objetivo</div>
          <h2 className="mt-1 font-display text-lg font-semibold text-white">Qual proposta vamos elaborar?</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                { id: "projeto", title: "Projeto, produtos ou serviços", text: "Fornecimento, instalação ou serviço avulso.", Icon: FileText },
                { id: "manutencao_mensal", title: "Manutenção mensal", text: "Preventiva e corretiva, com cobrança recorrente.", Icon: Wrench },
              ] as const
            ).map(({ id, title, text, Icon }) => (
              <button
                type="button"
                key={id}
                className={`rounded-xl border p-4 text-left transition hover:border-signal/50 ${
                  purpose === id ? "border-signal/55 bg-signal/[0.07]" : "border-line/60 bg-abyss2/40"
                }`}
                onClick={() => {
                  setPurpose(id);
                  invalidate();
                }}
              >
                <div className="flex items-center justify-between">
                  <Icon size={19} className={purpose === id ? "text-signal" : "text-steel"} />
                  {purpose === id ? <Check size={15} className="text-signal" /> : null}
                </div>
                <div className="mt-3 font-display text-[14px] font-semibold text-white">{title}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-steel">{text}</p>
              </button>
            ))}
          </div>

          <div className="mt-5 border-t border-line/40 pt-4">
            <div className="label-mono mb-2">Formato do documento</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {PROPOSAL_TYPES.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => {
                    setType(t.id);
                    invalidate();
                  }}
                  className={`rounded-lg border p-3 text-left ${type === t.id ? "border-signal/50 bg-signal/5" : "border-line/50"}`}
                >
                  <div className={`text-[12px] font-medium ${type === t.id ? "text-signal" : "text-silver"}`}>{t.short}</div>
                  <p className="mt-1 text-[10px] leading-relaxed text-steel">
                    {t.id === "completa" ? "Escopo e condições detalhados" : t.id === "simples" ? "Uma apresentação objetiva" : "Orçamento com itens e condições"}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* INTELIGÊNCIA COMPETITIVA */}
        <ReferencePanel context={analysisContext} onAnalysisReady={applyAnalysis} />

        {/* ETAPA 2 */}
        <section className="card p-5">
          <div className="label-mono text-signal">Etapa 2 · destinatário</div>
          <h2 className="mt-1 font-display text-lg font-semibold text-white">Cliente e local</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="flex flex-wrap items-center justify-between gap-2 label-mono mb-1.5">
                <span>Cliente cadastrado</span>
                <button
                  type="button"
                  onClick={() => void clientsLive.refresh()}
                  className="inline-flex items-center gap-1 text-[10px] normal-case tracking-normal text-steel hover:text-signal"
                >
                  <RefreshCw size={11} className={clientsLive.refreshing ? "animate-spin" : ""} />
                  Atualizar lista{clientsLive.updatedAt ? ` · ${timeLabel(clientsLive.updatedAt)}` : ""}
                </button>
              </span>
              <select className="field" value={info.clientId} onChange={(e) => applyClient(e.target.value)}>
                <option value="">Digitar cliente manualmente</option>
                {clients.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[10.5px] text-steel">
                Cadastrou um cliente agora há pouco? A lista é atualizada ao voltar para esta aba. Ou{" "}
                <Link href="/clientes" className="text-signal hover:underline">
                  cadastre pelo CNPJ em Clientes →
                </Link>
              </p>
            </label>
            <Field label="Nome do cliente *">
              <input className="field" value={info.clientName} onChange={(e) => updateInfo({ clientName: e.target.value })} placeholder="Nome do cliente" />
            </Field>
            <Field label="Contato / cargo">
              <input className="field" value={info.contact} onChange={(e) => updateInfo({ contact: e.target.value })} placeholder="Responsável" />
            </Field>
            <Field label="E-mail">
              <input className="field" type="email" value={info.clientEmail} onChange={(e) => updateInfo({ clientEmail: e.target.value })} />
            </Field>
            <Field label="Local da prestação de serviços">
              <input className="field" value={info.site} onChange={(e) => updateInfo({ site: e.target.value })} />
            </Field>
            <Field label="Validade da proposta (dias)">
              <input type="number" min={1} max={365} className="field" value={info.validityDays} onChange={(e) => updateInfo({ validityDays: Number(e.target.value) })} />
            </Field>
            {!maintenance ? (
              <label className="flex items-center gap-2 text-[12px] text-silver sm:col-span-2">
                <input type="checkbox" checked={info.artIncluded} onChange={(e) => updateInfo({ artIncluded: e.target.checked })} />
                Incluir ART / projeto executivo e memorial descritivo
              </label>
            ) : null}
          </div>
        </section>

        {/* ETAPA 3 */}
        <section className="card p-5">
          <div className="label-mono text-signal">Etapa 3 · escopo e valores</div>
          <h2 className="mt-1 font-display text-lg font-semibold text-white">
            {maintenance ? "Plano de manutenção mensal" : "Briefing técnico & produtos"}
          </h2>
          <p className="mt-1 mb-4 text-[11px] leading-relaxed text-steel">
            {maintenance
              ? "Defina o que está incluído, os limites de atendimento e o valor de cada mês."
              : "Informe as quantidades, os produtos do catálogo e as condições de pagamento. Miscelâneas, infraestrutura e margem são calculadas sobre os equipamentos."}
          </p>

          {maintenance ? (
            <MaintenancePlanFields
              value={plan}
              onChange={(p) => {
                setPlan(p);
                invalidate();
              }}
            />
          ) : (
            <div className="space-y-4">
              {/* PRODUTOS DO CATÁLOGO */}
              {catalog.length > 0 ? (
                <div className="rounded-xl border border-signal/30 bg-signal/[0.04] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="label-mono text-signal">Inserir produtos do catálogo</div>
                      <div className="text-[12px] font-medium text-silver">Adicione itens específicos do catálogo na proposta</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedCatalogItems.length > 0 ? (
                        <span className="chip !border-signal/50 !text-signal">{selectedCatalogItems.length} item(ns) incluído(s)</span>
                      ) : null}
                      <button type="button" className="btn px-2 py-1 text-[10.5px]" onClick={() => void catalogLive.refresh()}>
                        <RefreshCw size={11} className={catalogLive.refreshing ? "animate-spin" : ""} /> Atualizar
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_100px_auto]">
                    <input className="field text-[11px]" placeholder="Filtrar catálogo…" value={catalogFilter} onChange={(e) => setCatalogFilter(e.target.value)} />
                    <select className="field text-[11.5px]" value={catalogPick} onChange={(e) => setCatalogPick(e.target.value)}>
                      <option value="">Selecione um produto do catálogo…</option>
                      {filteredCatalog.map((c) => (
                        <option key={c.id} value={c.id}>
                          [{c.category}] {c.description} — {brl(c.priceCents / 100)}/{c.unit}
                        </option>
                      ))}
                    </select>
                    <input type="number" min={1} className="field text-[11px]" value={catalogQty} onChange={(e) => setCatalogQty(Number(e.target.value) || 1)} placeholder="Qtd" />
                    <button type="button" className="btn btn-primary px-3 text-[11.5px]" onClick={addCatalogItem} disabled={!catalogPick}>
                      <Plus size={14} /> Incluir
                    </button>
                  </div>

                  {selectedCatalogItems.length > 0 ? (
                    <div className="mt-3 space-y-1.5 border-t border-line/40 pt-2.5">
                      <div className="label-mono text-[9px]">Itens do catálogo adicionados:</div>
                      {selectedCatalogItems.map((item) => (
                        <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line/50 bg-abyss2/50 px-2.5 py-1.5 text-[11px]">
                          <span className="text-silver">
                            <b className="font-mono text-signal">{item.qty} {item.unit}</b> · {item.desc}
                            {item.spec ? <span className="text-steel"> ({item.spec})</span> : null}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10.5px] text-signal">{brl(item.price * item.qty)}</span>
                            <button type="button" onClick={() => removeCatalogItem(item.id)} className="text-steel hover:text-alarm" title="Remover item">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* CONDIÇÕES COMERCIAIS */}
              <div className="rounded-xl border border-line/60 bg-abyss2/40 p-4">
                <div className="label-mono text-signal">Condições de pagamento</div>
                <div className="mt-1 text-[12px] font-medium text-silver">Entrada na assinatura e parcelamento no cartão (1 a {MAX_INSTALLMENTS}×)</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Entrada na assinatura (%)">
                    <input type="number" min={0} max={100} className="field" value={entryPct} onChange={(e) => updateValueBlock({ entryPct: Number(e.target.value) })} />
                  </Field>
                  <Field label={`Parcelas no cartão (1 a ${MAX_INSTALLMENTS})`}>
                    <input type="number" min={1} max={MAX_INSTALLMENTS} className="field" value={installments} onChange={(e) => updateValueBlock({ installments: Number(e.target.value) })} />
                  </Field>
                </div>
                <p className="mt-2 text-[10.5px] leading-relaxed text-steel">
                  O restante ({100 - entryPct}%) é pago na entrega técnica. Ajuste também o texto do bloco de valor direto no documento.
                </p>
              </div>

              {/* CUSTOS INDIRETOS */}
              <div className="rounded-xl border border-line/60 bg-abyss2/40 p-4">
                <div className="label-mono text-signal">Custos indiretos & engenharia</div>
                <div className="mt-1 text-[12px] font-medium text-silver">
                  Miscelâneas, infraestrutura e margem de segurança (% sobre equipamentos) e mão de obra
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <Field label="Miscelâneas (%)">
                    <input type="number" min={0} max={100} className="field" value={briefing.miscPct ?? 8} onChange={(e) => updateBriefing({ miscPct: Number(e.target.value) })} />
                  </Field>
                  <Field label="Infraestrutura (%)">
                    <input type="number" min={0} max={100} className="field" value={briefing.infraPct ?? 10} onChange={(e) => updateBriefing({ infraPct: Number(e.target.value) })} />
                  </Field>
                  <Field label="Margem de segurança (%)">
                    <input type="number" min={0} max={100} className="field" value={briefing.marginPct ?? 5} onChange={(e) => updateBriefing({ marginPct: Number(e.target.value) })} />
                  </Field>
                  <Field label="Mão de obra (R$)">
                    <input type="number" min={0} step={50} className="field" value={briefing.laborValue ?? 2800} onChange={(e) => updateBriefing({ laborValue: Number(e.target.value) })} />
                  </Field>
                </div>
                <p className="mt-2 text-[10.5px] leading-relaxed text-steel">
                  Os custos indiretos são linhas discriminadas, recalculadas quando você inclui ou altera equipamentos. Podem ser editados no documento.
                </p>
              </div>

              {/* QUANTIDADES */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    ["cameras", "Câmeras IP"],
                    ["doors", "Portas com acesso"],
                    ["fenceMeters", "Perímetro (m)"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <input className="field" type="number" min={0} value={briefing[key]} onChange={(e) => updateBriefing({ [key]: Number(e.target.value) })} />
                  </Field>
                ))}
                <Field label="Segmento">
                  <select className="field" value={briefing.segment} onChange={(e) => updateBriefing({ segment: e.target.value })}>
                    {SEGMENTS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["alarm", "Alarme de intrusão"],
                    ["intercom", "Interfonia IP"],
                    ["network", "Rede / rack / nobreak"],
                    ["maintenance", "Adicionar manutenção"],
                  ] as const
                ).map(([key, label]) => (
                  <button type="button" key={key} onClick={() => updateBriefing({ [key]: !briefing[key] })} className={`chip ${briefing[key] ? "!border-signal/50 !text-signal bg-signal/10" : ""}`}>
                    {briefing[key] ? "✓ " : "+ "}
                    {label}
                  </button>
                ))}
              </div>

              {/* COMODATO */}
              <div className={`rounded-xl border p-4 ${comodato.enabled ? "border-signal/40 bg-signal/[0.04]" : "border-line/60 bg-abyss2/40"}`}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" className="mt-1 accent-cyan-400" checked={comodato.enabled} onChange={(e) => updateComodato({ enabled: e.target.checked })} />
                  <span>
                    <span className="block font-display text-[13px] font-semibold text-white">Incluir versão comodato</span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-steel">
                      Caso o cliente opte pelo comodato, os equipamentos são cedidos com mensalidade e permanecem de propriedade da Cipriano. O bloco é incluído na proposta e pode ser editado.
                    </span>
                  </span>
                </label>
                {comodato.enabled ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <Field label="Prazo (meses)">
                      <input
                        type="number"
                        min={1}
                        max={120}
                        className="field"
                        value={comodato.termMonths || DEFAULT_COMODATO_TERM}
                        onChange={(e) => updateComodato({ termMonths: Number(e.target.value) })}
                      />
                    </Field>
                    <Field label="Mensalidade (R$, opcional)">
                      <input
                        type="number"
                        min={0}
                        step={10}
                        className="field"
                        value={comodato.monthlyCents === null ? "" : comodato.monthlyCents / 100}
                        placeholder="Automática"
                        onChange={(e) => updateComodato({ monthlyCents: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100) })}
                      />
                    </Field>
                    <p className="self-end text-[10.5px] leading-relaxed text-steel">
                      {preview
                        ? `Mensalidade estimada: ${brl(comodatoInfo.monthlyCents / 100)} por mês`
                        : "Sem mensalidade informada, o valor é os equipamentos ÷ prazo. Confirme no preview."}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Prioridade">
                  <select className="field" value={briefing.priority} onChange={(e) => updateBriefing({ priority: e.target.value as Briefing["priority"] })}>
                    {PRIORITIES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Anotações / briefing do cliente">
                  <textarea
                    className="field min-h-[75px]"
                    value={rawNotes}
                    onChange={(e) => {
                      setRawNotes(e.target.value);
                      invalidate();
                    }}
                    placeholder="Cole mensagens do WhatsApp, requisitos da visita ou particularidades da instalação…"
                  />
                </Field>
              </div>
            </div>
          )}
        </section>

        {/* CONTRATO */}
        <section className="card p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 accent-cyan-400" checked={wantsContract} onChange={(e) => setWantsContract(e.target.checked)} />
            <span>
              <span className="flex items-center gap-2 font-display text-[14px] font-semibold text-white">
                <FileCheck2 size={16} className="text-signal" /> Elaborar contrato após salvar (opcional)
              </span>
              <span className="mt-1 block text-[11px] leading-relaxed text-steel">
                Marque se o cliente deseja formalizar a proposta em contrato. Você revisará a minuta em uma etapa separada; nada é ativado ou enviado automaticamente.
              </span>
            </span>
          </label>
        </section>

        {aiEnabled ? (
          <label className="flex items-center gap-2 text-[11px] text-steel">
            <input type="checkbox" checked={polish} onChange={(e) => { setPolish(e.target.checked); invalidate(); }} />
            Refinar a redação do escopo com a IA configurada no servidor.
          </label>
        ) : null}

        {error ? (
          <div role="alert" className="rounded-lg border border-alarm/35 bg-alarm/5 p-3 text-[12px] text-alarm">
            {error}
          </div>
        ) : null}

        <div className="flex gap-2">
          <button type="button" className="btn btn-primary px-5 py-3" disabled={loading || saving} onClick={generate}>
            {loading ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? "Elaborando…" : preview ? "Gerar novamente" : "Elaborar proposta"}
          </button>
          <Link href="/propostas" className="btn">
            Cancelar
          </Link>
        </div>
      </div>

      {/* RESUMO */}
      <aside className="space-y-4 xl:sticky xl:top-5">
        <section className="card overflow-hidden">
          <div className="border-b border-line/50 p-4">
            <div className="label-mono text-signal">Resumo</div>
            <h2 className="mt-1 font-display text-[16px] font-semibold text-white">
              {maintenance ? "Sua proposta de manutenção" : "Sua proposta comercial"}
            </h2>
          </div>

          <div className="p-4">
            {preview ? (
              <div className="space-y-4">
                {source === "matched" && analysis ? (
                  <div className="rounded-lg border border-network/35 bg-network/5 p-2.5 text-[10.5px] leading-relaxed text-silver">
                    <b className="text-signal">Proposta igualada à referência</b> · {analysis.scopes.length} escopo(s) separados · sem desconto automático. Edite valores e itens depois de salvar.
                  </div>
                ) : null}

                <div className="rounded-xl border border-signal/25 bg-signal/5 p-4">
                  <div className="label-mono">{maintenance ? "Mensalidade" : "Investimento total"}</div>
                  <div className="mt-1 font-display text-[25px] font-semibold text-signal">
                    {brl((maintenance ? monthly!.monthlyCents : preview.totals.totalCents) / 100)}
                    {maintenance ? <span className="ml-1 text-sm font-normal text-steel">/mês</span> : null}
                  </div>
                  <div className="mt-2 text-[11px] text-steel">
                    {maintenance
                      ? `${monthly!.months} meses · total do período ${brl(monthly!.totalCents / 100)}`
                      : `${preview.draft.items.length === 1 ? "1 item" : `${preview.draft.items.length} itens`}${preview.draft.discountPct > 0 ? ` · ${preview.draft.discountPct}% de desconto` : ""} · ${installments}× de ${brl(preview.totals.installmentCents / 100)}`}
                  </div>
                  {!maintenance ? (
                    <div className="mt-1 text-[11px] text-steel">
                      Entrada de {entryPct}% · {brl(Math.round(preview.totals.totalCents * entryPct / 100) / 100)} na assinatura
                    </div>
                  ) : null}
                  {comodato.enabled && !maintenance ? (
                    <div className="mt-2 rounded-lg border border-signal/30 bg-signal/5 p-2 text-[11px] text-silver">
                      Versão comodato: {brl(comodatoInfo.monthlyCents / 100)}/mês por {comodatoInfo.termMonths} meses
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  {preview.insights.map((i) => (
                    <div key={i.title} className="rounded-lg border border-line/50 bg-abyss2/40 p-3">
                      <div className="text-[11.5px] font-medium text-silver">{i.title}</div>
                      <p className="mt-1 text-[10.5px] leading-relaxed text-steel">{i.detail}</p>
                    </div>
                  ))}
                </div>

                <p className="text-[10.5px] leading-relaxed text-steel">{preview.aiNote}</p>

                <div className="flex flex-wrap gap-1">
                  {preview.draft.sections
                    .filter((s) => s.enabled)
                    .map((s) => (
                      <span key={s.id} className="chip !text-[8px] !tracking-normal !normal-case">
                        {s.title}
                      </span>
                    ))}
                </div>

                <div className="space-y-2 border-t border-line/40 pt-3">
                  <button type="button" className="btn btn-primary w-full py-2.5" disabled={saving} onClick={() => save("novo")}>
                    {saving ? <LoaderCircle size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                    Salvar e abrir no editor completo
                  </button>
                  <p className="text-center text-[10.5px] text-steel">No editor você poderá alterar 100% dos textos, blocos e valores, direto no documento.</p>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-steel">
                <p className="text-[12px]">Preencha o briefing ao lado e clique em “Elaborar proposta”.</p>
                <p className="mt-1 text-[11px]">Você poderá revisar e editar todos os itens e textos no editor.</p>
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
