# DECISIONS — Oficina Core

> **Versão:** 1.10.2 · 07/11/2026  
> **Escopo:** Índice consolidado e trilha de auditoria das Decisões Arquiteturais (ADRs).  
> **Diretório de ADRs:** [`docs/decisions/`](decisions/README.md)

---

## 1. Índice de Architectural Decision Records (ADRs)

| ADR | Título | Status | Data | Versão |
|---|---|---|---|---|
| [ADR-001](decisions/001-versao-base-e-state-machine-os.md) | Versão-base, Entidades e State Machine da OS | ✅ Aprovado | 04/11/2026 | 1.0 / 1.2 |
| [ADR-002](decisions/002-carteiras-e-estruturacao-detalhe-os.md) | Carteiras Financeiras (Cofre/Banco) e Abas da OS | ✅ Aprovado | 04/11/2026 | 1.1 |
| [ADR-003](decisions/003-alinhamento-fluxo-os-e-reversao.md) | Alinhamento do Fluxo de OS, Complementos e Reversão | ✅ Aprovado | 04/11/2026 | 1.2 |
| [ADR-004](decisions/004-consolidacao-estoque-e-financeiro-direto.md) | Consolidação de Estoque Simples, Financeiro Direto e Trava de Caixa | ✅ Aprovado | 04/11/2026 | 1.7 |
| [ADR-005](decisions/005-movimento-estoque-append-only.md) | Extrato de Estoque Append-Only (`MovimentoEstoque`) | ✅ Aprovado | 04/11/2026 | 1.7 |
| [ADR-006](decisions/006-storage-camada-unica-e-transacoes.md) | Storage em Camada Única e Transações Atômicas | 🟡 Proposta | 04/11/2026 | 1.8 |
| [ADR-007](decisions/007-convencoes-centavos-e-fuso-horario.md) | Convenções de Dados: Dinheiro em Centavos e Fuso UTC | 🟡 Proposta | 04/11/2026 | 1.8 |
| [ADR-008](decisions/008-matriz-permissoes-acao-role.md) | Matriz de Permissões Ação × Role como Fonte de Verdade | 🟡 Proposta | 04/11/2026 | 1.8 |
| [ADR-009](decisions/009-envio-orcamento-mvp-impressao-imagem.md) | Envio de Orçamento no MVP Restrito a Impressão e Imagem | 🟡 Proposta | 04/11/2026 | 1.8 |
| [ADR-010](decisions/010-casos-de-borda-fluxo-os.md) | Regras para Casos de Borda do Fluxo da OS | 🟡 Proposta | 04/11/2026 | 1.8 |
| [ADR-011](decisions/011-separacao-item-catalogo-item-estoque.md) | Separação entre `ItemCatalogo` e `ItemEstoque` | ✅ Aprovado | 05/11/2026 | 1.9 |
| [ADR-012](decisions/012-pdv-restrito-a-produtos.md) | PDV Restrito a Produtos do Catálogo | ✅ Aprovado | 05/11/2026 | 1.9 |
| [ADR-013](decisions/013-carteiras-modulo-independente-e-regras.md) | Carteiras como Módulo Próprio e Regras de Integridade | ✅ Aprovado | 05/11/2026 | 1.10 |
| [ADR-014](decisions/014-ux-detalhe-os-tabs-resumo-historico.md) | Redesenho da Tela de Detalhe da OS (Tabs, Resumo, Histórico e Edição) | ✅ Aprovado | 07/11/2026 | 1.10.2 |
| [ADR-015](decisions/015-parametros-semanticos-de-rotas.md) | Parâmetros semânticos nas rotas | ✅ Aprovado | 10/11/2026 | — |

---

## 2. Histórico de Versões e Trilha de Decisões

