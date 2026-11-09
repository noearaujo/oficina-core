<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  CaixaComEstado,
  Carteira,
  Cliente,
  FormaPagamentoPDV,
  ItemCatalogo,
  ItemEstoqueListagem,
  Venda
} from '~/types'

const route = useRoute()
const toast = useToast()
const unidadeId = computed(() => route.path.match(/\/unidade\/([^/]+)/)?.[1] ?? String(route.params.id))

const [
  { data: catalogo, status: statusCatalogo, error: errorCatalogo, refresh: refreshCatalogo },
  { data: estoques, refresh: refreshEstoques },
  { data: clientes, refresh: refreshClientes },
  { data: caixas, refresh: refreshCaixas },
  { data: carteiras, refresh: refreshCarteiras },
  { data: vendas, status: statusVendas, refresh: refreshVendas }
] = await Promise.all([
  useFetch<ItemCatalogo[]>(() => `/api/unidade/${unidadeId.value}/catalogo`, {
    default: () => [],
    watch: [unidadeId]
  }),
  useFetch<ItemEstoqueListagem[]>(() => `/api/unidade/${unidadeId.value}/estoque`, {
    default: () => [],
    watch: [unidadeId]
  }),
  useFetch<Cliente[]>(() => `/api/unidade/${unidadeId.value}/clientes`, {
    default: () => [],
    watch: [unidadeId]
  }),
  useFetch<CaixaComEstado[]>(() => `/api/unidade/${unidadeId.value}/caixa`, {
    default: () => [],
    watch: [unidadeId]
  }),
  useFetch<Carteira[]>(() => `/api/unidade/${unidadeId.value}/carteiras`, {
    default: () => [],
    watch: [unidadeId]
  }),
  useFetch<Venda[]>(() => `/api/unidade/${unidadeId.value}/pdv`, {
    default: () => [],
    watch: [unidadeId]
  })
])

function stripAccents(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function formatarPreco(centavos: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((centavos || 0) / 100)
}

function formatarData(iso?: string) {
  if (!iso) return 'Não informado'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(iso))
}

function labelFormaPagamento(forma: string) {
  const mapa: Record<string, string> = {
    dinheiro: 'Dinheiro',
    pix: 'Pix',
    credito: 'Cartão de Crédito',
    debito: 'Cartão de Débito'
  }
  return mapa[forma] || forma
}

const estoquePorCatalogoId = computed(() => {
  const mapa = new Map<number, ItemEstoqueListagem>()
  for (const est of estoques.value) {
    mapa.set(Number(est.catalogoId), est)
  }
  return mapa
})

// SÓ itens tipo='produto' no PDV
const produtosCatalogo = computed(() =>
  catalogo.value.filter(item => item.tipo === 'produto')
)

const buscaProduto = ref('')

const produtosFiltrados = computed(() => {
  const termo = stripAccents(buscaProduto.value.trim()).toLowerCase()

  return produtosCatalogo.value.filter((produto) => {
    if (!termo) return true
    const nomeNorm = produto.nomeBusca || stripAccents(produto.nome).toLowerCase()
    const skuNorm = (produto.sku || '').toLowerCase()
    const descNorm = stripAccents(produto.descricao || '').toLowerCase()
    return nomeNorm.includes(termo) || skuNorm.includes(termo) || descNorm.includes(termo)
  })
})

const opcoesClientes = computed(() => [
  { label: 'Avulso', value: 0 },
  ...clientes.value
    .filter(c => !c.deletedAt)
    .map(c => ({
      label: c.tipoPessoa === 'fisica' ? c.nome : (c.nomeFantasia || c.razaoSocial || c.nome),
      value: c.id
    }))
])

const caixasAbertos = computed(() =>
  caixas.value.filter(c => c.aberta && c.sessaoCaixaId !== null)
)

const temCaixaAberto = computed(() => caixasAbertos.value.length > 0)

const opcoesCaixasAbertos = computed(() =>
  caixasAbertos.value.map(c => ({
    label: `${c.nome} (Saldo: ${formatarPreco(c.saldoEsperado)})`,
    value: Number(c.sessaoCaixaId)
  }))
)

const bancosAtivos = computed(() =>
  carteiras.value.filter(c => c.tipo === 'banco' && c.ativa !== false)
)

const opcoesBancos = computed(() =>
  bancosAtivos.value.map(c => ({
    label: `${c.nome} (${formatarPreco(c.saldo ?? c.saldoInicial)})`,
    value: c.id
  }))
)

