<script setup lang="ts">
import type { ItemOSView, OSView, StatusOS } from '~/composables/useOS'

const props = defineProps<{
  os: OSView
  statusAtual?: StatusOS
  executando?: boolean
}>()

const emit = defineEmits<{
  abrirAdicionarItem: []
  abrirEditarItem: [item: ItemOSView]
  abrirEnviar: [complementos: boolean]
  abrirAjustar: []
  aprovarTodos: [subtotal: number]
  aprovarItem: [item: ItemOSView]
  abrirRecusar: [item: ItemOSView]
  removerItem: [item: ItemOSView]
  salvarDesconto: [descontoCentavos: number]
}>()

const { ITEM_META, formatarDinheiro, parseCentavos, centavosParaInput, totalItem } = useOS()

const itens = computed(() => props.os.itens ?? [])
const itensPrincipal = computed(() => itens.value.filter(i => i.lote === null || i.lote === undefined))
const lotes = computed(() =>
  [...new Set(itens.value.filter(i => typeof i.lote === 'number').map(i => i.lote as number))].sort((a, b) => a - b)
)
const grupos = computed(() => [
  { titulo: 'Orçamento principal', itens: itensPrincipal.value },
  ...lotes.value.map(l => ({ titulo: `Complemento ${l}`, itens: itens.value.filter(i => i.lote === l) }))
])

const complementosPendentes = computed(() =>
  itens.value.filter(i => typeof i.lote === 'number' && i.status === 'pendente' && !i.enviado)
)
const subtotalOrcamento = computed(() =>
  itens.value.filter(i => i.status !== 'recusado').reduce((soma, i) => soma + totalItem(i), 0)
)
const descontoOrcamento = computed(() => props.os.desconto || 0)
const totalOrcamento = computed(() => Math.max(0, subtotalOrcamento.value - descontoOrcamento.value))
const descontoEditavel = computed(() =>
  props.statusAtual === 'em_diagnostico' || props.statusAtual === 'aguardando_aprovacao'
)

const descontoInput = ref('0,00')
watch(() => props.os.desconto, (v) => {
  descontoInput.value = centavosParaInput(v)
}, { immediate: true })

const acaoAtiva = ref<string | null>(null)
watch(() => props.executando, (v) => {
  if (!v) acaoAtiva.value = null
})

function acionar(chave: string, fn: () => void) {
  acaoAtiva.value = chave
  fn()
}

function podeDecidir(item: ItemOSView) {
  if (item.status !== 'pendente') return false
  if (props.statusAtual === 'aguardando_aprovacao') return item.lote === null || item.lote === undefined
  return props.statusAtual === 'em_execucao'
}

function podeEditar(item: ItemOSView) {
  if (item.status !== 'pendente') return false
  if (!props.statusAtual || ['concluida', 'entregue', 'cancelada'].includes(props.statusAtual)) return false
  if (props.statusAtual !== 'em_diagnostico' && item.enviado && props.statusAtual !== 'em_execucao') return false
  return true
}
</script>

