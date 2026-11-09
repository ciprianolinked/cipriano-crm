"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { QuotationRecord } from "@/lib/types";
import type { PdfExportRecord } from "@/lib/server/downloads";
import { computeMetrics, formatCurrency, formatDateBR, formatDateTimeBR, recordedSavings, supplierCostBreakdown } from "@/lib/quotation";
import { formatSize, saveBase64File, type PdfDownload } from "@/lib/download";
import { ArrowLeftIcon, BuildingIcon, CheckIcon, DownloadIcon, FileIcon, PrinterIcon, TrendIcon } from "./icons";

type Props = {
  records: QuotationRecord[];
  condominiums: string[];
  initialCondominium?: string;
  initialDownloads?: PdfExportRecord[];
  dbError?: boolean;
};

function monthLabel(month: string): string {
  const [year, number] = month.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(number) - 1] ?? number}/${year.slice(2)}`;
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  // Evita fórmulas executáveis ao abrir nomes de fornecedores no Excel.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function IndicatorsDashboard({ records, condominiums, initialCondominium = "", initialDownloads = [], dbError }: Props) {
  const [condominium, setCondominium] = useState(initialCondominium);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [downloads, setDownloads] = useState<PdfExportRecord[]>(initialDownloads);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfMessage, setPdfMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const availableCondos = [...new Set([...condominiums, ...records.map((record) => record.condominium).filter(Boolean)])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const filtered = useMemo(() => records.filter((record) =>
    (!condominium || record.condominium === condominium) && (!start || record.analysisDate >= start) && (!end || record.analysisDate <= end),
  ), [records, condominium, start, end]);
  const calculated = useMemo(() => filtered.map((record) => ({ record, metrics: computeMetrics(record), recorded: recordedSavings(record) })), [filtered]);
  const actual = calculated.filter((entry) => entry.recorded !== null);
  const confirmedTotal = actual.reduce((sum, entry) => sum + (entry.recorded ?? 0), 0);
  const potentialRows = calculated.filter((entry) => entry.metrics.isComparable);
  const potentialTotal = potentialRows.reduce((sum, entry) => sum + entry.metrics.savings, 0);
  const costTotals: Record<"mao_obra" | "material" | "nao_discriminado", { amount: number; count: number }> = {
    mao_obra: { amount: 0, count: 0 }, material: { amount: 0, count: 0 }, nao_discriminado: { amount: 0, count: 0 },
  };
  for (const entry of potentialRows) {
    if (!entry.metrics.best) continue;
    const breakdown = supplierCostBreakdown(entry.record.items, entry.metrics.best.supplier.id);
    for (const type of ["mao_obra", "material", "nao_discriminado"] as const) {
      if (breakdown[type].total !== null) { costTotals[type].amount += breakdown[type].total; costTotals[type].count += 1; }
    }
  }
  const completed = filtered.filter((record) => record.status === "concluido").length;
  const totalSuppliers = calculated.reduce((sum, entry) => sum + entry.metrics.rankings.filter((row) => row.total !== null).length, 0);
  const grouped = new Map<string, { count: number; potential: number; recorded: number; recordedCount: number }>();
  for (const entry of calculated) {
    const key = entry.record.analysisDate.slice(0, 7);
    const value = grouped.get(key) ?? { count: 0, potential: 0, recorded: 0, recordedCount: 0 };
    value.count += 1;
    if (entry.metrics.isComparable) value.potential += entry.metrics.savings;
    if (entry.recorded !== null) { value.recorded += entry.recorded; value.recordedCount += 1; }
    grouped.set(key, value);
  }
  const months = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8);
  const chartMax = Math.max(1, ...months.flatMap(([, value]) => [value.potential, Math.abs(value.recorded)]));
  const byCondo = new Map<string, { count: number; potential: number; recorded: number; recordedCount: number }>();
  for (const entry of calculated) {
    const name = entry.record.condominium || "Não informado";
    const value = byCondo.get(name) ?? { count: 0, potential: 0, recorded: 0, recordedCount: 0 };
    value.count += 1;
    if (entry.metrics.isComparable) value.potential += entry.metrics.savings;
    if (entry.recorded !== null) { value.recorded += entry.recorded; value.recordedCount += 1; }
    byCondo.set(name, value);
  }
  const condoRows = [...byCondo.entries()].sort((a, b) => b[1].potential - a[1].potential || a[0].localeCompare(b[0], "pt-BR"));
  const periodLabel = `${start ? formatDateBR(start) : "Início"} a ${end ? formatDateBR(end) : "hoje"}`;

  async function refreshDownloads() {
    try {
      const response = await fetch("/api/downloads");
      const data = await response.json() as { exports?: PdfExportRecord[] };
      if (Array.isArray(data.exports)) setDownloads(data.exports);
    } catch {
      /* mantém a lista atual */
    }
  }

  async function downloadPdf() {
    setPdfBusy(true);
    setPdfMessage(null);
    try {
      const response = await fetch("/api/indicadores/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condominium, start, end }),
      });
      const data = await response.json() as PdfDownload & { error?: string };
      if (!response.ok || !data.fileBase64) throw new Error(data.error || "Não foi possível gerar o PDF.");
      saveBase64File(data.fileName, data.fileBase64);
      setPdfMessage({ type: "success", text: `Download concluído: ${data.fileName}${data.recorded ? " · registrado no histórico" : ""}` });
      await refreshDownloads();
    } catch (error) {
      setPdfMessage({ type: "error", text: error instanceof Error ? error.message : "Não foi possível gerar o PDF." });
    } finally {
      setPdfBusy(false);
    }
  }

  function downloadCsv() {
    const rows: unknown[][] = [["Protocolo", "Condomínio", "Data", "Objeto", "Status", "Economia potencial (R$)", "Economia confirmada (R$)"]];
    calculated.forEach(({ record, metrics, recorded }) => rows.push([record.protocol, record.condominium, formatDateBR(record.analysisDate), record.service, record.status, metrics.isComparable ? metrics.savings.toFixed(2).replace(".", ",") : "", recorded !== null ? recorded.toFixed(2).replace(".", ",") : ""]));
    const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "indicadores-gerencial.csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className="dashboard-print mx-auto max-w-[1280px] px-4 pb-16 pt-6 sm:px-6">
      <Link href="/" className="no-print inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-ink"><ArrowLeftIcon className="h-3.5 w-3.5" /> Voltar ao painel</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-dark">Governança em números</p><h1 className="font-display mt-1 text-[30px] leading-tight text-ink sm:text-[34px]">Indicadores para assembleia</h1><p className="mt-1 text-[13px] text-slate-500">Uma visão clara das cotações e dos resultados registrados.</p></div>
        <div className="no-print flex flex-wrap gap-2">
          <button type="button" onClick={downloadCsv} className="btn btn-ghost"><FileIcon /> Baixar CSV</button>
          <button type="button" onClick={downloadPdf} disabled={pdfBusy} className="btn btn-primary"><DownloadIcon /> {pdfBusy ? "Gerando PDF…" : "Baixar PDF"}</button>
          <button type="button" onClick={() => window.print()} className="btn btn-ghost"><PrinterIcon /> Imprimir</button>
        </div>
      </div>
      {dbError && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-800">Não foi possível carregar os dados. Confira a conexão e atualize a página.</p>}
      {pdfMessage && <div role="status" className={`no-print mt-4 rounded-xl px-4 py-3 text-[12px] font-semibold ${pdfMessage.type === "success" ? "border border-green-200 bg-green-50 text-green-800" : "border border-red-200 bg-red-50 text-red-700"}`}>{pdfMessage.text}</div>}
      <section className="no-print card mt-5 flex flex-wrap items-end gap-3 px-4 py-3.5 sm:px-5">
        <label className="min-w-[200px] flex-1"><span className="label">Condomínio</span><select className="field mt-1" value={condominium} onChange={(event) => setCondominium(event.target.value)}><option value="">Todos os condomínios</option>{availableCondos.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <label><span className="label">Data inicial</span><input type="date" className="field mt-1" value={start} onChange={(event) => setStart(event.target.value)} /></label>
        <label><span className="label">Data final</span><input type="date" className="field mt-1" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
        <button type="button" className="btn btn-ghost" onClick={() => { setCondominium(""); setStart(""); setEnd(""); }}>Limpar filtros</button>
      </section>
      {start && end && start > end && <p className="mt-2 text-[11px] font-bold text-red-600">A data inicial deve ser anterior à data final.</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500"><p>Exibindo <strong className="text-ink">{filtered.length} mapa(s)</strong> · {condominium || "Todos os condomínios"} · {periodLabel}</p><span className="rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-brand-dark">Dados dos mapas salvos</span></div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<TrendIcon />} label="Economia confirmada" value={actual.length ? formatCurrency(confirmedTotal) : "—"} detail={`${actual.length} contratação(ões) com valores confirmados`} primary />
        <Stat icon={<TrendIcon />} label="Economia potencial" value={potentialRows.length ? formatCurrency(potentialTotal) : "—"} detail={`${potentialRows.length} comparativo(s) completos`} />
        <Stat icon={<FileIcon />} label="Mapas de cotação" value={String(filtered.length)} detail={`${completed} concluído(s) no período`} />
        <Stat icon={<BuildingIcon />} label="Propostas com valor" value={String(totalSuppliers)} detail="Fornecedores com preço informado" />
      </div>

      <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-[1.45fr_1fr]">
        <section className="card break-inside-avoid px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-dark">Evolução dos resultados</p><h2 className="mt-1 text-[16px] font-extrabold text-ink">Economia por mês</h2><p className="mt-1 text-[11px] text-slate-500">Últimos meses com movimentação no período selecionado</p></div><span className="flex items-center gap-2 text-[10px] font-semibold text-slate-500"><span className="h-2 w-2 rounded-full bg-brand" /> Potencial <span className="ml-1 h-2 w-2 rounded-full bg-success" /> Confirmada</span></div>
          {months.length === 0 ? <div className="mt-5 grid min-h-[200px] place-items-center rounded-xl border border-dashed border-line bg-paper/50 px-4 text-center"><p className="text-[12px] text-slate-500">Sem dados para o período. Os indicadores aparecerão conforme os mapas forem salvos.</p></div> : (
            <div className="mt-6 space-y-3">{months.map(([month, value]) => <div key={month} className="grid grid-cols-[54px_1fr_76px] items-center gap-2"><span className="text-[11px] font-bold text-slate-500">{monthLabel(month)}</span><div className="space-y-1"><div className="h-2 rounded-full bg-paper"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(value.potential > 0 ? 2 : 0, value.potential / chartMax * 100)}%` }} /></div><div className="h-2 rounded-full bg-paper"><div className="h-full rounded-full bg-success" style={{ width: `${Math.max(value.recorded !== 0 ? 2 : 0, Math.abs(value.recorded) / chartMax * 100)}%` }} /></div></div><span className="text-right text-[10px] font-bold text-ink">{formatCurrency(value.potential)}</span></div>)}</div>
          )}
          <p className="mt-4 text-[10px] leading-relaxed text-slate-400">Barras verdes indicam a magnitude da economia confirmada; confira a tabela para valores negativos. Potencial é a diferença entre propostas completas, não lucro efetivo.</p>
        </section>
        <section className="card break-inside-avoid px-5 py-5"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-dark">Por condomínio</p><h2 className="mt-1 text-[16px] font-extrabold text-ink">Resultados por local</h2><p className="mt-1 text-[11px] text-slate-500">Economia potencial dos mapas comparáveis</p>
          {condoRows.length === 0 ? <div className="mt-5 grid min-h-[200px] place-items-center rounded-xl border border-dashed border-line bg-paper/50 px-4 text-center"><p className="text-[12px] text-slate-500">Os condomínios e suas cotações aparecerão aqui.</p></div> : <div className="mt-4 divide-y divide-line">{condoRows.slice(0, 6).map(([name, value]) => <div key={name} className="flex items-center gap-2 py-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-paper text-ink"><BuildingIcon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[11.5px] font-bold text-ink">{name}</span><span className="text-[10px] text-slate-500">{value.count} mapa(s)</span></span><span className="text-right text-[11px] font-extrabold text-ink">{formatCurrency(value.potential)}</span></div>)}</div>}
        </section>
      </div>

      <section className="card mt-4 break-inside-avoid px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-dark">Composição das propostas</p>
        <h2 className="mt-1 text-[15px] font-extrabold text-ink">Mão de obra e materiais</h2>
        <p className="mt-1 text-[11px] text-slate-500">Soma das menores propostas completas dos comparativos no período. Valores globais permanecem não discriminados.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">{([
          ["mao_obra", "Mão de obra"], ["material", "Material"], ["nao_discriminado", "Não discriminado"],
        ] as const).map(([type, label]) => <div key={type} className="rounded-xl bg-paper px-3 py-2.5"><p className="text-[10px] font-bold text-slate-500">{label}</p><p className="mt-1 text-[14px] font-extrabold text-ink">{costTotals[type].count ? formatCurrency(costTotals[type].amount) : "—"}</p></div>)}</div>
      </section>

      <section className="card mt-4 break-inside-avoid overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-dark">Downloads</p><h2 className="mt-1 text-[15px] font-extrabold text-ink">Histórico de arquivos PDF</h2><p className="mt-1 text-[11px] text-slate-500">Nome do arquivo registrado a cada download gerado.</p></div>
          <button type="button" onClick={refreshDownloads} className="btn btn-ghost !py-1.5">Atualizar lista</button>
        </div>
        {downloads.length === 0 ? <p className="px-5 py-6 text-center text-[12px] text-slate-500">Nenhum download ainda. Os arquivos gerados aparecem aqui com data e tamanho.</p> : (
          <ul className="divide-y divide-line">
            {downloads.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-dark"><DownloadIcon className="h-4 w-4" /></span>
                <span className="min-w-[220px] flex-1"><span className="block truncate text-[11.5px] font-bold text-ink" title={item.fileName}>{item.fileName}</span><span className="block text-[10px] text-slate-500">{item.kind === "mapa" ? "Mapa de cotação" : "Indicadores"}{item.condominium ? ` · ${item.condominium}` : ""} · {formatDateTimeBR(item.createdAt)}</span></span>
                <span className="text-[10.5px] font-semibold text-slate-500">{formatSize(item.sizeBytes)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-4 overflow-hidden break-inside-avoid"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-dark">Detalhamento</p><h2 className="mt-1 text-[15px] font-extrabold text-ink">Mapas do período</h2></div><span className="text-[10.5px] text-slate-500">Clique no mapa para editar os valores</span></div>
        {calculated.length === 0 ? <p className="px-5 py-8 text-center text-[12px] text-slate-500">Nenhum mapa encontrado para os filtros selecionados.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-[11.5px]"><thead className="bg-paper text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-4 py-2.5">Condomínio / objeto</th><th className="px-4 py-2.5">Data</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Potencial</th><th className="px-4 py-2.5 text-right">Confirmada</th></tr></thead><tbody>{calculated.map(({ record, metrics, recorded }) => <tr key={record.id} className="border-t border-line"><td className="px-4 py-3"><Link href={`/mapas/${record.id}`} className="font-bold text-ink hover:underline">{record.condominium}</Link><span className="mt-0.5 block text-[10.5px] text-slate-500">{record.service || record.protocol}</span></td><td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateBR(record.analysisDate)}</td><td className="px-4 py-3 text-slate-600">{record.status === "concluido" ? "Concluído" : record.status === "rascunho" ? "Rascunho" : "Em análise"}</td><td className="px-4 py-3 text-right font-bold text-ink">{metrics.isComparable ? formatCurrency(metrics.savings) : "—"}</td><td className={`px-4 py-3 text-right font-bold ${recorded !== null && recorded < 0 ? "text-red-700" : "text-success"}`}>{formatCurrency(recorded)}</td></tr>)}</tbody></table></div>}
      </section>
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-brand/30 bg-brand-soft/60 px-4 py-3"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" /><p className="text-[11px] leading-relaxed text-slate-600"><strong className="text-ink">Como ler os indicadores:</strong> economia potencial compara a maior e a menor proposta completas; economia confirmada usa o valor de referência e o valor contratado informados e confirmados em mapas concluídos. Valores negativos indicam contratação acima da referência. Esses números não representam lucro contábil.</p></div>
    </main>
  );
}

function Stat({ icon, label, value, detail, primary }: { icon: React.ReactNode; label: string; value: string; detail: string; primary?: boolean }) {
  return <div className={`break-inside-avoid rounded-2xl border px-4 py-4 ${primary ? "border-ink bg-ink text-white shadow-sm" : "card"}`}><div className="flex items-start justify-between gap-2"><p className={`text-[9px] font-bold uppercase tracking-[0.13em] ${primary ? "text-white/60" : "text-slate-500"}`}>{label}</p><span className={`grid h-8 w-8 place-items-center rounded-lg ${primary ? "bg-brand text-ink" : "bg-brand-soft text-brand-dark"}`}>{icon}</span></div><p className={`mt-3 text-[23px] font-extrabold tracking-tight ${primary ? "text-white" : "text-ink"}`}>{value}</p><p className={`mt-1 text-[10.5px] ${primary ? "text-white/60" : "text-slate-500"}`}>{detail}</p></div>;
}
