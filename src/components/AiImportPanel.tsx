"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AiExtractionResult } from "@/lib/types";
import type { AiAnalysisPhase } from "@/lib/ai-stream";
import { readAiAnalysisResponse } from "@/lib/ai-response";
import { formatBytes } from "@/lib/quotation";
import { MAX_FILES } from "@/lib/constants";
import { CheckIcon, CloseIcon, FileIcon, SparklesIcon, UploadIcon } from "./icons";

export type AiFileMeta = { name: string; size: number; type: string };

type AiStatus = {
  connected: boolean;
  provider: "gemini" | "openai" | "none";
  model: string;
  label: string;
  setupUrl: string;
  guideUrl: string;
  maxTotalUploadBytes?: number | null;
};

export type ApplyMode = "replace" | "merge";

type AiImportPanelProps = {
  hints: { condominium?: string; service?: string; recipient?: string; description?: string };
  onApply: (result: AiExtractionResult, files: AiFileMeta[], mode: ApplyMode, rawFiles: File[]) => void;
  variant?: "hero" | "embedded";
  title?: string;
  ctaLabel?: string;
  /** Quando o mapa já tem fornecedores/itens, oferece complementar em vez de substituir. */
  hasExistingData?: boolean;
  existingFileNames?: string[];
  /** Arquivos enviados antes (mantidos pelo editor) para reanalisar sem reanexar. */
  initialFiles?: File[];
  onFilesChange?: (files: File[]) => void;
  /** Incremente para disparar uma nova análise com os arquivos atuais. */
  reanalyzeSignal?: number;
};

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remaining}`;
}

export function AiImportPanel({
  hints,
  onApply,
  variant = "embedded",
  title = "Leitura inteligente de propostas",
  ctaLabel = "Analisar com IA",
  hasExistingData = false,
  existingFileNames = [],
  initialFiles = [],
  onFilesChange,
  reanalyzeSignal = 0,
}: AiImportPanelProps) {
  const [files, setFiles] = useState<File[]>(initialFiles);
  const filesRef = useRef<File[]>(initialFiles);
  const analyzeRef = useRef<() => Promise<void>>(async () => {});
  const lastSignalRef = useRef(reanalyzeSignal);

  function syncFiles(next: File[] | ((current: File[]) => File[])) {
    setFiles((current) => {
      const value = typeof next === "function" ? (next as (current: File[]) => File[])(current) : next;
      filesRef.current = value;
      onFilesChange?.(value);
      return value;
    });
  }
  const [text, setText] = useState("");
  const [showText, setShowText] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"enviando" | AiAnalysisPhase>("enviando");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiExtractionResult | null>(null);
  const [applied, setApplied] = useState(false);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [webSearch, setWebSearch] = useState(true);
  const [mode, setMode] = useState<ApplyMode>(hasExistingData ? "merge" : "replace");
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  const totalFilesBytes = files.reduce((sum, file) => sum + file.size, 0);
  const uploadLimit = status ? status.maxTotalUploadBytes : 4 * 1024 * 1024;
  // O Gemini não informa porcentagem real: a barra indica apenas uma estimativa.
  // Nunca chega a 100% antes da resposta verdadeira da IA.
  const progress = phase === "enviando"
    ? Math.min(12, 3 + elapsedSeconds)
    : Math.min(95, 15 + Math.floor(80 * (1 - Math.exp(-elapsedSeconds / 65))));

  useEffect(() => {
    let active = true;
    fetch("/api/ai/status")
      .then((response) => response.json())
      .then((data: AiStatus) => {
        if (active) setStatus(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loading) return;
    const startTime = Date.now();
    const timer = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [loading]);

  useEffect(() => () => requestRef.current?.abort(), []);

  function addFiles(incoming: FileList | File[]) {
    if (loading) return;
    const next = Array.from(incoming).filter((file) => {
      const okType = file.type === "application/pdf" || file.type.startsWith("image/");
      return okType && file.size <= 15 * 1024 * 1024;
    });
    setError(
      next.length === 0
        ? "Formato não suportado ou arquivo acima de 15 MB. Envie PDF, JPG, PNG ou WEBP."
        : null,
    );
    syncFiles((current) => {
      const merged = [...current];
      for (const file of next) {
        if (!merged.some((entry) => entry.name === file.name && entry.size === file.size)) merged.push(file);
      }
      return merged.slice(0, MAX_FILES);
    });
    setResult(null);
    setApplied(false);
  }

  async function analyze() {
    if (files.length === 0 && !text.trim()) {
      setError("Envie os arquivos das propostas ou cole o texto da cotação para analisar.");
      return;
    }

    const textBytes = new TextEncoder().encode(text + JSON.stringify(hints)).byteLength;
    const approxPayloadBytes = totalFilesBytes + textBytes + 16 * 1024;
    if (uploadLimit && approxPayloadBytes > uploadLimit) {
      setError(`O total dos arquivos (${formatBytes(totalFilesBytes)}) ultrapassa o limite seguro de 4 MB por envio na Vercel. Comprima os PDFs para enviá-los juntos.`);
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setPhase("enviando");
    setElapsedSeconds(0);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      form.append("text", text);
      form.append("hints", JSON.stringify(hints));
      form.append("webSearch", webSearch ? "1" : "0");

      const response = await fetch("/api/ai/extract?stream=1", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const data = await readAiAnalysisResponse(response, setPhase);
      setResult(data);
      setApplied(false);
    } catch (requestError) {
      if (controller.signal.aborted) {
        setError("Análise cancelada. Os arquivos continuam selecionados e você pode tentar novamente.");
      } else if (requestError instanceof TypeError) {
        setError("A conexão foi interrompida durante a análise. Seus arquivos continuam selecionados; verifique a internet e tente novamente.");
      } else {
        setError(requestError instanceof Error ? requestError.message : "Não foi possível concluir a análise. Tente novamente.");
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      setLoading(false);
    }
  }

  analyzeRef.current = analyze;

  function apply() {
    if (!result) return;
    onApply(
      result,
      files.map((file) => ({ name: file.name, size: file.size, type: file.type || "application/pdf" })),
      mode,
      [...filesRef.current],
    );
    setApplied(true);
  }

  // Reanálise: o editor pede uma nova leitura com os arquivos já selecionados.
  useEffect(() => {
    if (reanalyzeSignal > 0 && reanalyzeSignal !== lastSignalRef.current) {
      lastSignalRef.current = reanalyzeSignal;
      if (!loading && filesRef.current.length > 0) void analyzeRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reanalyzeSignal]);

  const modeLabel = result?.mode === "ia" ? "Análise concluída pela IA" : "Pré-análise local (texto)";
  const showSetupHint = error !== null && /configurar ia|chave/i.test(error);

  const phaseMessage = phase === "enviando"
    ? "Enviando documentos ao servidor…"
    : phase === "recebido"
      ? "Documentos recebidos. Preparando análise…"
      : phase === "tentando_novamente"
        ? "A conexão com o Google falhou. Tentando novamente…"
        : phase === "alternativa"
          ? "Tentando uma alternativa compatível do Gemini…"
          : phase === "pesquisando"
            ? "Pesquisando produtos em lojas confiáveis…"
            : "Aguardando o resultado da análise da IA…";
  const showGoogleHelp = error !== null && /Google|Gemini|cota/i.test(error);

  return (
    <section className={`card overflow-hidden ${variant === "hero" ? "ring-1 ring-brand/40" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-gradient-to-r from-brand-soft/80 via-white to-white px-4 py-3.5 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-xl bg-ink text-brand shadow-sm">
            <SparklesIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[15px] font-extrabold leading-tight text-ink">{title}</h2>
            <p className="mt-0.5 max-w-md text-[12px] leading-snug text-slate-500">
              Envie as propostas em PDF ou imagem. A IA gratuita identifica fornecedores, itens e valores e monta o
              mapa comparativo pronto para revisão.
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
            status?.connected ? "bg-success-soft text-success" : "bg-amber-50 text-amber-700"
          }`}
          title={status?.label}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status?.connected ? "bg-success" : "bg-amber-500"}`} />
          {status ? status.label : "Verificando IA…"}
        </span>
      </div>

      <div className="px-4 py-4 sm:px-5">
        {status && !status.connected && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/40 bg-brand-soft px-3 py-2.5">
            <p className="max-w-md text-[11.5px] leading-snug text-ink">
              <span className="font-extrabold">IA ainda não ativada.</span> Ative a leitura automática de PDFs e fotos
              em 2 minutos — é grátis, com sua conta Google.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/ajuda/ia" className="btn btn-ghost !py-1.5">
                Passo a passo
              </Link>
              <Link href="/configuracoes" className="btn btn-brand !py-1.5">
                <SparklesIcon className="h-3.5 w-3.5" />
                Ativar IA grátis
              </Link>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
          multiple
          disabled={loading}
          className="hidden"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
        />

        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!loading) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!loading && event.dataTransfer.files) addFiles(event.dataTransfer.files);
          }}
          onClick={() => { if (!loading) inputRef.current?.click(); }}
          role="button"
          aria-disabled={loading}
          tabIndex={loading ? -1 : 0}
          onKeyDown={(event) => {
            if (!loading && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-7 text-center transition ${
            dragging ? "border-brand-dark bg-brand-soft" : "border-[#cfc9ae] bg-[#fffdf6] hover:border-brand-dark/70 hover:bg-brand-soft/50"
          }`}
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-ink text-brand shadow-sm">
            <UploadIcon className="h-5 w-5" />
          </span>
          <p className="mt-3 text-[13px] font-bold text-ink">Arraste aqui as propostas dos fornecedores</p>
          <p className="mt-1 text-[11.5px] text-slate-500">
            PDF, JPG, PNG ou WEBP · até {MAX_FILES} arquivos · {uploadLimit ? "até 4 MB no total por envio" : "até 15 MB por arquivo"}
          </p>
          <span className="mt-2.5 inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-[11px] font-bold text-ink ring-1 ring-line">
            Selecionar arquivos
          </span>
        </div>

        {files.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span>{files.length} arquivo(s) selecionado(s)</span>
              <span className={uploadLimit && totalFilesBytes > uploadLimit ? "font-bold text-red-600" : "text-slate-500"}>
                Total: {formatBytes(totalFilesBytes)}{uploadLimit ? " / até 4 MB" : ""}
              </span>
            </div>
            <ul className="space-y-2">
              {files.map((file) => (
                <li
                  key={`${file.name}-${file.size}`}
                  className="flex items-center gap-2.5 rounded-lg border border-line bg-white px-2.5 py-2"
                >
                  <FileIcon className="h-4 w-4 shrink-0 text-brand-dark" />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">{file.name}</span>
                  <span className="text-[10.5px] text-slate-500">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    aria-label={`Remover ${file.name}`}
                    disabled={loading}
                    onClick={(event) => {
                      event.stopPropagation();
                      syncFiles((current) => current.filter((entry) => entry !== file));
                      setResult(null);
                      setApplied(false);
                    }}
                    className="rounded-md p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CloseIcon className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowText((current) => !current)}
            className="text-[11.5px] font-bold text-ink underline decoration-brand decoration-2 underline-offset-2 hover:decoration-brand-dark"
          >
            {showText ? "Ocultar texto da cotação" : "Ou cole o texto da cotação (funciona sem IA)"}
          </button>
          {showText && (
            <textarea
              value={text}
              disabled={loading}
              onChange={(event) => {
                setText(event.target.value);
                setResult(null);
                setApplied(false);
              }}
              rows={5}
              placeholder={"Cole aqui o conteúdo da proposta ou do orçamento.\nEx.: Fornecedor: HidroLuz Materiais Ltda.\nTubo PVC 25mm — 20 un — R$ 89,90"}
              className="field mt-2 resize-y font-mono text-[11.5px]"
            />
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <p className="text-[12px] font-bold leading-snug text-red-700">{error}</p>
            {(showSetupHint || showGoogleHelp) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {showSetupHint && (
                  <Link href="/configuracoes" className="btn btn-brand !py-1.5">
                    Configurar IA
                  </Link>
                )}
                {showGoogleHelp && (
                  <>
                    <a href="https://aistudio.google.com/status" target="_blank" rel="noopener noreferrer" className="btn btn-ghost !py-1.5">
                      Status do Google ↗
                    </a>
                    <a href="https://aistudio.google.com/usage" target="_blank" rel="noopener noreferrer" className="btn btn-ghost !py-1.5">
                      Verificar cota ↗
                    </a>
                  </>
                )}
                <Link href="/ajuda/ia" className="btn btn-ghost !py-1.5">
                  Ver ajuda
                </Link>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 space-y-2 rounded-xl border border-line bg-paper/50 px-3 py-2.5">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[#181447]"
              checked={webSearch}
              disabled={loading}
              onChange={(event) => setWebSearch(event.target.checked)}
            />
            <span className="text-[11.5px] leading-snug text-slate-600">
              <strong className="text-ink">Pesquisar produtos e links de compra em lojas confiáveis</strong> (opcional).
              A IA usa a busca do Google restrita a lojas conhecidas de materiais e ferragens. Pode deixar desmarcado para
              analisar apenas os documentos enviados.
            </span>
          </label>
          {hasExistingData && (
            <fieldset className="rounded-lg border border-line bg-white px-2.5 py-2">
              <legend className="px-1 text-[9.5px] font-bold uppercase tracking-[0.1em] text-slate-500">Como aplicar esta análise</legend>
              <label className="mt-1 flex items-start gap-2">
                <input type="radio" name="apply-mode" className="mt-0.5 h-3.5 w-3.5 accent-[#181447]" checked={mode === "merge"} disabled={loading} onChange={() => setMode("merge")} />
                <span className="text-[11.5px] leading-snug text-slate-600"><strong className="text-ink">Completar o mapa atual</strong> — soma aos {existingFileNames.length > 0 ? `${existingFileNames.length} arquivo(s) já analisado(s)` : "dados já preenchidos"}, sem apagar preços existentes.</span>
              </label>
              <label className="mt-1 flex items-start gap-2">
                <input type="radio" name="apply-mode" className="mt-0.5 h-3.5 w-3.5 accent-[#181447]" checked={mode === "replace"} disabled={loading} onChange={() => setMode("replace")} />
                <span className="text-[11.5px] leading-snug text-slate-600"><strong className="text-ink">Substituir os dados</strong> — usa somente o resultado desta análise.</span>
              </label>
            </fieldset>
          )}
          {existingFileNames.length > 0 && (
            <p className="text-[10px] leading-snug text-slate-500">
              Anexos já no mapa: {existingFileNames.slice(0, 4).join(", ")}{existingFileNames.length > 4 ? "…" : ""}. O
              aplicativo guarda os dados extraídos; para somar um novo arquivo, envie-o novamente junto desta análise.
            </p>
          )}
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
          <p className="max-w-sm text-[10.5px] leading-snug text-slate-500">
            {status?.connected
              ? "Os arquivos são enviados ao provedor de IA configurado. Confira os termos de privacidade antes de enviar dados reais."
              : "Sem a IA ativada, use o texto colado ou preencha manualmente."}
          </p>
          <button type="button" onClick={analyze} disabled={loading} className="btn btn-brand">
            <SparklesIcon className={loading ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
            {loading ? `Analisando… ${progress}%` : ctaLabel}
          </button>
        </div>

        {loading && (
          <div className="mt-3.5 rounded-xl border border-brand/40 bg-brand-soft/70 p-3.5" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-extrabold text-ink">{phaseMessage}</span>
              <span className="font-mono text-[13px] font-black text-brand-dark">~{progress}%</span>
            </div>
            <div
              className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white ring-1 ring-line"
              role="progressbar"
              aria-label="Progresso estimado da análise"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-valuetext={`${progress}% estimado; aguardando a resposta da IA`}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand to-[#ffc14d] transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
              <span>Tempo decorrido: <strong>{formatElapsed(elapsedSeconds)}</strong></span>
              <button
                type="button"
                onClick={() => requestRef.current?.abort()}
                className="font-bold text-ink underline decoration-brand underline-offset-2 hover:text-brand-dark"
              >
                Cancelar análise
              </button>
            </div>
            <p className="mt-1.5 text-[10.5px] leading-snug text-slate-500">
              A porcentagem é uma estimativa: o Google não informa o tempo exato. Várias propostas podem levar alguns minutos, mesmo quando os arquivos são pequenos.
            </p>
          </div>
        )}

        {result && (
          <div className="mt-3 rounded-xl border border-line bg-[#fffdf6] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-success">
                <CheckIcon className="h-3 w-3" />
                {modeLabel} · 100%
              </span>
              <span className="text-[10.5px] font-semibold text-slate-500">{result.provider}</span>
            </div>
            <p className="mt-2 text-[12px] leading-snug text-slate-600">
              {result.draft.suppliers.length} fornecedor(es) · {result.draft.items.length} item(ns) identificados
              {result.draft.condominium ? ` · ${result.draft.condominium}` : ""}
            </p>
            {result.warnings.length > 0 && (
              <ul className="mt-2 space-y-1">
                {result.warnings.map((warning) => (
                  <li key={warning} className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-800">
                    {warning}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button type="button" onClick={apply} className="btn btn-primary" disabled={applied}>
                <CheckIcon className="h-4 w-4" />
                {applied ? "Dados aplicados ao mapa" : "Aplicar dados ao mapa"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  syncFiles([]);
                  setText("");
                }}
                className="btn btn-ghost"
              >
                Limpar
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
