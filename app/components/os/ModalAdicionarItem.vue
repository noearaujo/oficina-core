<script setup lang="ts">
import { refDebounced } from '@vueuse/core'

interface ItemBusca {
  id?: number
  nome: string
  tipo: 'servico' | 'produto'
  sku?: string
  unidade?: string
  preco: number
}

const props = defineProps<{
  unidadeId: string
  loading?: boolean
  complemento?: boolean
}>()

const emit = defineEmits<{
  confirm: [item: {
    catalogoId?: number
    nome: string
    tipo: 'servico' | 'produto'
    unidade?: string
    quantidade: number
    precoUnitario: number
  }]
}>()
const open = defineModel<boolean>('open', { default: false })

const { parseCentavos, centavosParaInput, formatarDinheiro } = useOS()

const termo = ref('')
const termoDebounced = refDebounced(termo, 300)
const selecionado = ref<ItemBusca | undefined>()
const quantidade = ref('1')
const preco = ref('0,00')
const resultados = ref<ItemBusca[]>([])
const buscando = ref(false)

watch(open, (aberto) => {
  if (aberto) {
    termo.value = ''
    selecionado.value = undefined
    quantidade.value = '1'
    preco.value = '0,00'
    resultados.value = []
  }
})

watch(termoDebounced, async (q) => {
  const busca = q.trim()
  if (!open.value || busca.length < 1 || selecionado.value?.nome === busca) {
    if (!busca) resultados.value = []
    return
  }
  buscando.value = true
  try {
    resultados.value = await $fetch<ItemBusca[]>(`/api/unidade/${props.unidadeId}/catalogo`, {
      query: { q: busca }
    })
  } catch {
    resultados.value = []
  } finally {
    buscando.value = false
  }
})

watch(selecionado, (item) => {
  if (item) preco.value = centavosParaInput(item.preco)
})

const quantidadeNumero = computed(() => Number(quantidade.value.replace(',', '.')))
const valido = computed(() =>
  Boolean(selecionado.value) && quantidadeNumero.value > 0
)

function criarLivre(nome: string) {
  selecionado.value = { nome, tipo: 'servico', preco: 0 }
  resultados.value = []
}

function confirmar() {
  const item = selecionado.value
  if (!item || !valido.value) return
  emit('confirm', {
    catalogoId: item.id,
    nome: item.nome,
    tipo: item.tipo,
    unidade: item.unidade,
    quantidade: quantidadeNumero.value,
    precoUnitario: parseCentavos(preco.value)
  })
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="complemento ? 'Adicionar complemento' : 'Adicionar item'"
    description="Busque no catálogo por nome ou SKU."
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="Item do catálogo" required>
          <UInputMenu
            v-model="selecionado"
            v-model:search-term="termo"
            :items="resultados"
            :loading="buscando"
            label-key="nome"
            ignore-filter
            :create-item="{ when: 'empty' }"
            icon="i-lucide-search"
            placeholder="Buscar item..."
            @create="criarLivre"
          >
            <template #item-label="{ item }">
              {{ item.nome }}
              <span v-if="item.sku" class="text-xs text-muted"> · {{ item.sku }}</span>
            </template>
            <template #item-trailing="{ item }">
              <span class="text-xs text-muted">{{ formatarDinheiro(item.preco) }}</span>
            </template>
          </UInputMenu>
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Quantidade" required>
            <UInput v-model="quantidade" inputmode="decimal" />
          </UFormField>
          <UFormField label="Preço unitário" required>
            <UInput v-model="preco" inputmode="decimal">
              <template #leading>
                <span class="text-xs text-muted">R$</span>
              </template>
            </UInput>
          </UFormField>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Voltar"
          color="neutral"
          variant="outline"
          @click="open = false"
        />
        <UButton
          label="Adicionar"
          :loading="loading"
          :disabled="!valido"
          @click="confirmar"
        />
      </div>
    </template>
  </UModal>
</template>
