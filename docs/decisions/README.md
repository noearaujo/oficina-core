# Architectural Decision Records (ADRs) — Oficina Core

Este diretório contém os Registros de Decisões Arquiteturais (ADRs) do projeto **Oficina Core**. Cada registro documenta uma decisão técnica ou arquitetural relevante tomada ao longo do ciclo de vida da aplicação, descrevendo seu contexto, justificativa e consequências.

---

## Formato do ADR

Cada ADR adota a estrutura simplificada baseada no padrão de Michael Nygard:

```markdown
# [Número]. [Título]

- **Status:** [Proposto | Aprovado | Obsoleto | Substituído por ADR-xxx]
- **Data:** [DD/MM/AAAA]
- **Versão de Origem:** [vX.Y.Z]
- **Onde:** [Referência PRD / ARCH / ROADMAP]

## Contexto
O que motivou a decisão, quais problemas precisavam ser resolvidos e quais restrições existiam.

## Decisão
A alteração ou padrão arquitetural escolhido.

## Consequências
Impactos positivos, restrições introduzidas, débitos técnicos aceitos ou compromissos decorrentes.
```

### Ciclo de Vida dos Status

- **Proposto:** Em análise e validação prática (geralmente associado a marcos de teste).
- **Aprovado:** Decisão em vigor e consolidada na arquitetura da aplicação.
- **Obsoleto:** Decisão descartada por evolução de escopo ou mudança de premissas.
- **Substituído:** Decisão tornada sem efeito por um ADR posterior (com link para o substituto).

---

## Índice de Decisões

| ID | Título | Status | Data | Versão | Arquivo |
|---|---|---|---|---|---|
| [001](001-versao-base-e-state-machine-os.md) | Versão-base, Entidades e State Machine da OS | ✅ Aprovado | 04/11/2026 | 1.0 / 1.2 | [001-versao-base-e-state-machine-os.md](001-versao-base-e-state-machine-os.md) |
| [002](002-carteiras-e-estruturacao-detalhe-os.md) | Carteiras Financeiras (Cofre/Banco) e Abas da OS | ✅ Aprovado | 04/11/2026 | 1.1 | [002-carteiras-e-estruturacao-detalhe-os.md](002-carteiras-e-estruturacao-detalhe-os.md) |
| [003](003-alinhamento-fluxo-os-e-reversao.md) | Alinhamento do Fluxo de OS, Complementos e Reversão | ✅ Aprovado | 04/11/2026 | 1.2 | [003-alinhamento-fluxo-os-e-reversao.md](003-alinhamento-fluxo-os-e-reversao.md) |
| [004](004-consolidacao-estoque-e-financeiro-direto.md) | Consolidação de Estoque Simples, Financeiro Direto e Trava de Caixa | ✅ Aprovado | 04/11/2026 | 1.7 | [004-consolidacao-estoque-e-financeiro-direto.md](004-consolidacao-estoque-e-financeiro-direto.md) |
| [005](005-movimento-estoque-append-only.md) | Extrato de Estoque Append-Only (`MovimentoEstoque`) | ✅ Aprovado | 04/11/2026 | 1.7 | [005-movimento-estoque-append-only.md](005-movimento-estoque-append-only.md) |
| [006](006-storage-camada-unica-e-transacoes.md) | Storage em Camada Única e Transações Atômicas | 🟡 Proposta | 04/11/2026 | 1.8 | [006-storage-camada-unica-e-transacoes.md](006-storage-camada-unica-e-transacoes.md) |
| [007](007-convencoes-centavos-e-fuso-horario.md) | Convenções de Dados: Dinheiro em Centavos e Fuso UTC | 🟡 Proposta | 04/11/2026 | 1.8 | [007-convencoes-centavos-e-fuso-horario.md](007-convencoes-centavos-e-fuso-horario.md) |
| [008](008-matriz-permissoes-acao-role.md) | Matriz de Permissões Ação × Role como Fonte de Verdade | 🟡 Proposta | 04/11/2026 | 1.8 | [008-matriz-permissoes-acao-role.md](008-matriz-permissoes-acao-role.md) |
| [009](009-envio-orcamento-mvp-impressao-imagem.md) | Envio de Orçamento no MVP Restrito a Impressão e Imagem | 🟡 Proposta | 04/11/2026 | 1.8 | [009-envio-orcamento-mvp-impressao-imagem.md](009-envio-orcamento-mvp-impressao-imagem.md) |
| [010](010-casos-de-borda-fluxo-os.md) | Regras para Casos de Borda do Fluxo da OS | 🟡 Proposta | 04/11/2026 | 1.8 | [010-casos-de-borda-fluxo-os.md](010-casos-de-borda-fluxo-os.md) |
| [011](011-separacao-item-catalogo-item-estoque.md) | Separação entre `ItemCatalogo` e `ItemEstoque` | ✅ Aprovado | 05/11/2026 | 1.9 | [011-separacao-item-catalogo-item-estoque.md](011-separacao-item-catalogo-item-estoque.md) |
| [012](012-pdv-restrito-a-produtos.md) | PDV Restrito a Produtos do Catálogo | ✅ Aprovado | 05/11/2026 | 1.9 | [012-pdv-restrito-a-produtos.md](012-pdv-restrito-a-produtos.md) |
| [013](013-carteiras-modulo-independente-e-regras.md) | Carteiras como Módulo Próprio e Regras de Integridade | ✅ Aprovado | 05/11/2026 | 1.10 | [013-carteiras-modulo-independente-e-regras.md](013-carteiras-modulo-independente-e-regras.md) |
| [014](014-ux-detalhe-os-tabs-resumo-historico.md) | Redesenho da Tela de Detalhe da OS (Tabs, Resumo, Histórico e Edição) | ✅ Aprovado | 07/11/2026 | 1.10.2 | [014-ux-detalhe-os-tabs-resumo-historico.md](014-ux-detalhe-os-tabs-resumo-historico.md) |
| [015](015-parametros-semanticos-de-rotas.md) | Parâmetros semânticos nas rotas | ✅ Aprovado | 10/11/2026 | — | [015-parametros-semanticos-de-rotas.md](015-parametros-semanticos-de-rotas.md) |
