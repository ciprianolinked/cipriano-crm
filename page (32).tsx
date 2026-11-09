import Link from "next/link";
import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ArrowRight, CircleAlert, Database, Download, ExternalLink, ShieldCheck } from "lucide-react";
import { CodeBlock } from "@/components/ui/CopyButton";
import { Logo } from "@/components/ui/Logo";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Guia de publicação e SQL do Neon | Cipriano Tech & Security",
  description: "Publique o aplicativo com GitHub, Neon e Vercel. Copie o SQL completo, configure DATABASE_URL e diagnostique erros de produção.",
};

// Lido durante o build estático: o guia não consulta o banco para abrir.
const neonSql = readFileSync(join(process.cwd(), "public/neon-setup.sql"), "utf8");

const steps = [
  {
    id: "01", title: "Envie o código ao GitHub", time: "~10 min",
    items: [
      "Crie um repositório privado no GitHub. Confirme que .gitignore e .env.example estão presentes, mas que nenhuma senha real foi commitada.",
      "O upload pelo navegador aceita no máximo 100 arquivos por envio. Esta pasta tem 111 arquivos de código e mais de 33 mil em node_modules — por isso o GitHub responde “Nossa, isso é muito arquivo”. Publique por Git, que não tem esse limite.",
      "Rode ./scripts/publicar-github.sh com a URL do repositório. O script confere o .gitignore (node_modules, .next e .env ficam de fora), faz o commit e envia. Também pede nome e e-mail do Git na primeira execução.",
      "Se preferir, use os comandos manuais abaixo ou o GitHub Desktop. Pela web, envie pasta por pasta: raiz (11), public (3), drizzle (5), scripts (1), src/db (2), src/lib (15), src/components (28) e src/app (46).",
    ],
    code: `# Recomendado: um comando, sem limite de arquivos\n./scripts/publicar-github.sh https://github.com/SEU-USUARIO/cipriano-propostas.git\n\n# Com Personal Access Token (opcional)\nGITHUB_TOKEN=ghp_XXXX ./scripts/publicar-github.sh https://github.com/SEU-USUARIO/cipriano-propostas.git\n\n# Manual, se preferir\ngit init -b main\ngit add .\ngit commit -m "feat: central de propostas, CRM e contratos"\ngit remote add origin https://github.com/SEU-USUARIO/cipriano-propostas.git\ngit push -u origin main`,
    links: [{ label: "Criar repositório", href: "https://github.com/new" }, { label: "GitHub Desktop", href: "https://desktop.github.com" }],
  },
  {
    id: "02", title: "Prepare o banco no Neon", time: "~10 min",
    items: [
      "Em console.neon.tech, crie ou abra o projeto. Selecione o branch de produção e o database que o site deve usar. O painel do Neon já cria o database e o usuário; não coloque senhas dentro do SQL.",
      "Abra SQL Editor, confira branch e database no seletor e cole TODO o arquivo neon-setup.sql abaixo. Clique em Run. O resultado final deve informar 10 tabelas do aplicativo.",
      "O script cria a estrutura ausente, complementa campos de versões anteriores e não apaga registros. Não execute DROP, DELETE ou TRUNCATE para tentar corrigir o site.",
      "Depois, abra Connect no Neon, selecione Node.js / connection string e copie a conexão pooled (host com -pooler). Guarde-a para DATABASE_URL; não publique essa string em prints ou no GitHub.",
    ],
    code: `postgresql://USUARIO:SENHA@SEU-ENDPOINT-pooler.REGIAO.aws.neon.tech/SEU_DATABASE?sslmode=require`,
    links: [{ label: "Console Neon", href: "https://console.neon.tech" }, { label: "SQL Editor · documentação", href: "https://neon.com/docs/get-started/query-with-neon-sql-editor" }],
  },
  {
    id: "03", title: "Conecte e republique na Vercel", time: "~8 min",
    items: [
      "Abra o projeto na Vercel → Settings → Environment Variables. Adicione ou edite DATABASE_URL e cole a conexão do mesmo branch/database em que você executou o SQL.",
      "Marque Production. Para Preview, prefira um branch/database de teste do Neon; não compartilhe dados reais de produção sem necessidade. Não use o prefixo NEXT_PUBLIC_ nessa variável.",
      "Confira Framework Preset = Next.js, Node.js = 22.x e Build Command = npm run build. Deixe o output ser detectado pelo preset Next.js.",
      "Salve a variável e faça um NOVO deployment em Deployments → menu do deployment → Redeploy. Se a opção estiver disponível, desmarque o reuso do build cache. Alterar a variável não corrige o deployment antigo.",
      "Quando o novo deployment estiver ativo, abra a URL de produção e /api/health. O JSON deve mostrar ok: true e code: ready. Um deploy verde, sozinho, não comprova que o banco foi conectado.",
    ],
    code: `# Nome da variável (servidor, nunca pública)\nDATABASE_URL\n\n# Valor: cole a string real copiada do Neon\n# Ambiente: Production\n\n# Opcional, para recursos de IA\nOPENAI_API_KEY`,
    links: [{ label: "Variáveis de ambiente", href: "https://vercel.com/docs/environment-variables/managing-environment-variables" }, { label: "Importar projeto", href: "https://vercel.com/docs/getting-started-with-vercel/import" }],
  },
  {
    id: "04", title: "Valide e conecte seu domínio", time: "~10 min + DNS",
    items: [
      "Use Visit ou abra a URL de produção diretamente, fora da miniatura da tela de deploy. Teste /diagnostico, o painel, o CRM e a criação de uma proposta real.",
      "Em Settings → Domains, adicione seu domínio e configure o registro DNS mostrado pela Vercel no provedor do domínio. Aguarde a validação e a emissão do HTTPS.",
      "Antes de cadastrar dados reais, restrinja o acesso ao aplicativo. Este painel ainda não possui login próprio: use uma proteção de acesso da Vercel disponível no seu plano ou implemente autenticação.",
    ],
    code: `# Exemplo de subdomínio (confirme o valor no painel da Vercel)\nTipo: CNAME\nNome: propostas\nValor: cname.vercel-dns.com`,
    links: [{ label: "Domínios na Vercel", href: "https://vercel.com/docs/domains/working-with-domains" }],
  },
];

