<script setup lang="ts">
interface ItemCatalogoView {
  id: number
  nome: string
  tipo: 'servico' | 'produto'
  sku?: string
  unidade: string
  preco: number
}

interface ItemNaLista {
  catalogoId: number
  nome: string
  unidade: string
  tipo: 'servico' | 'produto'
  preco: number
  quantidade: number
}

const props = defineProps<{
  unidadeId: string
  loading?: boolean
  complemento?: boolean
}>()

const emit = defineEmits<{
  confirm: [itens: { catalogoId: number, quantidade: number, precoUnitario?: number }[]]
}>()

const open = defineModel<boolean>('open', { default: false })

const { data: catalogo } = await useFetch<ItemCatalogoView[]>(
  () => `/api/unidade/${props.unidadeId}/catalogo`,
  { default: () => [] }
)

const selecionado = ref<ItemCatalogoView | undefined>()
const quantidade = ref('1')
const preco = ref('0,00')
const lista = ref<ItemNaLista[]>([])
const { parseCentavos, centavosParaInput } = useOS()

const podeEditarPreco = computed(() => selecionado.value?.tipo === 'servico')

watch(() => open.value, (aberto) => {
  if (aberto) {
    selecionado.value = undefined
    quantidade.value = '1'
    preco.value = '0,00'
    lista.value = []
  }
})

watch(selecionado, (item) => {
  if (item) preco.value = centavosParaInput(item.preco)
})

const quantidadeNumero = computed(() => Number(quantidade.value.replace(',', '.')))
const podeAdicionar = computed(() => Boolean(selecionado.value) && quantidadeNumero.value > 0)

function adicionarALista() {
  const item = selecionado.value
  if (!podeAdicionar.value || !item) return

  const existente = lista.value.find(l => l.catalogoId === item.id)
  if (existente) {
    existente.quantidade += quantidadeNumero.value
  } else {
    lista.value.push({
      catalogoId: item.id,
      nome: item.nome,
      unidade: item.unidade,
      tipo: item.tipo,
      preco: podeEditarPreco.value ? parseCentavos(preco.value) : item.preco,
      quantidade: quantidadeNumero.value
    })
  }

  selecionado.value = undefined
  quantidade.value = '1'
  preco.value = '0,00'
}

function removerDaLista(index: number) {
  lista.value.splice(index, 1)
}

const subtotal = computed(() =>
  lista.value.reduce((s, i) => s + Math.round(i.quantidade * i.preco), 0)
)

const searchTerm = ref('')

const itemsVisiveis = computed(() => {
  if (!searchTerm.value.trim()) {
    return (catalogo.value ?? []).slice(0, 4)
  }
  const q = searchTerm.value.toLowerCase()
  const qDigits = q.replace(/\D/g, '')
  return (catalogo.value ?? []).filter(item =>
    item.nome?.toLowerCase().includes(q)
    || Boolean(qDigits && item.sku?.toLowerCase().includes(qDigits))
  )
})

function confirmar() {
  if (lista.value.length === 0) return
  emit('confirm', lista.value.map(i => ({
    catalogoId: i.catalogoId,
    quantidade: i.quantidade,
    ...(i.tipo === 'servico' ? { precoUnitario: i.preco } : {})
  })))
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="complemento ? 'Adicionar complementos' : 'Adicionar itens'"
    description="Busque no catálogo e adicione à lista."
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="Item do catálogo" required>
          <USelectMenu
            v-model="selecionado"
            v-model:search-term="searchTerm"
            :items="itemsVisiveis"
            ignore-filter
            label-key="nome"
            placeholder="Buscar por nome ou SKU..."
            icon="i-lucide-search"
          >
            <template #item-label="{ item }">
              <div class="flex items-center justify-between w-full gap-2">
                <span class="flex items-center gap-1.5 truncate">
                  <UIcon :name="item.tipo === 'servico' ? 'i-lucide-wrench' : 'i-lucide-package'" class="size-3.5 shrink-0 text-muted" />
                  {{ item.nome }}
                </span>
                <span class="text-xs text-muted shrink-0">{{ (item.preco / 100).toFixed(2).replace('.', ',') }}</span>
              </div>
            </template>
          </USelectMenu>
        </UFormField>

        <div class="flex items-end gap-3">
          <UFormField
            v-if="selecionado"
            label="Quantidade"
            required
            class="flex-1"
          >
            <UInput v-model="quantidade" inputmode="decimal">
              <template #trailing>
                <span class="text-xs text-muted">{{ selecionado.unidade }}</span>
              </template>
            </UInput>
          </UFormField>
          <UFormField v-if="selecionado && podeEditarPreco" label="Preço" class="w-32">
            <UInput v-model="preco" inputmode="decimal">
              <template #leading>
                <span class="text-xs text-muted">R$</span>
              </template>
            </UInput>
          </UFormField>
          <UButton
            label="Adicionar"
            icon="i-lucide-plus"
            size="sm"
            color="neutral"
            variant="outline"
            :disabled="!podeAdicionar"
            @click="adicionarALista"
          />
        </div>

        <div v-if="lista.length" class="border-t border-default pt-4">
          <p class="mb-2 text-xs font-medium text-muted">
            {{ lista.length }} item(ns) na lista
          </p>
          <ul class="divide-y divide-default">
            <li v-for="(item, index) in lista" :key="item.catalogoId" class="flex items-center gap-2 py-2 text-sm">
              <UIcon :name="item.tipo === 'servico' ? 'i-lucide-wrench' : 'i-lucide-package'" class="size-3.5 shrink-0 text-muted" />
              <span class="min-w-0 flex-1 truncate">{{ item.nome }}</span>
              <span class="text-xs text-muted shrink-0">{{ item.quantidade }} {{ item.unidade }}</span>
              <span class="text-xs tabular-nums shrink-0">{{ (Math.round(item.quantidade * item.preco) / 100).toFixed(2).replace('.', ',') }}</span>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="xs"
                color="error"
                @click="removerDaLista(index)"
              />
            </li>
          </ul>
          <p class="mt-2 text-right text-sm font-medium tabular-nums">
            Subtotal: {{ (subtotal / 100).toFixed(2).replace('.', ',') }}
          </p>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="outline"
          @click="open = false"
        />
        <UButton
          label="Salvar"
          icon="i-lucide-check"
          :loading="loading"
          :disabled="!lista.length"
          @click="confirmar"
        />
      </div>
    </template>
  </UModal>
</template>
