"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  AiExtractionResult,
  CostType,
  ProductSearchResult,
  QuotationDraft,
  QuotationStatus,
  QuoteItem,
  Supplier,
} from "@/lib/types";
import { CATEGORIES, COST_TYPE_LABEL, COST_TYPES, MAX_SUPPLIERS, STATUS_LABEL, STATUS_STYLE, UNITS } from "@/lib/constants";
import {
  buildNarrative,
  checkCompleteness,
  computeMetrics,
  createItem,
  createSupplier,
  formatBytes,
  formatCurrency,
  formatDateLong,
  parseCurrencyInput,
  recordedSavings,
  supplierCostBreakdown,
  todayISO,
} from "@/lib/quotation";
import { describeMerge, mergeComplementary, mergeExtraction } from "@/lib/extraction";
import type { ApplyMode } from "@/components/AiImportPanel";
import { saveBase64File, type PdfDownload } from "@/lib/download";
import { parsePurchaseUrl } from "@/lib/constants";
import { MapDocument } from "./MapDocument";
import { ProductSearchPanel } from "./ProductSearchPanel";
import { AiImportPanel, type AiFileMeta } from "./AiImportPanel";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BuildingIcon,
  CheckIcon,
  CloseIcon,
  DownloadIcon,
  FileIcon,
  PlusIcon,
  PrinterIcon,
  SaveIcon,
  SearchIcon,
  SparklesIcon,
  TrashIcon,
  TrendIcon,
} from "./icons";

type QuotationEditorProps = {
  initial: QuotationDraft;
  quotationId?: string;
  protocol?: string;
  condominiums: string[];
};

type Feedback = { tone: "ok" | "error"; message: string } | null;