const opcoesFormasPagamento = computed(() => [
  {
    label: 'Dinheiro',
    value: 'dinheiro',
    disabled: !temCaixaAberto.value
  },
  {
    label: 'Pix',
    value: 'pix'
  },
  {
    label: 'Crédito',
    value: 'credito'
  },
  {
    label: 'Débito',
    value: 'debito'
  }
])

interface ItemCarrinhoPDV {
  catalogoId: number
  nome: string
  unidade: string
  sku?: string
  quantidade: number
  precoUnitarioReais: number
}

const itensVenda = ref<ItemCarrinhoPDV[]>([])

const state = reactive<{
  clienteId: number
  formaPagamento: FormaPagamentoPDV
  sessaoCaixaId: number | undefined
  carteiraId: number | undefined
  observacao: string
}>({
  clienteId: 0,
  formaPagamento: temCaixaAberto.value ? 'dinheiro' : 'pix',
  sessaoCaixaId: caixasAbertos.value[0]?.sessaoCaixaId ?? undefined,
  carteiraId: bancosAtivos.value[0]?.id,
  observacao: ''
})

watch(
  [temCaixaAberto, caixasAbertos, bancosAtivos],
  () => {
    if (!temCaixaAberto.value && state.formaPagamento === 'dinheiro') {
      state.formaPagamento = 'pix'
    }
    if (state.formaPagamento === 'dinheiro' && !state.sessaoCaixaId && caixasAbertos.value[0]?.sessaoCaixaId) {
      state.sessaoCaixaId = caixasAbertos.value[0].sessaoCaixaId
    }
    if (state.formaPagamento !== 'dinheiro' && !state.carteiraId && bancosAtivos.value[0]?.id) {
      state.carteiraId = bancosAtivos.value[0].id
    }
  },
  { immediate: true }
)

watch(
  () => state.formaPagamento,
  (novaForma) => {
    if (novaForma === 'dinheiro') {
      if (!state.sessaoCaixaId && caixasAbertos.value[0]?.sessaoCaixaId) {
        state.sessaoCaixaId = caixasAbertos.value[0].sessaoCaixaId
      }
    } else if (!state.carteiraId && bancosAtivos.value[0]?.id) {
      state.carteiraId = bancosAtivos.value[0].id
    }
  }
)

function adicionarProduto(produto: ItemCatalogo) {
  if (produto.tipo !== 'produto') return

  const existente = itensVenda.value.find(item => item.catalogoId === produto.id)
  if (existente) {
    existente.quantidade = Number((Number(existente.quantidade || 0) + 1).toFixed(3))
    return
  }

  itensVenda.value.push({
    catalogoId: produto.id,
    nome: produto.nome,
    unidade: produto.unidade,
    sku: produto.sku,
    quantidade: 1,
    precoUnitarioReais: Number(((produto.preco || 0) / 100).toFixed(2))
  })
}

function removerItem(catalogoId: number) {
  itensVenda.value = itensVenda.value.filter(item => item.catalogoId !== catalogoId)
}

function subtotalItemCentavos(item: ItemCarrinhoPDV): number {
  const qtd = Math.max(0, Number(item.quantidade || 0))
  const unitCentavos = Math.max(0, Math.round(Number(item.precoUnitarioReais || 0) * 100))
  return Math.round(qtd * unitCentavos)
}

function saldoProdutoAtual(catalogoId: number): number {
  const est = estoquePorCatalogoId.value.get(catalogoId)
  return Number(est?.quantidadeAtual ?? 0)
}

function ficaraNegativo(item: ItemCarrinhoPDV): boolean {
  const saldo = saldoProdutoAtual(item.catalogoId)
  return saldo - Number(item.quantidade || 0) < 0
}

const totalVendaCentavos = computed(() =>
  itensVenda.value.reduce((acc, item) => acc + subtotalItemCentavos(item), 0)
)

const schemaVenda = z.object({
  clienteId: z.coerce.number().int().min(0).optional(),
  formaPagamento: z.enum(['dinheiro', 'pix', 'credito', 'debito'], {
    message: 'Selecione a forma de pagamento'
  }),
  sessaoCaixaId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  carteiraId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  observacao: z.string().trim().optional().default('')
}).superRefine((dados, ctx) => {
  if (dados.formaPagamento === 'dinheiro') {
    if (!temCaixaAberto.value) {
      ctx.addIssue({
        code: 'custom',
        path: ['formaPagamento'],
        message: 'Abra um Caixa para receber em dinheiro ou escolha Pix/cartão.'
      })
    } else if (!dados.sessaoCaixaId) {
      ctx.addIssue({
        code: 'custom',
        path: ['sessaoCaixaId'],
        message: 'Selecione o Caixa aberto de destino'
      })
    }
  } else if (!dados.carteiraId) {
    ctx.addIssue({
      code: 'custom',
      path: ['carteiraId'],
      message: 'Selecione a Carteira bancária de destino'
    })
  }
})

