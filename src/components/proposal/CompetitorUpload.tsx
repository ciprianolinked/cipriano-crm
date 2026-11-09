"use client";

import { useState, useRef } from "react";
import {
  UploadCloud,
  FileText,
  FileImage,
  FileSpreadsheet,
  Trash2,
  Sparkles,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  X,
  Target,
  Swords,
  Copy,
  Check,
} from "lucide-react";
import { brl } from "@/lib/brand";
import type { CompetitorAnalysis, CompetitorFile } from "@/lib/proposal/types";

const MAX_FILES = 6;
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export function CompetitorUpload({
  clientNameHint,
  onApplyAnalysis,
  initialAnalysis,
}: {
  clientNameHint?: string;
  onApplyAnalysis?: (analysis: CompetitorAnalysis) => void;
  initialAnalysis?: CompetitorAnalysis | null;
}) {
  const [files, setFiles] = useState<CompetitorFile[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<CompetitorAnalysis | null>(initialAnalysis ?? null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileIcon(type: string, name: string) {
    const n = name.toLowerCase();
    const t = type.toLowerCase();
    if (t.includes("pdf") || n.endsWith(".pdf")) return <FileText className="text-alarm" size={18} />;
    if (t.includes("image") || n.endsWith(".png") || n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".webp"))
      return <FileImage className="text-signal" size={18} />;
    return <FileSpreadsheet className="text-network" size={18} />;
  }

  async function handleFileSelection(selectedFiles: FileList | null) {
    if (!selectedFiles || selectedFiles.length === 0) return;
    setError(null);

    const currentCount = files.length;
    const availableSlots = MAX_FILES - currentCount;

    if (availableSlots <= 0) {
      setError(`Você já atingiu o limite de ${MAX_FILES} arquivos.`);
      return;
    }

    const filesToProcess = Array.from(selectedFiles).slice(0, availableSlots);
    if (selectedFiles.length > availableSlots) {
      setError(`Foram selecionados mais de ${MAX_FILES} arquivos. Adicionamos apenas os primeiros ${availableSlots}.`);
    }

    const newFiles: CompetitorFile[] = [];

    for (const f of filesToProcess) {
      if (f.size > MAX_BYTES) {
        setError(`O arquivo ${f.name} excede o limite de 10 MB.`);
        continue;
      }

      try {
        const base64 = await readFileAsBase64(f);
        newFiles.push({
          name: f.name,
          type: f.type || "application/octet-stream",
          size: f.size,
          base64,
        });
      } catch {
        setError(`Erro ao carregar o arquivo ${f.name}.`);
      }
    }

    setFiles((prev) => [...prev, ...newFiles].slice(0, MAX_FILES));
  }

  function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function clearAll() {
    setFiles([]);
    setAnalysis(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function startAnalysis() {
    if (files.length === 0) {
      setError("Adicione pelo menos 1 arquivo com a proposta do concorrente.");
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const res = await fetch("/api/proposals/competitor-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files,
          clientName: clientNameHint,
        }),
      });

      const data = (await res.json()) as { analysis?: CompetitorAnalysis; error?: string };
      if (!res.ok || !data.analysis) {
        throw new Error(data.error || "Não foi possível analisar os arquivos do concorrente.");
      }

      setAnalysis(data.analysis);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao analisar os documentos do concorrente.");
    } finally {
      setAnalyzing(false);
    }
  }

  function copyTalkingPoint(text: string, index: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  return (
    <div className="rounded-xl border border-line/70 bg-gradient-to-br from-navy2/90 via-abyss2/90 to-abyss/90 p-4 shadow-lg">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber/40 bg-amber/10 text-amber">
            <Swords size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="label-mono !text-amber">Inteligência Competitiva</span>
              <span className="chip !border-amber/30 !text-amber">Até {MAX_FILES} arquivos</span>
            </div>
            <h3 className="font-display text-[15px] font-semibold text-white">
              Analisar Proposta do Concorrente &amp; Vencer em Valores
            </h3>
          </div>
        </div>

        {analysis ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-[11.5px] text-steel transition hover:text-white"
          >
            {expanded ? "Recolher análise" : "Expandir análise"}
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        ) : null}
      </div>

      <p className="mt-2 text-[11.5px] leading-relaxed text-steel">
        Faça upload de orçamentos, fotos ou PDFs do concorrente (até 6 arquivos). A IA extrai valores, equipamentos e
        condições, detecta armadilhas e sugere uma contraproposta da Cipriano calibrada para fechar com melhor preço e
        qualidade superior.
      </p>

      {/* Área de Seleção e Upload */}
      <div className="mt-3.5 space-y-3">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFileSelection(e.dataTransfer.files);
          }}
          className={`relative rounded-xl border-2 border-dashed p-4 text-center transition ${
            files.length >= MAX_FILES
              ? "border-line/40 bg-abyss2/30 opacity-70"
              : "border-line hover:border-signal/60 hover:bg-signal/[0.02]"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv"
            onChange={(e) => handleFileSelection(e.target.files)}
            disabled={files.length >= MAX_FILES || analyzing}
            className="hidden"
            id="competitor-file-input"
          />

          <label
            htmlFor="competitor-file-input"
            className="flex cursor-pointer flex-col items-center justify-center gap-1.5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy/60 text-signal">
              <UploadCloud size={22} />
            </div>
            <div className="text-[12.5px] font-medium text-silver">
              Arraste os arquivos aqui ou <span className="text-signal underline">clique para selecionar</span>
            </div>
            <div className="text-[10.5px] text-steel">
              PDF, imagens (PNG/JPG/WEBP) ou texto · Limite de 10 MB por arquivo ({files.length}/{MAX_FILES} selecionados)
            </div>
          </label>
        </div>

        {/* Lista de Arquivos Selecionados */}
        {files.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-steel">
              <span>Arquivos prontos para análise ({files.length} de {MAX_FILES}):</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-alarm transition hover:underline"
              >
                Limpar todos
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {files.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-line/60 bg-abyss2/70 p-2.5 text-[11.5px]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {getFileIcon(file.type, file.name)}
                    <div className="min-w-0">
                      <div className="truncate font-medium text-white" title={file.name}>
                        {file.name}
                      </div>
                      <div className="text-[10px] text-steel">{formatBytes(file.size)}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    disabled={analyzing}
                    className="p-1 text-steel transition hover:text-alarm"
                    title="Remover arquivo"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Botão de Análise */}
            <div className="pt-1">
              <button
                type="button"
                onClick={startAnalysis}
                disabled={analyzing}
                className="btn btn-primary w-full py-2.5 font-semibold shadow-md"
              >
                <Sparkles size={16} />
                {analyzing
                  ? "Analisando proposta do concorrente com IA..."
                  : `Analisar ${files.length} arquivo(s) & Gerar Contraproposta Vencedora`}
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-alarm/40 bg-alarm/10 p-3 text-[11.5px] text-alarm">
            {error}
          </div>
        ) : null}
      </div>

      {/* Resultado da Análise / Raio-X */}
      {analysis && expanded ? (
        <div className="mt-5 space-y-4 rounded-xl border border-line/80 bg-abyss2/90 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
            <div className="flex items-center gap-2">
              <Target className="text-signal" size={17} />
              <span className="font-display text-[14px] font-semibold text-white">
                Raio-X do Concorrente: <span className="text-signal">{analysis.competitorName}</span>
              </span>
            </div>
            <span className="chip !border-armed/40 !text-armed">Análise Concluída</span>
          </div>

          {/* Comparativo de Valores */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-line/60 bg-abyss/80 p-3">
              <div className="label-mono">Valor do Concorrente</div>
              <div className="mt-1 font-display text-[18px] font-semibold text-silver">
                {analysis.detectedTotal > 0 ? brl(analysis.detectedTotal) : "Não identificado"}
              </div>
              <div className="mt-0.5 text-[10px] text-steel">
                {analysis.detectedMonthly ? `+ ${brl(analysis.detectedMonthly)}/mês` : "Equipamentos + mão de obra"}
              </div>
            </div>

            <div className="rounded-lg border border-signal/40 bg-signal/[0.05] p-3">
              <div className="label-mono !text-signal">Valor Alvo Cipriano</div>
              <div className="mt-1 font-display text-[18px] font-bold text-signal">
                {analysis.ciprianoRecommendedTotal > 0
                  ? brl(analysis.ciprianoRecommendedTotal)
                  : "Calibrado no Catálogo"}
              </div>
              <div className="mt-0.5 text-[10px] text-signal/80">Com 24 meses de garantia e ART</div>
            </div>

            <div className="rounded-lg border border-armed/40 bg-armed/[0.05] p-3">
              <div className="label-mono !text-armed">Vantagem ao Cliente</div>
              <div className="mt-1 flex items-center gap-1.5 font-display text-[18px] font-bold text-armed">
                <TrendingDown size={18} />
                {analysis.savingsVsCompetitor.pct > 0
                  ? `${analysis.savingsVsCompetitor.pct}% menor`
                  : "Melhor Custo-Benefício"}
              </div>
              <div className="mt-0.5 text-[10px] text-steel">
                {analysis.savingsVsCompetitor.diff > 0
                  ? `Economia de ${brl(analysis.savingsVsCompetitor.diff)}`
                  : "Qualidade de engenharia superior"}
              </div>
            </div>
          </div>

          {/* Resumo da Proposta Concorrente */}
          <div>
            <div className="label-mono text-steel">O que o concorrente orçou</div>
            <p className="mt-1 text-[12px] leading-relaxed text-silver">{analysis.detectedSummary}</p>
          </div>

          {/* Itens Detectados */}
          {analysis.detectedItems && analysis.detectedItems.length > 0 ? (
            <div className="rounded-lg border border-line/50 bg-abyss/60 p-3">
              <div className="label-mono mb-2 text-steel">Itens identificados no orçamento concorrente</div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {analysis.detectedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-2 border-b border-line/30 pb-1 text-[11px]"
                  >
                    <span className="text-silver">
                      {item.qty ? `${item.qty}× ` : ""}
                      {item.desc}
                    </span>
                    {item.price ? <span className="font-mono text-steel">{brl(item.price)}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Armadilhas e Fraquezas do Concorrente */}
          {analysis.weaknesses && analysis.weaknesses.length > 0 ? (
            <div className="rounded-lg border border-amber/35 bg-amber/[0.04] p-3">
              <div className="flex items-center gap-1.5 font-display text-[12.5px] font-semibold text-amber">
                <AlertTriangle size={15} />
                Pontos Fracos e Omissões Detectadas no Concorrente
              </div>
              <ul className="mt-2 space-y-1.5 text-[11.5px] text-silver">
                {analysis.weaknesses.map((weak, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber">▸</span>
                    <span>{weak}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Estratégia Comercial da Cipriano */}
          <div className="rounded-lg border border-signal/30 bg-navy/40 p-3">
            <div className="flex items-center gap-1.5 font-display text-[12.5px] font-semibold text-signal">
              <ShieldCheck size={15} />
              Estratégia da Cipriano para Fechar a Venda
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-silver">{analysis.ciprianoStrategy}</p>
          </div>

          {/* Argumentos de Venda / Talking Points */}
          {analysis.talkingPoints && analysis.talkingPoints.length > 0 ? (
            <div>
              <div className="label-mono mb-2 text-steel">Argumentos prontos para o cliente (clique para copiar)</div>
              <div className="space-y-1.5">
                {analysis.talkingPoints.map((point, idx) => (
                  <div
                    key={idx}
                    onClick={() => copyTalkingPoint(point, idx)}
                    className="flex cursor-pointer items-start justify-between gap-2 rounded-lg border border-line/50 bg-abyss/60 p-2.5 text-[11px] text-silver transition hover:border-signal/40 hover:bg-navy/30"
                  >
                    <span className="leading-relaxed">“{point}”</span>
                    <button
                      type="button"
                      className="shrink-0 p-1 text-steel hover:text-signal"
                      title="Copiar argumento"
                    >
                      {copiedIndex === idx ? (
                        <Check size={14} className="text-armed" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Botão de Aplicação */}
          {onApplyAnalysis ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onApplyAnalysis(analysis)}
                className="btn btn-primary w-full py-2.5 font-semibold"
              >
                <CheckCircle2 size={16} />
                Aplicar Dados do Concorrente e Calibrar Minha Proposta
              </button>
              <p className="mt-1.5 text-center text-[10.5px] text-steel">
                Isto preenche automaticamente as quantidades de câmeras, portas e escopo ideal para vencer a concorrência.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
