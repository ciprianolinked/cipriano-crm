"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileArchive, FolderOpen, GitBranch, LoaderCircle, RefreshCw, ShieldCheck, Terminal } from "lucide-react";
import type { SourceExportInfo } from "@/lib/source-export";
import { CodeBlock } from "@/components/ui/CopyButton";

const commands = `git init
git add .
git status --short
git commit -m "Publicar painel Cipriano"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main`;

export function GitHubPublishDownload() {
  const [info, setInfo] = useState<SourceExportInfo | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showFiles, setShowFiles] = useState(false);
  const [mode, setMode] = useState<"desktop" | "terminal">("desktop");

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/publicacao", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setInfo(await response.json() as SourceExportInfo);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  return (
    <section id="github-upload" className="card scroll-mt-5 overflow-hidden border-signal/30">
      <div className="border-b border-line/50 bg-gradient-to-r from-signal/[0.07] to-transparent p-5 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="label-mono flex items-center gap-2 text-signal"><GitBranch size={15}/> GitHub · publicação sem limite</div>
            <h2 className="mt-2 font-display text-xl font-semibold text-white">Pelo navegador? Envie em lotes com menos de 100.</h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-steel">
              O limite de 100 arquivos é por envio no <b className="text-silver">site do GitHub</b>. O projeto completo tem {info?.fileCount ?? "mais de 100"} arquivos. Baixe cada lote, extraia e faça um commit por lote no mesmo repositório. O ZIP completo é para GitHub Desktop ou terminal.
            </p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-signal/30 bg-signal/10 text-signal"><FileArchive size={25}/></span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-steel">
          {loading ? <span className="inline-flex items-center gap-1.5"><LoaderCircle size={12} className="animate-spin"/>Preparando lotes…</span> : null}
          {info ? <><span className="text-silver">{info.fileCount} arquivos no pacote completo</span><span>{info.browserBatches.length} lotes compatíveis com o navegador</span><span className="inline-flex items-center gap-1 text-armed"><ShieldCheck size={12}/>Sem credenciais ou dados do banco</span></> : null}
          {error ? <button type="button" onClick={load} className="inline-flex items-center gap-1 text-amber hover:underline"><RefreshCw size={12}/>Não foi possível conferir. Tentar novamente</button> : null}
        </div>
      </div>

      <div className="space-y-5 p-5 lg:p-6">
        <section className="rounded-xl border border-signal/25 bg-signal/[0.04] p-4">
          <div className="flex items-start gap-3"><div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-signal/25 bg-signal/10 font-mono text-[12px] text-signal">01</div><div className="min-w-0 flex-1"><h3 className="font-display text-[14px] font-semibold text-white">Upload pelo site do GitHub · lote por lote</h3><p className="mt-1 text-[11.5px] leading-relaxed text-steel">Baixe <b className="text-silver">todos</b> os lotes abaixo. Extraia cada ZIP; mantenha as pastas <code>src</code>, <code>public</code> e <code>drizzle</code> com seus caminhos. Faça upload do lote 1 e commit; repita para o lote seguinte no <b className="text-silver">mesmo repositório e branch</b>. Conecte à Vercel apenas quando os commits de todos os lotes estiverem no GitHub.</p></div></div>
          {info ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{info.browserBatches.map((batch) => <a key={batch.part} href={`/api/publicacao?formato=zip&lote=${batch.part}`} download className="flex items-center justify-between gap-3 rounded-lg border border-line/60 bg-abyss2/70 p-3 transition hover:border-signal/50 hover:bg-signal/[0.04]"><span className="flex min-w-0 items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-signal/25 bg-signal/10 font-mono text-[10px] text-signal">{String(batch.part).padStart(2, "0")}</span><span className="min-w-0"><span className="block text-[12px] font-semibold text-white">Baixar lote {batch.part} de {batch.total}</span><span className="block text-[10px] text-steel">{batch.fileCount} arquivos, incluindo manifesto</span></span></span><Download size={15} className="shrink-0 text-signal"/></a>)}</div> : null}
          <ol className="mt-3 grid gap-2 text-[11px] leading-relaxed text-silver sm:grid-cols-2"><li><b className="text-signal">1.</b> Crie um repositório vazio e privado; não conecte a Vercel ainda.</li><li><b className="text-signal">2.</b> Extraia os ZIPs para pastas separadas. Não envie o ZIP como código.</li><li><b className="text-signal">3.</b> GitHub → Add file → Upload files: arraste os arquivos/pasta do lote 1 e faça commit.</li><li><b className="text-signal">4.</b> Repita com o lote 2 no mesmo repositório; preserve os caminhos e faça outro commit.</li><li><b className="text-signal">5.</b> Confirme `package.json`, `src/` e `public/` na raiz do repositório.</li><li><b className="text-signal">6.</b> Só agora importe/conecte o repositório à Vercel e publique.</li></ol>
          <div className="mt-3 flex gap-2 rounded-lg border border-amber/25 bg-amber/5 p-2.5 text-[10.5px] leading-relaxed text-steel"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber"/><span>Se a Vercel já estiver conectada, o primeiro commit parcial poderá falhar no build. É esperado: o commit do lote seguinte envia os arquivos restantes e dispara um novo build completo.</span></div>
          <a href="https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[10.5px] text-signal hover:underline">Documentação oficial do GitHub: máximo de 100 arquivos por envio ↗</a>
        </section>

        <section className="rounded-xl border border-line/50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="label-mono">Alternativa recomendada</div><h3 className="mt-1 font-display text-[14px] font-semibold text-white">Um único pacote com GitHub Desktop ou Git</h3><p className="mt-1 text-[11px] text-steel">Esses métodos enviam o commit completo e não usam o limite do formulário web.</p></div><a href="/api/publicacao?formato=zip" download className="btn btn-primary shrink-0"><Download size={15}/>Baixar ZIP completo</a></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" className={`btn py-1.5 ${mode === "desktop" ? "!border-signal/50 !text-signal !bg-signal/10" : ""}`} onClick={() => setMode("desktop")}><GitBranch size={14}/>GitHub Desktop</button><button type="button" className={`btn py-1.5 ${mode === "terminal" ? "!border-signal/50 !text-signal !bg-signal/10" : ""}`} onClick={() => setMode("terminal")}><Terminal size={14}/>Terminal Git</button><button type="button" className="btn py-1.5" onClick={() => setShowFiles(!showFiles)} disabled={!info}><FolderOpen size={14}/>{showFiles ? "Ocultar lista" : "Conferir conteúdo"}</button></div>{mode === "desktop" ? <ol className="mt-3 grid gap-2 text-[11px] leading-relaxed text-silver sm:grid-cols-2">{["Crie um repositório vazio no GitHub, de preferência privado.","Extraia o ZIP completo em uma pasta nova; não use a pasta antiga com node_modules.","GitHub Desktop → File → Add local repository → selecione a pasta extraída.","Faça commit e Publish repository. Conecte à Vercel depois que o repositório estiver completo."].map((text, index) => <li key={text} className="flex gap-2 rounded-lg border border-line/35 bg-abyss2/30 p-2.5"><span className="font-mono text-[9px] text-signal">0{index+1}</span><span>{text}</span></li>)}</ol> : <div className="mt-3"><CodeBlock title="Publicar pasta extraída com Git" code={commands}/></div>}</section>

        {showFiles && info ? <div className="rounded-lg border border-line/60 bg-abyss2/50 p-3"><div className="mb-2 flex items-center justify-between"><span className="label-mono">Manifesto completo</span><span className="text-[10px] text-steel">{info.fileCount} arquivos</span></div><div className="scroll-thin max-h-64 overflow-auto rounded border border-line/40 bg-abyss/60 p-2 font-mono text-[10px] leading-relaxed text-silver">{info.files.map((file) => <div key={file.path} className="flex justify-between gap-3"><span>{file.path}</span><span className="shrink-0 text-steel">{file.bytes.toLocaleString("pt-BR")} B</span></div>)}</div><p className="mt-2 text-[10.5px] leading-relaxed text-steel">Excluídos: {info.excluded.join("; ")}. O manifesto tem hashes SHA-256.</p></div> : null}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/40 pt-3"><span className="inline-flex items-center gap-1.5 text-[10.5px] text-steel"><CheckCircle2 size={13} className="text-armed"/>A Vercel instala as dependências com package-lock.json.</span><a href="https://desktop.github.com/" target="_blank" rel="noopener noreferrer" className="text-[11px] text-signal hover:underline">Baixar GitHub Desktop ↗</a></div>
      </div>
    </section>
  );
}
