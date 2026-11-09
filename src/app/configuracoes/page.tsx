import Link from "next/link";
import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { AiSettingsForm } from "@/components/AiSettingsForm";
import { getAiConfig } from "@/lib/ai";
import { getGeminiKey, maskKey } from "@/lib/server/quotations";
import { ArrowLeftIcon, ArrowRightIcon, SparklesIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Configurar IA gratuita · Gerencial",
  description: "Ative a leitura automática de propostas com a chave gratuita do Google Gemini.",
};

export default async function ConfiguracoesPage() {
  let initial = {
    connected: false,
    provider: "none",
    model: "pré-análise local",
    source: null as "painel" | "ambiente" | null,
    maskedKey: null as string | null,
  };

  try {
    const config = await getAiConfig();
    const { key, source } = await getGeminiKey();
    initial = {
      connected: config.provider !== "none",
      provider: config.provider,
      model: config.model,
      source,
      maskedKey: key ? maskKey(key) : null,
    };
  } catch {
    /* usa estado inicial vazio */
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-[980px] px-4 pb-16 pt-5 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-500 hover:text-ink"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Painel de cotações
        </Link>

        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[28px] leading-tight text-ink sm:text-[34px]">
              Configurar IA gratuita
            </h1>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-snug text-slate-500">
              Conecte o Google Gemini — a IA gratuita que lê seus PDFs e fotos de propostas e monta o mapa de cotação
              sozinha. Sem código, sem cartão, em cerca de 2 minutos.
            </p>
          </div>
          <Link
            href="/ajuda/ia"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[10.5px] font-bold text-brand transition hover:bg-ink-soft"
          >
            <SparklesIcon className="h-3.5 w-3.5" />
            Passo a passo ilustrado
            <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <AiSettingsForm initial={initial} />

          <aside className="space-y-4">
            <section className="card px-4 py-4">
              <p className="label !text-[8.5px]">Resumo em 3 passos</p>
              <ol className="mt-2 space-y-2.5">
                {[
                  { n: "1", t: "Gere a chave grátis", d: "No Google AI Studio, com sua conta Gmail." },
                  { n: "2", t: "Cole a chave aqui", d: "No campo ao lado e clique em “Salvar e testar”." },
                  { n: "3", t: "Crie seu mapa", d: "Envie PDFs/fotos e a IA monta o comparativo." },
                ].map((step) => (
                  <li key={step.n} className="flex items-start gap-2.5">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-[10px] font-extrabold text-brand">
                      {step.n}
                    </span>
                    <div>
                      <p className="text-[12px] font-bold text-ink">{step.t}</p>
                      <p className="text-[10.5px] leading-snug text-slate-500">{step.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost mt-3 w-full"
              >
                Abrir Google AI Studio
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </a>
            </section>

            <section className="rounded-xl border border-brand/40 bg-brand-soft px-4 py-3.5">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-brand-dark">
                Primeira vez aqui?
              </p>
              <p className="mt-1 text-[11px] leading-snug text-slate-600">
                O guia explica cada clique, o que fazer se der erro e quanto custa (spoiler: nada no plano gratuito).
              </p>
              <Link href="/ajuda/ia" className="mt-2 inline-block text-[11px] font-bold text-ink hover:underline">
                Abrir guia completo →
              </Link>
            </section>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
