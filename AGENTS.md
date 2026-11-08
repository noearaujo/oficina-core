# AGENTS.md — Oficina Core

> **Versão:** 1.10.2 · 07/11/2026
> **Prompt para AI dev.** Regras inegociáveis + padrões de layout práticos.
> Para o "por quê" e o detalhe: `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/CONVENTIONS.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`.

---

## 1. Stack

| Item | Escolha |
|---|---|
| Framework | Nuxt 4 (`ssr: false`) |
| UI | Nuxt UI v4 (Reka UI + Tailwind CSS) |
| Validação | Zod (frontend + server/utils) |
| Estado | `useFetch` (sem Pinia) |
| Types | `app/types/index.d.ts` (auto-import) |
| Ícones | Lucide (`i-lucide-*`) |
| Storage | Adapter `server/utils/storage.ts` (driver de arquivo no dev, D1 na Fase 2) |
| Dinheiro | **Inteiro em centavos.** Nunca float. |
| Datas | ISO UTC no storage. Fuso da unidade só na UI/filtros. |

> Detalhe: `docs/ARCHITECTURE.md` §1–3.

---

## 2. Regras Inegociáveis

| # | Regra |
|---|---|
| 1 | Dinheiro: inteiro em centavos. `8500` = R$ 85,00. Formatação só na UI. |
| 2 | Datas: ISO UTC no storage. "Hoje", períodos e vencimentos via `server/utils/datas.ts` (fuso da unidade). |
| 3 | Storage: **só** via `server/utils/storage.ts` (`db.list`, `db.get`, `db.insert`, `db.update`, `db.transaction`). |
| 4 | Estoque: **só** via `server/utils/estoque.ts`. Todo saldo muda junto com um `MovimentoEstoque`. |
| 5 | Total / saldo financeiro / badge / faturamento: **sempre calculado**, nunca armazenado (única exceção: `ItemEstoque.quantidadeAtual`, regra 4). |
| 6 | `unidadeId` em toda query de unidade (multi-tenant). |
| 7 | Funções em `server/utils/`: **sempre async**. |
| 8 | Mutação que toca mais de uma entidade → dentro de `db.transaction`. |
| 9 | `lancamento` e `MovimentoEstoque`: **nunca** delete. Correção por estorno/novo movimento. |
| 10 | Estoque nunca bloqueia: saldo insuficiente avisa (`Estoque Negativo`), não impede. |
| 11 | Pagamento em espécie (modalidade `dinheiro`) exige sessão de Caixa aberta (UI desabilita + API recusa). |
| 12 | Autorização: API valida role + unidade + associação (matriz `PRD.md` §3.5). UI é conveniência. |
| 13 | Carteira: **só** via `server/utils/carteiras.ts`. Exclusão exige A+ e guard (sessão aberta bloqueia). |

---

## 3. Estrutura de Arquivos

> Árvore completa: `docs/ARCHITECTURE.md` §6.

```
app/
├── types/index.d.ts
├── layouts/ (default, unidade, blank)
├── components/ (dashboard/, os/, caixa/, catalogo/, estoque/, pdv/, agenda/, financeiro/, relatorios/, onboarding/, shared/)
├── composables/ (useAuth, useUnidade, useConfig, useOS, useSearch, ...)
├── middleware/ (auth.global, unidade, role)
├── pages/ (login, onboarding, unidades/, usuarios/, unidade/[id]/...)
└── assets/css/main.css

server/
├── middleware/ (auth, unidade)
├── api/ (auth/, admin/, unidade/[id]/...)
├── utils/ (storage, migrations, os, estoque, financeiro, caixas, ...)
└── plugins/ (storage)
```

**Regras:**
- Types compartilhados (2+ lugares) → `app/types/index.d.ts`
- Types específicos de 1 página → inline no `<script setup>`
- Schemas Zod do server → `server/utils/[entidade].ts`
- Componentes de modal por entidade → `app/components/[entidade]/`

