---
paths:
  - "app/**"
---

# Convenções de Frontend — Oficina Core

> Extraído de `docs/CONVENTIONS.md`.

## 1. Modais (Inventário Completo)

| Modal | Onde abre | Campos | Ações |
|---|---|---|---|
| **Adicionar Item** | OS (orcamento) | Busca catálogo (autocomplete), **Quantidade** (padrão 1) por item, aviso `Estoque Negativo` quando o saldo for insuficiente, seleção múltipla (checkbox) | Adicionar |
| **Editar Item** | OS (orcamento) | Quantidade, preço. Nome e tipo no header do modal como contexto (texto). Imutáveis na OS. | Salvar, Excluir |
| **Enviar orçamento** | OS (aba Orçamento) | Canal: Impressão/PDF ou Imagem (e-mail e link desabilitados, "Em breve") | Confirmar envio |
| **Ajustar** | OS (orcamento) | Motivo (textarea) | Ajustar |
| **Recusar Item** | OS (orcamento) | Motivo (textarea) | Recusar |
| **Aprovar Todos** | OS (orcamento) | Confirmação (texto dinâmico) | Confirmar |
| **Gerenciar OS** | OS (header ⚙) | Reverter (motivo) / Cancelar (confirm "CANCELAR") / Apagar | Por zona |
| **Lançar Pagamento** | OS (faturamento) | Valor, forma (Dinheiro desabilitado sem Caixa aberto), sessão de Caixa ou Carteira bancária compatível, data, hora, obs | Lançar |
| **Estornar** | OS (faturamento) | Confirmação + motivo | Estornar |
| **Imprimir** | OS (header) | Preview A4 full-screen | Voltar, PNG, Imprimir/PDF |
| **Agendamento** | Agenda | Cliente, veículo, data/hora, serviço, obs | Criar, Remarcar, Cancelar, Converter em OS |
| **Abrir Caixa** | Caixa selecionado | Valor de abertura; Cofre de origem obrigatório se valor > 0 | Abrir sessão |
| **Fechar Caixa** | Sessão | Saldo esperado, valor contado, Cofre destino, motivo se houver diferença | Fechar sessão |
| **Reforço** | Sessão | Valor, Carteira Cofre de origem, motivo | Confirmar |
| **Sangria** | Sessão | Valor, Carteira Cofre de destino, motivo | Confirmar |
| **Despesa** | Sessão ou Carteira | Valor, categoria, origem (sessão/Cofre/Banco), motivo | Confirmar |
| **Retirada Rápida** | Sessão aberta | Valor, justificativa (categoria fixa `retirada_rapida`) | Confirmar |
| **Transferir** | Carteiras | Origem, destino, valor, data, hora, motivo | Transferir |
| **Lançar Despesa** | Financeiro (avulso) | Valor, categoria, Carteira ou sessão aberta, data, hora, obs | Lançar |
| **Nova Carteira** | Carteiras | Tipo (banco/cofre), nome, saldo inicial | Criar |
| **Entrada Externa** | Carteiras | Tipo (aporte/empréstimo), contraparte, valor, data, obs | Confirmar |
| **Associar usuários ao Caixa** | Config (caixas) | Caixa, usuários da unidade autorizados | Salvar |
| **Novo Caixa** | Config (caixas) | Nome, usuários autorizados | Criar |
| **Item Catálogo** | Catálogo | Nome, tipo, descrição, preço, custo, unidade; se produto: SKU, estoque mínimo e saldo inicial (só na criação). *Exceção à regra dos 6 campos: campos condicionais por tipo, mantido em modal* | Salvar, Excluir |
| **Ajuste de Estoque** | Estoque | Produto, tipo (entrada/saída), quantidade, observação (obrigatória na saída) | Confirmar |
| **Recibo** | PDV | Preview A4 full-screen (modo RECIBO) | Voltar, PNG, Imprimir |
| **Novo Fornecedor** | *(Fase 2)* | Nome, condição | Salvar |

### Regra Modal vs. Página

