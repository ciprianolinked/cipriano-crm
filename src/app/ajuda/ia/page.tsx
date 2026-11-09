import Link from "next/link";
import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  SparklesIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Como ativar a IA gratuita · Ajuda Gerencial",
  description:
    "Passo a passo simples para conectar a IA gratuita do Google Gemini e ler propostas em PDF e fotos automaticamente.",
};

const STEPS = [
  {
    n: "1",
    title: "Tenha uma conta Google (Gmail)",
    body: "Você precisa apenas de uma conta Google — a mesma do Gmail ou do YouTube. Se ainda não tem, crie grátis em accounts.google.com. Não é preciso informar cartão de crédito em nenhum momento.",
    tip: "Use de preferência o e-mail da empresa, para a chave ficar vinculada à Gerencial.",
  },
  {
    n: "2",
    title: "Abra o Google AI Studio",
    body: "No computador ou celular, acesse aistudio.google.com e entre com sua conta Google. Essa é a página oficial do Google para gerar chaves gratuitas da IA Gemini.",
    tip: "Endereço direto da página de chaves: aistudio.google.com/apikey",
    link: { href: "https://aistudio.google.com/apikey", label: "Abrir o Google AI Studio" },
  },
  {
    n: "3",
    title: "Clique em “Get API key” (Obter chave)",
    body: "Dentro do AI Studio, procure no menu o botão “Get API key” ou “Create API key”. Na primeira vez, o Google pode pedir para aceitar os termos de uso — leia e aceite para continuar.",
    tip: "Se o site estiver em inglês, procure exatamente o texto “Get API key” no menu lateral.",
  },
  {
    n: "4",
    title: "Crie a chave em um projeto",
    body: "Clique em “Create API key” e escolha um projeto (pode ser o projeto padrão sugerido pelo Google). O Google mostrará sua chave. Os formatos podem variar: chaves novas também podem começar com “AQ.”.",
    tip: "Guarde essa chave como uma senha: ela dá acesso à IA na sua conta.",
  },
  {
    n: "5",
    title: "Copie a chave inteira",
    body: "Clique no ícone de copiar ao lado da chave para copiar o código completo, sem faltar nenhuma letra. Qualquer pedacinho a menos e a chave não funciona.",
    tip: "O formato e o tamanho variam. Copie a chave inteira diretamente do Google AI Studio; chaves novas podem começar com AQ.. Nunca a compartilhe.",
  },
  {
    n: "6",
    title: "Cole a chave aqui no aplicativo",
    body: "Volte para cá, abra a página “Configurar IA”, cole a chave no campo indicado e clique em “Salvar e testar”. Se aparecer a mensagem de sucesso, pronto: a leitura automática de PDFs e fotos já está funcionando!",
    tip: "Feito isso uma única vez, você não precisa repetir — a chave fica salva.",
    link: { href: "/configuracoes", label: "Ir para Configurar IA", internal: true },
  },
];

const ERRORS = [
  {
    symptom: "“O Google não conseguiu concluir a análise”",
    cause: "O Google retornou um erro durante a análise. Isso pode acontecer por indisponibilidade temporária, mesmo com PDFs pequenos.",
    fix: "O aplicativo tenta novamente e pode usar outra conexão ou modelo compatível, mantendo todos os arquivos na mesma análise. Se não conseguir concluir, os arquivos continuam selecionados. Confira o status do Gemini e a cota do projeto no Google AI Studio antes de tentar novamente.",
  },
  {
    symptom: "“O Gemini não respondeu dentro do tempo disponível”",
    cause: "A leitura de vários documentos depende do número de páginas, da complexidade e da disponibilidade do Google, não apenas do tamanho dos PDFs.",
    fix: "Os arquivos continuam selecionados. Tente a análise novamente; se o erro persistir, confira o status e os limites do seu projeto no Google AI Studio. Na Vercel, publique a versão atual do aplicativo e confirme que o Fluid Compute está ativo.",
  },
  {
    symptom: "“A chave do Gemini não é válida”",
    cause: "A chave foi colada incompleta ou com espaço a mais no início/fim.",
    fix: "Volte ao AI Studio, copie a chave inteira novamente e confirme se ela pertence ao projeto correto. Chaves novas podem começar com “AQ.”; o prefixo sozinho não confirma sua validade.",
  },
  {
    symptom: "“O Google recusou a chave (erro 403)”",
    cause: "A chave foi excluída/regenerada no Google, ou a API não está habilitada no projeto.",
    fix: "No AI Studio, gere uma nova chave (“Create API key”) e salve aqui. Se persistir, ative a API “Generative Language” no projeto do Google Cloud.",
  },
  {
    symptom: "“Limite gratuito atingido (429)”",
    cause: "Você fez muitas análises em pouco tempo e bateu no teto momentâneo do plano grátis.",
    fix: "Consulte os limites e a cota do seu projeto no Google AI Studio. Dependendo do limite atingido, talvez seja necessário aguardar a renovação por minuto ou por dia.",
  },
  {
    symptom: "“O serviço do Google está instável”",
    cause: "O serviço do Google pode estar temporariamente indisponível ou sobrecarregado.",
    fix: "Atualize o aplicativo para a versão mais recente. Ela tenta novamente automaticamente e preserva os arquivos; se persistir, consulte a página de status do Gemini e os limites da sua conta.",
  },
  {
    symptom: "Não acho o botão “Get API key”",
    cause: "Você pode estar logado com outra conta ou em página diferente do AI Studio.",
    fix: "Confirme que está em aistudio.google.com com a conta certa (foto no canto superior direito) e use o link direto aistudio.google.com/apikey.",
  },
];

