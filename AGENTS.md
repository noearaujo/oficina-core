```md
# Oficina SaaS — Convenções de Projeto

> Documento de referência para desenvolvimento e manutenção.
> Qualquer IA ou dev que trabalhar neste projeto DEVE seguir estas regras.

---

## 1. Stack

| Item      | Escolha                              |
| --------- | ------------------------------------ |
| Framework | Nuxt 4 (SSR: **false**)              |
| UI        | Nuxt UI v4 (Reka UI + Tailwind CSS)  |
| Validação | Zod (frontend + server/utils)        |
| Estado    | `useFetch` (sem Pinia)               |
| Types     | `app/types/index.d.ts` (auto-import) |
| Ícones    | Lucide (`i-lucide-*`)                |
| Storage   | `useStorage('data')` (localStorage)  |

---

## 2. Estrutura de Arquivos

```text
app/
├── types/
│   └── index.d.ts
├── components/
│   └── dashboard/
│       ├── SectionHeader.vue
│       ├── DataField.vue
│       └── ListItem.vue
├── pages/
│   ├── clientes/
│   │   ├── index.vue
│   │   ├── novo.vue
│   │   └── [id]/
│   │       ├── index.vue
│   │       └── editar.vue
│   ├── veiculos/
│   │   ├── index.vue
│   │   ├── novo.vue
│   │   └── [id]/
│   │       ├── index.vue
│   │       └── editar.vue
│   └── os/
│       ├── index.vue
│       ├── novo.vue
│       └── [id]/
│           ├── index.vue
│           └── orcamento.vue
└── layouts/
    └── default.vue

server/
├── api/
│   ├── clientes/
│   │   ├── index.get.ts
│   │   ├── index.post.ts
│   │   ├── [id].get.ts
│   │   ├── [id].put.ts
│   │   └── [id].delete.ts
│   └── veiculos/
│       ├── index.get.ts
│       ├── index.post.ts
│       ├── [id].get.ts
│       ├── [id].put.ts
│       └── [id].delete.ts
└── utils/
    ├── clientes.ts
    └── veiculos.ts
```

**Regras:**

- Types compartilhados (usados em 2+ lugares) → `app/types/index.d.ts`
- Types específicos de 1 página (ex: `VeiculoTabela`) → inline no `<script setup>`
- Schemas Zod do server → `server/utils/[entidade].ts`

---

## 3. Padrões de Layout

### 3.1 Listagem (`/clientes`, `/veiculos`)

```text
UDashboardPanel
└── UDASHBOARDNavbar (título + botão "Novo X")
└── Body:
    ├── div.flex.flex-wrap.items-center.justify-between.gap-1.5 (busca + filtros)
    ├── UAlert (apenas se error)
    └── UTable (paginação integrada via pageSize)
```

**Regras:**

- Busca/filtros: wrapper `flex flex-wrap items-center justify-between gap-1.5`
- `UTable` com `:pagination-options="{ getPaginationRowModel(), pageSize: 10 }"`
- **NUNCA** usar `UPagination` separado
- **NUNCA** usar `ref="table"` + `tableApi`
- `#empty` → `UEmpty` (nunca `<div>` manual)
- Colunas: `accessorKey` ou `id` + `cell` com `h()`
- Ações: `UDropdownMenu` com `UButton icon="i-lucide-ellipsis-vertical" variant="ghost"`

### 3.2 Detalhe (`/clientes/[id]`, `/veiculos/[id]`)

```text
UDashboardPanel
└── UDASHBOARDNavbar (título ESTÁTICO: "Perfil do Cliente" / "Perfil do Veículo")
└── Body:
    └── div.mx-auto.w-full.max-w-3xl
        ├── DashboardSectionHeader (naked: título + descrição + slot p/ ação)
        ├── UPageCard variant="subtle" (card de dados com header: avatar + nome + badge)
        │   └── #body: grid com DashboardDataField
        ├── DashboardSectionHeader (naked: próxima seção)
        └── UPageCard variant="subtle" :ui="{ container: 'p-0 sm:p-0 gap-y-0' }" (lista)
            └── DashboardListItem (linhas clicáveis)
```

**Regras:**

- Navbar **sempre limpa** (sem botões) — ações contextuais ficam no SectionHeader
- Wrapper: `mx-auto w-full max-w-3xl` (sem `space-y`, sem `flex-col`)
- Espaçamento entre seções: `mb-4 sm:mb-6` (no naked)
- Card de dados: `#header` com `UAvatar` + nome + `UBadge`
- Campos: `DashboardDataField` (nunca HTML manual repetido)
- Listas: `DashboardListItem` dentro de `divide-y divide-default`
- Loading: `USkeleton` com `rounded-xl`
- Error: `UEmpty` com ações (Voltar + Tentar novamente)