---

## 4. Padrões de Layout

### 4.1 Listagem com tabela (`/os`, `/clientes`, `/veiculos`, `/lancamentos`)

```
UDashboardPanel
└── UDashboardNavbar (título + botão "Novo X")
└── Body:
    ├── div.flex.flex-wrap.items-center.justify-between.gap-1.5 (busca + filtros)
    ├── UAlert (apenas se error)
    └── UTable (paginação integrada via pageSize)
```

**Regras:**
- Busca/filtros: wrapper `flex flex-wrap items-center justify-between gap-1.5`
- `UTable` com `:pagination-options="{ getPaginationRowModel(), pageSize: 10 }"`
- **NUNCA** `UPagination` separado
- **NUNCA** `ref="table"` + `tableApi`
- `#empty` → `UEmpty` (nunca `<div>` manual)
- Colunas: `accessorKey` ou `id` + `cell` com `h()`
- Ações: `UDropdownMenu` com `UButton icon="i-lucide-ellipsis-vertical" variant="ghost"`

### 4.2 Listagem estilo members / catálogo (`/catalogo`, `/estoque`)

```
UDashboardPanel
└── UDashboardNavbar (título + botão "Novo item")
└── Body:
    └── div.mx-auto.w-full.max-w-3xl.space-y-4.sm:space-y-6
        ├── div.flex.flex-wrap... (busca + filtro)
        ├── UAlert (apenas se error)
        └── UPageCard variant="subtle" :ui="{ container: 'p-0 sm:p-0 gap-y-0' }"
            └── divide-y → linhas clicáveis (abre modal)
```

**Regras:**
- Catálogo/Estoque é **referência**, não entidade de ciclo de vida
- **Sem** `UTable`, **sem** paginação, **sem** página de detalhe
- Linha inteira clicável → abre modal (edição)
- Exclusão **só no modal** (botão ghost error no footer)
- Ícones: serviço `i-lucide-wrench`, produto `i-lucide-package`
- Wrapper `max-w-3xl`
- Empty: `UEmpty` com ícone `i-lucide-package`
- Badges de estoque: `Estoque Negativo` / `Repor` (sem bloquear nada)

### 4.3 Detalhe (`/os/[id]`, `/clientes/[id]`, `/veiculos/[id]`)

```
UDashboardPanel
└── UDashboardNavbar (título ESTÁTICO: "OS #0042", "Perfil do Cliente")
└── Body:
    └── div.mx-auto.w-full.max-w-3xl
        ├── DashboardSectionHeader (naked: título + descrição + slot p/ ação)
        ├── UPageCard variant="subtle" (card de dados com header)
        │   └── #body: grid com DashboardDataField
        ├── DashboardSectionHeader (naked: próxima seção)
        └── UPageCard variant="subtle" p-0 (lista)
            └── DashboardListItem (linhas clicáveis)
```

**Regras:**
- Navbar **sempre limpa** (sem botões) — ações contextuais ficam no SectionHeader
- **Exceção multi-tab (OS):** navbar `#right` com `[Transição]` · `[Imprimir]` · `[⚙]`. Tabs horizontais (pill). Histórico: card compacto (max-h 120px, scroll interno) abaixo das tabs. Resumo: 4 cards verticais.
- Wrapper: `mx-auto w-full max-w-3xl` (sem `space-y`, sem `flex-col`)
- Espaçamento entre seções: `mb-4 sm:mb-6` (no naked)
- Card de dados: `#header` com `UAvatar` + nome + `UBadge`
- Campos: `DashboardDataField` (nunca HTML manual repetido)
- Campos vazios relevantes: **"Não informado"** (não esconder com `v-if`)
- Listas: `DashboardListItem` dentro de `divide-y divide-default`
- Loading: `USkeleton` com `rounded-xl`
- Error: `UEmpty` com ações (Voltar + Tentar novamente)

