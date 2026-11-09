import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { QuotationsList, type QuotationListItem } from "@/components/QuotationsList";
import { computeMetrics, formatCompactCurrency, formatCurrency, formatDateBR } from "@/lib/quotation";
import { listCondominiums, listQuotations } from "@/lib/server/quotations";
import { getAiConfig } from "@/lib/ai";
import type { CondominiumRecord, QuotationRecord } from "@/lib/types";
import {
  ArrowRightIcon,
  BuildingIcon,
  CheckIcon,
  FileIcon,
  SparklesIcon,
  TrendIcon,
  UploadIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let records: QuotationRecord[] = [];
  let condominiums: CondominiumRecord[] = [];
  let dbError = false;
  let aiConnected = false;

  try {
    records = await listQuotations();
    condominiums = await listCondominiums();
  } catch {
    dbError = true;
  }

  try {
    aiConnected = (await getAiConfig()).provider !== "none";
  } catch {
    aiConnected = false;
  }

  const items: QuotationListItem[] = records.map((record) => {
    const metrics = computeMetrics(record);
    return {
      id: record.id,
      protocol: record.protocol,
      condominium: record.condominium || "Condomínio não informado",
      service: record.service,
      category: record.category,
      kind: record.kind,
      analysisDate: record.analysisDate,
      status: record.status,
      supplierCount: metrics.supplierCount,
      itemCount: metrics.itemCount,
      bestName: metrics.best?.supplier.name ?? null,
      bestTotal: metrics.best?.total ?? null,
      savings: metrics.savings,
    };
  });

  const totalSavings = items.reduce((total, item) => total + item.savings, 0);
  const inAnalysis = records.filter((record) => record.status === "em_analise").length;
  const completed = records.filter((record) => record.status === "concluido").length;
  const latest = records[0];
  const condominiumCounts = new Map<string, number>();
  for (const record of records) {
    if (!record.condominium) continue;
    condominiumCounts.set(record.condominium, (condominiumCounts.get(record.condominium) ?? 0) + 1);
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-5 sm:px-6">
        <section className="relative overflow-hidden rounded-2xl bg-ink text-white shadow-[0_30px_60px_-40px_rgba(24,20,71,0.8)]">
          <div
            className="pointer-events-none absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                "radial-gradient(circle at 82% 18%, rgba(250,177,42,0.55) 0, transparent 42%), radial-gradient(circle at 12% 90%, rgba(250,177,42,0.25) 0, transparent 38%)",
            }}
          />
          <div className="relative grid gap-6 px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[9.5px] font-bold uppercase tracking-[0.18em] text-brand">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                Governança condominial · cotações
              </p>
              <h1 className="font-display mt-3 max-w-[560px] text-[30px] leading-[1.08] sm:text-[40px]">
                Cada decisão do condomínio começa com um mapa de cotação claro.
              </h1>
              <p className="mt-2.5 max-w-[540px] text-[13px] leading-relaxed text-white/70 sm:text-[14px]">
                Envie as propostas em PDF ou imagem, deixe a IA gratuita montar o comparativo e mantenha o padrão
                Gerencial de análise — com campos editáveis para a realidade de cada condomínio.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link href="/mapas/novo" className="btn btn-brand">
                  <SparklesIcon className="h-4 w-4" />
                  Criar mapa com IA
                </Link>
                {!aiConnected ? (
                  <Link
                    href="/configuracoes"
                    className="btn border-white/20 bg-white/10 text-white hover:bg-white/20"
                  >
                    Ativar IA gratuita
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <Link
                    href="/#mapas"
                    className="btn border-white/20 bg-white/10 text-white hover:bg-white/20"
                  >
                    Ver mapas de cotação
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10.5px] text-white/60">
                <span className="inline-flex items-center gap-1.5">
                  <CheckIcon className="h-3 w-3 text-brand" />
                  PDF, JPG e PNG
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckIcon className="h-3 w-3 text-brand" />
                  Campos do cabeçalho editáveis
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckIcon className="h-3 w-3 text-brand" />
                  Documento pronto para assinatura
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-brand/30 bg-white/[0.07] p-4 backdrop-blur-sm">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-brand">Último mapa elaborado</p>
              {latest ? (
                <>
                  <p className="mt-1 text-[15px] font-extrabold leading-tight">{latest.condominium}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-white/60">{latest.service}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-white/10 px-2.5 py-2">
                      <p className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-white/50">Melhor proposta</p>
                      <p className="text-[13px] font-extrabold">{formatCurrency(computeMetrics(latest).best?.total ?? null)}</p>
                    </div>
                    <div className="rounded-lg bg-white/10 px-2.5 py-2">
                      <p className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-white/50">Economia</p>
                      <p className="text-[13px] font-extrabold text-brand">
                        {formatCurrency(computeMetrics(latest).savings)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-white/50">
                    <span className="font-mono">{latest.protocol}</span>
                    <span>{formatDateBR(latest.analysisDate)}</span>
                  </div>
                  <Link
                    href={`/mapas/${latest.id}`}
                    className="mt-3 flex items-center justify-between rounded-lg bg-brand px-3 py-2 text-[11.5px] font-bold text-ink-deep transition hover:bg-[#ffc14d]"
                  >
                    Abrir mapa
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  </Link>
                </>
              ) : (
                <>
                  <p className="mt-2 text-[13px] font-bold leading-snug">
                    Bem-vindo ao seu painel Gerencial — por aqui começa tudo do zero.
                  </p>
                  <ol className="mt-3 space-y-2">
                    {[
                      "Ative a IA gratuita em “Configurar IA” (2 minutos).",
                      "Crie seu primeiro mapa a partir de PDFs ou fotos.",
                      "Revise, salve e imprima no padrão Gerencial.",
                    ].map((step, index) => (
                      <li key={step} className="flex items-start gap-2 text-[11.5px] leading-snug text-white/70">
                        <span className="grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-extrabold text-ink-deep">
                          {index + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                  <Link
                    href="/configuracoes"
                    className="mt-3 flex items-center justify-between rounded-lg bg-brand px-3 py-2 text-[11.5px] font-bold text-ink-deep transition hover:bg-[#ffc14d]"
                  >
                    Começar agora: ativar IA gratuita
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>

        {dbError && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-800">
            Não foi possível carregar os mapas agora. A estrutura do banco pode estar sendo inicializada — recarregue em
            instantes.
          </div>
        )}

        {!dbError && !aiConnected && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/40 bg-brand-soft px-4 py-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink text-brand">
                <SparklesIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[13px] font-extrabold text-ink">Ative a leitura automática de propostas — é grátis</p>
                <p className="text-[11.5px] leading-snug text-slate-600">
                  Com a chave gratuita do Google Gemini, a IA lê PDFs e fotos e monta o mapa sozinha. Sem ela, você
                  ainda pode colar o texto ou preencher manualmente.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/ajuda/ia" className="btn btn-ghost">
                Ver passo a passo
              </Link>
              <Link href="/configuracoes" className="btn btn-brand">
                Configurar IA
              </Link>
            </div>
          </div>
        )}

        <Link href="/indicadores" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-white px-4 py-3 transition hover:border-brand hover:bg-brand-soft/30">
          <span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-ink text-brand"><TrendIcon className="h-4.5 w-4.5" /></span><span><strong className="block text-[12.5px] text-ink">Dashboard para assembleia</strong><span className="block text-[11px] text-slate-500">Acompanhe economias, propostas e resultados por condomínio.</span></span></span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-dark">Abrir indicadores <ArrowRightIcon className="h-3.5 w-3.5" /></span>
        </Link>

        <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<FileIcon className="h-4 w-4" />}
            label="Mapas no portfólio"
            value={String(records.length)}
            hint={`${completed} concluído(s) · ${inAnalysis} em análise`}
          />
          <StatCard
            icon={<TrendIcon className="h-4 w-4" />}
            label="Economia potencial"
            value={formatCompactCurrency(totalSavings)}
            hint="Diferença entre propostas completas, não lucro"
            tone="gold"
          />
          <StatCard
            icon={<BuildingIcon className="h-4 w-4" />}
            label="Condomínios atendidos"
            value={String(condominiums.length)}
            hint="Associações e condomínios com processo ativo"
          />
          <StatCard
            icon={<SparklesIcon className="h-4 w-4" />}
            label="Leitura com IA"
            value={aiConnected ? "Ativa" : "A ativar"}
            hint={aiConnected ? "Gemini gratuito conectado" : "Configure grátis em 2 minutos"}
            tone="ink"
          />
        </section>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
          <QuotationsList items={items} />

          <aside className="space-y-4">
            <section className="card overflow-hidden">
              <div className="bg-ink px-4 py-4 text-white">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-ink-deep">
                  <SparklesIcon className="h-3 w-3" />
                  Assistente Gerencial · grátis
                </span>
                <h2 className="font-display mt-2 text-[20px] leading-tight">Da proposta ao mapa, em segundos.</h2>
                <p className="mt-1 text-[11.5px] leading-snug text-white/70">
                  Envie PDFs das cotações ou fotos dos orçamentos. A IA identifica fornecedores, itens, valores e redige
                  o parecer técnico.
                </p>
                <Link href="/mapas/novo" className="btn btn-brand mt-3 w-full">
                  <UploadIcon className="h-4 w-4" />
                  Analisar propostas
                </Link>
                {!aiConnected && (
                  <Link
                    href="/ajuda/ia"
                    className="mt-2 block text-center text-[11px] font-bold text-brand hover:underline"
                  >
                    Como ativar a IA gratuita? Veja o passo a passo →
                  </Link>
                )}
              </div>
              <ol className="divide-y divide-line">
                {[
                  { step: "1", title: "Envie os documentos", text: "PDF, JPG ou PNG — até 6 arquivos por análise." },
                  { step: "2", title: "Revise o comparativo", text: "Campos editáveis por condomínio e categoria." },
                  { step: "3", title: "Aprove e arquive", text: "Documento no padrão Gerencial, pronto para PDF." },
                ].map((entry) => (
                  <li key={entry.step} className="flex items-start gap-2.5 px-4 py-2.5">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[10px] font-extrabold text-brand-dark">
                      {entry.step}
                    </span>
                    <div>
                      <p className="text-[11.5px] font-bold text-ink">{entry.title}</p>
                      <p className="text-[10.5px] leading-snug text-slate-500">{entry.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="card" id="condominios">
              <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
                <div>
                  <Link href="/condominios" className="text-[13.5px] font-extrabold text-ink hover:underline">Condomínios atendidos</Link>
                  <p className="text-[10.5px] text-slate-500">Base da governança Gerencial</p>
                </div>
                <BuildingIcon className="h-4 w-4 text-slate-400" />
              </div>
              <ul className="divide-y divide-line">
                {condominiums.length === 0 && (
                  <li className="px-4 py-4 text-[11.5px] text-slate-500">
                    Nenhum condomínio ainda. O primeiro é cadastrado automaticamente ao salvar seu primeiro mapa.
                  </li>
                )}
                {condominiums.map((condominium) => (
                  <li key={condominium.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-bold text-ink">{condominium.name}</p>
                      <p className="truncate text-[10px] text-slate-500">
                        {condominium.city ?? "Cidade não informada"}
                        {condominium.manager ? ` · ${condominium.manager}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-paper px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      {condominiumCounts.get(condominium.name) ?? 0} mapa(s)
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line px-4 py-2.5">
                <Link href="/condominios" className="text-[11px] font-bold text-brand-dark hover:underline">
                  Gerenciar condomínios e associações →
                </Link>
              </div>
            </section>
          </aside>
        </div>

        <p className="mt-6 text-center text-[10.5px] text-slate-400">
          Gerencial · Governança Condominial — padrão institucional de mapas de cotação. Documentos gerados para apoio à
          decisão do síndico e do conselho.
        </p>
      </main>
    </AppShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "gold" | "ink";
}) {
  const iconStyle =
    tone === "gold"
      ? "bg-brand-soft text-brand-dark"
      : tone === "ink"
        ? "bg-ink text-brand"
        : "bg-paper text-ink";
  return (
    <div className="card px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="label !text-[8.5px]">{label}</p>
          <p className="font-display mt-1 text-[24px] leading-none text-ink">{value}</p>
        </div>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${iconStyle}`}>{icon}</span>
      </div>
      <p className="mt-1.5 text-[10.5px] leading-snug text-slate-500">{hint}</p>
    </div>
  );
}
