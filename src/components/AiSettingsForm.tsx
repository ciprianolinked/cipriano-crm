"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRightIcon, CheckIcon, CloseIcon, SparklesIcon } from "./icons";

type InitialState = {
  connected: boolean;
  provider: string;
  model: string;
  source: "painel" | "ambiente" | null;
  maskedKey: string | null;
};

export function AiSettingsForm({ initial }: { initial: InitialState }) {
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; message: string } | null>(null);

  async function refresh() {
    try {
      const response = await fetch("/api/ai/settings");
      const data = (await response.json()) as InitialState;
      setState(data);
    } catch {
      /* mantém estado atual */
    }
  }

  async function save(withTest: boolean) {
    if (!key.trim()) {
      setFeedback({ tone: "error", message: "Cole a chave do Gemini no campo acima antes de salvar." });
      return;
    }
    setBusy("save");
    setFeedback(null);
    try {
      const response = await fetch("/api/ai/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim(), test: withTest }),
      });
      const data = (await response.json()) as { ok?: boolean; maskedKey?: string; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Não foi possível salvar a chave.");
      setKey("");
      await refresh();
      setFeedback({
        tone: "ok",
        message: withTest
          ? "Chave testada e salva com sucesso! A leitura automática de PDFs e fotos já está funcionando."
          : "Chave salva com sucesso! Use “Testar conexão” para confirmar que está funcionando.",
      });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Erro ao salvar." });
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    setFeedback(null);
    try {
      const response = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim() || undefined }),
      });
      const data = (await response.json()) as { ok?: boolean; model?: string; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Falha no teste.");
      setFeedback({ tone: "ok", message: `Conexão OK! O Google respondeu usando o modelo ${data.model}.` });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Falha no teste." });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm("Remover a chave do painel? A leitura automática de arquivos será desativada.")) return;
    setBusy("remove");
    setFeedback(null);
    try {
      const response = await fetch("/api/ai/settings", { method: "DELETE" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Não foi possível remover.");
      await refresh();
      setFeedback({ tone: "ok", message: "Chave removida. Você ainda pode colar textos ou preencher manualmente." });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Erro ao remover." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden">
        <div className={`px-4 py-3.5 sm:px-5 ${state.connected ? "bg-ink text-white" : "bg-brand-soft"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span
                className={`grid h-9 w-9 place-items-center rounded-xl ${
                  state.connected ? "bg-brand text-ink-deep" : "bg-ink text-brand"
                }`}
              >
                <SparklesIcon className="h-5 w-5" />
              </span>
              <div>
                <h2 className={`text-[15px] font-extrabold leading-tight ${state.connected ? "" : "text-ink"}`}>
                  {state.connected ? "IA configurada" : "IA ainda não ativada"}
                </h2>
                <p className={`text-[11.5px] ${state.connected ? "text-white/65" : "text-slate-500"}`}>
                  {state.connected
                    ? `${state.provider === "gemini" ? "Google Gemini" : "OpenAI"} · ${state.model}${
                        state.source === "painel" ? " · chave salva no painel" : " · chave do ambiente"
                      }${state.maskedKey ? ` · ${state.maskedKey}` : ""}`
                    : "Cole sua chave gratuita do Google Gemini abaixo para ativar."}
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                state.connected ? "bg-brand text-ink-deep" : "bg-white text-amber-700 ring-1 ring-amber-200"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${state.connected ? "bg-ink-deep" : "bg-amber-500"}`} />
              {state.connected ? "Chave cadastrada" : "Pendente"}
            </span>
          </div>
        </div>

        <div className="px-4 py-4 sm:px-5">
          <label htmlFor="gemini-key">
            <span className="label">Chave de API do Google Gemini</span>
          </label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <input
                id="gemini-key"
                type={showKey ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="Cole aqui a chave gerada no Google AI Studio"
                className="field pr-20 font-mono !text-[12px]"
              />
              <button
                type="button"
                onClick={() => setShowKey((current) => !current)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[10.5px] font-bold text-slate-500 hover:bg-paper hover:text-ink"
              >
                {showKey ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
            Não tem a chave?{" "}
            <Link href="/ajuda/ia" className="font-bold text-brand-dark hover:underline">
              Veja o passo a passo de 2 minutos →
            </Link>
          </p>

          {feedback && (
            <div
              className={`mt-3 rounded-lg border px-3 py-2 text-[12px] font-semibold leading-snug ${
                feedback.tone === "ok"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
              role="status"
            >
              {feedback.message}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => save(true)} disabled={busy !== null} className="btn btn-brand">
              <CheckIcon className="h-4 w-4" />
              {busy === "save" ? "Salvando e testando…" : "Salvar e testar"}
            </button>
            <button type="button" onClick={test} disabled={busy !== null} className="btn btn-ghost">
              {busy === "test" ? "Testando…" : "Testar conexão"}
            </button>
            {state.source === "painel" && (
              <button
                type="button"
                onClick={remove}
                disabled={busy !== null}
                className="btn text-red-600 hover:bg-red-50"
              >
                <CloseIcon className="h-3.5 w-3.5" />
                {busy === "remove" ? "Removendo…" : "Remover chave"}
              </button>
            )}
          </div>

          {state.connected && (
            <Link
              href="/mapas/novo"
              className="btn btn-primary mt-3 w-full sm:w-auto"
            >
              Criar meu primeiro mapa com IA
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </section>

      <section className="card px-4 py-4 sm:px-5">
        <h2 className="text-[13.5px] font-extrabold text-ink">Perguntas rápidas</h2>
        <dl className="mt-2 space-y-2.5">
          {[
            {
              q: "O Gemini tem opção gratuita?",
              a: "O Google oferece uma cota gratuita para modelos elegíveis, sujeita a limites e condições. Consulte os preços e a disponibilidade do modelo antes de usar ou ativar faturamento.",
            },
            {
              q: "Preciso informar cartão de crédito?",
              a: "Para usar uma cota gratuita elegível, normalmente basta criar uma chave no Google AI Studio. Confira as condições atuais do seu projeto antes de escolher um plano pago.",
            },
            {
              q: "Como devo proteger minha chave?",
              a: "Uma chave salva aqui fica armazenada no banco do aplicativo e é exibida de forma mascarada. Como esta versão não tem login próprio, proteja todos os endereços antes de usá-la. Na Vercel, prefira a variável Secret GEMINI_API_KEY e não a envie ao GitHub.",
            },
            {
              q: "O que acontece com meus documentos?",
              a: "Eles são enviados ao provedor configurado. No serviço gratuito do Gemini, o Google informa que pode usar entradas e respostas para melhorar produtos. Não envie dados pessoais, sensíveis ou confidenciais sem avaliar os termos e as regras de privacidade aplicáveis.",
            },
          ].map((entry) => (
            <div key={entry.q} className="rounded-lg bg-paper px-3 py-2.5">
              <dt className="text-[12px] font-extrabold text-ink">{entry.q}</dt>
              <dd className="mt-0.5 text-[11.5px] leading-snug text-slate-600">{entry.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
