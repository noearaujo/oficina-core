<script setup lang="ts">
import type { CaixaComEstado, Carteira } from '~/types'
import { MODALIDADES_PAGAMENTO_OS } from '~/utils/os-constants'

interface PagamentoPayload {
  valor: number
  modalidade: string
  carteiraId?: number
  sessaoCaixaId?: number
  observacao?: string
}

const props = defineProps<{
  unidadeId: string
  loading?: boolean
  saldo: number
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  confirm: [payload: PagamentoPayload]
}>()

const { data: caixas } = await useFetch<CaixaComEstado[]>(() => `/api/unidade/${props.unidadeId}/caixa`, {
  default: () => []
})
const { data: carteiras } = await useFetch<Carteira[]>(() => `/api/unidade/${props.unidadeId}/carteiras`, {
  default: () => []
})

const sessoesAbertas = computed(() =>
  (caixas.value ?? []).filter(c => c.aberta && c.sessaoCaixaId !== null)
)
const carteirasBanco = computed(() =>
  (carteiras.value ?? []).filter(c => c.tipo === 'banco' && c.ativa !== false)
)

const valor = ref('0,00')
const modalidade = ref('')
const destino = ref<number | undefined>()
const observacao = ref('')
const { parseCentavos, centavosParaInput } = useOS()

watch(open, (aberto) => {
  if (aberto) {
    valor.value = centavosParaInput(props.saldo)
    modalidade.value = ''
    destino.value = undefined
    observacao.value = ''
  }
})

const destinosDisponiveis = computed(() => {
  if (modalidade.value === 'dinheiro') {
    return sessoesAbertas.value.map(s => ({ label: s.nome, value: Number(s.sessaoCaixaId) }))
  }
  return carteirasBanco.value.map(c => ({ label: c.nome, value: c.id }))
})

const valorCentavos = computed(() => parseCentavos(valor.value))
const valido = computed(() =>
  valorCentavos.value > 0
  && valorCentavos.value <= props.saldo
  && Boolean(modalidade.value)
  && Boolean(destino.value)
)

function confirmar() {
  if (!valido.value) return
  const payload: PagamentoPayload = {
    valor: valorCentavos.value,
    modalidade: modalidade.value
  }
  if (modalidade.value === 'dinheiro') payload.sessaoCaixaId = destino.value
  else payload.carteiraId = destino.value
  if (observacao.value.trim()) payload.observacao = observacao.value.trim()
  emit('confirm', payload)
}
</script>

<template>
  <UModal v-model:open="open" title="Lançar pagamento" description="Registrar recebimento da OS.">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Valor" required>
          <UInput v-model="valor" inputmode="decimal">
            <template #leading>
              <span class="text-xs text-muted">R$</span>
            </template>
          </UInput>
        </UFormField>
        <UFormField label="Modalidade" required>
          <USelect
            v-model="modalidade"
            :items="MODALIDADES_PAGAMENTO_OS"
            placeholder="Selecione"
            @change="destino = undefined"
          />
        </UFormField>
        <UFormField v-if="modalidade" label="Destino" required>
          <USelect
            v-model="destino"
            :items="destinosDisponiveis"
            :placeholder="modalidade === 'dinheiro' && !sessoesAbertas.length ? 'Nenhum caixa aberto' : 'Selecione'"
            :disabled="!destinosDisponiveis.length"
          />
        </UFormField>
        <p v-if="modalidade === 'dinheiro' && !sessoesAbertas.length" class="text-xs text-warning">
          Abra um caixa para receber em dinheiro, ou escolha Pix/cartão.
        </p>
        <UFormField label="Observação">
          <UInput v-model="observacao" placeholder="Opcional" />
        </UFormField>
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
          label="Confirmar pagamento"
          icon="i-lucide-check"
          :loading="loading"
          :disabled="!valido"
          @click="confirmar"
        />
      </div>
    </template>
  </UModal>
</template>
