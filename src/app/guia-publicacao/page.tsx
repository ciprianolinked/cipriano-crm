import Link from "next/link";
import type { Metadata } from "next";
import { CodeBlock } from "@/components/ui/CopyButton";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "Guia de publicação · GitHub + Neon + Vercel | Cipriano Tech & Security",
  description:
    "Passo a passo completo para publicar o app de propostas e CRM da Cipriano Tech & Security com GitHub, Neon.tech (PostgreSQL) e Vercel, incluindo domínio próprio.",
};

const steps = [
  {
    id: "01",
    title: "Coloque o projeto no GitHub",
    time: "~10 min",
    goal: "Ter um repositório privado versionado com o código deste app.",
    body: [
      "Crie uma conta em github.com (se ainda não tiver) e um repositório novo chamado cipriano-propostas, marcado como Private.",
      "No terminal, dentro da pasta do projeto, inicialize o git, faça o primeiro commit e envie para o GitHub.",
      "Confira se o arquivo .env NÃO foi enviado: o .gitignore do Next.js já ignora .env*. Se aparecer .env no commit, remova com git rm --cached .env antes de continuar.",
    ],
    code: [
      {
        title: "Terminal",
        code: `git init
git add .
git commit -m "feat: painel de propostas e CRM Cipriano"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/cipriano-propostas.git
git push -u origin main`,
      },
      {
        title: ".gitignore (garanta estas linhas)",
        code: `node_modules
.next
.env
.env*.local
.vercel
.DS_Store`,
      },
    ],
    links: [
      { label: "github.com/new", href: "https://github.com/new" },
      { label: "GitHub Docs · criar repositório", href: "https://docs.github.com/pt/repositories/creating-and-managing-repositories/creating-a-new-repository" },
    ],
  },
  {
    id: "02",
    title: "Crie o banco no Neon.tech",
    time: "~8 min",
    goal: "Ter um PostgreSQL serverless com a string de conexão segura.",
    body: [
      "Acesse neon.tech, crie um projeto (região aws-sa-east-1 / São Paulo para menor latência) e guarde a senha do usuário.",
      "No painel do projeto, abra Connection Details, selecione o driver Node.js e copie a string que já vem com sslmode=require. Use a versão com o host -pooler para o app na Vercel.",
      "O app usa Drizzle ORM. Com a string em mãos, aplique o schema no banco (cria tabelas de propostas, clientes, catálogo, atividades e configurações).",
      "Opcional: cada branch do Neon cria um banco isolado. Use um banco de preview para testar mudanças de schema sem afetar produção.",
    ],
    code: [
      {
        title: "String de conexão (exemplo)",
        code: `postgresql://USUARIO:SENHA@ep-xxxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require`,
      },
      {
        title: "Aplicar schema no banco",
        code: `# .env na sua máquina
DATABASE_URL="postgresql://USUARIO:SENHA@ep-xxxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"

# cria/atualiza as tabelas
npx drizzle-kit push

# verifique
psql "$DATABASE_URL" -c "\\dt"`,
      },
    ],
    links: [
      { label: "neon.tech", href: "https://neon.tech" },
      { label: "Neon Docs · conectar do Node.js", href: "https://neon.tech/docs/connect/connect-from-any-app" },
    ],
  },
  {
    id: "03",
    title: "Publique na Vercel",
    time: "~6 min",
    goal: "Site no ar com HTTPS, build automático a cada push e variáveis protegidas.",
    body: [
      "Entre em vercel.com, clique em Add New → Project e importe o repositório cipriano-propostas do GitHub.",
      "Framework: Next.js (detectado automaticamente). Build Command: npm run build. Output: .next. Node 20 ou superior.",
      "Em Environment Variables, adicione DATABASE_URL com a string do Neon (marque Production, Preview e Development). Nenhuma variável de banco deve começar com NEXT_PUBLIC_.",
      "Clique em Deploy. Cada push na branch main gera um deploy de produção; cada Pull Request gera uma URL de preview.",
      "Depois do deploy, valide o healthcheck em https://SEU-PROJETO.vercel.app/api/health — precisa responder status ok.",
    ],
    code: [
      {
        title: "Variáveis de ambiente (Vercel → Settings → Environment Variables)",
        code: `DATABASE_URL = postgresql://USUARIO:SENHA@ep-xxxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require

# opcional: reescrita de blocos por IA
OPENAI_API_KEY = sk-...`,
      },
      {
        title: "Publicar novamente pela CLI (alternativa)",
        code: `npm i -g vercel
vercel login
vercel link
vercel env add DATABASE_URL production
vercel --prod`,
      },
    ],
    links: [
      { label: "vercel.com/new", href: "https://vercel.com/new" },
      { label: "Vercel Docs · importar projeto Git", href: "https://vercel.com/docs/getting-started-with-vercel/import" },
      { label: "Vercel Docs · variáveis de ambiente", href: "https://vercel.com/docs/environment-variables" },
    ],
  },
  {
    id: "04",
    title: "Aponte seu domínio",
    time: "~10 min + DNS",
    goal: "App rodando em propostas.ciprianotech.com.br com certificado válido.",
    body: [
      "Na Vercel, abra o projeto → Settings → Domains → Add e informe o subdomínio desejado.",
      "No seu provedor de DNS (Registro.br, Cloudflare, GoDaddy), crie o registro indicado pela Vercel: CNAME do subdomínio para cname.vercel-dns.com, ou A para 76.76.21.21 se for o domínio raiz.",
      "Aguarde a propagação (de minutos a algumas horas). A Vercel emite o certificado TLS automaticamente.",
      "Se usar Cloudflare, deixe o proxy no modo DNS only durante a validação para evitar loop de SSL.",
    ],
    code: [
      {
        title: "Exemplo de registros DNS",
        code: `# subdomínio
Tipo: CNAME   Nome: propostas   Valor: cname.vercel-dns.com

# domínio raiz
Tipo: A       Nome: @           Valor: 76.76.21.21`,
      },
    ],
    links: [
      { label: "Vercel Docs · domínios", href: "https://vercel.com/docs/domains/working-with-domains" },
      { label: "Registro.br", href: "https://registro.br" },
    ],
  },
];

