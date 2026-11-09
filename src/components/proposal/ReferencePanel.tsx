"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { brl } from "@/lib/brand";
import { priceSummary, type ReferenceAnalysis } from "@/lib/references";

type ReferenceFile = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  createdAt: string;
  analysis: ReferenceAnalysis | null;
  url: string;
};

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function ReferencePanel({ maxFiles = 6 }: { maxFiles?: number }) {
  const [files, setFiles] = useState<ReferenceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/references", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { files: ReferenceFile[] };
      setFiles(data.files);
    } catch {
      setError("Não foi possível carregar os arquivos já enviados.");
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
    let uploaded = 0;
    let failed = "";

    // Um arquivo por requisição: o corpo limitado da Vercel não comporta 6 de uma vez.
    for (const file of queue) {
      if (files.length + uploaded >= maxFiles) {
        failed = `Limite de ${maxFiles} arquivos atingido. Envie apenas os restantes depois de excluir algum.`;
        break;
      }
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/references", {
          method: "POST",
          body: form,
          signal: controller.current?.signal,
        });
        const data = (await res.json()) as { error?: string; file?: ReferenceFile };
        if (!res.ok || !data.file) {
          failed = data.error ?? `Falha ao enviar ${file.name}.`;
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
    if (uploaded > 0) setFlash(`${uploaded} arquivo(s) enviado(s) e analisado(s).`);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function remove(id: string) {
    const target = files.find((file) => file.id === id);
    if (!target) return;
    if (!window.confirm(`Excluir "${target.fileName}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/references/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setFiles((prev) => prev.filter((file) => file.id !== id));
      setExpanded(null);
      setFlash("Arquivo excluído.");
    } catch {
      setError("Não foi possível excluir o arquivo.");
    } finally {
      setBusy(false);
    }
  }

  async function saveNote(id: string, note: string) {
    const res = await fetch(`/api/references/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    if (res.ok) setFiles((prev) => prev.map((file) => (file.id === id ? { ...file, note: note || null } : file)));
  }

  const allPrices = files.flatMap((file) => file.analysis?.prices ?? []);
  const summary = priceSummary(allPrices);
  const remaining = Math.max(0, maxFiles - files.length);

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label-mono text-signal">Concorrência · referência de preço</div>
          <h2 className="mt-1 font-display text-lg font-semibold text-white">
            Propostas de concorrentes
          </h2>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-steel">
            Envie até {maxFiles} arquivos do concorrente. O sistema extrai os valores do PDF e lista as quantias
            encontradas, para você posicionar o seu preço com informação. Use para comparação interna e siga as
            políticas de concorrência aplicáveis.
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
          PDF, PNG, JPG ou WEBP · até 4 MB por arquivo · PDF com texto é analisado automaticamente
        </p>
        <button
          type="button"
          className="btn btn-primary mt-3"
          disabled={busy || remaining === 0}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}
          {busy ? "Enviando…" : `Selecionar arquivos${remaining === 0 ? " (limite atingido)" : ` (${remaining} restante${remaining > 1 ? "s" : ""})`}`}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="hidden"
          disabled={busy || remaining === 0}
          onChange={(event) => {
            if (event.target.files) void upload(event.target.files);
          }}
        />
      </div>

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

      {summary ? (
        <div className="mt-4 rounded-xl border border-signal/25 bg-signal/[0.05] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="label-mono text-signal">Faixa de valores encontrados</div>
            <span className="text-[10.5px] text-steel">{summary.count} valor(es) distintos</span>
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
          <p className="mt-2 text-[10px] leading-relaxed text-steel">
            Valores extraídos automaticamente do texto dos arquivos enviados. Confira o contexto de cada um antes de
            usá-los como referência.
          </p>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-line/50 bg-abyss2/40 p-3 text-[11.5px] text-steel">
            <LoaderCircle size={14} className="animate-spin" /> Carregando arquivos…
          </div>
        ) : null}

        {!loading && files.length === 0 ? (
          <div className="rounded-lg border border-line/50 bg-abyss2/30 p-4 text-center">
            <Search size={18} className="mx-auto text-steel/70" />
            <p className="mt-2 text-[11.5px] text-silver">Nenhuma proposta de concorrente enviada ainda.</p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-steel">
              Os valores detectados aparecem acima, prontos para orientar a sua precificação.
            </p>
          </div>
        ) : null}

        {files.map((file) => {
          const prices = file.analysis?.prices ?? [];
          const isOpen = expanded === file.id;
          return (
            <article key={file.id} className="rounded-xl border border-line/60 bg-abyss2/45 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line/60 bg-navy text-signal">
                    {file.mimeType === "application/pdf" ? <FileText size={15} /> : <ImageIcon size={15} />}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-[12.5px] font-medium text-white" title={file.fileName}>
                      {file.fileName}
                    </h3>
                    <p className="mt-0.5 text-[10px] text-steel">
                      {formatSize(file.sizeBytes)}
                      {file.analysis?.pages ? ` · ${file.analysis.pages} página(s)` : ""}
                      {" · "}
                      {prices.length} valor(es)
                      {!file.analysis?.hasText ? " · sem camada de texto (leia visualmente)" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn px-2.5 py-1 text-[10.5px]"
                  >
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
                    <span
                      key={price.raw}
                      className="chip !border-signal/35 !text-signal"
                      title={price.context}
                    >
                      {price.raw}
                    </span>
                  ))}
                  {prices.length > 6 ? (
                    <span className="chip">+{prices.length - 6} valores</span>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-[10.5px] text-steel">
                  Nenhum valor em R$ identificado no texto deste arquivo.
                </p>
              )}

              <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line/40 pt-2.5">
                <input
                  className="field flex-1 !py-1 text-[11px]"
                  defaultValue={file.note ?? ""}
                  placeholder="Sua anotação: prazo, escopo, condições do concorrente…"
                  onBlur={(event) => {
                    const value = event.target.value.trim();
                    if (value !== (file.note ?? "")) void saveNote(file.id, value);
                  }}
                />
                {file.analysis?.hasText ? (
                  <button
                    type="button"
                    className="btn px-2.5 py-1 text-[10.5px]"
                    onClick={() => setExpanded(isOpen ? null : file.id)}
                  >
                    <ChevronDown size={12} className={isOpen ? "rotate-180 transition" : "transition"} />
                    {isOpen ? "Ocultar texto" : "Ver texto lido"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn px-2.5 py-1 text-[10.5px]"
                  onClick={() => {
                    setExpanded(null);
                    void load();
                  }}
                  title="Reler os arquivos"
                >
                  <RefreshCw size={12} />
                </button>
              </div>

              {isOpen && file.analysis?.hasText ? (
                <pre className="scroll-thin mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg border border-line/50 bg-abyss/60 p-3 font-mono text-[10.5px] leading-relaxed text-silver">
                  {files.find((f) => f.id === file.id)?.analysis
                    ? "O texto integral está disponível no servidor; os trechos com valores aparecem ao lado."
                    : ""}
                  {"\n\n"}
                  {file.analysis.prices.map((price) => `• ${price.raw} — ${price.context}`).join("\n") ||
                    "Sem valores extraídos."}
                </pre>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