| Versão | Data | Alterações | ADRs Relacionados |
|---|---|---|---|
| **1.10.2** | 07/11/2026 | Tela de detalhe OS: tabs horizontais (pill), transições na navbar #right, Resumo em 4 cards, Histórico compacto (ex-Notas, sem manual, exibe role), Editar Item só qtd+preço, regra de edição por enviado+status. | [ADR-014](decisions/014-ux-detalhe-os-tabs-resumo-historico.md) |
| **1.10.1** | 05/11/2026 | Correção de resíduos da 1.10: Step 2 do onboarding, StepCarteiras.vue na árvore, descrição do endpoint onboarding. | [ADR-013](decisions/013-carteiras-modulo-independente-e-regras.md) |
| **1.10** | 05/11/2026 | Carteiras como tela própria (`/carteiras`, G+); onboarding não seeda Carteiras; exclusão A+ com guard (sessão aberta bloqueia; lançamentos → `carteiraId` NULL); rename sem guard (FK por ID); `ON DELETE SET NULL` em `lancamentos.carteira_id` e `sessoes_caixa.carteira_origem_id`. | [ADR-013](decisions/013-carteiras-modulo-independente-e-regras.md) |
| **1.9.1** | 05/11/2026 | Revisão de consistência da 1.9, sem mudança de regra de negócio: referências cruzadas, total da OS nunca negativo, PDV alinhado à regra "só produto", `ItemEstoque` (criação transacional, seed, safe fallback), contratos de endpoint restaurados, `PUT /lancamentos/:id`, CSV de Estoque, exceção de `quantidadeAtual` ao princípio "derivado", "Etapa" (build) separada de "Fase 2/3" (roadmap). | [ADR-011](decisions/011-separacao-item-catalogo-item-estoque.md), [ADR-012](decisions/012-pdv-restrito-a-produtos.md) |
| **1.9** | 05/11/2026 | Separação `ItemCatalogo` / `ItemEstoque`. `ItemCatalogo` volta a ser só referência (sem `quantidadeAtual`/`quantidadeMinima`). Nova entidade `ItemEstoque` (1:1, só produto, `catalogoId` FK CASCADE). `MovimentoEstoque.catalogoId` mantido. Fluxo de baixa/estorno inalterado. PDV só produtos. | [ADR-011](decisions/011-separacao-item-catalogo-item-estoque.md), [ADR-012](decisions/012-pdv-restrito-a-produtos.md) |
| **1.8** | 04/11/2026 | Endurecimento para construção: camada de storage com adapter único e migração D1 sem transformação; convenções de dinheiro em centavos e fuso horário; matriz de permissões ação × role; envio de orçamento no MVP via impressão/imagem; casos de borda do fluxo da OS. | [ADR-006](decisions/006-storage-camada-unica-e-transacoes.md), [ADR-007](decisions/007-convencoes-centavos-e-fuso-horario.md), [ADR-008](decisions/008-matriz-permissoes-acao-role.md), [ADR-009](decisions/009-envio-orcamento-mvp-impressao-imagem.md), [ADR-010](decisions/010-casos-de-borda-fluxo-os.md) |
| **1.7** | 04/11/2026 | Consolidação: estoque simples no modelo mestre `ItemCatalogo`, `catalogoId` opcional no item da OS, ciclo de baixa/estorno de estoque, extrato `MovimentoEstoque`, financeiro direto, Retirada Rápida, trava de dinheiro sem Caixa aberto e exportação CSV contábil. | [ADR-004](decisions/004-consolidacao-estoque-e-financeiro-direto.md), [ADR-005](decisions/005-movimento-estoque-append-only.md) |
| **1.3–1.6** | 04/11/2026 | *(fragmentos, obsoletos)* Incorporados e consolidados na 1.7. | [ADR-004](decisions/004-consolidacao-estoque-e-financeiro-direto.md) |
| **1.2** | 04/11/2026 | Alinhamento do fluxo de OS: complementos separados, inclusão direta na execução, aprovação automática corrigida, reversão administrativa reabrindo itens do orçamento principal, envio documentado. | [ADR-001](decisions/001-versao-base-e-state-machine-os.md), [ADR-003](decisions/003-alinhamento-fluxo-os-e-reversao.md) |
| **1.1** | 04/11/2026 | Carteira consolidada como entidade financeira vigente (Cofre/Banco); detalhe da OS documentado nas abas Resumo, Orçamento e Faturamento. | [ADR-002](decisions/002-carteiras-e-estruturacao-detalhe-os.md) |
| **1.0** | 04/11/2026 | Versão-base aprovada (entidades, state machine, RBAC e multi-tenant). | [ADR-001](decisions/001-versao-base-e-state-machine-os.md) |