const checklist = [
  "Repositório privado no GitHub com o código versionado e .env fora do commit.",
  "DATABASE_URL configurada na Vercel (Production, Preview e Development).",
  "Schema aplicado no Neon com npx drizzle-kit push.",
  "/api/health respondendo 200 no domínio final.",
  "Login do painel restrito (se publicado com dados reais, proteja o acesso).",
  "Backup do Neon habilitado (retenção de 7+ dias) e um dump mensal em local seguro.",
  "Domínio próprio com HTTPS ativo e e-mail comercial configurado.",
];

const troubleshooting = [
  {
    problem: "Erro “DATABASE_URL is required” no deploy",
    fix: "A variável não existe no ambiente. Cadastre em Environment Variables e faça Redeploy (variáveis não entram em deploy já concluído).",
  },
  {
    problem: "“Connection terminated” ou timeout no Neon",
    fix: "Use a string com -pooler no host, adicione sslmode=require e não crie novos Pool a cada request. O app já usa um pool único global.",
  },
  {
    problem: "Tabelas não existem em produção",
    fix: "Rodar npx drizzle-kit push apontando para o banco de produção e depois executar um Redeploy para limpar cache.",
  },
  {
    problem: "PDF sem imagens ou fontes erradas",
    fix: "Gere o PDF com a página já carregada (fontes prontas) e mantenha o botão “Imprimir / PDF A4” como alternativa nativa do navegador.",
  },
  {
    problem: "Next.js pede Node 18",
    fix: "Em Settings → General → Node.js Version escolha 20.x ou 22.x e refaça o build.",
  },
];