### 4.4 Form página (`/clientes/novo`, `/veiculos/novo`, `/os/novo`)

```
UDashboardPanel
└── UDashboardNavbar (título: "Novo X")
└── Body:
    └── div.mx-auto.w-full.max-w-3xl
        └── UForm (:schema, :state, :loading, class="space-y-4 sm:space-y-6")
            ├── UPageCard variant="subtle" (Seção 1)
            ├── UPageCard variant="subtle" (Seção 2)
            └── div.flex.justify-end.gap-2 (Cancelar + Submit)
```

**Regras:**
- **NUNCA** `UPageCard variant="naked"` no topo (navbar já diz o título)
- **NUNCA** `<h1>` manual
- Grid: `sm:grid-cols-2` (form) / `sm:grid-cols-6` (endereço)
- `UFormField` com `label`, `name`, `required`
- `:loading` no `UForm` (desabilita tudo durante submit)
- `:loading` no botão submit (spinner)
- **NUNCA** `:disabled="enviando"` no botão (o `:loading` já faz)
- **NUNCA** `type="email"` no `UInput` (zod já valida)
- Redirect: `route.query.redirect` ou `/entidade/:id`

### 4.5 Edição página (`/clientes/[id]/editar`, etc.)

Mesma estrutura do 4.4, com:
- `useFetch` pré-carrega → `watch` preenche `state`
- `PUT /api/unidade/:id/entidade/:id` (substitui objeto inteiro)
- Botão submit: "Salvar alterações"
- Botão cancelar: `:to="/entidade/:id"` (volta pro detalhe, não pra lista)
- `window.confirm` ao mudar tipo (PF↔PJ, carro→moto) ou proprietário
- Redirect: `navigateTo('/entidade/:id')`

### 4.6 Modal (forms curtos)

```
UModal
  title + description (props nativas)
  #body → UForm (campos)
  #footer → ações (Excluir | Cancelar | Salvar)
```

| Campos | Formato |
|---|---|
| ≤ 6 campos, 1 seção | **Modal** na listagem |
| ≥ 7 campos ou múltiplas seções | **Página** `/novo` e `/[id]/editar` |

- Props `title` e `description` do `UModal` (não inventar `#header` com `<h3>`)
- Botões no `#footer` (slot recebe `{ close }`)
- `type="submit"` no footer → `form="id-do-form"` + `:ui="{ form: 'id:...' }"` no `UForm`
- Exclusão: `window.confirm` + botão ghost error (só na edição)
- Inventário completo de modais: `docs/CONVENTIONS.md` §1

---

## 5. Componentes Customizados

### `DashboardSectionHeader`

```vue
<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>
<template>
  <UPageCard :title="title" :description="description" variant="naked" orientation="horizontal" class="mb-4 sm:mb-6">
    <slot />
  </UPageCard>
</template>
```

### `DashboardDataField`

```vue
<script setup lang="ts">
defineProps<{ label: string; value?: string; fallback?: string }>()
</script>
<template>
  <div>
    <p class="text-xs font-medium text-muted uppercase tracking-wide">{{ label }}</p>
    <p class="mt-1 text-sm" :class="value ? 'font-medium text-highlighted' : 'text-muted'">
      {{ value || fallback || 'Não informado' }}
    </p>
  </div>
</template>
```

### `DashboardListItem`

```vue
<script setup lang="ts">
defineProps<{ to: string; icon?: string; avatar?: string; title: string; subtitle?: string }>()
</script>
<template>
  <NuxtLink :to="to" class="group flex items-center gap-3 p-4 hover:bg-elevated/50 transition-colors">
    <UAvatar v-if="avatar" :alt="avatar" size="lg" class="size-10" />
    <UAvatar v-else :alt="title" :icon="icon ?? 'i-lucide-circle'" class="size-10" />
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-highlighted truncate">{{ title }}</p>
      <p v-if="subtitle" class="text-sm text-muted">{{ subtitle }}</p>
    </div>
    <UIcon name="i-lucide-chevron-right" class="size-4 text-muted shrink-0 group-hover:translate-x-0.5 transition-transform" />
  </NuxtLink>
</template>
```