export function QuotationEditor({ initial, quotationId, protocol: initialProtocol, condominiums }: QuotationEditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<QuotationDraft>(initial);
  const [id, setId] = useState<string | undefined>(quotationId);
  const [protocol, setProtocol] = useState(initialProtocol ?? "MC-••••-••••");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(!quotationId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [analysisFiles, setAnalysisFiles] = useState<File[]>([]);
  const [reanalyzeSignal, setReanalyzeSignal] = useState(0);
  const [completeness, setCompleteness] = useState<string[] | null>(null);

  const metrics = useMemo(() => computeMetrics(draft), [draft]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 5200);
    return () => clearTimeout(timer);
  }, [feedback]);

  function update(patch: Partial<QuotationDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  }

  function updateSupplier(supplierId: string, patch: Partial<Supplier>) {
    setDraft((current) => ({
      ...current,
      suppliers: current.suppliers.map((supplier) =>
        supplier.id === supplierId ? { ...supplier, ...patch } : supplier,
      ),
    }));
    setDirty(true);
  }

  function addSupplier() {
    if (draft.suppliers.length >= MAX_SUPPLIERS) return;
    const supplier = createSupplier(draft.suppliers.length);
    setDraft((current) => ({
      ...current,
      suppliers: [...current.suppliers, supplier],
      items: current.items.map((item) => ({ ...item, prices: { ...item.prices, [supplier.id]: null } })),
    }));
    setDirty(true);
  }

  function removeSupplier(supplierId: string) {
    if (draft.suppliers.length <= 1) return;
    setDraft((current) => ({
      ...current,
      suppliers: current.suppliers.filter((supplier) => supplier.id !== supplierId),
      items: current.items.map((item) => {
        const prices = { ...item.prices };
        delete prices[supplierId];
        return { ...item, prices };
      }),
    }));
    setDirty(true);
  }

  function updateItem(itemId: string, patch: Partial<QuoteItem>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    }));
    setDirty(true);
  }

  function updatePrice(itemId: string, supplierId: string, value: number | null) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId ? { ...item, prices: { ...item.prices, [supplierId]: value } } : item,
      ),
    }));
    setDirty(true);
  }

  function addItem() {
    setDraft((current) => ({
      ...current,
      items: [...current.items, createItem("", current.suppliers.map((supplier) => supplier.id))],
    }));
    setDirty(true);
  }

  function removeItem(itemId: string) {
    if (draft.items.length <= 1) return;
    setDraft((current) => ({ ...current, items: current.items.filter((item) => item.id !== itemId) }));
    setDirty(true);
  }

  function regenerateAnalysis() {
    const narrative = buildNarrative(draft);
    setDraft((current) => ({
      ...current,
      analysis: {
        ...narrative,
        notes: current.analysis.notes || narrative.notes,
        outcome: current.analysis.outcome,
      },
    }));
    setDirty(true);
    setFeedback({ tone: "ok", message: "Análise técnica recalculada com base nos valores atuais." });
  }

  function applyExtraction(result: AiExtractionResult, files: AiFileMeta[], mode: ApplyMode = "replace", rawFiles: File[] = []) {
    const next = mode === "merge" ? mergeComplementary(draft, result, files) : mergeExtraction(draft, result, files);
    setDraft(next);
    setDirty(true);
    setCompleteness(null);
    if (rawFiles.length > 0) setAnalysisFiles(rawFiles);
    if (mode === "merge") {
      const changes = describeMerge(draft, next);
      setFeedback({
        tone: "ok",
        message: changes.length
          ? `Mapa complementado: ${changes.join(", ")}. Confira os valores e salve.`
          : "Nenhum dado novo foi encontrado nos arquivos enviados. O mapa atual foi preservado.",
      });
    } else {
      setFeedback({
        tone: "ok",
        message:
          result.mode === "ia"
            ? "Documentos analisados pela IA. Revise os campos e salve o mapa."
            : "Pré-análise aplicada ao mapa. Revise os valores antes de salvar.",
      });
    }
  }

  function setPurchaseLink(itemId: string, raw: string) {
    if (!raw.trim()) {
      updateItem(itemId, {
        purchaseUrl: undefined,
        purchaseStore: undefined,
        purchasePrice: null,
        purchaseVerified: false,
        purchaseSource: "manual",
      });
      return;
    }
    const link = parsePurchaseUrl(raw);
    if (!link) {
      setFeedback({ tone: "error", message: "Link inválido. Informe um endereço http(s) completo, como https://loja.com.br/produto." });
      return;
    }
    updateItem(itemId, {
      purchaseUrl: link.url,
      purchaseStore: link.store ?? "",
      purchaseVerified: link.trusted,
      purchaseSource: "manual",
    });
    if (!link.trusted) {
      setFeedback({ tone: "ok", message: `Link salvo. ${link.host} não está na lista de lojas confiáveis, por isso não é marcado como verificado.` });
    }
  }

  function addProductAsItem(result: ProductSearchResult) {
    const supplierIds = draft.suppliers.map((supplier) => supplier.id);
    const item = createItem(result.description, supplierIds);
    update({
      items: [
        ...draft.items,
        {
          ...item,
          unit: "un",
          quantity: 1,
          costType: "material",
          purchaseUrl: result.purchaseUrl,
          purchaseStore: result.store ?? "",
          purchasePrice: result.price,
          purchaseVerified: result.trusted,
          purchaseSource: "pesquisa",
        },
      ],
    });
    setFeedback({ tone: "ok", message: `"${result.description}" adicionado ao mapa com o link de compra.` });
  }

  function attachProductToSupplier(result: ProductSearchResult) {
    const target = draft.suppliers.find((supplier) => supplier.name.trim()) ?? draft.suppliers[0];
    if (!target) return;
    updateSupplier(target.id, {
      purchaseUrl: result.purchaseUrl,
      purchaseStore: result.store ?? "",
      purchaseVerified: result.trusted,
      purchaseSource: "pesquisa",
    });
    setFeedback({ tone: "ok", message: `Link vinculado ao fornecedor ${target.name || "A"}.` });
  }

  function setSupplierLink(supplierId: string, raw: string) {
    if (!raw.trim()) {
      updateSupplier(supplierId, { purchaseUrl: undefined, purchaseStore: undefined, purchaseVerified: false, purchaseSource: "manual" });
      return;
    }
    const link = parsePurchaseUrl(raw);
    if (!link) {
      setFeedback({ tone: "error", message: "Link do fornecedor inválido. Use um endereço completo http(s)." });
      return;
    }
    updateSupplier(supplierId, {
      purchaseUrl: link.url,
      purchaseStore: link.store ?? "",
      purchaseVerified: link.trusted,
      purchaseSource: "manual",
    });
  }

  async function searchProductsOnline() {
    const targets = draft.items.filter((item) => item.description.trim().length > 2);
    if (targets.length === 0) {
      setFeedback({ tone: "error", message: "Descreva ao menos um item para pesquisar." });
      return;
    }
    setSearchingProducts(true);
    try {
      const response = await fetch("/api/ai/product-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: targets.map((item) => item.description), condominium: draft.condominium }),
      });
      const data = (await response.json()) as { results?: ProductSearchResult[]; warnings?: string[]; error?: string };
      if (!response.ok || !data.results) throw new Error(data.error || "Não foi possível pesquisar os produtos.");
      const byId = new Map<number, ProductSearchResult>();
      data.results.forEach((result) => byId.set(result.index, result));
      let found = 0;
      setDraft((current) => ({
        ...current,
        items: current.items.map((item) => {
          const index = targets.findIndex((target) => target.id === item.id);
          if (index < 0) return item;
          const result = byId.get(index);
          if (!result?.found || !result.purchaseUrl) return item;
          found += 1;
          return {
            ...item,
            purchaseUrl: result.purchaseUrl,
            purchaseStore: result.store ?? "",
            purchasePrice: result.price,
            purchaseVerified: result.trusted,
            purchaseSource: "pesquisa" as const,
          };
        }),
      }));
      setDirty(true);
      setFeedback({
        tone: found > 0 ? "ok" : "error",
        message: found > 0
          ? `Pesquisa concluída: ${found} item(ns) com link em loja confiável. Revise antes de salvar.${data.warnings?.length ? ` ${data.warnings[0]}` : ""}`
          : `Nenhum link confiável encontrado.${data.warnings?.length ? ` ${data.warnings.join(" ")}` : ""}`,
      });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Falha na pesquisa online." });
    } finally {
      setSearchingProducts(false);
    }
  }

  async function persist(): Promise<string | undefined> {
    if (!draft.condominium.trim()) {
      setFeedback({ tone: "error", message: "Informe o condomínio/associação antes de salvar." });
      return undefined;
    }
    setSaving(true);
    try {
      const response = await fetch(id ? `/api/quotations/${id}` : "/api/quotations", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const data = (await response.json()) as {
        quotation?: { id: string; protocol: string };
        error?: string;
      };
      if (!response.ok || !data.quotation) throw new Error(data.error || "Não foi possível salvar o mapa.");
      setId(data.quotation.id);
      setProtocol(data.quotation.protocol);
      setDirty(false);
      setFeedback({ tone: "ok", message: "Mapa de cotação salvo com sucesso." });
      if (!id) {
        router.replace(`/mapas/${data.quotation.id}`);
        router.refresh();
      }
      return data.quotation.id;
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Erro ao salvar o mapa.",
      });
      return undefined;
    } finally {
      setSaving(false);
    }
  }

  async function handlePrint() {
    const targetId = dirty || !id ? await persist() : id;
    if (!targetId) return;
    window.open(`/mapas/${targetId}/imprimir`, "_blank", "noopener,noreferrer");
  }

  async function handlePdfDownload() {
    const targetId = dirty || !id ? await persist() : id;
    if (!targetId) return;
    setDownloading(true);
    setFeedback({ tone: "ok", message: "Gerando o PDF do mapa…" });
    try {
      const response = await fetch(`/api/quotations/${targetId}/pdf`);
      const data = await response.json() as PdfDownload & { error?: string };
      if (!response.ok || !data.fileBase64) throw new Error(data.error || "Não foi possível gerar o PDF.");
      saveBase64File(data.fileName, data.fileBase64);
      setFeedback({ tone: "ok", message: `Download concluído: ${data.fileName}${data.recorded ? " · registrado no histórico" : ""}` });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Não foi possível gerar o PDF." });
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    if (!id) {
      router.push("/");
      return;
    }
    const response = await fetch(`/api/quotations/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setFeedback({ tone: "error", message: "Não foi possível excluir o mapa." });
      return;
    }
    router.push("/");
    router.refresh();
  }

  const pendingChecks = [
    { ok: Boolean(draft.condominium.trim()), label: "Condomínio/associação identificado" },
    { ok: Boolean(draft.service.trim()), label: "Serviço ou objeto descrito" },
    { ok: draft.suppliers.filter((supplier) => supplier.name.trim()).length >= 2, label: "Ao menos 2 fornecedores" },
    {
      ok: draft.items.every((item) => draft.suppliers.some((supplier) => item.prices?.[supplier.id] != null)),
      label: "Todos os itens com preço",
    },
    { ok: draft.attachments.length > 0, label: "Proposta anexada ao processo" },
  ];

  const best = metrics.best;
  const maxTotal = Math.max(...metrics.rankings.map((row) => row.total ?? 0), 1);
  const outcome = draft.analysis.outcome ?? { supplierId: "", referenceAmount: null, contractedAmount: null, confirmed: false };
  const confirmedSavings = recordedSavings(draft);
  const awardedRanking = metrics.rankings.find((row) => row.supplier.id === outcome.supplierId);

  function updateOutcome(patch: Partial<typeof outcome>) {
    const changesValues = patch.supplierId !== undefined || patch.referenceAmount !== undefined || patch.contractedAmount !== undefined;
    update({ analysis: { ...draft.analysis, outcome: { ...outcome, ...patch, confirmed: changesValues ? false : (patch.confirmed ?? outcome.confirmed) } } });
  }

  return (
    <div className="print:hidden">
      <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/" className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-500 hover:text-ink">
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              Painel de cotações
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-[26px] leading-tight text-ink sm:text-[30px]">
                {draft.service.trim() || "Novo mapa de cotação"}
              </h1>
              <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                {protocol}
              </span>
            </div>
            <p className="mt-1 text-[12.5px] text-slate-500">
              {draft.condominium.trim() || "Condomínio a definir"} · Data análise {formatDateLong(draft.analysisDate)}
              {dirty ? " · alterações não salvas" : id ? " · salvo" : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={draft.status}
              onChange={(event) => update({ status: event.target.value as QuotationStatus })}
              className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold outline-none ring-1 ring-inset transition ${STATUS_STYLE[draft.status]}`}
              aria-label="Status do mapa"
            >
              {(Object.keys(STATUS_LABEL) as QuotationStatus[]).map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setPreviewOpen(true)} className="btn btn-ghost">
              <FileIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Ver documento</span>
            </button>
            <button type="button" onClick={handlePdfDownload} className="btn btn-ghost" disabled={saving || downloading}>
              <DownloadIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{downloading ? "Gerando…" : "Baixar PDF"}</span>
              <span className="sm:hidden">PDF</span>
            </button>
            <button type="button" onClick={handlePrint} className="btn btn-ghost" disabled={saving}>
              <PrinterIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button type="button" onClick={() => persist()} className="btn btn-primary" disabled={saving}>
              <SaveIcon className="h-4 w-4" />
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_318px]">
          <div className="space-y-4">
            {/* Identificação */}
            <section className="card px-4 py-4 sm:px-5">
              <SectionHeading
                number="1"
                title="Identificação do mapa"
                subtitle="Cabeçalho editável — um mapa por condomínio ou associação."
                right={
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                    <BuildingIcon className="h-3.5 w-3.5" />
                    {draft.kind === "produtos" ? "Produtos" : "Serviço"}
                  </span>
                }
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-6">
                <label className="sm:col-span-4">
                  <span className="label">Condomínio / Associação *</span>
                  <input
                    list="condominios-lista"
                    className="field mt-1"
                    placeholder="Selecione ou digite o condomínio"
                    value={draft.condominium}
                    onChange={(event) => update({ condominium: event.target.value })}
                  />
                  <datalist id="condominios-lista">
                    {condominiums.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </label>
                <div className="sm:col-span-2">
                  <span className="label">Data análise</span>
                  <div className="mt-1 flex items-center gap-1.5">
                    <input
                      type="date"
                      className="field"
                      value={draft.analysisDate}
                      onChange={(event) => update({ analysisDate: event.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => update({ analysisDate: todayISO() })}
                      className="shrink-0 rounded-lg border border-line px-2 py-2 text-[10.5px] font-bold text-slate-500 transition hover:border-brand-dark hover:text-brand-dark"
                      title="Usar data de hoje"
                    >
                      Hoje
                    </button>
                  </div>
                </div>
                <label className="sm:col-span-3">
                  <span className="label">A/C</span>
                  <input
                    className="field mt-1"
                    placeholder="Síndico(a), conselho, diretoria…"
                    value={draft.recipient}
                    onChange={(event) => update({ recipient: event.target.value })}
                  />
                </label>
                <label className="sm:col-span-3">
                  <span className="label">Serviço / Objeto</span>
                  <input
                    className="field mt-1"
                    placeholder="Ex.: manutenção de elevadores"
                    value={draft.service}
                    onChange={(event) => update({ service: event.target.value })}
                  />
                </label>
                <label className="sm:col-span-6">
                  <span className="label">Descrição</span>
                  <textarea
                    className="field mt-1 resize-y"
                    rows={3}
                    placeholder="Descreva o escopo, a necessidade do condomínio e as premissas desta cotação."
                    value={draft.description}
                    onChange={(event) => update({ description: event.target.value })}
                  />
                </label>
                <div className="sm:col-span-4">
                  <span className="label">Natureza da cotação</span>
                  <div className="mt-1 inline-flex rounded-lg border border-line bg-white p-1">
                    {(["servico", "produtos"] as const).map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => update({ kind })}
                        className={`rounded-md px-3 py-1.5 text-[12px] font-bold transition ${
                          draft.kind === kind ? "bg-ink text-white" : "text-slate-500 hover:text-ink"
                        }`}
                      >
                        {kind === "servico" ? "Serviço" : "Produtos"}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[10.5px] text-slate-500">
                    Use “Produtos” para listas de materiais (elétrica, hidráulica, piscina e outros).
                  </p>
                </div>
                <label className="sm:col-span-2">
                  <span className="label">Categoria</span>
                  <select
                    className="field mt-1"
                    value={draft.category}
                    onChange={(event) => update({ category: event.target.value })}
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            {/* IA */}
            <section>
              <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand-dark">
                    <SparklesIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13px] font-extrabold text-ink">Leitura de propostas com IA</p>
                    <p className="text-[11px] text-slate-500">
                      Envie PDF ou imagem das cotações e a IA preenche este mapa automaticamente.
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setAiOpen((current) => !current)} className="btn btn-ghost">
                  {aiOpen ? "Recolher" : "Abrir leitura de propostas"}
                  <ArrowRightIcon className={`h-3.5 w-3.5 transition ${aiOpen ? "rotate-90" : ""}`} />
                </button>
              </div>
              {aiOpen && (
                <div className="mt-3">
                  <AiImportPanel
                    hints={{
                      condominium: draft.condominium,
                      service: draft.service,
                      recipient: draft.recipient,
                      description: draft.description,
                    }}
                    onApply={applyExtraction}
                    variant="embedded"
                    ctaLabel="Analisar propostas e preencher"
                    hasExistingData={
                      Boolean(quotationId) ||
                      draft.suppliers.some((supplier) => supplier.name.trim()) ||
                      draft.items.some((item) => item.description.trim())
                    }
                    existingFileNames={draft.attachments.map((file) => file.name)}
                    initialFiles={analysisFiles}
                    onFilesChange={setAnalysisFiles}
                    reanalyzeSignal={reanalyzeSignal}
                  />
                </div>
              )}
            </section>

            {/* Fornecedores */}
            <section className="card px-4 py-4 sm:px-5">
              <SectionHeading
                number="2"
                title="Fornecedores consultados"
                subtitle="Até 5 propostas. As condições aparecem no documento final."
                right={
                  <button type="button" onClick={addSupplier} disabled={draft.suppliers.length >= MAX_SUPPLIERS} className="btn btn-ghost">
                    <PlusIcon className="h-3.5 w-3.5" />
                    Adicionar
                  </button>
                }
              />
              <div className="mt-3 space-y-3">
                {draft.suppliers.map((supplier, index) => {
                  const ranking = metrics.rankings.find((row) => row.supplier.id === supplier.id);
                  const breakdown = supplierCostBreakdown(draft.items, supplier.id);
                  return (
                    <div
                      key={supplier.id}
                      className={`rounded-xl border p-3 transition ${
                        ranking?.isBest ? "border-success/30 bg-success-soft/60" : "border-line bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="grid h-6 w-6 place-items-center rounded-md bg-ink text-[10.5px] font-extrabold text-white">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <input
                          className="field flex-1 min-w-[180px] font-semibold"
                          placeholder={`Fornecedor ${String.fromCharCode(65 + index)}`}
                          value={supplier.name}
                          onChange={(event) => updateSupplier(supplier.id, { name: event.target.value })}
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-right">
                            <span className="label block !text-[8.5px]">Total</span>
                            <span className={`text-[13px] font-extrabold ${ranking?.isBest ? "text-success" : "text-ink"}`}>
                              {formatCurrency(ranking?.total ?? null)}
                            </span>
                          </span>
                          {ranking?.isBest && (
                            <span className="rounded-full bg-ink px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-brand">
                              Melhor
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeSupplier(supplier.id)}
                            disabled={draft.suppliers.length <= 1}
                            className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                            aria-label={`Remover ${supplier.name || `fornecedor ${index + 1}`}`}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-4">
                        <label>
                          <span className="label !text-[8.5px]">Contato</span>
                          <input
                            className="field mt-0.5 !py-1.5 text-[12px]"
                            placeholder="e-mail · telefone"
                            value={supplier.contact}
                            onChange={(event) => updateSupplier(supplier.id, { contact: event.target.value })}
                          />
                        </label>
                        <label>
                          <span className="label !text-[8.5px]">Entrega / execução</span>
                          <input
                            className="field mt-0.5 !py-1.5 text-[12px]"
                            placeholder="Ex.: 10 dias"
                            value={supplier.deliveryDays}
                            onChange={(event) => updateSupplier(supplier.id, { deliveryDays: event.target.value })}
                          />
                        </label>
                        <label>
                          <span className="label !text-[8.5px]">Pagamento</span>
                          <input
                            className="field mt-0.5 !py-1.5 text-[12px]"
                            placeholder="Ex.: 28 dias"
                            value={supplier.paymentTerms}
                            onChange={(event) => updateSupplier(supplier.id, { paymentTerms: event.target.value })}
                          />
                        </label>
                        <label>
                          <span className="label !text-[8.5px]">Validade</span>
                          <input
                            className="field mt-0.5 !py-1.5 text-[12px]"
                            placeholder="Ex.: 30 dias"
                            value={supplier.validity}
                            onChange={(event) => updateSupplier(supplier.id, { validity: event.target.value })}
                          />
                        </label>
                      </div>
                      <label className="mt-2 block">
                        <span className="label !text-[8.5px]">Observações da proposta</span>
                        <input
                          className="field mt-0.5 !py-1.5 text-[12px]"
                          placeholder="Garantia, impostos inclusos, ART…"
                          value={supplier.notes}
                          onChange={(event) => updateSupplier(supplier.id, { notes: event.target.value })}
                        />
                      </label>
                      <div className="mt-2">
                        <span className="label !text-[8.5px]">Site / e-commerce do fornecedor</span>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <input
                            className="field min-w-[180px] flex-1 !py-1.5 text-[11.5px]"
                            placeholder="https://loja-do-fornecedor.com.br"
                            inputMode="url"
                            value={supplier.purchaseUrl ?? ""}
                            onChange={(event) => updateSupplier(supplier.id, { purchaseUrl: event.target.value })}
                            onBlur={(event) => setSupplierLink(supplier.id, event.target.value)}
                          />
                          {supplier.purchaseUrl && (
                            <a href={supplier.purchaseUrl} target="_blank" rel="noopener noreferrer" className="text-[10.5px] font-bold text-brand-dark underline underline-offset-2">Abrir</a>
                          )}
                          {supplier.purchaseVerified && (
                            <span className="rounded-full bg-success-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.05em] text-success">Loja confiável</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-paper/70 px-3 py-2 text-[10.5px]">
                        <div><span className="block text-slate-500">Mão de obra</span><strong className="text-ink">{formatCurrency(breakdown.mao_obra.total)}</strong></div>
                        <div><span className="block text-slate-500">Material</span><strong className="text-ink">{formatCurrency(breakdown.material.total)}</strong></div>
                        <div><span className="block text-slate-500">Não discriminado</span><strong className="text-ink">{formatCurrency(breakdown.nao_discriminado.total)}</strong></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Itens */}
            <section className="card px-4 py-4 sm:px-5">
              <SectionHeading
                number="3"
                title={draft.kind === "produtos" ? "Produtos e valores" : "Itens, serviços e valores"}
                subtitle="Classifique cada item como mão de obra, material ou não discriminado e informe os preços unitários."
                right={
                  <button type="button" onClick={addItem} className="btn btn-ghost">
                    <PlusIcon className="h-3.5 w-3.5" />
                    Adicionar item
                  </button>
                }
              />
              <div className="mt-3 -mx-1 overflow-x-auto px-1 pb-1">
                <table className="w-full min-w-[880px] border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 min-w-[240px] rounded-tl-lg bg-paper px-2 py-2 text-left text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
                        Item / descrição
                      </th>
                      <th className="w-[76px] bg-paper px-1.5 py-2 text-center text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
                        Qtd
                      </th>
                      <th className="w-[104px] bg-paper px-1.5 py-2 text-left text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
                        Un.
                      </th>
                      {draft.suppliers.map((supplier, index) => (
                        <th key={supplier.id} className="w-[136px] bg-paper px-1.5 py-2 text-right text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
                          <span className="block leading-tight" title={supplier.name}>
                            {String.fromCharCode(65 + index)} · {supplier.name || "Fornecedor"}
                          </span>
                          <span className="font-semibold normal-case tracking-normal text-[8.5px] text-slate-400">valor unit.</span>
                        </th>
                      ))}
                      <th className="w-[34px] rounded-tr-lg bg-paper px-1 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {draft.items.map((item, itemIndex) => {
                      const lowest = draft.suppliers
                        .map((supplier) => item.prices?.[supplier.id])
                        .filter((value): value is number => value !== null && value !== undefined);
                      const minPrice = lowest.length > 0 ? Math.min(...lowest) : null;
                      return (
                        <tr key={item.id} className="align-top">
                          <td className="border-b border-line px-2 py-1.5">
                            <div className="flex items-start gap-1.5">
                              <span className="mt-2 text-[9.5px] font-bold text-slate-400">
                                {String(itemIndex + 1).padStart(2, "0")}
                              </span>
                              <div className="min-w-0 flex-1">
                                <textarea
                                  className="field resize-y !py-2 text-[12.5px] leading-snug"
                                  rows={3}
                                  placeholder="Descrição do item, material ou serviço"
                                  value={item.description}
                                  onChange={(event) => updateItem(item.id, { description: event.target.value })}
                                />
                                <select
                                  className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1 text-[10.5px] font-semibold text-slate-600 outline-none focus:border-brand"
                                  aria-label={`Tipo de custo do item ${itemIndex + 1}`}
                                  value={item.costType ?? "nao_discriminado"}
                                  onChange={(event) => updateItem(item.id, { costType: event.target.value as CostType })}
                                >
                                  {COST_TYPES.map((type) => <option key={type} value={type}>{COST_TYPE_LABEL[type]}</option>)}
                                </select>
                              </div>
                            </div>
                          </td>
                          <td className="border-b border-line px-1.5 py-1.5">
                            <input
                              type="number"
                              min={0}
                              step="1"
                              aria-label={`Quantidade do item ${itemIndex + 1}`}
                              className="field !py-2 text-center text-[13px] font-bold tabular-nums"
                              value={item.quantity}
                              onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) || 0 })}
                            />
                          </td>
                          <td className="border-b border-line px-1.5 py-1.5">
                            <select
                              className="field !py-2 text-[12px]"
                              aria-label={`Unidade do item ${itemIndex + 1}`}
                              value={item.unit}
                              onChange={(event) => updateItem(item.id, { unit: event.target.value })}
                            >
                              {UNITS.map((unit) => (
                                <option key={unit} value={unit}>
                                  {unit}
                                </option>
                              ))}
                            </select>
                          </td>
                          {draft.suppliers.map((supplier) => {
                            const value = item.prices?.[supplier.id] ?? null;
                            const isLowest = value !== null && minPrice !== null && Math.abs(value - minPrice) < 0.005;
                            return (
                              <td key={supplier.id} className="border-b border-line px-1.5 py-1.5">
                                <MoneyInput
                                  value={value}
                                  highlight={isLowest}
                                  onChange={(next) => updatePrice(item.id, supplier.id, next)}
                                />
                              </td>
                            );
                          })}
                          <td className="border-b border-line px-1 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              disabled={draft.items.length <= 1}
                              className="rounded-md p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                              aria-label="Remover item"
                            >
                              <CloseIcon className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td colSpan={3} className="bg-paper px-2 py-2 text-right text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
                        Total por fornecedor
                      </td>
                      {draft.suppliers.map((supplier) => {
                        const ranking = metrics.rankings.find((row) => row.supplier.id === supplier.id);
                        return (
                          <td
                            key={supplier.id}
                            className={`bg-paper px-1.5 py-2 text-right text-[12px] font-extrabold ${
                              ranking?.isBest ? "text-success" : "text-ink"
                            }`}
                          >
                            {formatCurrency(ranking?.total ?? null)}
                          </td>
                        );
                      })}
                      <td className="bg-paper" />
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10.5px] text-slate-500">
                Totais calculados por quantidade × valor unitário. Itens sem preço não entram no total; melhor proposta e economia consideram apenas fornecedores com todos os itens cotados.
              </p>

              <div className="mt-3 rounded-xl border border-line bg-paper/40 px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[12px] font-extrabold text-ink">Links de compra dos produtos</p>
                    <p className="mt-0.5 max-w-md text-[10.5px] leading-snug text-slate-500">
                      Opcional. A IA preenche quando o link aparece no documento ou na pesquisa em lojas confiáveis. Você também pode colar o endereço manualmente.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={searchProductsOnline} disabled={searchingProducts} className="btn btn-ghost !py-1.5">
                      <SearchIcon className="h-3.5 w-3.5" />
                      {searchingProducts ? "Pesquisando…" : "Pesquisar itens do mapa"}
                    </button>
                  </div>
                </div>
                <div className="mt-2.5">
                  <ProductSearchPanel
                    condominium={draft.condominium}
                    onAddItem={addProductAsItem}
                    onAttachToSupplier={attachProductToSupplier}
                    hasSuppliers={draft.suppliers.some((supplier) => supplier.name.trim())}
                  />
                </div>
                <ul className="mt-2 space-y-2.5">
                  {draft.items.filter((item) => item.description.trim()).length === 0 && (
                    <li className="text-[11px] text-slate-500">Descreva os itens acima para registrar links de compra.</li>
                  )}
                  {draft.items.filter((item) => item.description.trim()).map((item, index) => (
                    <li key={item.id}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="w-6 shrink-0 text-[9.5px] font-bold text-slate-400">{String(index + 1).padStart(2, "0")}</span>
                        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-ink" title={item.description}>{item.description}</span>
                        {item.purchaseVerified && (
                          <span className="rounded-full bg-success-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-success">Loja confiável</span>
                        )}
                        {item.purchaseSource === "pesquisa" && (
                          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-brand-dark">Pesquisa IA</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-7">
                        <input
                          className="field min-w-[200px] flex-1 !py-1.5 text-[11px]"
                          value={item.purchaseUrl ?? ""}
                          placeholder="https://loja.com.br/produto"
                          inputMode="url"
                          onChange={(event) => updateItem(item.id, { purchaseUrl: event.target.value })}
                          onBlur={(event) => setPurchaseLink(item.id, event.target.value)}
                        />
                        {item.purchaseUrl && (
                          <a href={item.purchaseUrl} target="_blank" rel="noopener noreferrer" className="text-[10.5px] font-bold text-brand-dark underline underline-offset-2">Abrir</a>
                        )}
                        {item.purchasePrice != null && <span className="text-[10.5px] font-bold text-ink">{formatCurrency(item.purchasePrice)}</span>}
                        {item.purchaseStore && <span className="text-[10px] text-slate-500">{item.purchaseStore}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Análise */}
            <section className="card px-4 py-4 sm:px-5">
              <SectionHeading
                number="4"
                title="Análise técnica e recomendação"
                subtitle="Texto editável. A IA redige um parecer inicial e você pode ajustar."
                right={
                  <button type="button" onClick={regenerateAnalysis} className="btn btn-ghost">
                    <SparklesIcon className="h-3.5 w-3.5" />
                    Gerar análise
                  </button>
                }
              />
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <div className="space-y-3 lg:col-span-2">
                  <label className="block">
                    <span className="label">Resumo comparativo</span>
                    <textarea
                      className="field mt-1 resize-y text-[12.5px] leading-relaxed"
                      rows={5}
                      placeholder="Resumo das propostas analisadas, cobertura e diferenças de valor."
                      value={draft.analysis.summary}
                      onChange={(event) => update({ analysis: { ...draft.analysis, summary: event.target.value } })}
                    />
                  </label>
                  <label className="block">
                    <span className="label">Recomendação</span>
                    <textarea
                      className="field mt-1 resize-y text-[12.5px] leading-relaxed"
                      rows={3}
                      placeholder="Fornecedor recomendado e condicionantes."
                      value={draft.analysis.recommendation}
                      onChange={(event) =>
                        update({ analysis: { ...draft.analysis, recommendation: event.target.value } })
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="label">Observações e aprovação</span>
                    <textarea
                      className="field mt-1 resize-y text-[12.5px] leading-relaxed"
                      rows={2}
                      placeholder="Registro de aprovação, atas, ressalvas."
                      value={draft.analysis.notes}
                      onChange={(event) => update({ analysis: { ...draft.analysis, notes: event.target.value } })}
                    />
                  </label>
                </div>
                <div className="rounded-xl border border-line bg-[#fbfdfc] p-3">
                  <p className="label !text-[8.5px]">Melhor proposta</p>
                  <p className="text-[13px] font-extrabold leading-tight text-ink">{best?.supplier.name || "Aguardando valores"}</p>
                  <p className="font-display text-[22px] leading-none text-success">{formatCurrency(best?.total ?? null)}</p>
                  <div className="mt-2.5 border-t border-line pt-2.5">
                    <p className="label !text-[8.5px]">Economia potencial</p>
                    <p className="text-[16px] font-extrabold leading-none text-ink">{formatCurrency(metrics.savings)}</p>
                    <p className="text-[10.5px] text-slate-500">
                      {metrics.savings > 0 ? `${metrics.savingsPercent.toFixed(1)}% frente à maior proposta` : "Sem comparação suficiente"}
                    </p>
                  </div>
                  <div className="mt-2.5 space-y-1.5 border-t border-line pt-2.5">
                    {metrics.rankings
                      .filter((row) => row.total !== null)
                      .map((row) => (
                        <div key={row.supplier.id}>
                          <div className="flex items-center justify-between gap-2 text-[10.5px] font-semibold text-slate-600">
                            <span className="truncate">{row.supplier.name}</span>
                            <span className={row.isBest ? "text-success" : ""}>{formatCurrency(row.total)}</span>
                          </div>
                          <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-line">
                            <div
                              className={`h-full rounded-full ${row.isBest ? "bg-success" : "bg-ink/30"}`}
                              style={{ width: `${Math.max(6, ((row.total ?? 0) / maxTotal) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="card px-4 py-4 sm:px-5">
              <SectionHeading number="5" title="Resultado da contratação" subtitle="Registre a referência e o valor aprovado para acompanhar a economia confirmada no dashboard." />
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="sm:col-span-3"><span className="label">Fornecedor contratado</span><select className="field mt-1" value={outcome.supplierId} onChange={(event) => updateOutcome({ supplierId: event.target.value, contractedAmount: null })}><option value="">Selecione quando houver contratação</option>{draft.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name || "Fornecedor sem nome"}</option>)}</select></label>
                <div><span className="label">Valor de referência</span><div className="mt-1"><MoneyInput value={outcome.referenceAmount} onChange={(value) => updateOutcome({ referenceAmount: value })} /></div><button type="button" disabled={metrics.highest?.total == null} onClick={() => updateOutcome({ referenceAmount: metrics.highest?.total ?? null })} className="mt-1 text-[10px] font-bold text-brand-dark underline disabled:opacity-40">Usar maior proposta completa</button></div>
                <div><span className="label">Valor contratado</span><div className="mt-1"><MoneyInput value={outcome.contractedAmount} onChange={(value) => updateOutcome({ contractedAmount: value })} /></div><button type="button" disabled={!awardedRanking || awardedRanking.coverage !== draft.items.length || awardedRanking.total === null} onClick={() => updateOutcome({ contractedAmount: awardedRanking?.total ?? null })} className="mt-1 text-[10px] font-bold text-brand-dark underline disabled:opacity-40">Usar total do fornecedor</button></div>
                <div className="rounded-lg border border-line bg-paper px-3 py-2"><span className="label">Diferença confirmada</span><p className={`mt-1 text-[15px] font-extrabold ${confirmedSavings !== null && confirmedSavings < 0 ? "text-red-700" : "text-success"}`}>{formatCurrency(confirmedSavings)}</p><p className="text-[10px] text-slate-500">{confirmedSavings !== null && confirmedSavings < 0 ? "Acima da referência" : "Referência − contratado"}</p></div>
                <label className="flex items-start gap-2 sm:col-span-3"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#181447]" checked={outcome.confirmed} onChange={(event) => updateOutcome({ confirmed: event.target.checked })} /><span className="text-[11.5px] leading-relaxed text-slate-600">Confirmo os valores da contratação. Para entrar no indicador confirmado, informe os dois valores, selecione o fornecedor e marque o mapa como <strong>Concluído</strong>.</span></label>
              </div>
            </section>

            {/* Anexos */}
            <section className="card px-4 py-4 sm:px-5">
              <SectionHeading
                number="6"
                title="Anexos do processo"
                subtitle="Documentos que embasaram o mapa, para rastreabilidade da decisão."
              />
              {draft.attachments.length === 0 ? (
                <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-4 text-center text-[11.5px] text-slate-500">
                  Nenhum anexo registrado. Use a leitura de propostas com IA para anexar PDFs e imagens.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {draft.attachments.map((file) => (
                    <li key={`${file.name}-${file.size}`} className="flex flex-wrap items-center gap-2.5 py-2">
                      <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-soft text-brand-dark">
                        <FileIcon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">{file.name}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                        {file.source === "ia" ? "Lido pela IA" : "Manual"}
                      </span>
                      <span className="text-[10.5px] text-slate-500">{formatBytes(file.size)}</span>
                      <button
                        type="button"
                        onClick={() =>
                          update({ attachments: draft.attachments.filter((entry) => entry.name !== file.name) })
                        }
                        className="rounded-md p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remover anexo ${file.name}`}
                      >
                        <CloseIcon className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Coluna lateral */}
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <section className="card overflow-hidden">
              <div className="bg-ink px-4 py-3 text-white">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/60">Resumo do comparativo</p>
                <p className="font-display mt-0.5 text-[19px] leading-tight">
                  {best?.supplier.name || (metrics.rankings.some((row) => row.total !== null) ? "Propostas parciais" : "Aguardando valores")}
                </p>
                <p className="mt-1 text-[22px] font-extrabold leading-none">{formatCurrency(best?.total ?? null)}</p>
                <p className="mt-1 text-[10px] text-white/60">{best ? "Menor proposta com cobertura completa" : "Os valores informados aparecem abaixo"}</p>
              </div>
              <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
                <div className="px-3 py-2.5">
                  <p className="label !text-[8px]">Economia</p>
                  <p className="text-[13px] font-extrabold text-success">{metrics.isComparable ? formatCurrency(metrics.savings) : "—"}</p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="label !text-[8px]">Redução</p>
                  <p className="text-[13px] font-extrabold text-success">
                    {metrics.isComparable ? `${metrics.savingsPercent.toFixed(1)}%` : "—"}
                  </p>
                </div>
              </div>
              <div className="border-b border-line px-4 py-3">
                <div className="flex items-center justify-between"><p className="label !text-[8px]">Valores por fornecedor</p><span className="text-[9px] text-slate-400">Atualização imediata</span></div>
                <div className="mt-2 space-y-2.5">
                  {metrics.rankings.map((row) => {
                    const breakdown = supplierCostBreakdown(draft.items, row.supplier.id);
                    return <div key={row.supplier.id} className="rounded-lg bg-paper/70 px-2.5 py-2"><div className="flex justify-between gap-2 text-[10.5px]"><span className="truncate font-bold text-ink">{row.supplier.name || "Fornecedor"}</span><strong className={row.isBest ? "text-success" : "text-ink"}>{formatCurrency(row.total)}</strong></div><p className="mt-0.5 text-[9.5px] text-slate-500">{row.coverage}/{metrics.itemCount} itens cotados{row.total !== null && row.coverage < metrics.itemCount ? " · total parcial" : ""}</p>{row.total !== null && <p className="mt-1 text-[9.5px] leading-relaxed text-slate-500">Mão de obra: {formatCurrency(breakdown.mao_obra.total)} · Material: {formatCurrency(breakdown.material.total)} · Não discriminado: {formatCurrency(breakdown.nao_discriminado.total)}</p>}</div>;
                  })}
                </div>
                {!metrics.isComparable && <p className="mt-2 text-[9.5px] leading-relaxed text-slate-500">A economia potencial requer pelo menos duas propostas com todos os itens preenchidos.</p>}
              </div>
              <div className="px-4 py-3">
                <p className="label !text-[8px]">Pendências para concluir</p>
                <ul className="mt-1.5 space-y-1.5">
                  {pendingChecks.map((check) => (
                    <li key={check.label} className="flex items-start gap-1.5 text-[11px] leading-snug">
                      <span
                        className={`mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full ${
                          check.ok ? "bg-success-soft text-success" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {check.ok ? <CheckIcon className="h-2.5 w-2.5" /> : <span className="text-[8px] font-black">!</span>}
                      </span>
                      <span className={check.ok ? "text-slate-500 line-through decoration-slate-300" : "font-semibold text-ink"}>
                        {check.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="card px-4 py-3.5">
              <p className="label !text-[8.5px]">Ações do processo</p>
              <div className="mt-2 space-y-2">
                <button type="button" onClick={() => setPreviewOpen(true)} className="btn btn-ghost w-full !justify-start">
                  <FileIcon className="h-4 w-4" />
                  Pré-visualizar documento
                </button>
                <button type="button" onClick={handlePdfDownload} className="btn btn-brand w-full !justify-start" disabled={saving || downloading}>
                  <DownloadIcon className="h-4 w-4" />
                  {downloading ? "Gerando PDF…" : "Baixar PDF do mapa"}
                </button>
                <button type="button" onClick={handlePrint} className="btn btn-ghost w-full !justify-start" disabled={saving}>
                  <PrinterIcon className="h-4 w-4" />
                  Imprimir no navegador
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (analysisFiles.length === 0) {
                      setAiOpen(true);
                      setFeedback({ tone: "error", message: "Nenhum arquivo guardado nesta sessão. Anexe as propostas na leitura com IA e depois use este botão." });
                      return;
                    }
                    setAiOpen(true);
                    setReanalyzeSignal((signal) => signal + 1);
                    setFeedback({ tone: "ok", message: "Reanalisando a cotação com os mesmos arquivos, sem precisar reanexar." });
                  }}
                  className="btn btn-ghost w-full !justify-start"
                >
                  <SparklesIcon className="h-4 w-4" />
                  Reanalisar cotação completa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const issues = checkCompleteness(draft).map((issue) => issue.message);
                    setCompleteness(issues);
                    setFeedback({
                      tone: issues.length ? "error" : "ok",
                      message: issues.length
                        ? `${issues.length} ponto(s) para conferir antes de concluir.`
                        : "Mapa completo: todos os campos essenciais estão preenchidos.",
                    });
                  }}
                  className="btn btn-ghost w-full !justify-start"
                >
                  <CheckIcon className="h-4 w-4" />
                  Verificar preenchimento
                </button>
                {completeness !== null && (
                  <div className="rounded-lg border border-line bg-paper/60 px-2.5 py-2">
                    {completeness.length === 0 ? (
                      <p className="text-[10.5px] font-semibold text-success">Nada pendente. Pode salvar e apresentar.</p>
                    ) : (
                      <ul className="max-h-40 space-y-1 overflow-auto text-[10.5px] leading-snug text-slate-600">
                        {completeness.slice(0, 12).map((issue) => <li key={issue}>• {issue}</li>)}
                        {completeness.length > 12 && <li>• …e mais {completeness.length - 12} ponto(s).</li>}
                      </ul>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={regenerateAnalysis}
                  className="btn btn-ghost w-full !justify-start"
                >
                  <TrendIcon className="h-4 w-4" />
                  Recalcular análise
                </button>
                {confirmDelete ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2.5">
                    <p className="text-[11px] font-bold text-red-700">Excluir este mapa?</p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={handleDelete} className="btn flex-1 bg-red-600 text-white hover:bg-red-700">
                        Excluir
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(false)} className="btn btn-ghost flex-1">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="btn w-full !justify-start text-red-600 hover:bg-red-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                    Excluir mapa
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-brand/20 bg-brand-soft/60 px-4 py-3">
              <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-brand-dark">
                <SparklesIcon className="h-3.5 w-3.5" />
                Padrão Gerencial
              </p>
              <p className="mt-1 text-[11px] leading-snug text-slate-600">
                Este mapa segue o modelo institucional da Gerencial: identificação, comparativo, condições comerciais,
                parecer técnico e aprovação — pronto para anexar ao processo do condomínio.
              </p>
            </section>
          </aside>
        </div>
      </div>

      {feedback && (
        <div
          className={`fixed bottom-5 left-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 rounded-xl px-4 py-3 text-[12.5px] font-semibold shadow-lg ${
            feedback.tone === "ok" ? "bg-ink text-white" : "bg-red-600 text-white"
          }`}
          role="status"
        >
          {feedback.message}
        </div>
      )}

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink/70 backdrop-blur-sm print:static print:block print:bg-white">
          <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-ink px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <FileIcon className="h-4 w-4 text-white/70" />
              <span className="text-[12.5px] font-bold">Pré-visualização · {protocol}</span>
              <span className="hidden rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/70 sm:inline">
                Padrão A4
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handlePdfDownload} className="btn btn-brand" disabled={downloading}>
                <DownloadIcon className="h-4 w-4" />
                {downloading ? "Gerando PDF…" : "Baixar PDF"}
              </button>
              <button type="button" onClick={() => window.print()} className="btn bg-white/10 text-white hover:bg-white/20">
                <PrinterIcon className="h-4 w-4" />
                Imprimir
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="btn bg-white/10 text-white hover:bg-white/20"
              >
                <CloseIcon className="h-4 w-4" />
                Fechar
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-3 sm:p-6 print:overflow-visible print:p-0">
            <MapDocument draft={draft} protocol={protocol} />
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeading({
  number,
  title,
  subtitle,
  right,
}: {
  number: string;
  title: string;
  subtitle: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-ink text-[11px] font-extrabold text-white">
          {number}
        </span>
        <div>
          <h2 className="text-[14px] font-extrabold leading-tight text-ink">{title}</h2>
          <p className="mt-0.5 max-w-xl text-[11.5px] leading-snug text-slate-500">{subtitle}</p>
        </div>
      </div>
      {right}
    </div>
  );
}

function MoneyInput({
  value,
  onChange,
  highlight,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  highlight?: boolean;
}) {
  const [typed, setTyped] = useState<string | null>(null);
  const display = typed ?? (value === null ? "" : formatEditable(value));

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">
        R$
      </span>
      <input
        inputMode="decimal"
        className={`field !py-2 pl-8 pr-2 text-right text-[12.5px] font-semibold tabular-nums ${
          highlight ? "!border-success/50 !bg-success-soft font-bold text-success" : ""
        }`}
        placeholder="0,00"
        value={display}
        onFocus={() => setTyped(value === null ? "" : formatEditable(value))}
        onChange={(event) => {
          setTyped(event.target.value);
          onChange(parseCurrencyInput(event.target.value));
        }}
        onBlur={() => setTyped(null)}
      />
    </div>
  );
}

function formatEditable(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
