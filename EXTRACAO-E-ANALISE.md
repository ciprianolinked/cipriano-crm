# Extração e análise — CRM Cipriano Tech & Security

## Procedência

- Site analisado: https://cipriano-crm.vercel.app/
- Código extraído de: `GET /api/publicacao?formato=zip` (funcionalidade do próprio app, habilitada por
  `outputFileTracingIncludes` em `next.config.ts`).
- Pacote original: `cipriano-propostas-github-desktop.zip`, 118 arquivos, 1.027.013 bytes de fonte,
  sem `node_modules`, `.next`, `.env` real nem registros do banco.
- Também inspecionados: `/`, `/diagnostico`, `/guia-publicacao`, `/neon-setup.sql`, `/api/health` e as
  rotas públicas de dados.
- `ARQUIVOS-INCLUIDOS.txt` e `README.md` são o manifesto/documentação do pacote original. O manifesto
  com hashes é um retrato do código publicado e não foi recalculado após as correções abaixo.

## Inventário extraído

- 16 páginas: dashboard, clientes, propostas (lista/nova/detalhe), CRM, catálogo, contratos
  (lista/novo/detalhe), manutenção (lista/novo/detalhe), configurações, diagnóstico, guia de publicação.
- 27 rotas de API originais + 3 reconstruídas = 30.
- Componentes: kanban, follow-ups, wizard, editor de proposta, documento A4, ações de impressão,
  editor de contrato, comparador de índices, painel de concorrentes, catálogo, diagnóstico de banco,
  exportador de código.
- Bibliotecas: geração de proposta e minuta de contrato, PDF (jsPDF), PDF/OCR (unpdf, pdfjs-dist,
  pdf-parse, tesseract.js), CNPJ (BrasilAPI), índices BCB, análise de concorrentes, diagnóstico.
- Banco: 12 tabelas (`clients`, `proposals`, `activities`, `catalog_items`,
  `catalog_price_revisions`, `maintenance_contracts`, `maintenance_readjusts`,
  `maintenance_document_revisions`, `ipca_history`, `economic_index_values`, `reference_files`,
  `app_settings`), migrações em `drizzle/` e SQL idempotente em `public/neon-setup.sql`.
- Stack: Next.js 16 (App Router), React 19, Drizzle ORM + PostgreSQL, Tailwind 4, jsPDF,
  Space Grotesk / IBM Plex Sans / IBM Plex Mono.

## Divergências encontradas entre o site publicado e o resumo

1. `/api/health` em produção respondia **503 `schema_incomplete`**: faltava a tabela
   `catalog_price_revisions` e suas 10 colunas. O `public/neon-setup.sql` publicado não a criava,
   embora `src/db/schema.ts` a declarasse.
2. `src/lib/db-migrations.ts` (`ensureSchema`) nunca era chamado por nenhuma rota: era código morto.
3. `ReferencePanel.tsx` chamava `/api/references`, `/api/references/[id]` e
   `/api/references/analyze`, mas essas rotas **não existiam** nem no ZIP nem no deploy
   (`/api/references` devolvia 404 HTML). O módulo de inteligência competitiva estava quebrado, apesar
   de `reference_files` existir no SQL e de `references.ts` / `references-analysis.ts` estarem completos.
4. A lista de tabelas do resumo menciona `reference_files` mas omite `catalog_price_revisions`;
   o schema Drizzle original fazia o inverso.
5. `catalogPriceRevisions` era importado em `/api/catalog` sem ser usado — o histórico de preços não
   era gravado.
6. Dados expostos sem autenticação: `/api/clients`, `/api/proposals` e `/api/catalog` respondem 200
   com registros reais; `/api/reset` é um POST destrutivo sem controle de acesso.
7. Cabeçalhos: apenas HSTS e `X-Content-Type-Options` em algumas rotas; sem CSP, frame-ancestors
   ou Referrer-Policy.

## Correções aplicadas nesta extração

- `public/neon-setup.sql`: cria `catalog_price_revisions` e passa a conferir 12 tabelas.
- `src/db/schema.ts`: declara `reference_files` (bytea) para uso via Drizzle.
- `src/lib/db-migrations.ts`: cria `reference_files`, complementa colunas ausentes e passa a ser
  executado por `/api/health` antes do diagnóstico (auto-recuperação idempotente, sem apagar dados).
- `src/lib/references-store.ts`: camada de persistência e DTO dos anexos.
- `src/app/api/references/route.ts`, `[id]/route.ts`, `analyze/route.ts`: upload (6 arquivos, 4 MB),
  listagem, abertura/download, anotação, transcrição manual, exclusão e equalização por escopo —
  preservando quantidades e sem desconto automático.

## Pendências para as próximas edições

- **Crítico:** autenticação/autorização e proteção de `/api/reset`; backup/PITR no Neon; rate-limit,
  CSRF e auditoria; política LGPD para propostas de terceiros.
- **Alto:** OCR automático em imagens/PDFs escaneados (hoje usa transcrição manual), envio por
  e-mail/WhatsApp, assinatura digital, cache offline de índices, migrações versionadas com rollback,
  testes automatizados, paginação e busca full-text.
- **Médio:** gravar o histórico de preços do catálogo (`catalog_price_revisions`), fonte IBM Plex no
  PDF, exportação CSV/XLS/DOCX, trilha de auditoria multiusuário e notificações.

## Comandos

```bash
npm ci
cp .env.example .env.local     # DATABASE_URL
psql "$DATABASE_URL" -f public/neon-setup.sql   # ou npx drizzle-kit push
npm run dev
npx next typegen && npm exec tsc -- --noEmit && npm run build
```

Validação local concluída: `/api/health` → `ok: true`, `code: "ready"`, 12 tabelas,
0 colunas ausentes; upload, listagem, análise, download, edição e exclusão de referências testados.