### `SearchInput` (shared)

- Debounce 300ms, mínimo 3 caracteres
- `stripAccents` + `toLowerCase`
- Client-side first: se achou nos itens da página, não chama API

### `PeriodoFilter` (shared)

- Hoje / Semana / Mês / Personalizado
- Emite `dataInicio` + `dataFim` (formato `YYYY-MM-DD`, data local da unidade)

---

## 6. NUNCA

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
| `formSujo` / dirty check | Zero custo de PUT idêntico |
| `UModal` para confirmação de mudança de tipo | `window.confirm` |
| `z.number()` puro em preço/custo | Usar `z.coerce.number()` |
| `UTable` no catálogo/estoque | Lista members-style |
| Mudar `tipo` do item de catálogo na edição | Tipo é imutável |
| Hard delete em `lancamento` | Estorno no lugar |
| Hard delete em `MovimentoEstoque` | Correção por novo movimento |
| Armazenar total/saldo/badge | Sempre derivado |
| Travar aprovação/conclusão/venda por falta de estoque | Operação sem trava: só avisar |
| Alterar `ItemEstoque.quantidadeAtual` fora de `estoque.ts` | Todo saldo muda com `MovimentoEstoque` |
| Permitir "Dinheiro" sem sessão de Caixa aberta | Trava (UI + API) |
| Acessar storage fora de `server/utils/storage.ts` | Trocar driver sem tocar nas regras |
| Float para dinheiro | Sempre inteiro em centavos |
| Calcular "hoje"/período com `new Date()` direto | Usar `datas.ts` (fuso da unidade) |
| `useStorage` direto em `server/utils/` | Usar o adapter |
| Excluir Carteira com sessão aberta | Bloqueio: feche a sessão antes |
| Renomear Carteira via delete + create | FK é por ID; `PUT` basta |

---

## 7. SEMPRE

| Regra | Por quê |
|---|---|
| `color: 'success'` no toast de sucesso | Consistência |
| `color: 'error'` no toast de erro | Consistência |
| `i-lucide-trash-2` (não `i-lucide-trash`) | Consistência de ícone |
| `UBadge variant="subtle"` para status/tipo | Padrão visual |
| `UButton color="neutral" variant="outline"` para ações secundárias | Padrão visual |
| `window.confirm` para exclusão | Funcional (MVP) |
| `navigateTo(redirect \|\| /entidade/:id)` após POST | Redireciona pro detalhe |
| `await` em `useFetch` de página principal | Garante dados antes do render |
| `default: () => []` em `useFetch` de arrays | Evita `undefined` |
| `:loading` no `UForm` | Desabilita todo o form |
| `PUT` retorna o objeto atualizado | Consistência |
| Campos vazios no detalhe → "Não informado" | Layout estável |
| Placa: **sempre** UPPERCASE | Busca canônica |
| Datas: ISO string | Migração D1 |
| IDs: numéricos, auto-increment | Simplicidade + D1 |
| Funções em `server/utils/`: **async** | Pronto pra D1 |
| `unidadeId` em toda query de unidade | Isolamento multi-tenant |
| Campo Quantidade no modal de adicionar item | Evita linhas repetidas |
| Baixa/estorno via `estoque.ts`, com `estoqueBaixado` | Idempotência |
| Safe fallback no estorno (produto inexistente não derruba) | OS antiga nunca quebra |
| Exibir badges `Estoque Negativo` / `Repor` | Visibilidade sem bloqueio |
| Mutação multi-entidade → `db.transaction` | Atomicidade |
| Valores em centavos e datas via `dinheiro.ts` / `datas.ts` | Consistência |
| Select de Carteira em modais → exibir `nome` (não ID) | Legibilidade no extrato |
| Sem Cofre ativo → empty state com link `/carteiras` | Onboarding sem seed |

