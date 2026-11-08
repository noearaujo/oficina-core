# DECISIONS — Oficina Core

> **Versão:** 1.10.2 · 07/11/2026
> **Escopo:** Histórico de versões, notas de consolidação e registro de aprovação. Não é lido durante o desenvolvimento — serve como trilha de auditoria de decisões.

---

## 1. Histórico de Versões

| Versão | Data | Alterações |
|---|---|---|
| 1.10.2 | 07/11/2026 | Tela de detalhe OS: tabs horizontais (pill), transições na navbar #right, Resumo em 4 cards, Histórico compacto (ex-Notas, sem manual, exibe role), Editar Item só qtd+preço, regra de edição por enviado+status. |
| 1.10.1 | 05/11/2026 | Correção de resíduos da 1.10: Step 2 do onboarding, StepCarteiras.vue na árvore, descrição do endpoint onboarding. |
| 1.10 | 05/11/2026 | Carteiras como tela própria (`/carteiras`, G+); onboarding não seeda Carteiras; exclusão A+ com guard (sessão aberta bloqueia; lançamentos → `carteiraId` NULL); rename sem guard (FK por ID); `ON DELETE SET NULL` em `lancamentos.carteira_id` e `sessoes_caixa.carteira_origem_id`. |
| 1.9.1 | 05/11/2026 | **Revisão de consistência** da 1.9, sem mudança de regra de negócio: referências cruzadas, total da OS nunca negativo, PDV alinhado à regra "só produto", `ItemEstoque` (criação transacional, seed, safe fallback), contratos de endpoint restaurados, `PUT /lancamentos/:id`, CSV de Estoque, exceção de `quantidadeAtual` ao princípio "derivado", "Etapa" (build) separada de "Fase 2/3" (roadmap). |
| 1.9 | 05/11/2026 | Separação `ItemCatalogo` / `ItemEstoque`. `ItemCatalogo` volta a ser só referência (sem `quantidadeAtual`/`quantidadeMinima`). Nova entidade `ItemEstoque` (1:1, só produto, `catalogoId` FK CASCADE). `MovimentoEstoque.catalogoId` mantido. Fluxo de baixa/estorno inalterado. |
| 1.8 | 04/11/2026 | **Endurecimento para construção.** Camada de storage com adapter único e migração para D1 sem transformação; convenções de dinheiro em centavos e fuso horário; matriz de permissões ação × role; envio de orçamento no MVP limitado a impressão/imagem; casos de borda do fluxo da OS; marco de validação na ordem de implementação. **Fluxo da OS inalterado**, salvo as pré-condições de casos de borda. |
| 1.7 | 04/11/2026 | **Consolidação.** Documento completo (37 seções) partindo da 1.2 e incorporando o que as versões 1.3–1.6 decidiram: estoque simples no modelo mestre `ItemCatalogo`, `catalogoId` opcional no item da OS, ciclo de baixa/estorno de estoque, quantidade no modal, financeiro direto (sem compensação de cartão), Retirada Rápida, trava de dinheiro sem Caixa aberto e exportação CSV contábil. Conflitos entre versões resolvidos e lacunas da 1.2 corrigidas. **Fluxo da OS (seção 7) preservado da 1.2.** |
| 1.6 | 04/11/2026 | *(fragmento, obsoleto)* Baixa em garantia R$ 0, safe fallback no estorno, troca de produto em item aprovado, trava de Caixa fechado para dinheiro. Incorporado na 1.7. |
| 1.5 | 04/11/2026 | *(fragmento, obsoleto)* Estorno atômico e recálculo diferencial (delta) de estoque. Incorporado na 1.7. |
| 1.4 | 04/11/2026 | *(fragmento, obsoleto)* Quantidade no modal, momento da baixa, modelo mestre unificado Catálogo + Estoque. Incorporado na 1.7. |
| 1.3 | 04/11/2026 | *(fragmento, obsoleto)* Separação Catálogo/Estoque, financeiro direto, Retirada Rápida, relatórios/CSV, roles em 2 perfis. Incorporado na 1.7 (com ajustes). |
| 1.2 | 04/11/2026 | Alinhamento do fluxo de OS já validado: Complementos separados do status do item, inclusão direta durante execução, aprovação automática corrigida, reversão administrativa reabre itens aprovados e recusados do orçamento principal, e envio do orçamento documentado. Revisão cruzada de Carteira/Caixa, endpoints, checklist, badges e schema. |
| 1.1 | 04/11/2026 | Carteira consolidada como entidade financeira vigente (tipos Cofre/Banco); estrutura de detalhe da OS documentada nas abas Resumo, Orçamento e Faturamento. |
| 1.0 | 04/11/2026 | Versão-base aprovada. |

---

## 2. Notas de Consolidação (1.7)

As versões 1.3 a 1.6 foram geradas como arquivos parciais (seções resumidas em uma linha, sem aplicar as mudanças sobre o documento completo). A 1.7 é a **única versão completa**; as anteriores ficam como histórico.