const FAQS = [
  {
    q: "Quanto custa? Vou pagar alguma coisa?",
    a: "O Google oferece uma cota gratuita para modelos elegíveis, sujeita a limites que variam por modelo e projeto. O plano gratuito pode ser suficiente para testes, mas não há garantia para qualquer volume. Consulte preços e limites no Google antes de ativar faturamento ou usar um plano pago.",
  },
  {
    q: "O que é essa “chave” (API key)?",
    a: "É como uma senha que identifica o aplicativo junto ao Google. Guarde-a em segredo, não envie para o GitHub e limite o acesso de quem administra o projeto.",
  },
  {
    q: "O que acontece com os documentos enviados?",
    a: "Os arquivos são enviados ao provedor de IA configurado. Nos serviços gratuitos do Gemini, o Google informa que pode usar entradas e respostas para melhorar produtos e que revisores podem processá-las. Não envie dados sensíveis, pessoais ou confidenciais ao serviço gratuito; consulte os termos, a LGPD e as políticas da sua empresa antes de usar documentos reais.",
  },
  {
    q: "E se eu não quiser usar IA?",
    a: "Sem problema. O aplicativo funciona sem a chave: você pode colar o texto da cotação (o sistema tenta identificar fornecedores e valores) ou preencher o mapa manualmente. A IA só automatiza a leitura de arquivos.",
  },
  {
    q: "Posso usar a mesma chave em outro computador?",
    a: "Sim. Quando salva no painel, a chave fica armazenada no banco do aplicativo; quando definida na Vercel, fica em uma variável de ambiente. Esta versão não tem login próprio: proteja todo o endereço do aplicativo antes de armazenar dados ou chaves reais.",
  },
  {
    q: "Existe outra IA além do Gemini?",
    a: "O aplicativo aceita Google Gemini e também OpenAI por variável de ambiente. Confira os preços, limites e termos de privacidade do provedor e do modelo escolhidos; acesso gratuito e qualidade podem variar.",
  },
];

