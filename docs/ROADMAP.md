# ROADMAP — Oficina Core

> **Versão:** 1.10.2 · 07/11/2026
> **Escopo:** Fases de implementação do MVP e roadmap de evolução. Decisões de produto em `PRD.md`.

---

## 1. Ordem de Implementação (MVP)

| Etapa | Módulo | Dependência | Estima |
|---|---|---|---|
| **1** | Camada de storage (adapter, transação, migrations, seed), helpers de dinheiro e data, Auth simulada + Onboarding + Layouts | — | 1,5–2 dias |
| **2** | Cadastros base: Clientes, Veículos, Catálogo + Estoque (ajuste manual, movimentos, badges) + **Carteiras** (tela, CRUD, transferir, despesa, entrada) | — | 2,5 dias |
| **3** | OS (workflow, itens com quantidade, notas, status, lotes, reverter, garantia, baixa/estorno de estoque) | Etapa 2 | 2,5–3,5 dias |
| **4** | Caixas + sessões (abrir/fechar, reforço, sangria, despesa, Retirada Rápida, ajustes) | Etapa 2 | 1–1,5 dias |
| **5** | Lançamentos (pagamento com trava de Caixa, despesa, estorno, transferência, entrada externa) | Carteiras + sessões + OS | 1–2 dias |
| **6** | PDV (venda rápida + baixa de estoque + recibo) | Catálogo/Estoque + Lançamentos | 1 dia |
| **7** | Agenda (dia/semana/mês + conversão em OS) | Clientes + Veículos | 1–2 dias |
| **8** | Tela de Faturamento (aba da OS) | OS + Lançamentos | 1 dia |
| **9** | Relatórios (financeiro, caixa, exportação CSV contábil) | Lançamentos + Carteiras + sessões | 1,5–2 dias |
| **10** | Busca e filtros em todas as listagens (normalização, debounce, client-side first) | Todas as listagens | 1 dia |
| **11** | Lixeira (soft delete + restaurar) | OS + Clientes + Veículos | 0,5 dia |
| **12** | Configurações (oficina, Caixas, backup) | — | 1 dia |
| **13** | Dashboard (resumo + alertas, inclusive estoque) | Tudo | 0,5 dia |
| **14** | PrintPreview (orçamento, complementar, nota, recibo) + envio do orçamento (canal, `EnvioOrcamento`) | OS + Config | 1,5–2 dias |

**Total estimado: 18–23 dias** (1 dev + IA).

---

## 2. Marco de Validação

**Fim da Etapa 5** — antes de seguir, rodar à mão o roteiro ponta a ponta:

0. Criar Banco + Cofre na tela `/carteiras` (empty state → modal).
1. Criar OS → diagnóstico → enviar orçamento (impressão) → aprovar item com baixa de estoque → receber em dinheiro com Caixa aberto → fechar Caixa.
2. Tentar também os bloqueios de PRD §5.11 (casos de borda).

> Erros de especificação aparecem aqui, em dias, e não no fim do projeto.

---

## 3. Roadmap de Evolução

### Fase 2

| Item | Dependência |
|---|---|
| Estoque avançado (entrada por NF-e/XML, custo médio, multi-depósito, inventário, reserva na aprovação) | Fornecedor + NF-e |
| Fornecedor (nome + condição) + vínculo compra ↔ entrada de estoque | — |
| Link público (`/p/[token]`) | D1 + SSR |
| Envio do orçamento por e-mail | Provedor de e-mail |
| Correção administrativa de item aprovado (estorno de estoque + nota) | — |
| Multi-unidade (UI) | Schema pronto |
| Audit log (`events` table) | Multi-usuário real |
| D1 + Cloudflare Workers (migração) | MVP estável |
| Auth real (argon2id + D1.sessions) | D1 |
| Relatórios: operacional, vendas, contábil | Dados históricos |
| Recebíveis de cartão/boleto (D+X, taxa, compensação) | D1 |

### Fase 3

| Item | Dependência |
|---|---|
| Nota fiscal (integração) | D1 |
| Lembretes (WhatsApp/SMS) | D1 + webhook |
| Capacidade de produção (slots) | Multi-mecânico |
| Recorrência (revisão 10k) | Histórico de km |
| MFA / SSO / Google | Auth real |
| KMS / criptografia de campo (CPF) | LGPD |
| Conciliação bancária | D1 |
| Fatura de fornecedor (com itens) | Estoque avançado |
| Fluxo de caixa projetado | Histórico |
| FTS5 (busca full-text) | >10k registros |
| 4 lançamentos por parcela (crédito) | Precisão no saldo |
| Fotos (check-in, diagnóstico) | Storage de imagens |
| Kanban board | Volume |
| Billing (SaaS) | Multi-tenant real |

---

> **Fim do ROADMAP.md.**