<template>
  <div>
    <DashboardSectionHeader title="Orçamento" description="Itens, complementos e totais.">
      <div class="flex flex-wrap justify-end gap-2">
        <UButton
          v-if="statusAtual === 'em_diagnostico' || statusAtual === 'em_execucao'"
          :label="statusAtual === 'em_execucao' ? 'Adicionar complemento' : 'Adicionar item'"
          icon="i-lucide-plus"
          @click="emit('abrirAdicionarItem')"
        />
        <UButton
          v-if="statusAtual === 'em_diagnostico'"
          label="Enviar orçamento"
          icon="i-lucide-send"
          color="neutral"
          variant="outline"
          :disabled="!itens.length"
          @click="emit('abrirEnviar', false)"
        />
        <UButton
          v-if="statusAtual === 'em_execucao' && complementosPendentes.length > 0"
          label="Enviar complementos"
          icon="i-lucide-send"
          color="neutral"
          variant="outline"
          @click="emit('abrirEnviar', true)"
        />
        <UButton
          v-if="statusAtual === 'aguardando_aprovacao'"
          label="Ajustar"
          icon="i-lucide-pencil-ruler"
          color="neutral"
          variant="outline"
          @click="emit('abrirAjustar')"
        />
        <UButton
          v-if="statusAtual === 'aguardando_aprovacao'"
          label="Aprovar todos"
          icon="i-lucide-check-check"
          :loading="executando && acaoAtiva === 'aprovarTodos'"
          :disabled="executando"
          @click="acionar('aprovarTodos', () => emit('aprovarTodos', subtotalOrcamento))"
        />
      </div>
    </DashboardSectionHeader>

    <UEmpty
      v-if="!itens.length"
      icon="i-lucide-receipt-text"
      title="Nenhum item no orçamento"
      description="Adicione serviços e produtos para montar o orçamento."
      class="py-8"
    />

    <template v-else>
      <UPageCard
        v-for="grupo in grupos"
        :key="grupo.titulo"
        :title="grupo.titulo"
        variant="subtle"
        class="mb-4"
      >
        <p v-if="!grupo.itens.length" class="text-sm text-muted">
          Sem itens.
        </p>
        <ul v-else class="divide-y divide-default">
          <li
            v-for="item in grupo.itens"
            :key="item.id"
            class="flex flex-wrap items-center gap-3 py-3"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-highlighted truncate">
                {{ item.nome }}
              </p>
              <p class="text-xs text-muted">
                {{ item.tipo === 'servico' ? 'Serviço' : 'Produto' }}
                · {{ item.quantidade }}{{ item.unidade ? ` ${item.unidade}` : '' }}
                × {{ formatarDinheiro(item.precoUnitario) }}
              </p>
              <p v-if="item.status === 'recusado' && item.motivoRecusa" class="text-xs text-muted">
                Motivo: {{ item.motivoRecusa }}
              </p>
            </div>
            <span v-if="item.status === 'pendente' && item.enviado" class="text-xs text-primary">● enviado</span>
            <UBadge :label="ITEM_META[item.status].label" :color="ITEM_META[item.status].color" variant="subtle" />
            <span class="w-24 text-right text-sm font-medium tabular-nums">{{ formatarDinheiro(totalItem(item)) }}</span>
            <div class="flex gap-1">
              <template v-if="podeDecidir(item)">
                <UButton
                  icon="i-lucide-check"
                  color="success"
                  variant="ghost"
                  size="sm"
                  aria-label="Aprovar item"
                  :loading="executando && acaoAtiva === `aprovar-${item.id}`"
                  :disabled="executando"
                  @click="acionar(`aprovar-${item.id}`, () => emit('aprovarItem', item))"
                />
                <UButton
                  icon="i-lucide-x"
                  color="error"
                  variant="ghost"
                  size="sm"
                  aria-label="Recusar item"
                  :disabled="executando"
                  @click="emit('abrirRecusar', item)"
                />
              </template>
              <UButton
                v-if="podeEditar(item) && !(item.enviado && statusAtual === 'aguardando_aprovacao')"
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="sm"
                aria-label="Editar item"
                :disabled="executando"
                @click="emit('abrirEditarItem', item)"
              />
              <UButton
                v-if="podeEditar(item) && !(item.enviado && statusAtual === 'aguardando_aprovacao')"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="sm"
                aria-label="Remover item"
                :loading="executando && acaoAtiva === `remover-${item.id}`"
                :disabled="executando"
                @click="acionar(`remover-${item.id}`, () => emit('removerItem', item))"
              />
            </div>
          </li>
        </ul>
      </UPageCard>

      <UPageCard title="Totais" variant="subtle">
        <dl class="space-y-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-muted">
              Subtotal
            </dt>
            <dd class="tabular-nums">
              {{ formatarDinheiro(subtotalOrcamento) }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <dt class="text-muted">
              Desconto
            </dt>
            <dd v-if="descontoEditavel" class="flex items-center gap-2">
              <UInput
                v-model="descontoInput"
                inputmode="decimal"
                size="sm"
                class="w-32"
              >
                <template #leading>
                  <span class="text-xs text-muted">R$</span>
                </template>
              </UInput>
              <UButton
                label="Aplicar"
                size="sm"
                color="neutral"
                variant="outline"
                :loading="executando && acaoAtiva === 'desconto'"
                :disabled="executando"
                @click="acionar('desconto', () => emit('salvarDesconto', parseCentavos(descontoInput)))"
              />
            </dd>
            <dd v-else class="tabular-nums">
              − {{ formatarDinheiro(descontoOrcamento) }}
            </dd>
          </div>
          <div class="flex justify-between border-t border-default pt-2 font-semibold text-highlighted">
            <dt>Total</dt>
            <dd class="tabular-nums">
              {{ formatarDinheiro(totalOrcamento) }}
            </dd>
          </div>
        </dl>
      </UPageCard>
    </template>
  </div>
</template>