export default function AiHelpPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-[980px] px-4 pb-16 pt-5 sm:px-6">
          <Link
            href="/ajuda"
            className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-500 hover:text-ink"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Central de ajuda
          </Link>

        <section className="relative mt-2 overflow-hidden rounded-2xl bg-ink px-5 py-7 text-white sm:px-8">
          <div
            className="pointer-events-none absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                "radial-gradient(circle at 85% 15%, rgba(250,177,42,0.6) 0, transparent 45%)",
            }}
          />
          <div className="relative">
            <p className="inline-flex items-center gap-2 rounded-full bg-brand px-3 py-1 text-[9.5px] font-bold uppercase tracking-[0.16em] text-ink-deep">
              <SparklesIcon className="h-3 w-3" />
              Guia para iniciantes · 2 minutos
            </p>
            <h1 className="font-display mt-3 max-w-xl text-[28px] leading-[1.1] sm:text-[36px]">
              Como ativar a IA gratuita que lê suas cotações
            </h1>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-white/70">
              Este guia explica, clique por clique e sem termos técnicos, como gerar sua chave gratuita do Google
              Gemini e conectar ao aplicativo. Você só faz isso uma vez.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/configuracoes" className="btn btn-brand">
                Configurar minha IA agora
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="btn border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                Abrir Google AI Studio
              </a>
            </div>
          </div>
        </section>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3.5">
          <div>
            <p className="text-[12px] font-bold text-ink">Quer publicar o aplicativo na internet?</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">Veja também como conectar GitHub, Neon e Vercel e proteger o acesso.</p>
          </div>
          <Link href="/ajuda/publicar" className="btn btn-ghost">Guia de publicação <ArrowRightIcon className="h-3.5 w-3.5" /></Link>
        </div>

        <section className="mt-4 grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-3 sm:p-5">
          {[
            { t: "Cota gratuita", d: "Sujeita aos limites e condições atuais do Google." },
            { t: "Configuração única", d: "A chave pode ser ajustada quando necessário." },
            { t: "Lê PDF e foto", d: "Orçamentos em PDF, JPG, PNG ou print de celular." },
          ].map((item) => (
            <div key={item.t} className="flex items-start gap-2.5 rounded-xl bg-paper px-3 py-2.5">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success-soft text-success">
                <CheckIcon className="h-3 w-3" />
              </span>
              <div>
                <p className="text-[12.5px] font-extrabold text-ink">{item.t}</p>
                <p className="text-[11px] leading-snug text-slate-500">{item.d}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-6">
          <h2 className="font-display text-[22px] text-ink">Passo a passo</h2>
          <p className="mt-1 max-w-2xl text-[12.5px] text-slate-500">
            Siga na ordem. Se preferir, abra o Google AI Studio em outra aba e vá alternando entre as telas.
          </p>
          <ol className="mt-3 space-y-3">
            {STEPS.map((step) => (
              <li key={step.n} className="card flex gap-3.5 px-4 py-4 sm:px-5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink text-[15px] font-extrabold text-brand">
                  {step.n}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14.5px] font-extrabold leading-tight text-ink">{step.title}</h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{step.body}</p>
                  {step.tip && (
                    <p className="mt-2 rounded-lg bg-brand-soft px-2.5 py-1.5 text-[11.5px] leading-snug text-brand-dark">
                      <span className="font-extrabold">Dica: </span>
                      {step.tip}
                    </p>
                  )}
                  {step.link &&
                    (step.link.internal ? (
                      <Link href={step.link.href} className="btn btn-brand mt-2.5">
                        {step.link.label}
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <a href={step.link.href} target="_blank" rel="noreferrer" className="btn btn-primary mt-2.5">
                        {step.link.label}
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                      </a>
                    ))}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-[22px] text-ink">Deu erro? Veja a solução</h2>
          <p className="mt-1 max-w-2xl text-[12.5px] text-slate-500">
            As mensagens de erro mais comuns e o que fazer em cada uma — sem precisar chamar técnico.
          </p>
          <div className="mt-3 space-y-2.5">
            {ERRORS.map((entry) => (
              <details key={entry.symptom} className="card group px-4 py-3 sm:px-5">
                <summary className="cursor-pointer list-none text-[13px] font-extrabold text-ink [&::-webkit-details-marker]:hidden">
                  <span className="mr-2 inline-grid h-5 w-5 place-items-center rounded-full bg-red-50 align-middle text-[11px] font-black text-red-500">
                    !
                  </span>
                  {entry.symptom}
                  <span className="ml-2 text-[10.5px] font-bold text-brand-dark group-open:hidden">
                    Ver solução →
                  </span>
                </summary>
                <div className="mt-2 space-y-1.5 border-t border-line pt-2 text-[12px] leading-relaxed">
                  <p className="text-slate-600">
                    <span className="font-bold text-ink">Por que acontece: </span>
                    {entry.cause}
                  </p>
                  <p className="rounded-lg bg-success-soft px-2.5 py-1.5 text-success">
                    <span className="font-bold">Como resolver: </span>
                    {entry.fix}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-[22px] text-ink">Perguntas frequentes</h2>
          <div className="mt-3 space-y-2.5">
            {FAQS.map((entry) => (
              <details key={entry.q} className="card group px-4 py-3 sm:px-5">
                <summary className="cursor-pointer list-none text-[13px] font-extrabold text-ink [&::-webkit-details-marker]:hidden">
                  {entry.q}
                  <span className="ml-2 text-[10.5px] font-bold text-brand-dark group-open:hidden">Ler →</span>
                </summary>
                <p className="mt-2 border-t border-line pt-2 text-[12px] leading-relaxed text-slate-600">{entry.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl bg-ink px-5 py-6 text-center text-white sm:px-8">
          <SparklesIcon className="mx-auto h-6 w-6 text-brand" />
          <h2 className="font-display mx-auto mt-2 max-w-md text-[22px] leading-tight">
            Pronto para ativar sua IA gratuita?
          </h2>
          <p className="mx-auto mt-1 max-w-md text-[12px] text-white/65">
            Gere a chave no Google AI Studio, cole na página de configuração e crie seu primeiro mapa com leitura
            automática.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="btn border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              1 · Gerar chave grátis
            </a>
            <Link href="/configuracoes" className="btn btn-brand">
              2 · Colar e ativar
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
