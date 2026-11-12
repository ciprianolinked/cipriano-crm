"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  FileCheck2,
  FileText,
  LoaderCircle,
  Package,
  Plus,
  ShieldCheck,
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
};

type Preview = { draft: ProposalDraft; totals: Totals; insights: Insight[]; aiNote: string; error?: string };

const uid = (p = "it") => `${p}-${Math.random().toString(36).slice(2, 9)}`;

export function NewProposalWizard({
  clients,
  catalog = [],
  aiEnabled = false,
}: {
  clients: ClientOption[];
  catalog?: WizardCatalogItem[];
  aiEnabled?: boolean;
}) {
  const router = useRouter();
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
  const [briefing, setBriefing] = useState<Briefing>(defaultBriefing);
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

  // Itens selecionados do catálogo no momento da criação
  const [selectedCatalogItems, setSelectedCatalogItems] = useState<ProposalItem[]>([]);
  const [catalogPickId, setCatalogPickId] = useState("");
  const [catalogQty, setCatalogQty] = useState(1);
  const [catalogCustomPrice, setCatalogCustomPrice] = useState<number | "">("");
  const [categoryFilter, setCategoryFilter] = useState("Todos");

  // Miscelâneas e Mão de obra (específicos de cada proposta, exceto manutenção)
  const [miscPct, setMiscPct] = useState(10);
  const [laborPrice, setLaborPrice] = useState<number | "">("");

  const maintenance = purpose === "manutencao_mensal";

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

  // Categorias disponíveis no catálogo
  const categories = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((item) => set.add(item.category));
    return ["Todos", ...Array.from(set)];
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    if (categoryFilter === "Todos") return catalog;
    return catalog.filter((item) => item.category === categoryFilter);
  }, [catalog, categoryFilter]);

  function addCatalogItem() {
    const found = catalog.find((i) => i.id === catalogPickId);
    if (!found) return;
    const price = typeof catalogCustomPrice === "number" && catalogCustomPrice >= 0
      ? catalogCustomPrice
      : found.priceCents / 100;
    const newItem: ProposalItem = {
      id: uid("cat"),
      kind: found.kind === "servico" ? "servico" : "equipamento",
      desc: found.description,
      spec: found.spec ?? "",
      unit: found.unit || "un",
      qty: Math.max(1, catalogQty),
      price,
      scope: found.category || "Equipamentos",
    };
    setSelectedCatalogItems((prev) => [...prev, newItem]);
    setCatalogPickId("");
    setCatalogQty(1);
    setCatalogCustomPrice("");
    invalidate();
  }

  function removeCatalogItem(id: string) {
    setSelectedCatalogItems((prev) => prev.filter((i) => i.id !== id));
    invalidate();
  }

  // Totais em tempo real dos itens de catálogo adicionados
  const equipSubtotal = useMemo(() => {
    return selectedCatalogItems
      .filter((it) => it.kind === "equipamento")
      .reduce((sum, it) => sum + it.price * it.qty, 0);
  }, [selectedCatalogItems]);

  const calculatedMiscValue = Math.round(equipSubtotal * (miscPct / 100) * 100) / 100;

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
          miscPct: maintenance ? 0 : miscPct,
          laborPrice: typeof laborPrice === "number" ? laborPrice : undefined,
          customItems: selectedCatalogItems.length > 0 ? selectedCatalogItems : undefined,
          briefing: {
            ...briefing,
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

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        {/* Etapa 1 · Objetivo */}
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
                    {t.id === "completa"
                      ? "Escopo e condições detalhados"
                      : t.id === "simples"
                        ? "Uma apresentação objetiva"
                        : "Orçamento com itens e condições"}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Inteligência Competitiva */}
        <ReferencePanel context={analysisContext} onAnalysisReady={applyAnalysis} />

        {/* Etapa 2 · Destinatário */}
        <section className="card p-5">
          <div className="label-mono text-signal">Etapa 2 · destinatário</div>
          <h2 className="mt-1 font-display text-lg font-semibold text-white">Cliente e local</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="label-mono mb-1.5 block">Cliente cadastrado</span>
              <select className="field" value={info.clientId} onChange={(e) => applyClient(e.target.value)}>
                <option value="">Digitar cliente manualmente</option>
                {clients.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[10.5px] text-steel">
                Precisa buscar os dados da empresa?{" "}
                <Link href="/clientes" className="text-signal hover:underline">
                  Cadastre pelo CNPJ em Clientes →
                </Link>
              </p>
            </label>
            <Field label="Nome do cliente *">
              <input
                className="field"
                value={info.clientName}
                onChange={(e) => updateInfo({ clientName: e.target.value })}
                placeholder="Nome do cliente"
              />
            </Field>
            <Field label="Contato / cargo">
              <input
                className="field"
                value={info.contact}
                onChange={(e) => updateInfo({ contact: e.target.value })}
                placeholder="Responsável"
              />
            </Field>
            <Field label="E-mail">
              <input
                className="field"
                type="email"
                value={info.clientEmail}
                onChange={(e) => updateInfo({ clientEmail: e.target.value })}
              />
            </Field>
            <Field label="Local da prestação de serviços">
              <input className="field" value={info.site} onChange={(e) => updateInfo({ site: e.target.value })} />
            </Field>
            <Field label="Validade da proposta (dias)">
              <input
                className="field"
                type="number"
                min={1}
                max={365}
                value={info.validityDays}
                onChange={(e) => updateInfo({ validityDays: Number(e.target.value) })}
              />
            </Field>
            {!maintenance ? (
              <label className="flex items-center gap-2 text-[12px] text-silver">
                <input
                  type="checkbox"
                  checked={info.artIncluded}
                  onChange={(e) => updateInfo({ artIncluded: e.target.checked })}
                />
                Incluir ART / projeto executivo
              </label>
            ) : null}
          </div>
        </section>

        {/* Etapa 3 · Escopo, Produtos do Catálogo, Miscelâneas e Valores */}
        <section className="card p-5">
          <div className="label-mono text-signal">Etapa 3 · escopo e valores</div>
          <h2 className="mt-1 font-display text-lg font-semibold text-white">
            {maintenance ? "Plano de manutenção mensal" : "Equipamentos, catálogo e serviços"}
          </h2>
          <p className="mt-1 mb-4 text-[11px] leading-relaxed text-steel">
            {maintenance
              ? "Defina o que está incluído, os limites de atendimento e o valor de cada mês."
              : "Insira produtos do catálogo diretamente, defina o percentual de miscelâneas/infraestrutura e a mão de obra técnica para esta proposta."}
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
              {/* Seleção direta de produtos do catálogo */}
              {catalog.length > 0 ? (
                <div className="rounded-xl border border-line/60 bg-abyss2/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="label-mono text-signal flex items-center gap-1.5">
                      <Package size={14} /> Inserir produtos do catálogo na proposta
                    </div>
                    <span className="text-[10.5px] text-steel">{selectedCatalogItems.length} item(ns) adicionados</span>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)_80px_110px_auto]">
                    <select
                      className="field text-[11.5px]"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>

                    <select
                      className="field text-[11.5px]"
                      value={catalogPickId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setCatalogPickId(id);
                        const it = catalog.find((i) => i.id === id);
                        if (it) setCatalogCustomPrice(it.priceCents / 100);
                      }}
                    >
                      <option value="">Selecione um produto do catálogo…</option>
                      {filteredCatalog.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.category} · {c.description} ({brl(c.priceCents / 100)})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min={1}
                      className="field text-[11.5px]"
                      placeholder="Qtd"
                      value={catalogQty}
                      onChange={(e) => setCatalogQty(Math.max(1, Number(e.target.value)))}
                      title="Quantidade"
                    />

                    <input
                      type="number"
                      step="0.01"
                      className="field text-[11.5px]"
                      placeholder="Preço R$"
                      value={catalogCustomPrice}
                      onChange={(e) => setCatalogCustomPrice(e.target.value ? Number(e.target.value) : "")}
                      title="Preço unitário em reais"
                    />

                    <button
                      type="button"
                      className="btn btn-primary px-3 text-[11.5px]"
                      disabled={!catalogPickId}
                      onClick={addCatalogItem}
                    >
                      <Plus size={14} /> Inserir
                    </button>
                  </div>

                  {selectedCatalogItems.length > 0 ? (
                    <div className="mt-3 space-y-1.5 border-t border-line/40 pt-3">
                      <div className="label-mono text-[9px]">Itens de catálogo selecionados para esta proposta:</div>
                      {selectedCatalogItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line/50 bg-abyss2/60 p-2 text-[11.5px]"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-mono text-signal">{item.qty} {item.unit}</span>
                            {" · "}
                            <span className="font-medium text-white">{item.desc}</span>
                            {item.spec ? <span className="text-steel"> ({item.spec})</span> : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <span className="font-mono text-steel">
                              {brl(item.price)} = <b className="text-signal">{brl(item.price * item.qty)}</b>
                            </span>
                            <button
                              type="button"
                              className="text-steel transition hover:text-alarm"
                              onClick={() => removeCatalogItem(item.id)}
                              title="Remover este item"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Miscelâneas, Infraestrutura & Mão de Obra */}
              <div className="rounded-xl border border-signal/25 bg-signal/[0.04] p-4">
                <div className="label-mono text-signal">Inclusões automáticas de projeto</div>
                <h3 className="mt-1 font-display text-[14px] font-semibold text-white">
                  Miscelâneas, infraestrutura e mão de obra
                </h3>
                <p className="mt-0.5 text-[11px] leading-relaxed text-steel">
                  Adicionados em toda proposta de fornecimento/instalação. A miscelânea cobre eletrodutos, conectores e insumos
                  com percentual sobre os equipamentos. A mão de obra é definida para esta proposta.
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Margem de miscelâneas e infraestrutura (% sobre equipamentos)">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="field"
                        value={miscPct}
                        onChange={(e) => {
                          setMiscPct(Math.max(0, Math.min(100, Number(e.target.value))));
                          invalidate();
                        }}
                      />
                      <span className="font-mono text-sm text-steel">%</span>
                    </div>
                    {equipSubtotal > 0 ? (
                      <div className="mt-1 font-mono text-[10.5px] text-signal">
                        Equivalente a: {brl(calculatedMiscValue)} sobre {brl(equipSubtotal)}
                      </div>
                    ) : null}
                  </Field>

                  <Field label="Mão de obra técnica especializada (R$)">
                    <input
                      type="number"
                      step="50"
                      min={0}
                      className="field"
                      placeholder="Sugerido automaticamente ou digite o valor"
                      value={laborPrice}
                      onChange={(e) => {
                        setLaborPrice(e.target.value ? Number(e.target.value) : "");
                        invalidate();
                      }}
                    />
                    <div className="mt-1 text-[10px] text-steel">
                      Deixe vazio para cálculo automático por pontos ou digite o valor negociado.
                    </div>
                  </Field>
                </div>
              </div>

              {/* Briefing técnico por quantidades (opcional caso queira compor com o catálogo) */}
              <details className="rounded-xl border border-line/60 bg-abyss2/30 p-3">
                <summary className="cursor-pointer text-[12px] font-medium text-silver hover:text-signal">
                  + Complementar com briefing rápido de quantidades (câmeras, portas, alarme...)
                </summary>
                <div className="mt-3 space-y-3 border-t border-line/40 pt-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {([["cameras", "Câmeras IP"], ["doors", "Portas com acesso"], ["fenceMeters", "Perímetro (m)"]] as const).map(
                      ([key, label]) => (
                        <Field key={key} label={label}>
                          <input
                            className="field"
                            type="number"
                            min={0}
                            value={briefing[key]}
                            onChange={(e) => updateBriefing({ [key]: Number(e.target.value) })}
                          />
                        </Field>
                      ),
                    )}
                    <Field label="Segmento">
                      <select
                        className="field"
                        value={briefing.segment}
                        onChange={(e) => updateBriefing({ segment: e.target.value })}
                      >
                        {SEGMENTS.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["monitoring", "Monitoramento"],
                        ["alarm", "Alarme"],
                        ["intercom", "Interfonia"],
                        ["network", "Rede / rack"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        type="button"
                        key={key}
                        onClick={() => updateBriefing({ [key]: !briefing[key] })}
                        className={`chip ${briefing[key] ? "!border-signal/50 !text-signal bg-signal/10" : ""}`}
                      >
                        {briefing[key] ? "✓ " : "+ "}
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Prioridade">
                      <select
                        className="field"
                        value={briefing.priority}
                        onChange={(e) => updateBriefing({ priority: e.target.value as Briefing["priority"] })}
                      >
                        {PRIORITIES.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Informações adicionais do cliente">
                      <textarea
                        className="field min-h-[60px]"
                        value={rawNotes}
                        onChange={(e) => {
                          setRawNotes(e.target.value);
                          invalidate();
                        }}
                        placeholder="Requisitos específicos, horários de instalação, marcas exigidas..."
                      />
                    </Field>
                  </div>
                </div>
              </details>
            </div>
          )}
        </section>

        {/* Contrato opcional */}
        <section className="card p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 accent-cyan-400"
              checked={wantsContract}
              onChange={(e) => setWantsContract(e.target.checked)}
            />
            <span>
              <span className="flex items-center gap-2 font-display text-[14px] font-semibold text-white">
                <FileCheck2 size={16} className="text-signal" /> Elaborar contrato após salvar (opcional)
              </span>
              <span className="mt-1 block text-[11px] leading-relaxed text-steel">
                Marque se o cliente deseja formalizar a proposta em contrato. Você revisará a minuta em uma etapa separada;
                nada é ativado ou enviado automaticamente.
              </span>
            </span>
          </label>
        </section>

        {aiEnabled ? (
          <label className="flex items-center gap-2 text-[11px] text-steel">
            <input
              type="checkbox"
              checked={polish}
              onChange={(e) => {
                setPolish(e.target.checked);
                invalidate();
              }}
            />
            Refinar a redação do escopo com a IA configurada no servidor.
          </label>
        ) : null}

        {error ? (
          <div role="alert" className="rounded-lg border border-alarm/35 bg-alarm/5 p-3 text-[12px] text-alarm">
            {error}
          </div>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-primary px-5 py-3"
            disabled={loading || saving}
            onClick={generate}
          >
            {loading ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? "Elaborando…" : preview ? "Gerar novamente" : "Elaborar proposta"}
          </button>
          <Link href="/propostas" className="btn">
            Cancelar
          </Link>
        </div>
      </div>

      {/* Painel lateral de Resumo */}
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
                    <b className="text-signal">Proposta igualada à referência</b> · {analysis.scopes.length} escopo(s)
                    separados · sem desconto automático. Edite valores e itens depois de salvar.
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
                      : `${preview.draft.items.length} itens · ${preview.draft.discountPct}% de desconto`}
                  </div>
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
                  <button
                    type="button"
                    className="btn btn-primary w-full py-2.5"
                    disabled={saving}
                    onClick={() => save("novo")}
                  >
                    {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
                    {saving ? "Salvando…" : "Salvar proposta e abrir editor"}
                  </button>
                  <button
                    type="button"
                    className="btn w-full py-2 text-[11px]"
                    disabled={saving}
                    onClick={() => save("enviada")}
                  >
                    Salvar e marcar como “Enviada”
                  </button>
                  <p className="text-center text-[10px] text-steel">
                    Ao salvar, o editor completo abre para você alterar qualquer texto, seção, item ou preço.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center text-[11.5px] text-steel">
                <p>Preencha os dados e clique em <b className="text-silver">Elaborar proposta</b>.</p>
                <p className="mt-1 text-[10.5px]">A prévia do investimento e dos blocos aparecerá aqui.</p>
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