| Campos | Formato |
|---|---|
| ≤ 6 campos, 1 seção | **Modal** |
| ≥ 7 campos ou múltiplas seções | **Página** (`/novo` e `/[entidadeId]/editar`) |

---

## 2. NUNCA

| Regra | Por quê |
|---|---|
| `resolveComponent('UButton')` | Auto-import do Nuxt UI |
| `class="w-full"` em `UInput`/`USelect` | `UFormField` já aplica |
| `max-w-5xl` | Usar `max-w-3xl` |
| `space-y-*` no wrapper de cards de detalhe | Usar `mb-4 sm:mb-6` nos SectionHeaders |
| `UPagination` separado | Paginação integrada ao `UTable` |
| `<div>` manual no `#empty` | Usar `UEmpty` |
| `USeparator` entre seções de form | Os grids já separam |
| `type="email"` no `UInput` | Zod já valida |
| `console.error` no submit | Toast trata |
| `:disabled="enviando"` no botão | `:loading` já desabilita |
| `<h1>` manual no body | Navbar já tem o título |
| `UPageCard variant="naked"` no topo de form | Redundante com navbar |
| Botões no navbar de páginas de detalhe | Ações contextuais ficam no SectionHeader |
| `lazy: true` em `useFetch` de página principal | A lista É o conteúdo |
| `ref="table"` + `tableApi` | Paginação integrada |
| `formSujo` / dirty check | Não aplica (zero custo de PUT idêntico) |
| `UModal` para confirmação de mudança de tipo | `window.confirm` |
| `UTable` no catálogo/estoque | Lista members-style |
| Mudar `tipo` do item de catálogo na edição | Tipo é imutável |
| Travar aprovação, conclusão ou venda por falta de saldo de estoque | Operação sem trava: só avisar (`Estoque Negativo`) |
| Permitir "Dinheiro" sem sessão de Caixa aberta | Trava de Caixa fechado (UI + API) |

---

## 3. SEMPRE

| Regra | Por quê |
|---|---|
| `color: 'success'` no toast de sucesso | Consistência |
| `color: 'error'` no toast de erro | Consistência |
| `i-lucide-trash-2` (não `i-lucide-trash`) | Consistência de ícone |
| `UBadge variant="subtle"` para status/tipo | Padrão visual |
| `UButton color="neutral" variant="outline"` para ações secundárias | Padrão visual |
| `window.confirm` para exclusão | Funcional (MVP) |
| `navigateTo(redirect \|\| /entidade/:resourceId)` após POST | Redireciona pro detalhe |
| `await` em `useFetch` de página principal | Garante dados antes do render |
| `default: () => []` em `useFetch` de arrays | Evita `undefined` |
| `:loading` no `UForm` | Desabilita todo o form |
| Campos vazios no detalhe → "Não informado" | Layout estável |
| Campo Quantidade no modal de adicionar item | Evita linhas repetidas e define a baixa |
| Exibir badges `Estoque Negativo` / `Repor` | Visibilidade sem bloqueio |

---

## 4. Tom de Texto (PT-BR)

| Contexto | Exemplo |
|---|---|
| Título de página | "OS #0042", "Novo veículo", "Catálogo", "Estoque", "Caixa", "PDV" |
| Empty state | "Nenhuma OS aberta." / "Crie sua primeira OS para começar." |
| Fallback | "Não informado" |
| Toast sucesso | "OS criada" / "Pagamento lançado" / "Caixa fechado" / "Venda V-0001 finalizada" / "Estoque ajustado" / "Retirada registrada" |
| Toast erro | "Não foi possível salvar" / "Verifique os dados e tente novamente." |
| Botão primário | "Enviar orçamento", "Lançar pagamento", "Aprovar", "Fechar caixa", "Finalizar venda" |
| Botão secundário | "Cancelar", "Ajustar", "Recusar", "Transferir" |
| Badge status OS | "Aberta", "Em diagnóstico", "Aguardando aprovação", "Aprovada", "Em execução", "Concluída", "Entregue", "Cancelada" |
| Badge pagamento | "Pendente", "Parcial", "Pago" |
| Badge item | "Pendente", "Aprovado", "Recusado" |
| Badge caixa | "Aberto", "Fechado" |
| Badge garantia | "Garantia válida", "Fora da garantia" |
| Badge estoque | "Estoque Negativo", "Repor" |
| Alerta de Caixa fechado | "Abra um Caixa para receber em dinheiro ou escolha Pix/cartão." |
| Placeholder | "Nome completo do cliente", "Ex.: Troca de óleo", "Buscar por nome, placa, OS, CPF..." |

