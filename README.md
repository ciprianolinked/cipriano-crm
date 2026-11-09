# Cipriano Tech & Security — Central de Propostas, CRM e Contratos

Aplicativo interno de vendas: propostas comerciais em A4, contratos, CRM com kanban,
manutenção mensal com reajuste por IPCA/IGP-M/INPC e cadastro de clientes por CNPJ.

## Publicação no GitHub

O upload pelo **navegador do GitHub** aceita no máximo **100 arquivos por envio**.
Este projeto tem 110 arquivos de código e `node_modules` tem mais de 33 mil — por isso
o site recusa com *"Nossa, isso é muito arquivo. Tente enviar menos de 100 de uma vez."*

### Caminho mais fácil (sem terminal): ZIP limpo + GitHub Desktop

1. Baixe o **código limpo** em [`/cipriano-fontes.zip`](public/cipriano-fontes.zip) (ou pelo botão no Guia de publicação). Ele já vem **sem `node_modules`, sem `.next` e sem `.env`**.
2. Extraia o ZIP (abre a pasta `cipriano-propostas`).
3. Instale o [GitHub Desktop](https://desktop.github.com/) e entre na sua conta.
4. **File → Add local repository** → escolha a pasta extraída → **create a repository**.
5. Escreva uma mensagem e clique em **Commit to main** → **Publish repository** (marque *private*).

O GitHub Desktop ignora o `node_modules` sozinho e não tem o limite de 100 arquivos.

### Alternativa: publicar por Git (sem limite de arquivos)

```bash
./scripts/publicar-github.sh https://github.com/SEU-USUARIO/cipriano-propostas.git
```

Para regenerar o ZIP limpo depois de alterar o código: `python3 scripts/gerar-zip-fontes.py`.

O script valida o `.gitignore`, faz o commit e envia. Com token de acesso pessoal:

```bash
GITHUB_TOKEN=ghp_XXXX ./scripts/publicar-github.sh https://github.com/SEU-USUARIO/cipriano-propostas.git
```

Comandos manuais, se preferir:

```bash
git init -b main
git add .
git commit -m "feat: central de propostas, CRM e contratos"
git remote add origin https://github.com/SEU-USUARIO/cipriano-propostas.git
git push -u origin main
```

Sem Git instalado, use o [GitHub Desktop](https://desktop.github.com/) (arraste a pasta
do projeto — ele ignora `node_modules` automaticamente).

### Alternativa: upload por lotes no navegador

Se precisar usar o site do GitHub, envie **pasta por pasta** (cada lote fica abaixo de 100):

| Lote | Caminho | Arquivos |
| --- | --- | --- |
| 1 | raiz (`package.json`, `tsconfig.json`, `.gitignore`, `README.md`, etc.) | 11 |
| 2 | `public/` | 3 |
| 3 | `drizzle/` | 5 |
| 4 | `scripts/` | 1 |
| 5 | `src/db/` | 2 |
| 6 | `src/lib/` | 15 |
| 7 | `src/components/` | 28 |
| 8 | `src/app/` | 46 |

Total: 111 arquivos em 8 lotes, todos abaixo de 100.

**Nunca envie** `node_modules/`, `.next/`, `.vercel/` ou qualquer arquivo `.env`.
Eles estão no `.gitignore`; o único arquivo de exemplo permitido é o `.env.example`.

## Estrutura

- `src/app` — páginas (propostas, CRM, contratos, catálogo, guia de publicação) e APIs.
- `src/components` — interface, documentos A4 paginados e exportação de PDF.
- `src/lib` — regras de negócio: propostas, contratos, índices econômicos, CNPJ.
- `src/db` — Drizzle ORM e schema PostgreSQL.
- `drizzle/` e `public/neon-setup.sql` — estrutura do banco para o Neon.tech.

## Ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | Sim | Conexão PostgreSQL (Neon) com `sslmode=require` |
| `OPENAI_API_KEY` | Não | Habilita redação e reescrita de contratos com IA |

## Comandos

```bash
npm install        # dependências
npm run dev        # desenvolvimento em http://localhost:3000
npm run build      # build de produção
npm run start      # servidor de produção
```

Antes de publicar, execute o SQL de `public/neon-setup.sql` no Neon e configure
`DATABASE_URL` na Vercel. O passo a passo completo está em **Guia de publicação**
dentro do próprio aplicativo.
