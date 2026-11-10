<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ItemEstoqueDetalhe, ItemEstoqueListagem, MovimentoEstoque } from '~/types'

const route = useRoute()
const toast = useToast()
const unidadeId = computed(() => String(route.params.unidadeId ?? ''))

const busca = ref('')
const filtroReposicao = ref('todos')

const { data, status, error, refresh } = await useFetch<ItemEstoqueListagem[]>(
  () => `/api/unidade/${unidadeId.value}/estoque`,
  {
    default: () => [],
    watch: [unidadeId]
  }
)

function stripAccents(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

const itensFiltrados = computed(() => {
  const termo = stripAccents(busca.value.trim()).toLowerCase()

  return data.value
    .filter(item => item.tipo === 'produto')
    .filter((item) => {
      const nomeNormalizado = item.nomeBusca || stripAccents(item.nome).toLowerCase()
      const skuNormalizado = (item.sku || '').toLowerCase()
      const descricaoNormalizada = stripAccents(item.descricao || '').toLowerCase()

      const correspondeBusca
        = !termo
          || nomeNormalizado.includes(termo)
          || skuNormalizado.includes(termo)
          || descricaoNormalizada.includes(termo)

      const precisaRepor
        = item.repor
          || (item.quantidadeMinima !== undefined && item.quantidadeAtual <= item.quantidadeMinima)
      const negativo = item.estoqueNegativo || item.quantidadeAtual < 0

      const correspondeFiltro
        = filtroReposicao.value === 'todos'
          || (filtroReposicao.value === 'abaixo' && (precisaRepor || negativo))
          || (filtroReposicao.value === 'negativo' && negativo)

      return correspondeBusca && correspondeFiltro
    })
})

function formatarPreco(centavos: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100)
}

function formatarData(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(iso))
}

function labelOrigem(origem: MovimentoEstoque['origem']) {
  const mapa: Record<MovimentoEstoque['origem'], string> = {
    manual: 'Ajuste manual',
    os_baixa: 'Baixa OS',
    os_estorno: 'Estorno OS',
    venda_baixa: 'Venda PDV'
  }
  return mapa[origem] || origem
}

// Modal de Ajuste e Histórico
const modalOpen = ref(false)
const itemSelecionado = ref<ItemEstoqueListagem | null>(null)
const enviando = ref(false)
const carregandoDetalhe = ref(false)
const movimentos = ref<MovimentoEstoque[]>([])

const tiposMovimento = [
  { label: 'Entrada', value: 'entrada' },
  { label: 'Saída', value: 'saida' }
]

const opcoesProdutos = computed(() =>
  data.value
    .filter(item => item.tipo === 'produto')
    .map(item => ({
      label: item.sku ? `${item.nome} (${item.sku})` : item.nome,
      value: item.catalogoId
    }))
)

const schema = z.object({
  catalogoId: z.coerce.number().int().positive('Selecione o produto'),
  tipo: z.enum(['entrada', 'saida']),
  quantidade: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(0, 'Quantidade inválida').optional()
  ),
  quantidadeMinima: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(0, 'Quantidade mínima inválida').optional()
  ),
  observacao: z.string().trim().optional().default('')
}).superRefine((dados, ctx) => {
  const temMovimento = dados.quantidade !== undefined && dados.quantidade > 0
  const alterouMinimo
    = itemSelecionado.value
      && dados.quantidadeMinima !== itemSelecionado.value.quantidadeMinima

  if (!temMovimento && !alterouMinimo) {
    ctx.addIssue({
      code: 'custom',
      path: ['quantidade'],
      message: 'Informe uma quantidade maior que zero para movimentar'
    })
  }

  if (temMovimento && dados.tipo === 'saida' && !dados.observacao.trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['observacao'],
      message: 'A observação é obrigatória nas saídas manuais'
    })
  }
})

type Schema = z.output<typeof schema>

const state = reactive<{
  catalogoId: number | undefined
  tipo: 'entrada' | 'saida'
  quantidade: number | undefined
  quantidadeMinima: number | undefined
  observacao: string
}>({
  catalogoId: undefined,
  tipo: 'entrada',
  quantidade: 1,
  quantidadeMinima: undefined,
  observacao: ''
})

async function carregarDetalhe(catalogoId: number) {
  carregandoDetalhe.value = true
  try {
    const detalhe = await $fetch<ItemEstoqueDetalhe>(
      `/api/unidade/${unidadeId.value}/estoque/${catalogoId}`
    )
    movimentos.value = detalhe.movimentos || []
  } catch {
    movimentos.value = []
  } finally {
    carregandoDetalhe.value = false
  }
}

function abrirAjusteGeral() {
  const primeiro = data.value.find(item => item.tipo === 'produto') || null
  itemSelecionado.value = primeiro
  state.catalogoId = primeiro?.catalogoId
  state.tipo = 'entrada'
  state.quantidade = 1
  state.quantidadeMinima = primeiro?.quantidadeMinima
  state.observacao = ''
  movimentos.value = []
  modalOpen.value = true

  if (primeiro) {
    carregarDetalhe(primeiro.catalogoId)
  }
}

