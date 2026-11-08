# PRD Summary — Oficina Core

## Visão
SaaS de gestão para oficinas mecânicas de pequeno e médio porte que cobre o ciclo operacional e financeiro completo: agendamento, OS, orçamento, execução, entrega, PDV, estoque, caixa, carteiras e relatórios.
Opera sob o princípio de "operação sem trava" (estoque negativo alerta mas não bloqueia) com integridade financeira, rastreabilidade contábil e totais sempre derivados.

## Features por Status

| Feature | Status |
|---|---|
| Onboarding, Auth simulada, Multi-tenant (`unidadeId`), 5 Roles (`owner`, `admin`, `gerente`, `mecanico`, `recepcionista`) | MVP |
| Cadastros (Clientes cross-unit, Veículos, Catálogo de produtos/serviços) e Busca unificada | MVP |
| Estoque simples (`ItemEstoque` + `MovimentoEstoque`, baixa/estorno automáticos, ajuste manual) | MVP |
| Ordem de Serviço (workflow 8 status, lotes/complementos, garantia, impressão/PNG) e PDV (venda rápida) | MVP |
| Financeiro (`Lancamento` único, Carteiras `cofre`/`banco`, múltiplos Caixas e sessões em espécie) | MVP |
| Agenda (Dia/Semana/Mês, conversão em OS), Dashboard, Relatórios (CSV), Lixeira (soft delete) e Backup JSON/CSV | MVP |
| Auth real (argon2id/D1), Fornecedor, Recebíveis/Conciliação, Link público (`/p/[token]`), E-mail, Multi-unidade UI, Audit log | Fase 2 |
| Nota fiscal, Lembretes (WhatsApp/SMS), Capacidade produtiva, Recorrência (revisão), MFA/SSO | Fase 3 |

## 10 Regras Críticas de Negócio
1. **Valores derivados:** Totais de OS/PDV, saldos de Carteiras/Caixas e status de pagamento são sempre calculados na leitura, nunca armazenados (única exceção: `ItemEstoque.quantidadeAtual`).
2. **Imutabilidade contábil e de estoque:** `Lancamento`, `MovimentoEstoque` e `Nota` são append-only (hard delete proibido); correções ocorrem exclusivamente via estorno ou novo movimento.
3. **Operação sem trava no estoque:** Saldo insuficiente nunca bloqueia aprovação de item na OS nem venda no PDV — gera apenas alerta visual (`Estoque Negativo`).
4. **Snapshot nos itens:** `ItemOS` congela nome, tipo, unidade e preço unitário no momento da adição; alterações ou exclusões posteriores no Catálogo não afetam OS ou vendas antigas.
5. **Baixa de estoque na aprovação:** Na OS, o estoque de produtos (`catalogoId`) só é baixado quando o item passa para `aprovado` (idempotente via `estoqueBaixado`), com estorno automático ao remover item, reverter aprovação ou cancelar OS.
6. **Separação Caixa vs. Carteiras:** `Caixa` é gaveta operacional exclusiva para espécie durante `SessaoCaixa` aberta (origem/destino sempre `Carteira` tipo `cofre`); meios digitais (`pix`, `credito`, `debito`, `boleto`) entram direto na `Carteira` tipo `banco`.
7. **Trava de espécie:** Qualquer recebimento ou pagamento em `dinheiro` exige sessão de Caixa aberta e acessível ao usuário; sem sessão aberta, UI e API recusam a operação.
8. **Workflow e travas financeiras da OS:** `aguardando_aprovacao` auto-aprova quando não restam itens pendentes no lote principal e há ≥ 1 aprovado; cancelar OS ou reverter aprovação exige pago líquido igual a zero; concluir exige zero itens pendentes (inclusive complementos).
9. **Transferências e entradas externas neutras:** Transferências internas usam 2 lançamentos pareados (`parId`) e, junto com aportes, empréstimos de sócio e sobras/quebras de caixa, não compõem receita ou despesa operacional.
10. **Segurança e escopo Multi-tenant:** Clientes pertencem ao tenant (`usuarioId`) e demais entidades pertencem à unidade (`unidadeId`); toda mutação na API valida role (matriz §3.5), unidade e associação ao Caixa.

## Fora de Escopo (MVP)
- Escrituração contábil de partidas dobradas, apuração fiscal e emissão de Nota Fiscal (NF-e/NFS-e).
- Estoque fiscal/avançado (entrada por XML, custo médio, múltiplos depósitos, reserva antes da aprovação).
- Controle de recebíveis de cartão/boleto (prazos D+X, taxas automáticas de adquirente, conciliação bancária).
- Aprovação online por link público (`/p/[token]`) e envio automático por e-mail, WhatsApp ou SMS.