type SchemaVenda = z.output<typeof schemaVenda>

const enviando = ref(false)

const { config } = useConfig()
const vendaRecibo = ref<Venda | null>(null)
const reciboAberto = ref(false)

async function fecharRecibo() {
  reciboAberto.value = false
  if (vendaRecibo.value) await navigateTo(`/unidade/${unidadeId.value}/pdv/${vendaRecibo.value.id}`)
}

async function recarregarDados() {
  await Promise.all([
    refreshCatalogo(),
    refreshEstoques(),
    refreshClientes(),
    refreshCaixas(),
    refreshCarteiras(),
    refreshVendas()
  ])
}

async function onSubmit(event: FormSubmitEvent<SchemaVenda>) {
  if (itensVenda.value.length === 0) {
    toast.add({
      title: 'Adicione produtos à venda',
      description: 'Selecione pelo menos um produto do catálogo para finalizar a venda.',
      color: 'error'
    })
    return
  }

  const itemInvalido = itensVenda.value.find(
    i => Number(i.quantidade) <= 0 || Number(i.precoUnitarioReais) < 0
  )

  if (itemInvalido) {
    toast.add({
      title: 'Verifique os itens da venda',
      description: `Quantidade ou preço inválido no item "${itemInvalido.nome}".`,
      color: 'error'
    })
    return
  }

  enviando.value = true

  try {
    const vendaCriada = await $fetch<Venda>(`/api/unidade/${unidadeId.value}/pdv`, {
      method: 'POST',
      body: {
        ...(event.data.clienteId && event.data.clienteId > 0 ? { clienteId: event.data.clienteId } : {}),
        formaPagamento: event.data.formaPagamento,
        ...(event.data.formaPagamento === 'dinheiro'
          ? { sessaoCaixaId: event.data.sessaoCaixaId }
          : { carteiraId: event.data.carteiraId }),
        ...(event.data.observacao ? { observacao: event.data.observacao } : {}),
        itens: itensVenda.value.map(item => ({
          catalogoId: item.catalogoId,
          nome: item.nome,
          unidade: item.unidade,
          quantidade: Number(item.quantidade),
          precoUnitario: Math.round(Number(item.precoUnitarioReais) * 100)
        }))
      }
    })

    toast.add({
      title: `Venda ${vendaCriada.numero} finalizada`,
      description: `Total: ${formatarPreco(vendaCriada.total ?? totalVendaCentavos.value)}`,
      color: 'success'
    })

    itensVenda.value = []
    vendaRecibo.value = vendaCriada
    reciboAberto.value = true
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
  <UDashboardPanel id="pdv">
    <template #header>
      <UDashboardNavbar title="PDV">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-3xl space-y-6">
        <!-- Alerta de Caixa fechado -->
        <UAlert
          v-if="!temCaixaAberto"
          color="warning"
          variant="subtle"
          icon="i-lucide-banknote"
          title="Abra um Caixa para receber em dinheiro ou escolha Pix/cartão."
          description="Não há nenhuma sessão de Caixa aberta nesta unidade. O pagamento em dinheiro fica desabilitado até a abertura de um Caixa."
        >
          <template #actions>
            <UButton
              label="Ir para Caixa"
              icon="i-lucide-arrow-right"
              color="neutral"
              variant="outline"
              :to="`/unidade/${unidadeId}/caixa`"
            />
          </template>
        </UAlert>

        <!-- Erro ao carregar catálogo -->
        <UAlert
          v-if="errorCatalogo"
          color="error"
          variant="subtle"
          title="Erro ao carregar produtos"
          description="Não foi possível carregar os produtos do catálogo."
        >
          <template #actions>
            <UButton
              label="Tentar novamente"
              color="error"
              variant="soft"
              @click="recarregarDados"
            />
          </template>
        </UAlert>

        <!-- Loading -->
        <div v-if="statusCatalogo === 'pending'" class="space-y-4">
          <USkeleton class="h-32 w-full rounded-xl" />
          <USkeleton class="h-48 w-full rounded-xl" />
        </div>

        <UForm
          v-else
          id="pdv-venda-form"
          :schema="schemaVenda"
          :state="state"
          :loading="enviando"
          class="space-y-6"
          @submit="onSubmit"
        >
          <!-- ═══ Cliente e Busca de Produtos ═══ -->
          <DashboardSectionHeader
            title="Nova venda rápida"
            description="Selecione o cliente (opcional) e adicione produtos do catálogo."
          />

          <UPageCard variant="subtle">
            <div class="space-y-4">
              <UFormField label="Cliente (opcional)" name="clienteId">
                <USelect
                  v-model="state.clienteId"
                  :items="opcoesClientes"
                  placeholder="Avulso"
                />
              </UFormField>

              <!-- Autocomplete / Busca de Produtos (SÓ tipo='produto') -->
              <UFormField label="Buscar produto no catálogo" name="buscaProduto">
                <UInput
                  v-model="buscaProduto"
                  icon="i-lucide-search"
                  placeholder="Buscar por nome ou SKU (somente produtos)..."
                />
              </UFormField>

              <div
                v-if="produtosFiltrados.length"
                class="rounded-lg border border-default divide-y divide-default max-h-60 overflow-y-auto"
              >
                <div
                  v-for="produto in produtosFiltrados"
                  :key="produto.id"
                  class="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-elevated/50 transition-colors"
                >
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="text-sm font-medium text-highlighted truncate">
                        {{ produto.nome }}
                      </span>
                      <UBadge color="neutral" variant="subtle" size="sm">
                        Produto
                      </UBadge>
                      <UBadge
                        v-if="estoquePorCatalogoId.get(produto.id)?.estoqueNegativo || saldoProdutoAtual(produto.id) < 0"
                        color="error"
                        variant="subtle"
                        size="sm"
                      >
                        Estoque Negativo
                      </UBadge>
                      <UBadge
                        v-else-if="estoquePorCatalogoId.get(produto.id)?.repor"
                        color="warning"
                        variant="subtle"
                        size="sm"
                      >
                        Repor
                      </UBadge>
                    </div>
                    <p class="text-xs text-muted truncate mt-0.5">
                      {{ formatarPreco(produto.preco) }} / {{ produto.unidade }}
                      · Saldo: {{ saldoProdutoAtual(produto.id) }} {{ produto.unidade }}
                      <template v-if="produto.sku">
                        · SKU: {{ produto.sku }}
                      </template>
                    </p>
                  </div>

                  <UButton
                    type="button"
                    label="Adicionar"
                    icon="i-lucide-plus"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    @click="adicionarProduto(produto)"
                  />
                </div>
              </div>

              <UEmpty
                v-else
                icon="i-lucide-package"
                :title="buscaProduto ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado no catálogo'"
                :description="buscaProduto ? 'Tente outro termo de busca. Serviços são lançados apenas em Ordens de Serviço.' : 'Cadastre produtos no Catálogo para vendê-los no PDV.'"
                class="py-6"
              />
            </div>
          </UPageCard>

          <!-- ═══ Itens da Venda ═══ -->
          <DashboardSectionHeader
            title="Itens da venda"
            :description="`${itensVenda.length} ${itensVenda.length === 1 ? 'produto selecionado' : 'produtos selecionados'}.`"
          />

          <UPageCard
            variant="subtle"
            :ui="{ container: 'p-0 sm:p-0 gap-y-0', wrapper: 'items-stretch' }"
          >
            <div v-if="itensVenda.length" class="divide-y divide-default">
              <div
                v-for="item in itensVenda"
                :key="item.catalogoId"
                class="p-4 space-y-3"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="text-sm font-medium text-highlighted truncate">
                        {{ item.nome }}
                      </p>
                      <UBadge
                        v-if="ficaraNegativo(item)"
                        color="error"
                        variant="subtle"
                        size="sm"
                      >
                        Estoque Negativo
                      </UBadge>
                    </div>
                    <p class="text-xs text-muted">
                      Unidade: {{ item.unidade }} · Saldo disponível: {{ saldoProdutoAtual(item.catalogoId) }} {{ item.unidade }}
                    </p>
                  </div>

                  <div class="flex items-center gap-3 shrink-0">
                    <span class="text-sm font-semibold tabular-nums text-highlighted">
                      {{ formatarPreco(subtotalItemCentavos(item)) }}
                    </span>
                    <UButton
                      type="button"
                      icon="i-lucide-trash-2"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      aria-label="Remover item"
                      @click="removerItem(item.catalogoId)"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <UFormField label="Quantidade" :name="`qtd-${item.catalogoId}`">
                    <UInput
                      v-model.number="item.quantidade"
                      type="number"
                      min="0.001"
                      step="any"
                    />
                  </UFormField>

                  <UFormField label="Preço unitário (R$)" :name="`preco-${item.catalogoId}`">
                    <UInput
                      v-model.number="item.precoUnitarioReais"
                      type="number"
                      min="0"
                      step="0.01"
                    />
                  </UFormField>
                </div>
              </div>

              <!-- Resumo do Total -->
              <div class="flex items-center justify-between px-4 py-3 bg-elevated/40">
                <span class="text-sm font-medium text-muted">
                  Total da venda
                </span>
                <span class="text-lg font-bold tabular-nums text-highlighted">
                  {{ formatarPreco(totalVendaCentavos) }}
                </span>
              </div>
            </div>

            <UEmpty
              v-else
              icon="i-lucide-shopping-cart"
              title="Nenhum item adicionado"
              description="Adicione produtos do catálogo acima para montar a venda."
              class="py-8"
            />
          </UPageCard>

          <!-- ═══ Pagamento e Finalização ═══ -->
          <DashboardSectionHeader
            title="Pagamento"
            description="Escolha a forma de pagamento e o destino financeiro."
          />

          <UPageCard variant="subtle">
            <div class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <UFormField label="Forma de pagamento" name="formaPagamento" required>
                  <USelect
                    v-model="state.formaPagamento"
                    :items="opcoesFormasPagamento"
                  />
                </UFormField>

                <UFormField
                  v-if="state.formaPagamento === 'dinheiro'"
                  label="Caixa aberto (destino)"
                  name="sessaoCaixaId"
                  required
                >
                  <USelect
                    v-model="state.sessaoCaixaId"
                    :items="opcoesCaixasAbertos"
                    placeholder="Selecione um Caixa aberto"
                  />
                </UFormField>

                <UFormField
                  v-else
                  label="Carteira Banco (destino)"
                  name="carteiraId"
                  required
                >
                  <USelect
                    v-model="state.carteiraId"
                    :items="opcoesBancos"
                    placeholder="Selecione uma Carteira Banco"
                  />
                </UFormField>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-default">
                <div>
                  <p class="text-xs text-muted">
                    Total a receber
                  </p>
                  <p class="text-xl font-bold tabular-nums text-highlighted">
                    {{ formatarPreco(totalVendaCentavos) }}
                  </p>
                </div>

                <UButton
                  type="submit"
                  label="Finalizar venda"
                  icon="i-lucide-check"
                  :loading="enviando"
                />
              </div>
            </div>
          </UPageCard>
        </UForm>

        <!-- ═══ Histórico de Vendas Recentes ═══ -->
        <div>
          <DashboardSectionHeader
            title="Vendas realizadas"
            :description="`${vendas.length} ${vendas.length === 1 ? 'venda registrada' : 'vendas registradas'} nesta unidade.`"
          />

          <UPageCard
            variant="subtle"
            :ui="{ container: 'p-0 sm:p-0 gap-y-0', wrapper: 'items-stretch' }"
          >
            <div v-if="statusVendas === 'pending'" class="p-4 space-y-2">
              <USkeleton class="h-12 w-full rounded-lg" />
              <USkeleton class="h-12 w-full rounded-lg" />
            </div>

            <div v-else-if="vendas.length" class="divide-y divide-default">
              <DashboardListItem
                v-for="v in vendas"
                :key="v.id"
                :to="`/unidade/${unidadeId}/pdv/${v.id}`"
                icon="i-lucide-receipt"
                :title="`${v.numero} · ${v.clienteNome || 'Avulso'}`"
                :subtitle="`${labelFormaPagamento(v.formaPagamento)} · ${formatarData(v.dataCriacao)} · ${v.itens.length} ${v.itens.length === 1 ? 'item' : 'itens'}`"
              >
                <template #right>
                  <span class="text-sm font-semibold tabular-nums text-highlighted">
                    {{ formatarPreco(v.total ?? v.itens.reduce((s, i) => s + Math.round(i.quantidade * i.precoUnitario), 0)) }}
                  </span>
                </template>
              </DashboardListItem>
            </div>

            <UEmpty
              v-else
              icon="i-lucide-receipt"
              title="Nenhuma venda registrada"
              description="Finalize sua primeira venda no PDV para emitir recibos."
              class="py-8"
            />
          </UPageCard>
        </div>
      </div>
    </template>

    <PrintPreview
      v-if="vendaRecibo"
      :title="`Recibo ${vendaRecibo.numero}`"
      :is-open="reciboAberto"
      @close="fecharRecibo"
    >
      <TemplatesReciboTemplate :venda="vendaRecibo" :config="config" />
    </PrintPreview>
  </UDashboardPanel>
</template>
