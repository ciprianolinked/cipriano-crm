# Módulo de Ordens de Serviço (OS)

## Fluxo

1. **Abrir a OS** em `/os/nova`: cliente (do cadastro ou manual), tipo, prioridade, técnico, agenda,
   solicitação, diagnóstico, solução, peças do catálogo e mão de obra/deslocamento.
   A OS pode nascer de uma proposta (`originProposalId`), herdando cliente, local e itens
   **apenas como checklist** (`billable: false`), sem cobrança duplicada.
2. **Executar** em `/os/[id]`: checklist com conferência, laudo técnico, PDF A4 e impressão.
   Datas de início/conclusão acompanham o status.
3. **Gerar orçamento** quando houver peças cobráveis, mão de obra ou deslocamento:
   `POST /api/service-orders/[id]/budget` cria uma **proposta comercial** com peças + mão de obra +
   deslocamento, e grava o vínculo nos dois lados:
   - OS: `budget_proposal_id`, `budget_proposal_number`, `budget_total_cents`, `budget_issued_at`;
   - Proposta: `briefing.osId` e `briefing.osNumber`.
4. **Corrigir**: o botão “Corrigir orçamento” abre `/propostas/[id]`. Ao salvar a proposta, o
   `PATCH /api/proposals/[id]` atualiza o valor da OS automaticamente.
5. **Nova versão**: `POST .../budget { regenerate: true }` cria a próxima revisão do orçamento
   (mesmo `revisionGroupId`, `revision + 1`) e revincula a OS à versão nova.
6. **Desvincular** (`DELETE .../budget`) e **excluir a OS** preservam a proposta de orçamento.

## Números

- OS: `OS-AAAA-0001`, sequencial, calculado pela maior numeração existente.
- Orçamento: usa a numeração normal de propostas (`CTS-AAAA-0000`), respeitando exclusões.

## Regras

- A OS nunca envia nada ao cliente sozinha.
- Itens com “cobrar” desmarcado entram no checklist e ficam fora do orçamento.
- Orçamento sem nenhum valor cobrável é bloqueado com mensagem orientando o preenchimento.
- Os status `aberta`/`aguardando_orcamento` passam a `aguardando_aprovacao` quando o orçamento é emitido.

## Arquivos

- `src/db/schema.ts` — tabela `service_orders` e tipo `ServiceOrderItem`.
- `src/lib/service-orders.ts` — tipos/status, totais, numeração e `buildBudgetDraft`.
- `src/app/api/service-orders/route.ts` — listar e criar.
- `src/app/api/service-orders/[id]/route.ts` — ler, editar, excluir.
- `src/app/api/service-orders/[id]/budget/route.ts` — gerar/reaproveitar/nova versão/desvincular.
- `src/app/os/page.tsx`, `/os/nova`, `/os/[id]` — lista, formulário e editor.
- `src/components/os/*` — manager, formulário, documento e editor.
- `src/lib/pdf-documents.ts` — `renderServiceOrderPdf`.
- `public/neon-setup.sql` e `src/lib/db-migrations.ts` — criação idempotente (14 tabelas).
