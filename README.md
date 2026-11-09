# Gerencial · Mapa de Cotação

Aplicativo de mapas de cotação para governança condominial. O guia completo e ilustrado está no menu **Ajuda → Publicar o aplicativo** (`/ajuda/publicar`). O guia da IA está em `/ajuda/ia`.

## Publicação: resumo dos passos

1. **Código no GitHub:** exporte ou baixe o projeto no ambiente em que ele foi criado. Use o GitHub Desktop para adicionar a pasta que contém `package.json`, `src` e `public`, faça um commit e publique em um repositório privado. Não inclua `.env`, senhas ou chaves. O `.gitignore` protege arquivos locais novos, mas não remove segredos já presentes no histórico.
2. **Banco Neon:** crie uma conta e um projeto em [Neon](https://console.neon.tech/). Em **Connect**, copie a connection string PostgreSQL com **Connection pooling**. Ela contém uma senha e não deve ser divulgada.
3. **Estrutura do banco:** no Neon, abra **Postgres database → SQL Editor**, selecione a branch e o banco corretos, cole e execute o conteúdo de [`public/guia/estrutura-inicial.sql`](public/guia/estrutura-inicial.sql). O arquivo prepara um banco novo sem dados de exemplo; ele não migra tabelas antigas nem transfere mapas de outro banco.
4. **Vercel:** crie uma conta em [Vercel](https://vercel.com/), conecte o GitHub e importe o repositório em **Add New → Project**. Mantenha o preset Next.js e a pasta raiz que contém `package.json`. Adicione `DATABASE_URL` como variável **Secret** de **Production**, com a conexão completa do Neon. Clique em **Deploy**.
5. **Proteção obrigatória:** esta versão ainda não tem login próprio nem permissões por usuário. Na Vercel, use **Deployment Protection → Vercel Authentication → All Deployments** e verifique em janela anônima se todos os endereços exigem acesso. Não use dados reais enquanto houver endereços públicos. Consulte o plano e as permissões adequados à sua equipe.
6. **Teste:** em sessão autorizada, abra `/api/health` para verificar a conexão e `/api/quotations` para conferir a tabela de mapas. A resposta positiva de health não verifica todas as tabelas. Se alterar variáveis na Vercel, faça um novo deploy.
7. **IA (opcional):** depois de proteger o site, cadastre `GEMINI_API_KEY` como **Secret** na Vercel e faça Redeploy, ou use o painel protegido. A chave salva no painel tem prioridade sobre a variável. Veja `/ajuda/ia` e consulte os termos de privacidade do provedor antes de enviar dados reais.

O Neon criado para a publicação é um banco novo. Mapas já existentes em outra instalação não são migrados automaticamente. Faça backup e migre os dados separadamente se necessário.

## Custos e limites

- O plano Hobby da Vercel é destinado a uso pessoal não comercial; para uma empresa, verifique os planos Pro/Enterprise.
- GitHub, Neon e Gemini oferecem opções gratuitas sujeitas a limites e condições vigentes. Confira os valores e termos nos sites oficiais.
- Nas Vercel Functions, o corpo de cada requisição tem limite de 4,5 MB. Neste aplicativo, mantenha o total dos arquivos e texto abaixo de aproximadamente 4 MB por envio.
- A análise de múltiplas propostas usa Fluid Compute e pode durar alguns minutos, mesmo com arquivos pequenos. A porcentagem mostrada é apenas estimativa; o resultado só é concluído quando o provedor retorna.
- Erros transitórios do Gemini recebem tentativas limitadas com espera. Se necessário, é usada uma API ou modelo multimodal alternativo do próprio Google, com aviso no resultado. Cotas, custos e privacidade seguem as condições do projeto Google; erros de chave ou cota diária não são repetidos indefinidamente.
- Na versão atual, o banco guarda os dados dos mapas e os metadados dos anexos, mas não os PDFs ou imagens originais. Guarde os documentos originais em local seguro.
- Nos serviços gratuitos do Gemini, o Google informa que pode usar conteúdo e respostas para melhorar produtos. Não envie dados pessoais, sensíveis ou confidenciais sem avaliar os termos e as regras aplicáveis.

## Desenvolvimento

O projeto é Next.js com PostgreSQL e Drizzle. Para desenvolvimento local, defina `DATABASE_URL` em um arquivo `.env` ignorado pelo Git e execute `npm install` e `npm run dev`. O arquivo `drizzle.config.ts` lê a variável de ambiente; para migrações em Neon, utilize uma conexão direta adequada e faça backup antes de alterar estruturas existentes.

Documentação: [GitHub Desktop](https://docs.github.com/en/desktop), [Neon](https://neon.com/docs/), [Vercel](https://vercel.com/docs) e [termos do Gemini](https://ai.google.dev/gemini-api/terms).