### 3.3 Form (`/clientes/novo`, `/veiculos/novo`)

```text
UDashboardPanel
└── UDASHBOARDNavbar (título: "Novo X")
└── Body:
    └── div.mx-auto.w-full.max-w-3xl
        └── UForm (:schema, :state, :loading, class="space-y-4 sm:space-y-6")
            ├── UPageCard variant="subtle" (Seção 1)
            ├── UPageCard variant="subtle" (Seção 2)
            ├── ...
            └── div.flex.justify-end.gap-2 (Cancelar + Submit)
```

**Regras:**

- **NUNCA** `UPageCard variant="naked"` no topo (navbar já diz o título)
- **NUNCA** `<h1>` manual
- Grid: `sm:grid-cols-2` (form) / `sm:grid-cols-6` (endereço)
- `UFormField` com `label`, `name`, `required` (quando aplicável)
- `:loading` no `UForm` (desabilita tudo durante submit)
- `:loading` no botão submit (spinner)
- **NUNCA** `:disabled="enviando"` no botão (o `:loading` já faz)
- **NUNCA** `type="email"` no `UInput` (zod já valida)
- Redirect: `route.query.redirect` ou `/entidade/:id`

### 3.4 Edição (`/clientes/[id]/editar`, `/veiculos/[id]/editar`)

```text
UDashboardPanel
└── UDASHBOARDNavbar (título: "Editar X")
└── Body:
    └── div.mx-auto.w-full.max-w-3xl
        └── UForm (:schema, :state, :loading, class="space-y-4 sm:space-y-6")
            ├── UPageCard variant="subtle" (mesmas seções do form novo)
            └── div.flex.justify-end.gap-2 (Cancelar + Salvar)
```

**Diferenças vs. Form (novo):**

- `useFetch` pré-carrega os dados → `watch` preenche o `state`
- `PUT /api/entidade/:id` (substitui objeto inteiro)
- Botão submit: "Salvar alterações"
- Botão cancelar: `:to="/entidade/:id"` (volta pro detalhe, não pra lista)
- `window.confirm` ao mudar tipo (PF↔PJ, carro→moto) ou proprietário
- Redirect: `navigateTo('/entidade/:id')` (sempre volta pro detalhe)

---

## 4. Componentes Customizados

### `DashboardSectionHeader`

```vue
<!-- app/components/dashboard/SectionHeader.vue -->
<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>
<template>
  <UPageCard :title="title" :description="description" variant="naked" orientation="horizontal" class="mb-4 sm:mb-6">
    <slot />
  </UPageCard>
</template>
```

**Uso:** `<DashboardSectionHeader title="..." description="..."> <UButton .../> </DashboardSectionHeader>`

### `DashboardDataField`

```vue
<!-- app/components/dashboard/DataField.vue -->
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

**Uso:** `<DashboardDataField label="CPF" :value="cliente.cpf" />`

### `DashboardListItem`

```vue
<!-- app/components/dashboard/ListItem.vue -->
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

**Uso:**

```vue
<DashboardListItem
  :to="`/veiculos/${v.id}`"
  icon="i-lucide-car"
  :title="v.marca + ' ' + v.modelo"
  :subtitle="v.placa"
/>
```

---

## 5. Convenções de Código (NUNCA / SEMPRE)

### NUNCA

| Regra | Por quê |
|---|---|
| `resolveComponent('UButton')` | Auto-import do Nuxt UI |
| `class="w-full"` em `UInput`/`USelect` | `UFormField` já aplica |
| `max-w-5xl` | Usar `max-w-3xl` |
| `space-y-*` no wrapper de cards | Usar `mb-4 sm:mb-6` nos cards |
| `UPagination` separado | Paginação integrada ao `UTable` |
| `<div>` manual no `#empty` | Usar `UEmpty` |
| `USeparator` entre seções de form | Os grids já separam |
| `USeparator` entre RadioGroup e campos | Inútil |
| `type="email"` no `UInput` | Zod já valida |
| `console.error` no submit | Toast trata |
| `:disabled="enviando"` no botão | `:loading` já desabilita |
| `value-key="value"` no `USelect` | Padrão já usa `value` |
| `<h1>` manual no body | Navbar já tem o título |
| `UPageCard variant="naked"` no topo de form | Redundante com navbar |
| Botões no navbar de páginas de detalhe | Ações contextuais ficam no SectionHeader |
| `⋮` (dropdown de ações) em navbar de detalhe | Exclusão vai pro modal de edição |
| `lazy: true` em `useFetch` de página principal | A lista É o conteúdo |
| `ref="table"` + `tableApi` | Paginação integrada |
| `formSujo` / dirty check | Não aplica (localStorage, zero custo de PUT idêntico) |
| `UModal` para confirmação de mudança de tipo/proprietário | `window.confirm` (reversível, bloqueia ação) |