function abrirProduto(item: ItemEstoqueListagem) {
  itemSelecionado.value = item
  state.catalogoId = item.catalogoId
  state.tipo = 'entrada'
  state.quantidade = 1
  state.quantidadeMinima = item.quantidadeMinima
  state.observacao = ''
  movimentos.value = []
  modalOpen.value = true
  carregarDetalhe(item.catalogoId)
}

watch(() => state.catalogoId, (novoCatalogoId) => {
  if (!modalOpen.value || !novoCatalogoId) return
  const encontrado = data.value.find(item => item.catalogoId === Number(novoCatalogoId)) || null
  if (encontrado && encontrado.catalogoId !== itemSelecionado.value?.catalogoId) {
    itemSelecionado.value = encontrado
    state.quantidadeMinima = encontrado.quantidadeMinima
    carregarDetalhe(encontrado.catalogoId)
  }
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
  const d = event.data
  enviando.value = true

  try {
    const temMovimento = d.quantidade !== undefined && d.quantidade > 0

    if (temMovimento) {
      await $fetch(`/api/unidade/${unidadeId.value}/estoque/ajustar`, {
        method: 'POST',
        body: {
          catalogoId: d.catalogoId,
          tipo: d.tipo,
          quantidade: d.quantidade,
          quantidadeMinima: d.quantidadeMinima,
          observacao: d.observacao
        }
      })
    } else {
      await $fetch(`/api/unidade/${unidadeId.value}/estoque/${d.catalogoId}`, {
        method: 'PUT',
        body: {
          quantidadeMinima: d.quantidadeMinima
        }
      })
    }

    toast.add({
      title: 'Estoque ajustado',
      description: 'Os dados de estoque foram atualizados com sucesso.',
      color: 'success'
    })

    await refresh()
    modalOpen.value = false
  } catch (err: unknown) {
    const statusMessage = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
    toast.add({
      title: 'Não foi possível salvar',
      description: statusMessage || 'Verifique os dados e tente novamente.',
      color: 'error'
    })
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="estoque">
    <template #header>
      <UDashboardNavbar title="Estoque">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            v-if="data.length > 0"
            label="Ajustar estoque"
            icon="i-lucide-sliders-horizontal"
            @click="abrirAjusteGeral"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-3xl space-y-4 sm:space-y-6">
        <!-- Busca + Filtro -->
        <div class="flex flex-wrap items-center justify-between gap-1.5">
          <UInput
            v-model="busca"
            icon="i-lucide-search"
            placeholder="Buscar por nome ou SKU..."
            class="w-full sm:max-w-sm"
          />
          <USelect
            v-model="filtroReposicao"
            :items="[
              { label: 'Todos os produtos', value: 'todos' },
              { label: 'Abaixo do mínimo', value: 'abaixo' },
              { label: 'Estoque negativo', value: 'negativo' }
            ]"
            class="w-full sm:w-52"
          />
        </div>

        <!-- Erro -->
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          title="Erro ao carregar estoque"
          description="Não foi possível buscar os produtos em estoque."
        >
          <template #actions>
            <UButton
              label="Tentar novamente"
              color="error"
              variant="soft"
              @click="() => refresh()"
            />
          </template>
        </UAlert>

        <!-- Loading -->
        <div v-if="status === 'pending'" class="space-y-3">
          <USkeleton class="h-14 w-full rounded-xl" />
          <USkeleton class="h-14 w-full rounded-xl" />
          <USkeleton class="h-14 w-full rounded-xl" />
        </div>

        <!-- Lista members-style -->
        <UPageCard
          v-else
          variant="subtle"
          :ui="{ container: 'p-0 sm:p-0 gap-y-0', wrapper: 'items-stretch' }"
        >
          <div v-if="itensFiltrados.length" class="divide-y divide-default">
            <div
              v-for="item in itensFiltrados"
              :key="item.id"
              class="group flex items-center gap-3 p-4 hover:bg-elevated/50 transition-colors cursor-pointer"
              @click="abrirProduto(item)"
            >
              <!-- Ícone -->
              <UAvatar
                :alt="item.nome"
                icon="i-lucide-package"
                class="size-10"
              />

              <!-- Informações do produto -->
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-sm font-medium text-highlighted truncate">
                    {{ item.nome }}
                  </p>
                  <UBadge
                    v-if="item.estoqueNegativo || item.quantidadeAtual < 0"
                    color="error"
                    variant="subtle"
                    size="sm"
                  >
                    Estoque Negativo
                  </UBadge>
                  <UBadge
                    v-else-if="item.repor || (item.quantidadeMinima !== undefined && item.quantidadeAtual <= item.quantidadeMinima)"
                    color="warning"
                    variant="subtle"
                    size="sm"
                  >
                    Repor
                  </UBadge>
                </div>

                <p class="text-sm text-muted truncate">
                  Unidade: {{ item.unidade }}<template v-if="item.sku">
                    · SKU: {{ item.sku }}
                  </template>
                  · Mínimo: {{ item.quantidadeMinima !== undefined ? `${item.quantidadeMinima} ${item.unidade}` : 'Não informado' }}<template v-if="item.custo !== undefined">
                    · Custo: {{ formatarPreco(item.custo) }}
                  </template>
                </p>
              </div>

              <!-- Saldo atual -->
              <div class="text-right shrink-0">
                <p
                  class="text-sm font-semibold tabular-nums"
                  :class="item.quantidadeAtual < 0 ? 'text-error' : 'text-highlighted'"
                >
                  {{ item.quantidadeAtual }} {{ item.unidade }}
                </p>
                <p class="text-xs text-muted">
                  Saldo atual
                </p>
              </div>

              <!-- Chevron -->
              <UIcon
                name="i-lucide-chevron-right"
                class="size-4 text-muted shrink-0 group-hover:translate-x-0.5 transition-transform"
              />
            </div>
          </div>

          <!-- Empty -->
          <UEmpty
            v-else
            icon="i-lucide-boxes"
            :title="busca || filtroReposicao !== 'todos' ? 'Nenhum produto encontrado' : 'Nenhum produto em estoque'"
            :description="busca || filtroReposicao !== 'todos' ? 'Tente ajustar a busca ou o filtro de reposição.' : 'Cadastre produtos no catálogo para acompanhar o saldo de estoque.'"
            class="py-8"
          />
        </UPageCard>

        <!-- Modal de Ajuste e Histórico -->
        <UModal
          v-model:open="modalOpen"
          title="Ajuste de Estoque"
          :description="itemSelecionado ? `${itemSelecionado.nome} · Saldo atual: ${itemSelecionado.quantidadeAtual} ${itemSelecionado.unidade}` : 'Registre entradas, saídas ou ajuste o estoque mínimo.'"
        >
          <template #body>
            <div class="space-y-6">
              <UForm
                id="estoque-ajuste-form"
                :schema="schema"
                :state="state"
                :loading="enviando"
                class="space-y-4"
                @submit="onSubmit"
              >
                <UFormField label="Produto" name="catalogoId" required>
                  <USelect
                    v-model="state.catalogoId"
                    :items="opcoesProdutos"
                    placeholder="Selecione o produto"
                  />
                </UFormField>

                <UFormField label="Tipo de movimento" name="tipo" required>
                  <URadioGroup
                    v-model="state.tipo"
                    :items="tiposMovimento"
                    orientation="horizontal"
                  />
                </UFormField>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <UFormField label="Quantidade" name="quantidade">
                    <UInput
                      v-model="state.quantidade"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                    />
                  </UFormField>

                  <UFormField label="Estoque mínimo" name="quantidadeMinima">
                    <UInput
                      v-model="state.quantidadeMinima"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Opcional"
                    />
                  </UFormField>
                </div>

                <UFormField
                  label="Observação"
                  name="observacao"
                  :required="state.tipo === 'saida' && Boolean(state.quantidade && state.quantidade > 0)"
                >
                  <UInput
                    v-model="state.observacao"
                    :placeholder="state.tipo === 'saida' ? 'Motivo da saída (obrigatório)' : 'Ex.: Compra de reposição (opcional)'"
                  />
                </UFormField>
              </UForm>

              <!-- Histórico de Movimentos -->
              <div class="space-y-2">
                <p class="text-xs font-medium text-muted uppercase tracking-wide">
                  Histórico de movimentos
                </p>

                <div v-if="carregandoDetalhe" class="space-y-2">
                  <USkeleton class="h-10 w-full rounded-lg" />
                  <USkeleton class="h-10 w-full rounded-lg" />
                </div>

                <div
                  v-else-if="movimentos.length"
                  class="max-h-48 overflow-y-auto divide-y divide-default rounded-lg border border-default"
                >
                  <div
                    v-for="mov in movimentos"
                    :key="mov.id"
                    class="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <UBadge
                          :color="mov.tipo === 'entrada' ? 'success' : 'error'"
                          variant="subtle"
                          size="sm"
                        >
                          {{ mov.tipo === 'entrada' ? '+' : '-' }}{{ mov.quantidade }}
                        </UBadge>
                        <span class="font-medium text-highlighted truncate">
                          {{ labelOrigem(mov.origem) }}
                        </span>
                      </div>
                      <p class="text-xs text-muted truncate mt-0.5">
                        {{ formatarData(mov.data) }}<template v-if="mov.observacao">
                          · {{ mov.observacao }}
                        </template>
                      </p>
                    </div>
                    <span class="text-xs text-muted tabular-nums shrink-0">
                      Saldo: {{ mov.saldoApos }}
                    </span>
                  </div>
                </div>

                <UEmpty
                  v-else
                  icon="i-lucide-history"
                  title="Sem movimentações"
                  description="Nenhum movimento registrado para este produto."
                  class="py-6"
                />
              </div>
            </div>
          </template>

          <template #footer="{ close }">
            <div class="flex-1" />
            <UButton
              label="Cancelar"
              color="neutral"
              variant="outline"
              @click="close"
            />
            <UButton
              type="submit"
              label="Confirmar"
              icon="i-lucide-check"
              :loading="enviando"
              form="estoque-ajuste-form"
            />
          </template>
        </UModal>
      </div>
    </template>
  </UDashboardPanel>
</template>