---

## 5. Estados (Loading / Error / Empty)

| Estado | Componente | Onde |
|---|---|---|
| Loading página | `USkeleton` com `rounded-xl` | `v-if="status === 'pending'"` |
| Error página | `UEmpty` com ações (Voltar + Retry) | `v-else-if` quando error |
| Empty lista | `UEmpty` (título + descrição dinâmicos) | `#empty` do `UTable` ou dentro do card |
| Loading sub-seção | `USkeleton` inline | Dentro do card |
| Error sub-seção | `<p class="text-sm text-muted">` | Mensagem simples |
| Empty sub-seção | `UEmpty` com `class="py-8"` | Dentro do card |
| Error listagem | `UAlert` + "Tentar novamente" | Acima da tabela/lista |

---

## 6. Checklist para Nova Página

Ao criar uma nova página, verificar:

- [ ] `UDashboardPanel` com `id` único
- [ ] `UDashboardNavbar` com `#leading` (sidebar collapse)
- [ ] Navbar sem botões (detalhe) ou com 1 botão primário (listagem/form)
- [ ] Wrapper `mx-auto w-full max-w-3xl` (detalhe/form/catálogo)
- [ ] Loading state (`USkeleton`)
- [ ] Error state (`UEmpty` ou `UAlert` + ações)
- [ ] Empty state (`UEmpty`)
- [ ] `mb-4 sm:mb-6` entre seções (detalhe)
- [ ] `DashboardSectionHeader` para títulos de seção
- [ ] `DashboardDataField` para campos
- [ ] `DashboardListItem` para linhas clicáveis (quando navegação)
- [ ] Toast com `color` (success/error/neutral)
- [ ] `navigateTo(redirect || /entidade/:resourceId)` após POST (página)
- [ ] Types em `app/types/index.d.ts` (se compartilhado)
- [ ] Sem `resolveComponent`, sem `w-full` manual, sem `max-w-5xl`
- [ ] `window.confirm` ao mudar tipo/proprietário (edição)
- [ ] Botão "Salvar alterações" (não "Cadastrar") na edição
- [ ] Cancelar volta pro detalhe (não pra lista) na edição
- [ ] Form curto (≤ 6 campos) → modal; form longo → página
- [ ] Sidebar atualizada com o novo item
- [ ] Produto exibido em lista/modal → badges `Estoque Negativo` / `Repor` (sem bloquear nada)
- [ ] Ação que recebe em dinheiro → "Dinheiro" desabilitado sem sessão de Caixa aberta (e API valida)
- [ ] Carteira referenciada em modal (pagamento, abertura de caixa, transferência) → select com nome, não ID

---

## 7. Impressão / PrintPreview

- Componentes de impressão: shell em `app/components/os/PrintPreview.vue`, templates em `app/components/templates/`
- Novo template: criar em `templates/`, usar via slot no PrintPreview
- Zero fetch no PrintPreview: dados vêm de props (estado reativo)
- Dependência: `modern-screenshot` (captura PNG)


## Parâmetros de rota

- Nomear parâmetros dinâmicos semanticamente: `[unidadeId]`, `[clienteId]`, `[veiculoId]`, `[osId]` etc. Nunca usar `[id]` genérico.
- Obter valores por `const route = useRoute()` e `route.params.<nomeSemantico>`.
- Não usar `route.path`, `route.fullPath`, regex ou `split()` para descobrir IDs que já existem em `route.params`.
- Não criar fallbacks para parâmetros antigos ou para IDs presumidos. Tratar ausência de parâmetro como contexto inválido.