### SEMPRE

| Regra | Por quê |
|---|---|
| `color: 'success'` no toast de sucesso | Consistência |
| `color: 'error'` no toast de erro | Consistência |
| `i-lucide-trash-2` (não `i-lucide-trash`) | Consistência de ícone |
| `UBadge variant="subtle"` para status/tipo | Padrão visual |
| `UButton color="neutral" variant="outline"` para ações secundárias | Padrão visual |
| `UButton` (default) para ação primária | Padrão visual |
| `window.confirm` para exclusão (por enquanto) | Funcional; migrar pra `UModal` quando houver |
| `navigateTo(redirect ?? /entidade/:id)` após POST | Redireciona pro detalhe ou volta de onde veio |
| `await` em `useFetch` de página principal | Garante dados antes do render |
| `default: () => []` em `useFetch` de arrays | Evita `undefined` |
| `watch(id, () => refresh())` em páginas de detalhe | Recarrega ao trocar de rota |
| `:loading` no `UForm` | Desabilita todo o form durante submit |
| `onMounted` para pré-seleção via query param | SSR: false, dados já prontos |
| `window.confirm` ao mudar tipo ou proprietário | Reversível, bloqueia a ação até resposta |
| `PUT` retorna o objeto atualizado | Consistência com POST |
| Duplicidade no PUT exclui o próprio registro | `if (i === index) return false` |

---

## 6. Espaçamento (Resumo Visual)

```text
┌─ UDASHBOARDPANEL ─────────────────────────────────────────────┐
│  Navbar (w-full, sem max-w)                                   │
├───────────────────────────────────────────────────────────────┤
│  Body (gap nativo entre filhos)                               │
│                                                               │
│  ┌─ max-w-3xl mx-auto ────────────────────────────────────┐   │
│  │                                                         │   │
│  │  SectionHeader (naked)          [Botão contextual]      │   │
│  │  mb-4 sm:mb-6                                           │   │
│  │  ┌─ UPageCard subtle ─────────────────────────────┐     │   │
│  │  │  Header: Avatar + Nome + Badge                 │     │   │
│  │  │  Body: grid gap-x-8 gap-y-5                    │     │   │
│  │  │    DataField | DataField                       │     │   │
│  │  │    DataField | DataField                       │     │   │
│  │  └─────────────────────────────────────────────────┘     │   │
│  │  mb-4 sm:mb-6                                           │   │
│  │  SectionHeader (naked)          [Botão contextual]      │   │
│  │  mb-4 sm:mb-6                                           │   │
│  │  ┌─ UPageCard subtle p-0 ─────────────────────────┐     │   │
│  │  │  ListItem (divide-y)                           │     │   │
│  │  │  ListItem                                      │     │   │
│  │  └─────────────────────────────────────────────────┘     │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

---

## 7. Validação (Zod)

### Frontend

- Schema no `<script setup>` da página
- `superRefine` para validações condicionais (PF/PJ)
- `:state` = `reactive<z.output<typeof schema>>`
- `UFormField name="campo"` vincula erro ao campo

### Server

- Schema em `server/utils/[entidade].ts`
- `safeParse` → `createError` com `statusMessage` + `data: error.flatten()`
- `default('')` em campos opcionais (garante shape consistente)
- Duplicidade: checar antes de criar → `409`

### Regras

- Frontend valida UX (mensagens amigáveis)
- Server valida integridade (nunca confiar no frontend)
- Os dois podem ter regras diferentes (server é mais restritivo)

---

## 8. Fluxos de Navegação

### POST → Redirect

```ts
const redirect = route.query.redirect as string | undefined
await navigateTo(redirect || `/entidade/${novo.id}`)
```

### Pré-seleção via Query

```ts
// /veiculos/novo?clienteId=4
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
→ DELETE /api/entidade/:id
→ toast success → navigateTo('/entidades')
→ catch → toast error com statusMessage
```

### PUT → Voltar pro detalhe

```ts
await $fetch(`/api/entidade/${id}`, { method: 'PUT', body })
→ toast success
→ navigateTo(`/entidade/${id}`)
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
  // limpar campos do tipo anterior
})
```

---

## 9. Estados (Loading / Error / Empty)

| Estado | Componente | Onde |
|---|---|---|
| Loading página | `USkeleton` com `rounded-xl` | `v-if="status === 'pending'"` |
| Error página | `UEmpty` com ações (Voltar + Retry) | `v-else-if` quando error ou entidade vazia |
| Empty lista | `UEmpty` (título + descrição dinâmicos) | `#empty` do `UTable` |
| Loading sub-seção | `USkeleton` inline | Dentro do card |
| Error sub-seção | `<p class="text-sm text-muted">` | Mensagem simples |
| Empty sub-seção | `UEmpty` com `class="py-8"` | Dentro do card |

