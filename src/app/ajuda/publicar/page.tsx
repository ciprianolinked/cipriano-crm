import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { DeploymentChecklist } from "@/components/DeploymentChecklist";
import { GuideCopyButton } from "@/components/GuideCopyButton";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, FileIcon, SparklesIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Como publicar o aplicativo · Ajuda Gerencial",
  description: "Passo a passo para levar o aplicativo Gerencial ao GitHub, conectar o banco Neon e publicar na Vercel com segurança.",
};

type GuideStepProps = {
  id: string;
  number: string;
  service: string;
  title: string;
  description: string;
  children: ReactNode;
};

function GuideStep({ id, number, service, title, description, children }: GuideStepProps) {
  return (
    <section id={id} className="scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className="flex items-start gap-4 border-b border-line px-5 py-5 sm:px-7">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-[15px] font-bold text-brand">{number}</span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-dark">{service}</p>
          <h2 className="font-display mt-1 text-[19px] leading-tight text-ink sm:text-[21px]">{title}</h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">{description}</p>
        </div>
      </div>
      <div className="space-y-5 px-5 py-5 text-[13px] leading-relaxed text-slate-600 sm:px-7 sm:py-6">{children}</div>
    </section>
  );
}

function Substep({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-paper text-[11px] font-bold text-ink">{number}</span>
      <div className="min-w-0 flex-1">
        <h3 className="font-bold text-ink">{title}</h3>
        <div className="mt-1 leading-relaxed text-slate-600">{children}</div>
      </div>
    </div>
  );
}

function ExternalLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}<span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}

const questions = [
  {
    q: "Onde encontro os arquivos do aplicativo?",
    a: "Você precisa do código-fonte, não apenas do link de visualização. No ambiente onde o aplicativo foi criado, procure uma opção de exportar/baixar o projeto ou de sincronizar com o GitHub. Depois descompacte o arquivo ZIP no computador. Se já houver um repositório com o código completo, use-o e comece pela etapa do Neon. Se sua plataforma não oferecer essas opções, consulte a documentação ou o suporte dela.",
  },
  {
    q: "Criei o banco, mas não vejo os mapas que já tinha. O que aconteceu?",
    a: "Um projeto novo no Neon cria um banco novo e vazio. Publicar o código não transfere automaticamente os mapas do ambiente anterior. Para manter dados já existentes, faça uma migração ou restauração de backup entre os bancos antes de começar a usar o novo endereço. Não apague o banco antigo até conferir os dados no novo.",
  },
  {
    q: "O site abre, mas aparece erro de banco ou não consigo salvar.",
    a: "Na Vercel, confira se DATABASE_URL está em Production e contém a conexão completa do Neon, incluindo sslmode. Depois faça Redeploy. No Neon, confirme que executou o SQL deste guia na mesma branch e no mesmo banco selecionados na conexão. O teste /api/health confirma a conexão, mas sozinho não confirma a existência das tabelas.",
  },
  {
    q: "A IA demorou mesmo com arquivos pequenos. Por quê?",
    a: "O tempo depende do conteúdo, do número de páginas e da disponibilidade do Google, não apenas dos kilobytes do arquivo. A versão atual aguarda por mais tempo e mantém os arquivos selecionados em caso de falha. Se persistir após publicar a atualização, confira o status e os limites do Gemini no Google AI Studio e os logs da Vercel. O projeto usa Fluid Compute para permitir análises mais longas.",
  },
  {
    q: "Apareceu o erro 413 ao enviar um PDF. Como resolvo?",
    a: "A Vercel limita o tamanho total de uma requisição a 4,5 MB. Comprima ou reduza os PDFs e imagens para manter toda a seleção abaixo de 4 MB, com margem para o formulário. O limite é para todos os arquivos enviados juntos. Atenção: aplicar uma nova análise substitui os itens e fornecedores atuais; ela não junta automaticamente resultados de envios separados.",
  },
  {
    q: "Os arquivos originais das propostas ficam guardados no Neon?",
    a: "Não. Na versão atual, o aplicativo registra os dados do mapa e informações dos anexos, como o nome; os arquivos PDF e de imagem não são arquivados para download. Mantenha os originais em um local seguro e autorizado pela empresa. A leitura por IA envia os arquivos ao provedor de IA configurado.",
  },
  {
    q: "Se eu mudar o código, preciso publicar tudo de novo?",
    a: "Depois que o projeto estiver conectado, envie suas alterações para o GitHub. Na branch de produção (geralmente main), a Vercel cria uma nova publicação automaticamente. Mudanças de variáveis de ambiente exigem um novo deploy. Alterações na estrutura do banco podem exigir migração separada; o SQL inicial não atualiza tabelas já existentes.",
  },
  {
    q: "Posso guardar senhas no GitHub privado ou mandar por mensagem?",
    a: "Não. A conexão do Neon contém senha e deve ser tratada como segredo, mesmo se o repositório for privado. Use as variáveis Secret da Vercel. Se uma senha ou chave for exposta, substitua ou revogue-a no serviço correspondente e atualize a configuração na Vercel.",
  },
];