### Incorporado de 1.3–1.6

| # | Decisão | Onde (PRD) |
|---|---|---|
| 1 | Estoque simples no modelo mestre `ItemCatalogo` (produto tem saldo físico); duas visões: `/catalogo` e `/estoque` | §4.6, §4.6.2 |
| 2 | `ItemOS.catalogoId` opcional + `estoqueBaixado`; baixa no aceite do item, estorno, delta, troca de produto, safe fallback, baixa em garantia R$ 0,00 | §4.8, §5.10 |
| 3 | Campo **Quantidade** no modal de adicionar item | §4.8 |
| 4 | Financeiro direto: Pix/crédito/débito/boleto creditam na hora na Carteira banco (sem D+X, sem compensação) | §4.10, §6 |
| 5 | **Retirada Rápida** no Caixa (`retirada_rapida`) | §7.4 |
| 6 | **Trava**: dinheiro só com sessão de Caixa aberta (UI bloqueia, API valida) | §4.10, §7.4 |
| 7 | Relatório gerencial + **Exportar CSV** de OS e Lançamentos para o contador | §13.5 |
| 8 | Perfis **Administração** e **Operacional** (agrupamento de menus) | §3.3 |

### Conflitos entre versões — decisão aplicada

| Conflito | Decisão na 1.7 |
|---|---|
| 1.3 criou `ItemEstoque` separado; 1.4 unificou em `ItemCatalogo` | **Unificado** (1.4 em diante) |
| 1.4–1.6 falam em "recusar" ou "editar" item **aprovado**; a 1.2 define `aprovado` e `recusado` como terminais | **1.2 prevalece.** As regras de delta/troca de produto viram invariantes da função de estoque (§5.10), sem abrir edição de item aprovado |
| 1.3 reduziu os roles a 2 perfis; a state machine da 1.2 depende de `mecanico` ≠ `recepcionista` ≠ `gerente` | **5 roles mantidos** para autorização; os 2 perfis só agrupam menus (§3.3) |
| 1.3 define "A Receber" só com OS concluídas/entregues; 1.2 usa status ≥ `aprovada` | **1.2** (coerente com "pagamento só a partir de `aprovada`") |
| 1.3 manda lançar taxa de cartão como `imposto`/`outro` | Mantida a categoria **`taxa_adquirente`** da 1.2 (lançamento manual) |

### Acrescentado na 1.7 (proposta — pode ser removido sem afetar o resto)

| Item | Motivo | Onde (PRD) |
|---|---|---|
| `MovimentoEstoque` (extrato de estoque, append-only) | O modal "Ajuste de Estoque" tem observação/usuário/data e a baixa/estorno precisa de idempotência e rastro; sem isso não há onde gravar | §4.6.1 |
| Alerta de estoque no Dashboard | Usa `quantidadeMinima`, que já existia só para alerta | §14.2 |
| Formato do CSV (UTF-8 BOM, `;`, vírgula decimal) e colunas extras (local, documento) | Abrir direto no Excel pt-BR; permitir ao contador excluir transferências | §13.5 |

### Correções de consistência da 1.2

- Numeração de regras duplicada (47–55 em Financeiro e Busca) → renumerada de 1 a N.
- `Venda` com "hard delete" gerava lançamento que nunca pode ser apagado → sem exclusão no MVP.
- `Agendamento` "cancelado" era ao mesmo tempo status e hard delete → só status.
- `StorageShape` não tinha `enviosOrcamento` nem `lancamentoHistorico` (existiam no schema D1) → incluídos.
- Modal **Enviar orçamento** existia no inventário mas não na árvore de arquivos → incluído.
- Ordem de implementação sem fase de Cadastros (Clientes, Veículos, Catálogo) e com Busca duplicada (fases 9 e 14) → reorganizada.
- PrintPreview complementar citava "Motivo do Ajustar", mas complemento não passa mais por Ajustar → corrigido.
- `orcamento_enviado` (snake) em 7.4 → `orcamentoEnviado`.
- `Sidebar` aprovada na assinatura sem ter seção → adicionada em §18.
- Tabelas de endpoints com colunas a mais que o cabeçalho → corrigidas.
- Schema D1: unicidade de `os.numero`, `vendas.numero` e `usuario_unidades` (usuário + unidade).

---

## 3. Decisões da 1.8 (proposta — validar construindo a fatia vertical)

| # | Decisão | Onde (PRD / ARCH) |
|---|---|---|
| 1 | Storage em camada única (`server/utils/storage.ts`): coleções espelham as tabelas D1, transação com lock, `schemaVersion` + migrations. Driver de arquivo no dev | ARCH §2 |
| 2 | Dinheiro em **centavos inteiros**; datas em UTC com **fuso da unidade** para "hoje", períodos e vencimentos | ARCH §3 |
| 3 | **Matriz de permissões** ação × role (fonte de verdade da autorização) | PRD §3.5 |
| 4 | Envio do orçamento no MVP: impressão e imagem. E-mail e link ficam na Fase 2 | PRD §10.5 |
| 5 | Casos de borda: cancelar/reverter com pagamento, concluir com item pendente, pagamento maior que o saldo, desconto, item aprovado com erro | PRD §5.11 |
| 6 | Marco de validação: roteiro ponta a ponta ao fim da Etapa 5 | ROADMAP §2 |

