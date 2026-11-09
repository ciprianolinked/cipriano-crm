"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, Database, RefreshCw, ShieldCheck } from "lucide-react";
import type { DatabaseDiagnostics } from "@/lib/database-diagnostics";

export function DatabaseStatusPanel({ initial }: { initial?: DatabaseDiagnostics }) {
  const [report, setReport] = useState<DatabaseDiagnostics | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState("");

  async function check() {
    setBusy(true);
    setRequestError("");
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const data = await response.json() as DatabaseDiagnostics;
      if (typeof data.ok !== "boolean" || !data.code) throw new Error("Resposta inválida");
      setReport(data);
    } catch {
      setRequestError("Não foi possível consultar o diagnóstico. Abra os Runtime Logs do deployment na Vercel e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card overflow-hidden" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/50 px-5 py-4">
        <div className="flex items-center gap-2"><Database size={17} className="text-signal" /><h2 className="font-display text-[15px] font-semibold text-white">Conexão com o banco</h2></div>
        <button type="button" className="btn py-2" onClick={check} disabled={busy}><RefreshCw size={14} className={busy ? "animate-spin" : ""} />{busy ? "Verificando…" : "Verificar conexão"}</button>
      </div>
      <div className="space-y-4 p-5">
        {requestError ? <p role="alert" className="rounded-lg border border-alarm/35 bg-alarm/5 p-3 text-[12px] leading-relaxed text-alarm">{requestError}</p> : null}
        {!report && !requestError ? <p className="text-[12px] text-steel">Clique em “Verificar conexão” para testar este deployment. Nenhuma senha será exibida.</p> : null}
        {report ? <>
          <div className={`flex gap-3 rounded-xl border p-4 ${report.ok ? "border-armed/35 bg-armed/5" : "border-amber/35 bg-amber/5"}`}>
            {report.ok ? <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-armed" /> : <CircleAlert size={19} className="mt-0.5 shrink-0 text-amber" />}
            <div><p className="text-[13px] font-medium text-white">{report.message}</p><p className="mt-1.5 text-[12px] leading-relaxed text-silver">{report.action}</p><span className="mt-2 inline-block font-mono text-[10px] text-steel">Código: {report.code}</span></div>
          </div>
          <dl className="grid gap-2 text-[12px] sm:grid-cols-2">
            <Status label="DATABASE_URL" value={report.environment.configured ? report.environment.valid ? "Configurada e válida" : "Formato inválido" : "Não configurada"} good={report.environment.valid} />
            <Status label="Conexão PostgreSQL" value={report.connection === "connected" ? "Conectada" : report.connection === "failed" ? "Falhou" : "Ainda não testada"} good={report.connection === "connected"} />
            <Status label="Estrutura do banco" value={!report.schema.checked ? "Aguardando conexão" : report.schema.missingTables.length ? `${report.schema.missingTables.length} tabela(s) ausente(s)` : report.schema.missingColumnCount ? `${report.schema.missingColumnCount} campo(s) ausente(s)` : `${report.schema.expectedTables} tabelas verificadas`} good={report.schema.checked && !report.schema.missingTables.length && !report.schema.missingColumnCount} />
            <Status label="Ambiente" value={`${report.runtime === "vercel" ? "Vercel" : "Local"}${report.environment.neon ? " · Neon" : ""}${report.environment.pooled ? " · pooled" : ""}`} good />
          </dl>
          {report.ok ? <button className="btn btn-primary" onClick={() => window.location.reload()}><RefreshCw size={14} />Atualizar o aplicativo</button> : null}
          <p className="flex items-start gap-2 text-[10.5px] leading-relaxed text-steel"><ShieldCheck size={13} className="mt-0.5 shrink-0" />Diagnóstico sem URL, usuário, senha ou dados de clientes. Detalhes internos ficam nos Runtime Logs da Vercel.</p>
        </> : null}
      </div>
    </section>
  );
}

function Status({ label, value, good }: { label: string; value: string; good: boolean }) {
  return <div className="rounded-lg border border-line/45 bg-abyss2/45 p-3"><dt className="font-mono text-[9px] uppercase tracking-wider text-steel">{label}</dt><dd className={`mt-1.5 flex items-center gap-2 ${good ? "text-silver" : "text-amber"}`}><span className={`h-1.5 w-1.5 rounded-full ${good ? "bg-armed" : "bg-amber"}`} />{value}</dd></div>;
}
