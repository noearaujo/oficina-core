<script setup lang="ts">
import type { CaixaComEstado, Carteira } from '~/types'
import { MODALIDADES_PAGAMENTO_OS } from '~/utils/os-constants'

interface DevolucaoPayload {
  valor: number
  modalidade: string
  carteiraId?: number
  sessaoCaixaId?: number
  motivo: string
}

const props = defineProps<{
  unidadeId: string
  loading?: boolean
  pago: number
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  confirm: [payload: DevolucaoPayload]
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
const motivo = ref('')
const { parseCentavos, centavosParaInput } = useOS()

watch(open, (aberto) => {
  if (aberto) {
    valor.value = centavosParaInput(props.pago)
    modalidade.value = ''
    destino.value = undefined
    motivo.value = ''
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
  && valorCentavos.value <= props.pago
  && Boolean(modalidade.value)
  && Boolean(destino.value)
  && motivo.value.trim().length > 0
)

function confirmar() {
  if (!valido.value) return
  const payload: DevolucaoPayload = {
    valor: valorCentavos.value,
    modalidade: modalidade.value,
    motivo: motivo.value.trim()
  }
  if (modalidade.value === 'dinheiro') payload.sessaoCaixaId = destino.value
  else payload.carteiraId = destino.value
  emit('confirm', payload)
}
</script>

<template>
  <UModal v-model:open="open" title="Registrar devolução" description="Registrar devolução de pagamento da OS.">
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
        <UFormField v-if="modalidade" label="Origem" required>
          <USelect
            v-model="destino"
            :items="destinosDisponiveis"
            :placeholder="modalidade === 'dinheiro' && !sessoesAbertas.length ? 'Nenhum caixa aberto' : 'Selecione'"
            :disabled="!destinosDisponiveis.length"
          />
        </UFormField>
        <p v-if="modalidade === 'dinheiro' && !sessoesAbertas.length" class="text-xs text-warning">
          Abra um caixa para devolver em dinheiro, ou escolha Pix/cartão.
        </p>
        <UFormField label="Motivo" required>
          <UInput v-model="motivo" placeholder="Ex.: Cliente desistiu" />
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
          label="Confirmar devolução"
          icon="i-lucide-undo-2"
          color="error"
          :loading="loading"
          :disabled="!valido"
          @click="confirmar"
        />
      </div>
    </template>
  </UModal>
</template>