export default function PublicarAjudaPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-[1200px] px-4 pb-20 pt-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 text-[11.5px] font-semibold text-slate-500">
          <Link href="/ajuda" className="inline-flex items-center gap-1.5 hover:text-ink">
            <ArrowLeftIcon className="h-3.5 w-3.5" /> Central de ajuda
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-ink">Publicar o aplicativo</span>
        </div>

        <section className="relative mt-4 overflow-hidden rounded-2xl bg-ink px-6 py-8 text-white sm:px-9 sm:py-10">
          <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full border-[52px] border-brand/10" />
          <div className="relative max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-brand">
              <FileIcon className="h-3.5 w-3.5" /> Guia de publicação · do zero
            </p>
            <h1 className="font-display mt-4 max-w-[720px] text-[29px] leading-[1.1] sm:text-[38px]">
              Seu aplicativo na internet, passo a passo.
            </h1>
            <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-white/70 sm:text-[14px]">
              Vamos guardar o código no GitHub, criar o banco no Neon e publicar na Vercel. Não é necessário programar:
              siga as etapas na ordem e marque o que já concluiu.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] font-bold">
              <a href="#github" className="rounded-lg bg-white/10 px-3 py-2 text-white hover:bg-white/15">01 · GitHub</a>
              <ArrowRightIcon className="h-3.5 w-3.5 text-brand/70" />
              <a href="#neon" className="rounded-lg bg-white/10 px-3 py-2 text-white hover:bg-white/15">02 · Neon</a>
              <ArrowRightIcon className="h-3.5 w-3.5 text-brand/70" />
              <a href="#vercel" className="rounded-lg bg-white/10 px-3 py-2 text-white hover:bg-white/15">03 · Vercel</a>
              <ArrowRightIcon className="h-3.5 w-3.5 text-brand/70" />
              <a href="#seguranca" className="rounded-lg bg-brand px-3 py-2 text-ink-deep hover:bg-[#ffc14d]">04 · Proteger</a>
            </div>
          </div>
        </section>

        <div className="mt-5 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 sm:px-5">
          <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-[15px] font-extrabold text-amber-800">!</span>
          <div>
            <p className="text-[13px] font-bold text-amber-950">Importante antes de publicar</p>
            <p className="mt-1 text-[12px] leading-relaxed text-amber-900">
              Esta versão <strong>ainda não tem login próprio nem permissões por usuário</strong>. Quem conseguir acessar o endereço pode
              consultar, alterar e excluir mapas e configurações. Não use dados reais até proteger <strong>todos os endereços</strong> na Vercel
              ou implementar autenticação. Um repositório privado, por si só, não protege o site.
            </p>
            <a href="#seguranca" className="mt-2 inline-block text-[11.5px] font-bold text-amber-950 underline underline-offset-2">Ver como proteger o acesso ↓</a>
          </div>
        </div>

        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-5">
            <section id="preparacao" className="scroll-mt-24 rounded-2xl border border-line bg-white px-5 py-5 shadow-sm sm:px-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-dark">Antes de começar</p>
              <h2 className="font-display mt-1 text-[20px] text-ink">Separe o que você vai precisar</h2>
              <p className="mt-2 text-[12.5px] leading-relaxed text-slate-600">
                Use um computador com internet, cerca de 30 a 60 minutos e um e-mail ao qual você tenha acesso.
                Você criará contas nos três serviços durante o processo.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {[
                  { name: "Código-fonte do aplicativo", detail: "Pasta com package.json, src e public." },
                  { name: "GitHub", detail: "Guarda o código e suas atualizações." },
                  { name: "Neon", detail: "Guarda mapas e dados dos condomínios." },
                  { name: "Vercel", detail: "Publica o aplicativo em um endereço." },
                ].map((item) => (
                  <div key={item.name} className="flex items-start gap-2.5 rounded-lg bg-paper px-3 py-3">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-dark"><CheckIcon className="h-3 w-3" /></span>
                    <div><p className="text-[12px] font-bold text-ink">{item.name}</p><p className="mt-0.5 text-[11px] leading-snug text-slate-500">{item.detail}</p></div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-line px-3.5 py-3 text-[12px] leading-relaxed text-slate-600">
                <strong className="text-ink">Primeiro, obtenha os arquivos:</strong> no ambiente onde o app foi criado,
                procure uma opção para exportar/baixar o código ou sincronizar com o GitHub. Se baixar um ZIP, descompacte-o.
                Abra a pasta e verifique se nela há <code className="font-bold text-ink">package.json</code>, <code className="font-bold text-ink">src</code> e <code className="font-bold text-ink">public</code>.
                Copiar apenas o endereço do site não copia o projeto. Se já tiver um repositório com estes arquivos, pule para o Neon.
              </div>
            </section>

            <GuideStep id="github" number="01" service="Etapa 1 · GitHub" title="Guarde o código em um repositório" description="O GitHub organiza os arquivos do aplicativo. Usaremos o GitHub Desktop para fazer isso com cliques, sem terminal.">
              <Substep number="1" title="Crie sua conta e instale o GitHub Desktop">
                <p>Acesse <ExternalLink href="https://github.com/signup" className="font-bold text-brand-dark underline underline-offset-2">github.com/signup</ExternalLink>, crie sua conta e confirme o e-mail. Depois baixe e instale o <ExternalLink href="https://desktop.github.com/" className="font-bold text-brand-dark underline underline-offset-2">GitHub Desktop</ExternalLink> para Windows ou macOS e entre com essa conta.</p>
              </Substep>
              <Substep number="2" title="Adicione a pasta do aplicativo">
                <p>No GitHub Desktop, clique em <strong>File → Add Local Repository → Choose</strong>. Selecione a pasta que contém o <strong>package.json</strong> e clique em <strong>Add Repository</strong>. Se o programa informar que a pasta ainda não é um repositório Git, escolha a opção oferecida para <strong>criar um repositório ali</strong> e confirme a mesma pasta.</p>
              </Substep>
              <Substep number="3" title="Confira os arquivos antes de enviar">
                <p>Na lista <strong>Changes</strong>, confira o código e as pastas <strong>src</strong> e <strong>public</strong>. O projeto inclui um arquivo <strong>.gitignore</strong> para não enviar <strong>.env</strong>, <strong>node_modules</strong> e <strong>.next</strong>. Se algum arquivo de senha aparecer na lista, não publique até removê-lo da seleção e proteger a credencial.</p>
              </Substep>
              <Substep number="4" title="Registre e publique a primeira versão">
                <p>Se houver alterações, escreva <strong>Primeira versão Gerencial</strong> em Summary e clique em <strong>Commit to main</strong>. Clique em <strong>Publish repository</strong>, escolha um nome como <strong>gerencial-mapa-cotacao</strong>, mantenha <strong>Keep this code private</strong> marcado e confirme em <strong>Publish Repository</strong>.</p>
              </Substep>
              <Substep number="5" title="Confira no site do GitHub">
                <p>Abra seu repositório em <strong>github.com</strong>. A página inicial deve mostrar <strong>package.json</strong>, <strong>package-lock.json</strong>, <strong>src</strong>, <strong>public</strong> e o arquivo de configuração do projeto. Guarde esse repositório para importá-lo na Vercel.</p>
              </Substep>
              <div className="rounded-lg bg-brand-soft px-4 py-3 text-[12px] text-amber-900">
                <strong>Segurança:</strong> nunca envie sua chave do Gemini nem a URL real do banco para o GitHub. O .gitignore ajuda, mas não remove segredos que já tenham sido enviados anteriormente.
              </div>
              <div className="flex flex-wrap gap-2">
                <ExternalLink href="https://github.com/signup" className="btn btn-primary">Abrir GitHub <ArrowRightIcon className="h-3.5 w-3.5" /></ExternalLink>
                <ExternalLink href="https://docs.github.com/en/desktop/adding-and-cloning-repositories/adding-an-existing-project-to-github-using-github-desktop" className="btn btn-ghost">Documentação do GitHub Desktop ↗</ExternalLink>
              </div>
            </GuideStep>

            <GuideStep id="neon" number="02" service="Etapa 2 · Neon" title="Crie o banco de dados" description="O Neon oferece PostgreSQL na nuvem. É lá que os mapas e os dados dos condomínios serão armazenados.">
              <Substep number="1" title="Crie a conta e o projeto">
                <p>Acesse <ExternalLink href="https://console.neon.tech/" className="font-bold text-brand-dark underline underline-offset-2">console.neon.tech</ExternalLink> e crie uma conta. No painel, clique em <strong>New Project</strong>, informe um nome como <strong>gerencial-cotacoes</strong>, escolha uma região próxima da região usada na Vercel quando possível e confirme em <strong>Create Project</strong>.</p>
              </Substep>
              <Substep number="2" title="Copie a conexão do banco">
                <p>Dentro do projeto, clique em <strong>Connect</strong>. Selecione a branch principal (pode se chamar <strong>production</strong> ou <strong>main</strong>), o banco padrão <strong>neondb</strong> e a função/usuário apresentado. Deixe <strong>Connection pooling</strong> ativado e copie a <strong>connection string</strong>.</p>
              </Substep>
              <Substep number="3" title="Guarde essa conexão com cuidado">
                <p>É um endereço longo que começa com <code className="font-bold text-ink">postgresql://</code> e inclui usuário, senha, servidor e <code className="font-bold text-ink">sslmode=require</code>. Copie a URL inteira, sem acrescentar <code>DATABASE_URL=</code>, aspas ou o comando <code>psql</code>. Vamos colá-la como segredo na Vercel.</p>
              </Substep>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
                <strong>Não compartilhe essa URL:</strong> ela funciona como uma senha do banco. Um banco novo começa vazio; os dados da visualização anterior não são transferidos automaticamente.
              </div>
              <ExternalLink href="https://console.neon.tech/" className="btn btn-primary">Abrir Neon <ArrowRightIcon className="h-3.5 w-3.5" /></ExternalLink>
            </GuideStep>

            <GuideStep id="tabelas" number="03" service="Etapa 3 · Neon SQL Editor" title="Prepare as tabelas do aplicativo" description="O Neon nasce com um banco vazio. Este passo cria as três tabelas que o aplicativo usa, sem inserir exemplos.">
              <Substep number="1" title="Abra o editor de SQL">
                <p>No projeto do Neon, vá em <strong>Postgres database → SQL Editor</strong>. No topo, selecione a <strong>mesma branch e o mesmo banco</strong> escolhidos em Connect. Apague qualquer texto de exemplo que aparecer no editor.</p>
              </Substep>
              <Substep number="2" title="Copie e execute a estrutura pronta">
                <p>Clique em <strong>Copiar estrutura do banco</strong> abaixo, volte ao editor do Neon e cole todo o conteúdo com Ctrl+V (Windows) ou Command+V (Mac). Clique em <strong>Run</strong> e aguarde a mensagem de sucesso. Não é necessário alterar o texto.</p>
              </Substep>
              <div className="rounded-xl border border-line bg-paper/70 p-4">
                <p className="text-[12px] font-bold text-ink">Arquivo pronto para a primeira instalação</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">Cria a estrutura inicial e não apaga dados nem inclui cotações fictícias.</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <GuideCopyButton label="Copiar estrutura do banco" fileUrl="/guia/estrutura-inicial.sql" />
                  <ExternalLink href="/guia/estrutura-inicial.sql" className="text-[11.5px] font-bold text-brand-dark underline underline-offset-2">Abrir arquivo e copiar manualmente ↗</ExternalLink>
                </div>
              </div>
              <Substep number="3" title="Confirme o resultado">
                <p>No menu do Neon, abra <strong>Tables</strong> e confira as tabelas <code className="font-bold text-ink">condominiums</code>, <code className="font-bold text-ink">quotations</code> e <code className="font-bold text-ink">app_settings</code>. Elas começam vazias. Se não aparecerem, atualize a página e confira a branch e o banco selecionados.</p>
              </Substep>
              <p className="rounded-lg border border-line px-4 py-3 text-[11.5px] text-slate-500">
                Este arquivo serve para a <strong>estrutura inicial de um banco novo</strong>. Se a estrutura do aplicativo mudar depois, será necessária uma migração; executá-lo novamente não modifica colunas já existentes. Para dados que já existam, faça backup antes de qualquer alteração no banco.
              </p>
            </GuideStep>

            <GuideStep id="vercel" number="04" service="Etapa 4 · Vercel" title="Publique o aplicativo" description="A Vercel irá buscar o código no GitHub, instalar as dependências e criar o endereço do aplicativo.">
              <Substep number="1" title="Crie a conta e prepare a proteção">
                <p>Acesse <ExternalLink href="https://vercel.com/signup" className="font-bold text-brand-dark underline underline-offset-2">vercel.com/signup</ExternalLink> e entre com a mesma conta GitHub. Para evitar um intervalo público, se disponível, configure na equipe a proteção padrão <strong>Vercel Authentication → All Deployments</strong> antes de criar o projeto. Não coloque dados reais enquanto o acesso não estiver protegido.</p>
              </Substep>
              <Substep number="2" title="Importe o projeto do GitHub">
                <p>No painel da Vercel, clique em <strong>Add New → Project</strong>. Conecte e autorize o GitHub, encontre <strong>gerencial-mapa-cotacao</strong> e clique em <strong>Import</strong>. Se ele não aparecer, revise as permissões da integração para esse repositório.</p>
              </Substep>
              <Substep number="3" title="Confira as opções do projeto">
                <p>O <strong>Framework Preset</strong> deve ser <strong>Next.js</strong>. Em <strong>Root Directory</strong>, selecione a pasta que contém o package.json; se ele estiver na raiz do repositório, mantenha o padrão. Deixe instalação e build automáticos. Se for solicitado escolher Node.js, use uma versão compatível, como <strong>22.x</strong>.</p>
              </Substep>
              <Substep number="4" title="Adicione a conexão do Neon como segredo">
                <p>Na seção <strong>Environment Variables</strong>, adicione a variável abaixo. Cole como valor a connection string completa que você copiou no Neon. Escolha o tipo <strong>Secret</strong>, quando disponível, e o ambiente <strong>Production</strong>. Não use o prefixo NEXT_PUBLIC para segredos.</p>
              </Substep>
              <div className="overflow-hidden rounded-xl border border-line">
                <div className="grid gap-3 bg-paper/70 px-4 py-3 sm:grid-cols-[160px_1fr]">
                  <div><p className="label">Nome / Key</p><code className="mt-1 block text-[12px] font-bold text-ink">DATABASE_URL</code></div>
                  <div><p className="label">Valor / Value</p><p className="mt-1 text-[12px] text-slate-600">Cole a URL privada do Neon, começando com <code>postgresql://</code>.</p></div>
                </div>
                <div className="border-t border-line px-4 py-2.5"><GuideCopyButton label="Copiar nome da variável" value="DATABASE_URL" className="btn btn-ghost !py-1.5" /></div>
              </div>
              <Substep number="5" title="Inicie a publicação">
                <p>Clique em <strong>Deploy</strong> e aguarde. Quando a Vercel mostrar <strong>Ready</strong>, abra o endereço terminado em <strong>vercel.app</strong>. Ele ainda deve ser considerado um teste até a proteção da etapa seguinte estar ativa.</p>
              </Substep>
              <div className="rounded-lg bg-brand-soft px-4 py-3 text-[12px] text-amber-900">
                <strong>Ambientes de teste:</strong> não coloque a URL do banco real em Preview. Se quiser usar prévias, crie uma branch ou banco separado no Neon e configure outra DATABASE_URL só para Preview.
              </div>
              <ExternalLink href="https://vercel.com/new" className="btn btn-primary">Abrir Vercel e importar projeto <ArrowRightIcon className="h-3.5 w-3.5" /></ExternalLink>
            </GuideStep>

            <GuideStep id="seguranca" number="05" service="Etapa 5 · Segurança" title="Proteja todos os endereços" description="Faça isso antes de inserir cotações, dados de clientes ou chaves de IA no aplicativo publicado.">
              <Substep number="1" title="Abra Deployment Protection">
                <p>No projeto da Vercel, abra <strong>Settings → Deployment Protection</strong> (em algumas telas, procure a seção <strong>Security</strong>). Ative <strong>Vercel Authentication</strong>, escolha <strong>All Deployments</strong> e salve.</p>
              </Substep>
              <Substep number="2" title="Verifique produção e prévias">
                <p><strong>All Deployments</strong> protege também o domínio de produção; <strong>Standard Protection</strong> deixa os domínios de produção abertos. Não crie exceções públicas. Abra o endereço principal e os de prévia em uma janela anônima: devem exigir uma conta Vercel autorizada antes de mostrar o aplicativo.</p>
              </Substep>
              <Substep number="3" title="Autorize somente quem precisa trabalhar no app">
                <p>Na Vercel, conceda acesso apenas às pessoas necessárias e confirme o que seu plano permite. A proteção da Vercel limita a entrada no site, mas <strong>não cria permissões individuais dentro do aplicativo</strong>: usuários autorizados continuam compartilhando o mesmo acesso aos mapas.</p>
              </Substep>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
                <strong>Teste em uma janela anônima.</strong> Se o painel abrir sem autenticação em qualquer domínio, não envie dados reais. Repositório privado, link difícil de adivinhar ou proteção apenas das prévias não substituem controle de acesso.
              </div>
              <ExternalLink href="https://vercel.com/docs/deployment-protection" className="btn btn-ghost">Consultar proteção da Vercel ↗</ExternalLink>
            </GuideStep>

            <GuideStep id="testar" number="06" service="Etapa 6 · Conferência" title="Teste e conecte a IA" description="Depois de proteger o acesso, confira a conexão e só então comece a usar o aplicativo.">
              <Substep number="1" title="Teste a conexão com o banco">
                <p>Entre no aplicativo com seu acesso autorizado e abra, no mesmo navegador, o seu endereço seguido de <code className="font-bold text-ink">/api/health</code>. O resultado esperado é <code className="font-bold text-ink">{`{"ok":true}`}</code>. Isso confirma a conexão, mas não verifica se todas as tabelas existem.</p>
              </Substep>
              <Substep number="2" title="Confira a tabela de mapas">
                <p>Abra também o endereço seguido de <code className="font-bold text-ink">/api/quotations</code>. Em um banco novo, você deverá ver uma resposta com uma lista vazia de mapas. Se houver erro, volte ao SQL Editor, confira as tabelas e se a URL na Vercel aponta para o mesmo banco.</p>
              </Substep>
              <Substep number="3" title="Configure a IA, se desejar">
                <p>A leitura de PDFs e fotos é opcional. Após proteger o site, siga o guia de IA para obter a chave do Gemini. Na Vercel, você pode cadastrar <code className="font-bold text-ink">GEMINI_API_KEY</code> como <strong>Secret</strong> em Production. Depois de adicionar ou alterar uma variável, abra <strong>Deployments</strong>, selecione o último deploy e clique em <strong>Redeploy</strong>.</p>
                <p className="mt-2">Se houver uma chave salva anteriormente pelo painel <strong>Configurar IA</strong>, ela tem prioridade sobre a variável de ambiente. Remova a chave antiga do painel para usar a chave definida na Vercel.</p>
              </Substep>
              <Substep number="4" title="Verifique se consegue salvar">
                <p>Com o acesso protegido, crie um mapa com identificação de teste, salve e recarregue a página para confirmar que ele foi guardado. Depois exclua esse mapa. O nome do condomínio de teste permanece cadastrado; se quiser removê-lo, no Neon abra <strong>Tables → condominiums</strong> e exclua apenas a linha de teste, sem alterar outras linhas.</p>
              </Substep>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
                <strong>Privacidade:</strong> nos serviços gratuitos do Gemini, o Google informa que pode usar conteúdo enviado e respostas para melhorar seus produtos e que revisores podem processá-los. Não envie informações sensíveis, pessoais ou confidenciais ao serviço gratuito; avalie os termos, a LGPD e uma opção adequada para dados reais.
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/ajuda/ia" className="btn btn-brand"><SparklesIcon className="h-4 w-4" /> Abrir guia de IA</Link>
                <ExternalLink href="https://ai.google.dev/gemini-api/terms" className="btn btn-ghost">Ver termos do Google ↗</ExternalLink>
              </div>
            </GuideStep>

            <section id="custos" className="scroll-mt-24 rounded-2xl border border-line bg-white px-5 py-5 shadow-sm sm:px-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-dark">Antes de contratar</p>
              <h2 className="font-display mt-1 text-[20px] text-ink">Sobre custos e limites</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-paper px-4 py-3"><h3 className="text-[12px] font-bold text-ink">GitHub e Neon</h3><p className="mt-1 text-[11.5px] leading-relaxed text-slate-600">Oferecem opções gratuitas com recursos e limites próprios. Confira os planos vigentes e monitore o uso do banco; condições podem mudar.</p></div>
                <div className="rounded-xl bg-brand-soft px-4 py-3"><h3 className="text-[12px] font-bold text-ink">Vercel para a empresa</h3><p className="mt-1 text-[11.5px] leading-relaxed text-slate-600">O plano gratuito Hobby é destinado a uso pessoal não comercial. Para uso comercial da empresa, confira os planos Pro/Enterprise e seus custos antes de publicar.</p></div>
              </div>
              <p className="mt-3 text-[11.5px] text-slate-500">O Gemini tem cota gratuita sujeita a limites e condições. Um domínio próprio e recursos extras podem ter custo. Consulte os preços diretamente em cada serviço.</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11.5px] font-bold text-brand-dark">
                <ExternalLink href="https://github.com/pricing" className="underline underline-offset-2">Planos GitHub ↗</ExternalLink>
                <ExternalLink href="https://neon.com/pricing" className="underline underline-offset-2">Planos Neon ↗</ExternalLink>
                <ExternalLink href="https://vercel.com/docs/limits/fair-use-guidelines" className="underline underline-offset-2">Regras da Vercel ↗</ExternalLink>
                <ExternalLink href="https://ai.google.dev/gemini-api/docs/pricing" className="underline underline-offset-2">Preços Gemini ↗</ExternalLink>
              </div>
            </section>

            <section id="duvidas" className="scroll-mt-24">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-dark">Ainda precisa de ajuda?</p>
              <h2 className="font-display mt-1 text-[21px] text-ink">Dúvidas e soluções</h2>
              <div className="mt-3 space-y-2">
                {questions.map((entry) => (
                  <details key={entry.q} className="group rounded-xl border border-line bg-white px-5 py-4 shadow-sm">
                    <summary className="cursor-pointer list-none text-[13px] font-bold text-ink [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center justify-between gap-4">{entry.q}<span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-dark group-open:rotate-45">+</span></span>
                    </summary>
                    <p className="mt-3 border-t border-line pt-3 text-[12px] leading-relaxed text-slate-600">{entry.a}</p>
                  </details>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20">
            <DeploymentChecklist />
            <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-dark">Um lembrete importante</p>
              <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
                O guia orienta os passos, mas não cria suas contas nem publica o projeto automaticamente. As telas dos serviços podem mudar com o tempo.
              </p>
            </section>
            <section className="rounded-2xl bg-ink p-5 text-white">
              <SparklesIcon className="h-5 w-5 text-brand" />
              <h2 className="mt-2 text-[14px] font-bold">Próximo passo: IA</h2>
              <p className="mt-1 text-[11.5px] leading-relaxed text-white/65">Após proteger o site, veja como configurar e testar o Gemini.</p>
              <Link href="/ajuda/ia" className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-bold text-brand hover:underline">Ver guia de IA <ArrowRightIcon className="h-3.5 w-3.5" /></Link>
            </section>
          </aside>
        </div>

        <div className="mt-9 border-t border-line pt-5 text-center text-[11px] leading-relaxed text-slate-400">
          Gerencial · Guia baseado na documentação oficial do GitHub, Neon, Vercel e Google. Consulte sempre as condições atuais dos serviços.
        </div>
      </main>
    </AppShell>
  );
}
