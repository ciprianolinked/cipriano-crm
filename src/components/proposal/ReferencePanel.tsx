"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Layers,
  LoaderCircle,
  Plus,
  RefreshCw,
  ScanText,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { brl } from "@/lib/brand";
import { fetchJson } from "@/lib/api-client";
import { priceSummary, type ReferenceAnalysis } from "@/lib/references";
import type { CompetitorAnalysis } from "@/lib/references-analysis";
import type { Insight } from "@/lib/ai";
import type { ProposalDraft, ProposalType, Totals } from "@/lib/proposal/types";

type ReferenceFile = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  manualText: string | null;
  createdAt: string;
  analysis: ReferenceAnalysis | null;
  url: string;
  textPreview: string;
};

export type AnalysisContext = {
  type: ProposalType;
  clientName: string;
  contact: string;
  clientEmail: string;
  site: string;
  validityDays: number;
};

export type AnalysisResponse = {
  analysis: CompetitorAnalysis;
  draft: ProposalDraft;
  totals: Totals;
  insights: Insight[];
  aiNote: string;
};

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir. Tente novamente.";
}

export function ReferencePanel({
  context,
  onAnalysisReady,
  maxFiles = 6,
}: {
  context: AnalysisContext;
  onAnalysisReady: (result: AnalysisResponse) => void;
  maxFiles?: number;
}) {
  const [files, setFiles] = useState<ReferenceFile[]>([]);
  const [analysis, setAnalysis] = useState<CompetitorAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);

  async function load() {
    try {
      const data = await fetchJson<{ files: ReferenceFile[] }>("/api/references");
      setFiles(data.files);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, []);

  async function upload(list: FileList | File[]) {
    const queue = Array.from(list);
    if (!queue.length) return;
    controller.current?.abort();
    controller.current = new AbortController();
    setBusy(true);
    setError("");
    setFlash("");
    setAnalysis(null);
    let uploaded = 0;
    let failed = "";

    for (const file of queue) {
      if (files.length + uploaded >= maxFiles) {
        failed = `Limite de ${maxFiles} arquivos atingido. Exclua um antes de enviar outro.`;
        break;
      }
      const form = new FormData();
      form.append("file", file);
      try {
        const response = await fetch(`${window.location.origin}/api/references`, {
          method: "POST",
          body: form,
          signal: controller.current?.signal,
        });
        const contentType = response.headers.get("content-type") ?? "";
        const raw = await response.text();
        let data: { error?: string; file?: ReferenceFile } = {};
        try {
          data = raw.trim() ? (JSON.parse(raw) as typeof data) : {};
        } catch {
          data = {};
        }
        if (!response.ok || !data.file) {
          failed =
            data.error ??
            (contentType.includes("text/html")
              ? `O servidor devolveu HTML (HTTP ${response.status}) ao enviar ${file.name}. Confira o deploy e /api/health.`
              : `Falha ao enviar ${file.name}.`);
          break;
        }
        setFiles((prev) => [data.file!, ...prev]);
        uploaded += 1;
      } catch (err) {
        if ((err as Error).name === "AbortError") break;
        failed = `Falha de conexão ao enviar ${file.name}.`;
        break;
      }
    }
    setBusy(false);
    if (failed) setError(failed);
    if (uploaded > 0) setFlash(`${uploaded} arquivo(s) enviado(s). Clique em “Analisar e igualar valores” para montar a proposta.`);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function analyze() {
    setAnalyzing(true);
    setError("");
    setFlash("");
    try {
      const result = await fetchJson<AnalysisResponse>("/api/references/analyze", {
        method: "POST",
        body: JSON.stringify(context),
      });
      setAnalysis(result.analysis);
      onAnalysisReady(result);
      setFlash(
        `${result.analysis.items.length} itens lidos em ${result.analysis.scopes.length} escopo(s). ` +
          `Valor igualado: ${brl(result.analysis.matchedValue)} — editável depois de salvar.`,
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAnalyzing(false);
    }
  }

  async function remove(id: string) {
    const target = files.find((file) => file.id === id);
    if (!target || !window.confirm(`Excluir "${target.fileName}"?`)) return;
    setBusy(true);
    try {
      await fetchJson(`/api/references/${id}`, { method: "DELETE" });
      setFiles((prev) => prev.filter((file) => file.id !== id));
      setAnalysis(null);
      setExpanded(null);
      setFlash("Arquivo excluído. Analise novamente para atualizar a proposta.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (!files.length || !window.confirm("Excluir todos os arquivos de referência?")) return;
    setBusy(true);
    try {
      await Promise.all(files.map((file) => fetchJson(`/api/references/${file.id}`, { method: "DELETE" })));
      setFiles([]);
      setAnalysis(null);
      setFlash("Arquivos de referência removidos.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveMeta(id: string, patch: { note?: string; manualText?: string }) {
    try {
      await fetchJson(`/api/references/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setFiles((prev) =>
        prev.map((file) =>
          file.id === id
            ? {
                ...file,
                note: patch.note !== undefined ? patch.note || null : file.note,
                manualText: patch.manualText !== undefined ? patch.manualText || null : file.manualText,
                textPreview: patch.manualText !== undefined ? patch.manualText.slice(0, 3000) : file.textPreview,
              }
            : file,
        ),
      );
      setAnalysis(null);
      setFlash("Atualizado. Analise novamente para considerar a transcrição.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const allPrices = files.flatMap((file) => file.analysis?.prices ?? []);
  const summary = priceSummary(allPrices);
  const remaining = Math.max(0, maxFiles - files.length);
  const isPdf = (mime: string) => mime === "application/pdf";
  const isText = (mime: string) => mime.startsWith("text/");

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label-mono text-signal">Inteligência competitiva · até {maxFiles} arquivos</div>
          <h2 className="mt-1 font-display text-lg font-semibold text-white">
            Analisar propostas do concorrente
          </h2>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-steel">
            O sistema lê equipamentos, quantidades e valores, separa os escopos (CFTV IP, Controle de Acesso, Rede etc.)
            e monta uma proposta com <b className="text-silver">valores igualados</b> — nunca com preço menor automático.
            Você ajusta os preços no editor depois de salvar.
          </p>
        </div>
        <span className={`chip shrink-0 ${remaining === 0 ? "!border-amber/50 !text-amber" : "!border-signal/40 !text-signal"}`}>
          {files.length} / {maxFiles} enviados
        </span>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(event.dataTransfer.files);
        }}
        className={`mt-4 rounded-xl border-2 border-dashed p-5 text-center transition ${
          dragging ? "border-signal bg-signal/[0.07]" : "border-line/70 bg-abyss2/35"
        }`}
      >
        <Upload size={20} className={`mx-auto ${dragging ? "text-signal" : "text-steel"}`} />
        <p className="mt-2 text-[12px] text-silver">
          Arraste os arquivos aqui ou clique em <b className="text-signal">Selecionar arquivos</b>
        </p>
        <p className="mt-1 text-[10.5px] text-steel">
          PDF, PNG, JPG, WEBP ou TXT · até 4 MB por arquivo · PDFs com texto são lidos item a item
        </p>
        <button
          type="button"
          className="btn btn-primary mt-3"
          disabled={busy || remaining === 0}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}
          {busy ? "Enviando…" : `Selecionar arquivos (${remaining} restante${remaining > 1 ? "s" : ""})`}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,image/png,image/jpeg,image/webp,text/plain,text/markdown,text/csv"
          className="hidden"
          disabled={busy || remaining === 0}
          onChange={(event) => {
            if (event.target.files) void upload(event.target.files);
          }}
        />
      </div>

      {files.length ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10.5px] text-steel">Arquivos prontos para análise: {files.length} de {maxFiles}</span>
          <button type="button" className="text-[11px] text-alarm hover:underline" onClick={() => void clearAll()} disabled={busy}>
            Limpar todos
          </button>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="mt-3 flex gap-2 rounded-lg border border-alarm/35 bg-alarm/5 p-3 text-[11.5px] leading-relaxed text-alarm">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {flash ? (
        <div role="status" className="mt-3 rounded-lg border border-armed/30 bg-armed/5 p-3 text-[11.5px] text-silver">
          {flash}
        </div>
      ) : null}

      <button
        type="button"
        className="btn btn-primary mt-4 w-full py-3"
        disabled={analyzing || busy || !files.length}
        onClick={() => void analyze()}
      >
        {analyzing ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />}
        {analyzing ? "Lendo equipamentos e quantidades…" : "Analisar e igualar valores da proposta"}
      </button>

      {summary ? (
        <div className="mt-4 rounded-xl border border-signal/25 bg-signal/[0.05] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="label-mono text-signal">Valores brutos encontrados nos arquivos</div>
            <span className="text-[10.5px] text-steel">{summary.count} ocorrência(s)</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {([
              ["Menor", summary.min],
              ["Mediana", summary.median],
              ["Maior", summary.max],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded-lg border border-line/50 bg-abyss2/50 p-2 text-center">
                <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-steel">{label}</div>
                <div className="mt-1 font-display text-[14px] font-semibold text-white">{brl(value)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {analysis ? (
        <div className="mt-4 rounded-xl border border-signal/30 bg-signal/[0.04] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="label-mono flex items-center gap-1.5 text-signal"><Layers size={13} /> Escopos identificados</div>
              <h3 className="mt-1 font-display text-[15px] font-semibold text-white">
                {analysis.items.length} itens · {analysis.scopes.length} escopos separados
              </h3>
            </div>
            <div className="text-right">
              <div className="label-mono">Valor igualado</div>
              <div className="font-display text-xl font-semibold text-signal">{brl(analysis.matchedValue)}</div>
              <div className="mt-0.5 text-[10px] text-steel">sem desconto automático</div>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {analysis.scopes.map((scope) => (
              <details key={scope.id} open className="rounded-lg border border-line/55 bg-abyss2/45 p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[12.5px] font-medium text-white">
                    <span className="chip !px-1.5 !py-0 !text-[9px]">{scope.items.length}</span>
                    {scope.name}
                  </span>
                  <span className="font-mono text-[10.5px] text-signal">{brl(scope.subtotal)}</span>
                </summary>
                <div className="mt-2 space-y-1.5 border-t border-line/40 pt-2">
                  {scope.items.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 text-[11px]">
                      <span className="min-w-0 flex-1 text-silver">
                        <b className="font-mono text-signal">{item.qty} {item.unit}</b> — {item.description}
                        {item.spec ? <span className="text-steel"> · {item.spec}</span> : null}
                      </span>
                      <span className="shrink-0 font-mono text-[10.5px] text-steel">
                        {brl(item.unitPrice)} → {brl(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>

          {analysis.hasCftvAndAccess ? (
            <p className="mt-3 flex gap-2 rounded-lg border border-network/30 bg-network/5 p-2.5 text-[10.5px] leading-relaxed text-silver">
              <ScanText size={14} className="mt-0.5 shrink-0 text-network" />
              CFTV IP e Controle de Acesso foram separados em seções próprias, com um bloco explicando que compartilham a
              mesma rede — sem duplicar infraestrutura.
            </p>
          ) : null}

          {analysis.warnings.length ? (
            <div className="mt-3 space-y-1.5">
              {analysis.warnings.map((warning) => (
                <p key={warning} className="flex gap-2 rounded-lg border border-amber/25 bg-amber/5 p-2.5 text-[10.5px] leading-relaxed text-amber">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  {warning}
                </p>
              ))}
            </div>
          ) : null}

          <p className="mt-3 text-[10.5px] leading-relaxed text-steel">{analysis.note}</p>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-line/50 bg-abyss2/40 p-3 text-[11.5px] text-steel">
            <LoaderCircle size={14} className="animate-spin" /> Carregando arquivos…
          </div>
        ) : null}
        {!loading && !files.length ? (
          <div className="rounded-lg border border-line/50 bg-abyss2/30 p-4 text-center">
            <ScanText size={18} className="mx-auto text-steel/70" />
            <p className="mt-2 text-[11.5px] text-silver">Nenhuma proposta de concorrente enviada.</p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-steel">
              Envie os orçamentos em PDF com texto (ou transcreva PDFs escaneados) para ler equipamentos e quantidades.
            </p>
          </div>
        ) : null}

        {files.map((file) => {
          const prices = file.analysis?.prices ?? [];
          const isOpen = expanded === file.id;
          const noText = !file.analysis?.hasText && !file.manualText;
          return (
            <article key={file.id} className="rounded-xl border border-line/60 bg-abyss2/45 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line/60 bg-navy text-signal">
                    {isPdf(file.mimeType) || isText(file.mimeType) ? <FileText size={15} /> : <ImageIcon size={15} />}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-[12.5px] font-medium text-white" title={file.fileName}>
                      {file.fileName}
                    </h3>
                    <p className="mt-0.5 text-[10px] text-steel">
                      {formatSize(file.sizeBytes)}
                      {file.analysis?.pages ? ` · ${file.analysis.pages} página(s)` : ""}
                      {` · ${prices.length} valor(es)`}
                      {file.manualText ? " · texto digitado" : ""}
                      {noText ? " · sem texto legível" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn px-2.5 py-1 text-[10.5px]">
                    Abrir
                  </a>
                  <button
                    type="button"
                    onClick={() => void remove(file.id)}
                    disabled={busy}
                    className="rounded-lg border border-line/60 p-1.5 text-steel transition hover:border-alarm/50 hover:text-alarm"
                    aria-label={`Excluir ${file.fileName}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {prices.length ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {prices.slice(0, 6).map((price) => (
                    <span key={price.raw} className="chip !border-signal/35 !text-signal" title={price.context}>
                      {price.raw}
                    </span>
                  ))}
                  {prices.length > 6 ? <span className="chip">+{prices.length - 6}</span> : null}
                </div>
              ) : null}

              <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line/40 pt-2.5">
                <input
                  className="field flex-1 !py-1 text-[11px]"
                  defaultValue={file.note ?? ""}
                  placeholder="Anotação: prazo, escopo, condições do concorrente…"
                  onBlur={(event) => {
                    const value = event.target.value.trim();
                    if (value !== (file.note ?? "")) void saveMeta(file.id, { note: value });
                  }}
                />
                <button
                  type="button"
                  className="btn px-2.5 py-1 text-[10.5px]"
                  onClick={() => setExpanded(isOpen ? null : file.id)}
                >
                  <ChevronDown size={12} className={isOpen ? "rotate-180 transition" : "transition"} />
                  {isOpen ? "Ocultar" : noText ? "Transcrever" : "Ver texto"}
                </button>
                <button
                  type="button"
                  className="btn px-2.5 py-1 text-[10.5px]"
                  onClick={() => {
                    setExpanded(null);
                    void load();
                  }}
                  title="Reler arquivos"
                >
                  <RefreshCw size={12} />
                </button>
              </div>

              {isOpen ? (
                <div className="mt-2 space-y-2">
                  <label className="block">
                    <span className="label-mono mb-1 block">Texto digitado (substitui a leitura automática)</span>
                    <textarea
                      className="field min-h-[100px] font-mono text-[10.5px] leading-relaxed"
                      value={editingText[file.id] ?? file.manualText ?? ""}
                      onChange={(event) => setEditingText((prev) => ({ ...prev, [file.id]: event.target.value }))}
                      placeholder={"Cole aqui os itens do orçamento, um por linha. Ex.:\n8 un - Câmera IP Bullet 4K ColorVu - R$ 1.290,00 - R$ 10.320,00\n2 portas - Controle de acesso facial - R$ 3.150,00 - R$ 6.300,00\nTOTAL: R$ 16.620,00"}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary py-1.5 text-[10.5px]"
                    onClick={() => void saveMeta(file.id, { manualText: editingText[file.id] ?? file.manualText ?? "" })}
                  >
                    Salvar transcrição
                  </button>
                  {file.textPreview ? (
                    <pre className="scroll-thin max-h-44 overflow-auto whitespace-pre-wrap rounded-lg border border-line/50 bg-abyss/60 p-2.5 font-mono text-[10px] leading-relaxed text-steel">
                      {file.textPreview}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