---

## 10. Endpoints

| Método | Rota | Retorna |
|---|---|---|
| GET | `/api/clientes` | `Cliente[]` |
| POST | `/api/clientes` | `Cliente` (com `id`) |
| GET | `/api/clientes/:id` | `Cliente` |
| PUT | `/api/clientes/:id` | `Cliente` (atualizado) |
| DELETE | `/api/clientes/:id` | `200` (409 se houver veículos) |
| GET | `/api/veiculos` | `Veiculo[]` |
| POST | `/api/veiculos` | `Veiculo` (com `id`) |
| GET | `/api/veiculos/:id` | `Veiculo` |
| PUT | `/api/veiculos/:id` | `Veiculo` (atualizado) |
| DELETE | `/api/veiculos/:id` | `200` |

---

## 11. Tipos (app/types/index.d.ts)

```ts
export interface Endereco {
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
}

export interface Cliente {
  id: number
  nome: string
  tipoPessoa: 'fisica' | 'juridica'
  cpf?: string
  razaoSocial?: string
  nomeFantasia?: string
  cnpj?: string
  telefone?: string
  email?: string
  endereco?: Endereco
}

export interface Veiculo {
  id: number
  clienteId: number
  tipo: string
  marca: string
  modelo: string
  versao?: string
  placa: string
  anoFabricacao: string | number
  anoModelo: string | number
  cor?: string
  combustivel?: string
  quilometragem?: string | number
  chassi?: string
}
```

**Regra:** toda interface exportada aqui fica disponível globalmente (auto-import). Não precisa de `import type` nos `.vue`.

---

## 12. Checklist para Nova Página

Ao criar uma nova página, verificar:

- [ ] `UDashboardPanel` com `id` único
- [ ] `UDashboardNavbar` com `#leading` (sidebar collapse)
- [ ] Navbar sem botões (detalhe) ou com 1 botão primário (listagem/form)
- [ ] Wrapper `mx-auto w-full max-w-3xl` (detalhe/form)
- [ ] Loading state (`USkeleton`)
- [ ] Error state (`UEmpty` com ações)
- [ ] Empty state (`UEmpty`)
- [ ] `mb-4 sm:mb-6` entre seções
- [ ] `DashboardSectionHeader` para títulos de seção
- [ ] `DashboardDataField` para campos
- [ ] `DashboardListItem` para linhas clicáveis
- [ ] Toast com `color` (success/error/neutral)
- [ ] `navigateTo(redirect || /entidade/:id)` após POST
- [ ] Types em `app/types/index.d.ts` (se compartilhado)
- [ ] Sem `resolveComponent`, sem `w-full` manual, sem `max-w-5xl`
- [ ] `window.confirm` ao mudar tipo/proprietário (edição)
- [ ] PUT retorna objeto atualizado (backend)
- [ ] Duplicidade no PUT exclui próprio registro
- [ ] Botão "Salvar alterações" (não "Cadastrar")
- [ ] Cancelar volta pro detalhe (não pra lista)

---

## 13. Tom de Texto (PT-BR)

| Contexto | Exemplo |
|---|---|
| Título de página | "Perfil do Cliente", "Novo veículo" |
| Descrição de seção | "Informações pessoais e de contato." |
| Empty state | "Nenhum veículo cadastrado." / "Cadastre seu primeiro veículo para começar." |
| Fallback de campo | "Não informado" |
| Toast sucesso | "Cliente cadastrado" / "O cliente foi cadastrado com sucesso." |
| Toast erro | "Não foi possível cadastrar" / "Verifique os dados e tente novamente." |
| Botão primário | "Cadastrar cliente", "Cadastrar veículo" |
| Botão secundário | "Cancelar", "Editar", "Trocar" |
| Placeholder | "Nome completo do cliente", "000.000.000-00" |

---

## 14. O Que Ainda Não Existe (Roadmap)

| Recurso | Status |
|---|---|
| Edição de cliente/veículo | ✅ Implementado |
| `UModal` para exclusão | Futuro — substituir `window.confirm` |
| Ordens de Serviço (OS) | Futuro — abas (Visão geral, Orçamento, Histórico) |
| Catálogo de produtos/serviços | Futuro — base pra OS |
| Multi-unidade (oficinas) | Futuro — mover rotas pra `/unidade/[id]/` |
| CEP → auto-preencher endereço | Futuro — API ViaCEP |
| Foto de veículo | Futuro — trocar `icon` por `:src` no `UAvatar` |

---

*Última atualização: 01/11/2026*
```