---

## 3. Matriz de Aprovação por Domínio

| Domínio / Decisão | Status | Origem | ADR |
|---|---|---|---|
| Entidades Principais e Multi-tenant | ✅ Aprovado | 1.2 | [ADR-001](decisions/001-versao-base-e-state-machine-os.md) |
| State Machine da OS (status, lotes, reversão) | ✅ Aprovado | 1.2 | [ADR-001](decisions/001-versao-base-e-state-machine-os.md), [ADR-003](decisions/003-alinhamento-fluxo-os-e-reversao.md) |
| Financeiro Unificado (`Lancamento`) | ✅ Aprovado | 1.2 | [ADR-001](decisions/001-versao-base-e-state-machine-os.md) |
| Financeiro Direto (sem compensação D+X) | ✅ Aprovado | 1.3 / 1.7 | [ADR-004](decisions/004-consolidacao-estoque-e-financeiro-direto.md) |
| Caixa e Retirada Rápida | ✅ Aprovado | 1.2 / 1.7 | [ADR-004](decisions/004-consolidacao-estoque-e-financeiro-direto.md) |
| Trava de Dinheiro sem Caixa Aberto | ✅ Aprovado | 1.7 | [ADR-004](decisions/004-consolidacao-estoque-e-financeiro-direto.md) |
| Extrato de Estoque Append-Only (`MovimentoEstoque`) | ✅ Aprovado | 1.7 | [ADR-005](decisions/005-movimento-estoque-append-only.md) |
| Camada de Storage Única com Adapter e Transações | 🟡 Proposta | 1.8 | [ADR-006](decisions/006-storage-camada-unica-e-transacoes.md) |
| Convenções de Dados (Centavos inteiros e Fuso UTC) | 🟡 Proposta | 1.8 | [ADR-007](decisions/007-convencoes-centavos-e-fuso-horario.md) |
| Matriz de Permissões Ação × Role | 🟡 Proposta | 1.8 | [ADR-008](decisions/008-matriz-permissoes-acao-role.md) |
| Envio de Orçamento no MVP (Impressão / Imagem) | 🟡 Proposta | 1.8 | [ADR-009](decisions/009-envio-orcamento-mvp-impressao-imagem.md) |
| Casos de Borda do Fluxo da OS | 🟡 Proposta | 1.8 | [ADR-010](decisions/010-casos-de-borda-fluxo-os.md) |
| Separação `ItemCatalogo` / `ItemEstoque` | ✅ Aprovado | 1.9 | [ADR-011](decisions/011-separacao-item-catalogo-item-estoque.md) |
| PDV Restrito a Produtos | ✅ Aprovado | 1.9 | [ADR-012](decisions/012-pdv-restrito-a-produtos.md) |
| Carteiras como Módulo Próprio e Integridade Relacional | ✅ Aprovado | 1.10 | [ADR-013](decisions/013-carteiras-modulo-independente-e-regras.md) |
| Redesenho UX do Detalhe da OS (Tabs, Histórico e Edição) | ✅ Aprovado | 1.10.2 | [ADR-014](decisions/014-ux-detalhe-os-tabs-resumo-historico.md) |


## 015 — Parâmetros semânticos nas rotas

Ver [015 — Parâmetros semânticos nas rotas](decisions/015-parametros-semanticos-de-rotas.md). A decisão proíbe `[id]` genérico e extração manual de parâmetros por regex.