---

## 8. Espaçamento (Resumo Visual)

```
┌─ UDASHBOARDPANEL ─────────────────────────────────────────────┐
│  Navbar (w-full, sem max-w)                                   │
├───────────────────────────────────────────────────────────────┤
│  Body                                                          │
│  ┌─ max-w-3xl mx-auto ────────────────────────────────────┐   │
│  │  SectionHeader (naked)          [Botão contextual]      │   │
│  │  mb-4 sm:mb-6                                           │   │
│  │  ┌─ UPageCard subtle ─────────────────────────────┐     │   │
│  │  │  Header: Avatar + Nome + Badge                 │     │   │
│  │  │  Body: grid gap-x-8 gap-y-5                    │     │   │
│  │  └─────────────────────────────────────────────────┘     │   │
│  │  mb-4 sm:mb-6                                           │   │
│  │  SectionHeader (naked)                                   │   │
│  │  mb-4 sm:mb-6                                           │   │
│  │  ┌─ UPageCard subtle p-0 ─────────────────────────┐     │   │
│  │  │  ListItem (divide-y)                           │     │   │
│  │  └─────────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

---

## 9. Validação (Zod)

### Frontend
- Schema no `<script setup>` (ou no modal)
- `superRefine` para validações condicionais
- `:state` = `reactive<z.output<typeof schema>>`
- `UFormField name="campo"` vincula erro ao campo
- Preço/custo: `z.coerce.number()`

### Server
- Schema em `server/utils/[entidade].ts`
- `safeParse` → `createError` com `statusMessage` + `data: error.flatten()`
- **Sempre** `z.coerce.number()` em campos numéricos vindos de form
- Duplicidade: checar antes de criar → `409`

### Regra
- Frontend valida UX. Server valida integridade. Server é mais restritivo.

---

## 10. Fluxos de Navegação

| Padrão | Regra |
|---|---|
| POST → Redirect | `navigateTo(redirect \|\| /entidade/:id)` |
| PUT → Voltar pro detalhe | `navigateTo('/entidade/:id')` |
| Cancelar (edição) | Volta pro detalhe (não pra lista) |
| Cancelar (criação) | Volta pra lista |
| 404 | Genérico |

### Pré-seleção via Query

```ts
// /veiculos/novo?clienteId=4&redirect=/os/novo
onMounted(() => {
  const id = route.query.clienteId
  if (id && clientes.value?.length) {
    const encontrado = clientes.value.find(c => c.id === Number(id))
    if (encontrado) clienteSelecionado.value = encontrado
  }
})
```

### Exclusão

```ts
window.confirm(`Deseja realmente excluir ${nome}?`)
→ DELETE /api/unidade/:id/entidade/:id
→ toast success → refresh na listagem
→ catch → toast error com statusMessage
```

### Confirmação de mudança (reversível)

```ts
watch(() => state.tipo, (novoTipo) => {
  if (tipoOriginal && novoTipo !== tipoOriginal) {
    if (!window.confirm(`Mudar de X para Y?`)) {
      state.tipo = tipoOriginal
      return
    }
  }
})
```

---

## 11. Estados (Loading / Error / Empty)

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

## 12. Tom de Texto (PT-BR)

> Tabela completa: `docs/CONVENTIONS.md` §4.

| Contexto | Exemplo |
|---|---|
| Título de página | "OS #0042", "Novo veículo", "Catálogo" |
| Empty state | "Nenhuma OS aberta." / "Crie sua primeira OS para começar." |
| Fallback | "Não informado" |
| Toast sucesso | "OS criada" / "Pagamento lançado" / "Caixa fechado" |
| Toast erro | "Não foi possível salvar" / "Verifique os dados e tente novamente." |
| Botão primário | "Enviar orçamento", "Lançar pagamento", "Aprovar" |
| Botão secundário | "Cancelar", "Ajustar", "Recusar" |
| Placeholder | "Nome completo do cliente", "Buscar por nome, placa, OS, CPF..." |

---

## 13. Sidebar (painel da unidade)

| Item | Rota | Ícone | Visível para |
|---|---|---|---|
| Dashboard | `/unidade/[id]/` | `i-lucide-layout-dashboard` | todos |
| Agenda | `/agenda` | `i-lucide-calendar` | todos |
| OS | `/os` | `i-lucide-clipboard-list` | todos |
| PDV | `/pdv` | `i-lucide-shopping-cart` | `recepcionista`, G+ |
| Clientes | `/clientes` | `i-lucide-users` | todos |
| Veículos | `/veiculos` | `i-lucide-car` | todos |
| Catálogo | `/catalogo` | `i-lucide-package` | todos |
| Estoque | `/estoque` | `i-lucide-warehouse` | todos |
| Caixa | `/caixa` | `i-lucide-wallet` | `recepcionista` (associados), G+ |
| Carteiras | `/carteiras` | `i-lucide-landmark` | G+ |
| Relatórios | `/relatorios` | `i-lucide-bar-chart-3` | G+ |
| Lixeira | `/lixeira` | `i-lucide-trash-2` | G+ |
| Configurações | `/configuracoes` | `i-lucide-settings` | A+ |

Item sem permissão não aparece; acesso direto pela URL barrado por middleware + API.

---

## 14. Checklist para Nova Página

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
- [ ] `DashboardListItem` para linhas clicáveis
- [ ] Toast com `color` (success/error/neutral)
- [ ] `navigateTo(redirect || /entidade/:id)` após POST
- [ ] Types em `app/types/index.d.ts` (se compartilhado)
- [ ] Sem `resolveComponent`, sem `w-full` manual, sem `max-w-5xl`
- [ ] `window.confirm` ao mudar tipo/proprietário (edição)
- [ ] PUT retorna objeto atualizado
- [ ] Botão "Salvar alterações" (não "Cadastrar") na edição
- [ ] Cancelar volta pro detalhe na edição
- [ ] Form curto (≤ 6 campos) → modal; form longo → página
- [ ] Sidebar atualizada
- [ ] `unidadeId` presente em toda query
- [ ] Papel verificado no middleware e na API
- [ ] Produto exibido → badges `Estoque Negativo` / `Repor`
- [ ] Ação que recebe em dinheiro → "Dinheiro" desabilitado sem Caixa aberto
- [ ] Mutação de estoque → via `estoque.ts` + `MovimentoEstoque`
- [ ] Mutação multi-entidade → `db.transaction`
- [ ] Valores em centavos e datas via `dinheiro.ts` / `datas.ts`
- [ ] Ação nova → linha na matriz PRD §3.5 + validação na API
- [ ] Carteira em select → `nome` exibido, `id` enviado
- [ ] Sem Cofre → empty state (não error) com link

---

## 15. Referências

| Documento | Conteúdo |
|---|---|
| `docs/PRD.md` | O quê + por quê + regras de negócio + entidades + workflow |
| `docs/ARCHITECTURE.md` | Stack, storage, convenções de dados, árvore, endpoints, schema D1, segurança |
| `docs/CONVENTIONS.md` | Modais, NUNCA/SEMPRE detalhado, tom, estados, checklist |
| `docs/ROADMAP.md` | Fases de implementação + roadmap de evolução |
| `docs/DECISIONS.md` | Histórico de versões + notas de consolidação + assinaturas |

**Regra de precedence:** em caso de conflito entre este arquivo e um documento em `docs/`, vale o documento em `docs/`. Este arquivo é o atalho prático; os docs são a fonte de verdade.

---

