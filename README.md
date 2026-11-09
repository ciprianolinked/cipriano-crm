# Cipriano Tech & Security — Propostas, CRM e Contratos

Aplicação Next.js 16 com PostgreSQL/Drizzle, propostas e contratos em PDF A4, CRM, manutenção mensal e consulta de CNPJ.

## Erro do GitHub: “menos de 100 arquivos por vez”

Esse é um limite do **upload pelo navegador do GitHub**, não um limite do projeto nem da Vercel. Não arraste a pasta de instalação inteira: `node_modules` contém milhares de dependências que são instaladas novamente com `npm ci`.

Em **/guia-publicacao#github-upload** há duas formas de baixar o projeto limpo:

- **Upload pelo navegador:** baixe os dois ZIPs de lotes. Cada lote tem menos de 100 arquivos e deve ser enviado em um commit separado para o mesmo repositório. Importe na Vercel somente depois de enviar os dois.
- **GitHub Desktop ou terminal Git (recomendado):** baixe o ZIP completo, extraia e publique todos os arquivos em um único commit.

Os pacotes excluem dependências instaladas, builds, caches, arquivos `.env` e dados do banco. O manifesto do pacote lista os arquivos e seus hashes SHA-256.

**Extraia cada ZIP antes de publicar. Não envie o ZIP sozinho como se fosse o código do site.** O repositório deve ter `package.json`, `src/` e os demais arquivos na raiz.

### Opção recomendada: GitHub Desktop (sem limite de 100 arquivos do navegador)

1. Instale o GitHub Desktop e entre na sua conta.
2. Crie um repositório vazio no GitHub, de preferência privado.
3. Extraia o ZIP em uma pasta nova no computador.
4. No GitHub Desktop: **File → Add local repository** e selecione a pasta extraída. Se a opção aparecer, escolha **create a repository** para inicializar Git nessa pasta.
5. Confira os arquivos: não devem aparecer `node_modules`, `.next`, `.env` ou chaves privadas.
6. Faça o commit inicial e clique em **Publish repository**. Selecione o repositório/conta corretos e mantenha privado se necessário.
7. Importe o repositório na Vercel **depois que todos os arquivos estiverem no GitHub**.

O Git/GitHub Desktop envia o commit completo; não é necessário dividir o código em vários envios de 100 arquivos.

### Alternativa: terminal Git

Crie um repositório vazio no GitHub. Abra o terminal **dentro da pasta extraída** e substitua os placeholders na URL abaixo:

```bash
git init
git add .
git status --short
git commit -m "Publicar painel Cipriano"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```

Se a pasta já tiver um remoto, confira `git remote -v`; não adicione um remoto duplicado. Nunca use force push para sobrescrever um repositório existente sem conferir o histórico. Configure nome/e-mail do Git se solicitado. A autenticação é feita pelo GitHub/Gerenciador de Credenciais, não colocando tokens na URL.

### Se já enviou arquivos demais

- Não envie `node_modules`, `.next`, `.vercel`, caches ou `.env`.
- Se esses arquivos já foram commitados, remova-os do índice com `git rm -r --cached node_modules .next` (somente as pastas que existirem no índice), confira `.gitignore` e faça um novo commit.
- Se uma senha chegou a ser commitada, **rotacione a credencial**. Apagar o arquivo no último commit não remove segredos do histórico.
- O `.gitignore` protege commits Git; ele **não filtra arquivos arrastados pelo navegador**.

## Neon e Vercel

1. No Neon, abra o SQL Editor no branch/database correto e execute `public/neon-setup.sql`. O script é idempotente e não apaga registros.
2. Na Vercel, configure `DATABASE_URL` em **Settings → Environment Variables → Production**, usando a conexão pooled do Neon. Não use `NEXT_PUBLIC_DATABASE_URL`.
3. Opcional: configure `OPENAI_API_KEY` no servidor para recursos generativos.
4. Use Node.js 22.x, framework Next.js e comando de build `npm run build`.
5. Faça um novo deployment depois de alterar variáveis.
6. Valide `/api/health`: o esperado é `ok: true` e `code: "ready"`.

O guia completo fica em `/guia-publicacao`; o diagnóstico, em `/diagnostico`.

## Desenvolvimento local

Requer Node.js 22.x e PostgreSQL. Crie `.env.local` a partir de `.env.example` e preencha as variáveis localmente. Não commite credenciais.

```bash
npm ci
npx drizzle-kit push
npm run dev
```

Validação:

```bash
npx next typegen
npm exec tsc -- --noEmit --pretty false
npm run build
```

## Segurança e dados

- O ZIP contém apenas código/configuração/assets públicos, não um dump do banco.
- Dados de clientes, propostas e contratos ficam no PostgreSQL e não são exportados pelo pacote GitHub.
- `.env.example` contém somente placeholders.
- Antes de usar com dados reais, proteja o acesso ao painel. O aplicativo não possui autenticação própria integrada.
- Minutas contratuais exigem revisão humana/jurídica antes da assinatura.

Referência oficial: https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