const failures = [
  ["GitHub: “Nossa, isso é muito arquivo”", "O navegador aceita no máximo 100 arquivos por envio e node_modules tem dezenas de milhares. Não arraste a pasta inteira: use ./scripts/publicar-github.sh (ou git push / GitHub Desktop). Se usar a web, envie por pastas — raiz (11), public (3), drizzle (5), scripts (1), src/db (2), src/lib (15), src/components (28) e src/app (46)."],
  ["env_missing / env_invalid", "Adicione/corrija DATABASE_URL em Production e faça um novo deploy. O .env local não é enviado ao GitHub."],
  ["schema_missing / schema_incomplete", "Execute o SQL completo no mesmo branch e database da conexão. Depois abra /diagnostico e clique em Verificar conexão."],
  ["auth_failed / database_not_found", "Copie uma conexão atual do Neon. Confira usuário, senha, branch e nome do database."],
  ["unreachable / timeout / tls_error", "Use a conexão pooled do Neon, confira o projeto ativo e tente novamente. Não desative a validação SSL."],
  ["Deploy verde, página com erro", "Abra Deployments → deployment ativo → Runtime Logs e filtre por error. Compare com /api/health; não compartilhe logs que contenham credenciais."],
];

export default function PublishingGuidePage() {
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 lg:px-8 lg:py-8">
      <header className="border-b border-line/50 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><Logo height={44} /><Link href="/" className="btn py-1.5">← Voltar ao painel</Link></div>
        <div className="label-mono mt-7 text-signal">Documentação · versão atualizada</div>
        <h1 className="mt-2 font-display text-[clamp(1.8rem,3.5vw,2.5rem)] font-semibold leading-tight tracking-tight text-white">Guia de publicação do site completo</h1>
        <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-steel">GitHub para versionar, Neon para o PostgreSQL e Vercel para publicar. Agora com SQL completo para preparar o banco e diagnóstico para falhas de produção.</p>
        <div className="mt-4 flex flex-wrap gap-2"><span className="chip">Next.js 16</span><span className="chip">Node.js 22.x</span><span className="chip">PostgreSQL · Neon</span><span className="chip">10 tabelas · sem dados de exemplo</span></div>
      </header>

      <section className="mt-5 rounded-xl border border-amber/35 bg-amber/5 p-5">
        <div className="flex gap-3"><CircleAlert size={21} className="mt-0.5 shrink-0 text-amber" /><div><h2 className="font-display text-[16px] font-semibold text-white">Publicou na Vercel, mas a página não carrega?</h2><p className="mt-2 text-[12px] leading-relaxed text-silver">A imagem de erro não identifica sozinha a causa. O mais comum é a conexão de produção não estar configurada ou o SQL ainda não ter sido executado no banco correto. Siga esta ordem:</p><ol className="mt-3 space-y-1.5 text-[12px] text-silver"><li><b className="text-amber">1.</b> Execute o SQL no Neon → <b className="text-white">mesmo branch e database</b> da Vercel.</li><li><b className="text-amber">2.</b> Configure <code className="text-signal">DATABASE_URL</code> em Production.</li><li><b className="text-amber">3.</b> Faça um <b className="text-white">novo deploy</b> e teste <code className="text-signal">/api/health</code>.</li></ol><div className="mt-4 flex flex-wrap gap-2"><Link href="/diagnostico" className="btn btn-primary py-2">Verificar este deployment<ArrowRight size={14} /></Link><a href="#banco-neon-sql" className="btn py-2">Ir direto ao SQL</a></div></div></div>
      </section>

      <nav className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Etapas de publicação">{steps.map((step) => <a key={step.id} href={`#passo-${step.id}`} className="card p-4 transition hover:border-signal/50"><div className="flex justify-between"><span className="font-mono text-[10px] text-signal">{step.id}</span><span className="text-[10px] text-steel">{step.time}</span></div><h2 className="mt-2 font-display text-[13px] font-semibold text-white">{step.title}</h2></a>)}</nav>

      <section id="banco-neon-sql" className="card mt-6 scroll-mt-5 overflow-hidden">
        <div className="border-b border-line/50 p-5 lg:p-6"><div className="flex items-center gap-2 label-mono text-signal"><Database size={15} />Neon.tech · SQL Editor</div><h2 className="mt-2 font-display text-xl font-semibold text-white">Código completo para preparar o banco</h2><p className="mt-2 max-w-3xl text-[12.5px] leading-relaxed text-steel">Copia e executa no painel do Neon. Cria clientes, propostas, CRM, catálogo, configurações, contratos, revisões e índices econômicos. Também complementa a estrutura de uma instalação anterior.</p><div className="mt-4 flex flex-wrap gap-2"><a href="/neon-setup.sql" download className="btn btn-primary"><Download size={15} />Baixar neon-setup.sql</a><a href="https://console.neon.tech" target="_blank" rel="noopener noreferrer" className="btn">Abrir Neon<ExternalLink size={13} /></a></div></div>
        <div className="space-y-4 p-5 lg:p-6">
          <div className="grid gap-2 text-[12px] leading-relaxed text-silver sm:grid-cols-2"><p><b className="text-signal">01.</b> No Neon, selecione o projeto, branch e database de produção.</p><p><b className="text-signal">02.</b> Abra <b className="text-white">SQL Editor</b> e confira o database selecionado.</p><p><b className="text-signal">03.</b> Clique em <b className="text-white">Copiar SQL completo</b> abaixo, cole todo o conteúdo e pressione <b className="text-white">Run</b>.</p><p><b className="text-signal">04.</b> Confira o resultado: <b className="text-white">10 tabelas</b>. Depois teste o diagnóstico do site.</p></div>
          <div className="flex gap-2 rounded-lg border border-armed/25 bg-armed/5 p-3 text-[11.5px] leading-relaxed text-silver"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-armed" /><p><b className="text-armed">Sem DELETE, DROP ou TRUNCATE.</b> O script usa CREATE TABLE IF NOT EXISTS e ADD COLUMN IF NOT EXISTS. Ele não sobrescreve dados existentes. Ainda assim, faça um backup antes de alterar um banco em produção.</p></div>
          <details open className="overflow-hidden rounded-lg border border-line/60 bg-abyss2/60"><summary className="cursor-pointer select-none px-4 py-3 text-[12px] font-medium text-silver hover:text-white">Ver / ocultar código SQL completo <span className="ml-2 font-mono text-[9px] text-steel">POSTGRESQL · NEON</span></summary><div className="border-t border-line/50 p-3"><CodeBlock title="neon-setup.sql · copie o arquivo inteiro" language="SQL" code={neonSql} maxHeight={520} /></div></details>
          <p className="text-[11px] leading-relaxed text-steel">O projeto, o database e as credenciais são criados no painel do Neon. Este SQL cria a estrutura <b className="text-silver">dentro do database já selecionado</b>; não cria usuários nem insere propostas de exemplo. A identidade padrão só é inserida se ainda não existir.</p>
          <CodeBlock title="Conferência opcional · execute no SQL Editor" language="SQL" code={`SELECT current_database() AS database_atual;\n\nSELECT tablename\nFROM pg_tables\nWHERE schemaname = 'public'\nORDER BY tablename;`} />
        </div>
      </section>

      <div className="mt-6 space-y-5">{steps.map((step) => <section key={step.id} id={`passo-${step.id}`} className="card scroll-mt-5 p-5 lg:p-6"><div className="flex flex-wrap items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg border border-signal/35 bg-signal/10 font-mono text-[12px] text-signal">{step.id}</span><h2 className="font-display text-[17px] font-semibold text-white">{step.title}</h2><span className="ml-auto chip">{step.time}</span></div><ol className="mt-4 space-y-2.5">{step.items.map((item, index) => <li key={item} className="flex gap-3 text-[12.5px] leading-relaxed text-silver"><span className="mt-0.5 font-mono text-[10px] text-signal">{String(index + 1).padStart(2, "0")}</span><span>{item}</span></li>)}</ol><div className="mt-4"><CodeBlock title={step.id === "02" ? "Formato da conexão · exemplo sem credenciais" : "Comandos / configuração"} code={step.code} /></div><div className="mt-3 flex flex-wrap gap-2">{step.links.map((link) => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="chip hover:border-signal/60 hover:text-signal">{link.label} ↗</a>)}</div></section>)}</div>

      <section className="card mt-5 p-5 lg:p-6"><div className="label-mono text-signal">Diagnóstico rápido</div><h2 className="mt-1 font-display text-xl font-semibold text-white">O que cada resultado significa</h2><p className="mt-2 text-[12px] leading-relaxed text-steel">Abra <Link href="/diagnostico" className="text-signal hover:underline">/diagnostico</Link> ou <Link href="/api/health" className="text-signal hover:underline">/api/health</Link> na URL publicada. O diagnóstico não mostra senha, URL de conexão ou dados de clientes.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-[12px]"><thead><tr className="bg-navy/50 font-mono text-[9px] uppercase tracking-wider text-steel"><th className="px-3 py-2.5">Código / sintoma</th><th className="px-3 py-2.5">Ação recomendada</th></tr></thead><tbody>{failures.map(([code, action]) => <tr key={code} className="border-t border-line/40"><td className="px-3 py-3 align-top font-mono text-[11px] text-amber">{code}</td><td className="px-3 py-3 leading-relaxed text-silver">{action}</td></tr>)}</tbody></table></div></section>

      <section className="card mt-5 p-5"><div className="label-mono text-signal">Antes de usar com clientes</div><h2 className="mt-1 font-display text-lg font-semibold text-white">Checklist final</h2><ul className="mt-3 grid gap-2 text-[12px] leading-relaxed text-silver sm:grid-cols-2">{["SQL executado no branch/database correto; 10 tabelas encontradas.", "DATABASE_URL configurada em Production e novo deploy publicado.", "/api/health retornando ok: true e code: ready.", "Painel, CRM, catálogo e propostas abrindo sem erro.", "Credenciais fora do GitHub; acesso ao painel protegido antes de usar dados reais.", "Backup/restore do Neon configurado conforme seu plano."].map((item) => <li key={item} className="flex gap-2"><span className="text-armed">✓</span>{item}</li>)}</ul></section>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/60 bg-navy/30 p-4"><p className="text-[12px] text-steel">Depois de configurar e publicar novamente, volte ao painel.</p><Link href="/" className="btn btn-primary">Abrir meu aplicativo<ArrowRight size={14} /></Link></div>
    </div>
  );
}