export default function PublishingGuidePage() {
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 lg:px-8 lg:py-8">
      <header className="border-b border-line/50 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Logo height={44} />
          <Link href="/" className="btn py-1.5 text-[11.5px]">
            ← Voltar ao painel
          </Link>
        </div>
        <div className="mt-5 label-mono text-signal">Documentação interna</div>
        <h1 className="mt-2 font-display text-[clamp(1.7rem,3.2vw,2.4rem)] font-semibold leading-tight text-white">
          Guia de publicação do site completo
        </h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-steel">
          Do repositório ao domínio próprio: como publicar este app (Next.js + PostgreSQL/Drizzle) usando
          <b className="text-silver"> GitHub</b> para versionamento, <b className="text-silver">Neon.tech</b> como banco gerenciado
          e <b className="text-silver">Vercel</b> para hospedagem. Tempo estimado total: 35 a 45 minutos.
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {[
            ["#", "Stack: Next.js 16 · Node 20+"],
            ["#", "Banco: PostgreSQL (Neon)"],
            ["#", "Deploy: Vercel · HTTPS automático"],
            ["#", "Escopo: app completo, com CRM e PDF"],
          ].map(([, label]) => (
            <span key={label} className="chip">
              {label}
            </span>
          ))}
        </div>
      </header>

      <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <a key={step.id} href={`#passo-${step.id}`} className="card p-3 transition hover:border-signal/50">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.18em] text-signal">{step.id}</span>
              <span className="chip">{step.time}</span>
            </div>
            <div className="mt-1 font-display text-[13px] font-semibold leading-snug text-white">{step.title}</div>
            <p className="mt-1 text-[10.5px] leading-snug text-steel">{step.goal}</p>
          </a>
        ))}
      </section>

      <div className="mt-6 space-y-5">
        {steps.map((step) => (
          <section key={step.id} id={`passo-${step.id}`} className="card p-4 lg:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-signal/40 bg-signal/10 font-mono text-[12px] text-signal">
                {step.id}
              </span>
              <div>
                <h2 className="font-display text-[17px] font-semibold text-white">{step.title}</h2>
                <p className="text-[11px] text-steel">{step.goal}</p>
              </div>
              <span className="ml-auto chip">{step.time}</span>
            </div>

            <ol className="mt-3 space-y-1.5">
              {step.body.map((line, index) => (
                <li key={line} className="flex gap-2 text-[12.5px] leading-relaxed text-silver">
                  <span className="font-mono text-[10px] text-signal">{String(index + 1).padStart(2, "0")}</span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>

            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {step.code.map((block) => (
                <CodeBlock key={block.title} title={block.title} code={block.code} />
              ))}
            </div>

            {step.links.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/40 pt-2.5">
                <span className="label-mono">Links úteis</span>
                {step.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="chip hover:border-signal/60 hover:text-signal"
                  >
                    {link.label} ↗
                  </a>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>

      <section className="card mt-5 p-4 lg:p-5">
        <div className="label-mono text-signal">Antes de divulgar</div>
        <h2 className="font-display text-[17px] font-semibold text-white">Checklist de go-live</h2>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {checklist.map((item) => (
            <li key={item} className="flex gap-2 text-[12px] leading-relaxed text-silver">
              <span className="text-armed">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 rounded-lg border border-amber/40 bg-amber/5 p-3 text-[11.5px] leading-relaxed text-silver">
          <b className="text-amber">Atenção com dados reais:</b> este app não tem autenticação. Antes de publicar com
          propostas de clientes, ative o Deployment Protection na Vercel (Password Protection ou Vercel Authentication) ou
          implemente login. O repositório deve permanecer privado.
        </div>
      </section>

      <section className="card mt-4 p-4 lg:p-5">
        <div className="label-mono text-signal">Socorro</div>
        <h2 className="font-display text-[17px] font-semibold text-white">Problemas comuns no deploy</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-[12px]">
            <thead>
              <tr className="bg-navy/50 font-mono text-[9px] uppercase tracking-[0.14em] text-steel">
                <th className="px-3 py-2">Sintoma</th>
                <th className="px-3 py-2">Como resolver</th>
              </tr>
            </thead>
            <tbody>
              {troubleshooting.map((row) => (
                <tr key={row.problem} className="border-t border-line/40 text-silver">
                  <td className="px-3 py-2 align-top text-[11.5px] font-medium text-white">{row.problem}</td>
                  <td className="px-3 py-2 text-[11.5px] leading-snug text-steel">{row.fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card mt-4 p-4 lg:p-5">
        <div className="label-mono text-signal">Comandos do dia a dia</div>
        <h2 className="font-display text-[17px] font-semibold text-white">Depois de publicado</h2>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          <CodeBlock
            title="Ciclo de alteração"
            code={`git add .
git commit -m "fix: ajuste na proposta completa"
git push            # a Vercel publica sozinha

# banco: novas colunas/tabelas
npx drizzle-kit push`}
          />
          <CodeBlock
            title="Rodar localmente com o banco de produção (com cuidado)"
            code={`# use a string SEM -pooler para migrações
export DATABASE_URL="postgresql://...@ep-xxxx.sa-east-1.aws.neon.tech/neondb?sslmode=require"
npm run dev

# abra http://localhost:3000/api/health`}
          />
        </div>
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/60 bg-navy/30 p-4">
        <div>
          <div className="font-display text-[13.5px] font-semibold text-white">Tudo pronto para publicar</div>
          <p className="text-[11.5px] text-steel">
            Arquivos de marca para download: <code className="text-signal">/logo-cipriano.svg</code> e{" "}
            <code className="text-signal">/logo-cipriano-mark.svg</code>.
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/logo-cipriano.svg" download className="btn py-1.5 text-[11.5px]">
            Baixar logo
          </a>
          <Link href="/propostas/nova" className="btn btn-primary py-1.5 text-[11.5px]">
            Gerar proposta
          </Link>
        </div>
      </div>
    </div>
  );
}