---

## 4. Assinatura (Aprovações)

| Item | Status | Origem |
|---|---|---|
| Entidades | ✅ Aprovado | 1.2 |
| State Machine OS (status, lotes, ajustar, reverter) | ✅ Aprovado | 1.2 — inalterada |
| Financeiro (lançamento unificado) | ✅ Aprovado | 1.2 |
| Financeiro direto (sem compensação de cartão) | ✅ Aprovado | 1.3 |
| Caixa (cofre/gaveta/banco) | ✅ Aprovado | 1.2 |
| Retirada Rápida + trava de Caixa fechado | ✅ Aprovado | 1.3 / 1.6 |
| Estoque simples (baixa, estorno, delta, safe fallback; modelo de dados: ver 1.9) | ✅ Aprovado | 1.4 a 1.6 / 1.9 |
| `MovimentoEstoque` (extrato de estoque) | 🟡 Proposta | 1.7 |
| PDV | ✅ Aprovado (+ baixa de estoque) | 1.2 / 1.4 |
| Agenda | ✅ Aprovado | 1.2 |
| Multi-tenant | ✅ Aprovado | 1.2 |
| Auth (simulada) | ✅ Aprovado | 1.2 |
| Roles (5 roles + 2 perfis de menu) | ✅ Aprovado (com ajuste) | 1.2 / 1.3 |
| Busca | ✅ Aprovado | 1.2 |
| Soft Delete / Lixeira | ✅ Aprovado | 1.2 |
| Relatórios + CSV contábil | ✅ Aprovado (formato do CSV: 🟡 proposta) | 1.2 / 1.3 / 1.7 |
| Impressão (PrintPreview) | ✅ Aprovado | 1.2 |
| Onboarding | ✅ Aprovado | 1.2 |
| Backup | ✅ Aprovado | 1.2 |
| Rotas | ✅ Aprovado | 1.2 |
| Sidebar | ✅ Aprovado (aprovada na 1.2 sem seção) | 1.7 |
| Ordem de implementação | ✅ Aprovado (reorganizada) | 1.2 / 1.7 |
| Camada de storage (adapter, transação, migrations) | 🟡 Proposta | 1.8 |
| Convenções de dados (centavos, fuso) | 🟡 Proposta | 1.8 |
| Matriz de permissões | 🟡 Proposta | 1.8 |
| Envio do orçamento no MVP (impressão/imagem) | 🟡 Proposta | 1.8 |
| Casos de borda do fluxo | 🟡 Proposta | 1.8 |
| Schema D1 | ✅ Aprovado | 1.2 / 1.4 |
| Segurança | ✅ Aprovado | 1.2 |
| Separação `ItemCatalogo` / `ItemEstoque` | ✅ Aprovado | 1.9 |

---

## 5. Decisões da 1.9

| # | Decisão | Onde (PRD / ARCH) |
|---|---|---|
| 1 | `ItemCatalogo` sem campos de estoque (só referência) | PRD §4.6 |
| 2 | `ItemEstoque` como entidade separada (1:1, só produto, CASCADE) | PRD §4.6.3, ARCH §8 |
| 3 | `MovimentoEstoque.catalogoId` mantido (não vira `estoqueId`) | PRD §4.6.1 |
| 4 | `ItemOS.catalogoId` mantido como gatilho de baixa | PRD §4.8, §5.10 |
| 5 | Fluxo de baixa/estorno, PDV, badges, UX inalterados | PRD §5.10, §8.2 |
| 6 | PDV aceita **somente produto** do catálogo (serviço/mão de obra vai na OS) | PRD §4.12, §8.1 |
| 7 | Todos os itens do orçamento principal recusados: a OS permanece em `aguardando_aprovacao`; o operador usa [Ajustar] ou [Cancelar OS] | PRD §5.11 |

---

## 6. Decisões da 1.10

| # | Decisão | Onde (PRD / ARCH) |
|---|---|---|
| 1 | Carteiras: tela própria, não Config tab | PRD §4.11, §17.2 |
| 2 | Onboarding não seeda Carteiras | PRD §15.1, ARCH §4.1 |
| 3 | Gerenciar (criar, renomear, transferir, despesa, entrada): G+ | PRD §3.5 |
| 4 | Excluir: A+; guard (sessão aberta → bloqueia; lançamentos → NULL + confirm) | PRD §4.11 |
| 5 | Rename sem guard (FK por ID) | PRD §4.11 |
| 6 | Sem Cofre ativo → não abre Caixa (empty state) | PRD §7.3 |
| 7 | `ON DELETE SET NULL` em FKs de `lancamentos` e `sessoes_caixa` | ARCH §8 |

---

> **Fim do DECISIONS.md.**
