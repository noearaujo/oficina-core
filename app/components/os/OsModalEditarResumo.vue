<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { OSView } from '~/composables/useOS'
import { COMBUSTIVEIS, RESPONSAVEIS } from '~/utils/os-constants'

const props = defineProps<{
  open: boolean
  loading: boolean
  os: OSView
  unidadeId: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': [payload: {
    clienteId?: number
    veiculoId?: number
    funcionarioId: number
    quilometragem?: string
    combustivel?: string
    previsaoEntrega?: string
  }]
}>()

const { data: clientes } = await useFetch<Cliente[]>(
  () => `/api/unidade/${props.unidadeId}/clientes`,
  { default: () => [] }
)
const { data: veiculos } = await useFetch<Veiculo[]>(
  () => `/api/unidade/${props.unidadeId}/veiculos`,
  { default: () => [] }
)

const buscaCliente = ref('')
const clienteId = ref<number | undefined>()
const veiculoId = ref<number | undefined>()
const inicializando = ref(false)

const state = reactive({
  funcionarioId: undefined as number | undefined,
  quilometragem: '',
  combustivel: undefined as string | undefined,
  previsaoEntrega: ''
})

const clientesFiltrados = computed(() => {
  const q = buscaCliente.value.trim().toLowerCase()
  if (!q) return clientes.value ?? []
  const d = q.replace(/\D/g, '')
  return (clientes.value ?? []).filter(item =>
    item.nome?.toLowerCase().includes(q)
    || Boolean(d && item.cpf?.replace(/\D/g, '').includes(d))
    || Boolean(d && item.telefone?.replace(/\D/g, '').includes(d))
  )
})

const veiculosDoCliente = computed(() => (veiculos.value ?? []).filter(v => v.clienteId === clienteId.value))
const veiculoItens = computed(() =>
  veiculosDoCliente.value.map(v => ({
    label: `${v.placa} — ${[v.marca, v.modelo].filter(Boolean).join(' ')}`,
    value: v.id
  }))
)
const veiculoSelecionado = computed(() => veiculosDoCliente.value.find(v => v.id === veiculoId.value))

watch(() => props.open, (aberto) => {
  if (!aberto) return
  inicializando.value = true
  buscaCliente.value = ''
  clienteId.value = props.os.clienteId
  veiculoId.value = props.os.veiculoId
  state.funcionarioId = props.os.funcionarioId
  state.quilometragem = props.os.quilometragem !== undefined ? String(props.os.quilometragem) : ''
  state.combustivel = props.os.combustivel
  state.previsaoEntrega = props.os.previsaoEntrega ? props.os.previsaoEntrega.slice(0, 10) : ''
  nextTick(() => {
    inicializando.value = false
  })
})

watch(clienteId, () => {
  if (!inicializando.value) veiculoId.value = undefined
})

watch(veiculoSelecionado, (v) => {
  if (v && !state.quilometragem && v.quilometragem !== undefined) {
    state.quilometragem = String(v.quilometragem)
  }
})

const schema = z.object({
  funcionarioId: z.number({ message: 'Selecione o responsável' }),
  quilometragem: z.string().refine(v => !v || /^\d+$/.test(v), 'Quilometragem inválida'),
  combustivel: z.string().optional(),
  previsaoEntrega: z.string().optional()
})

async function onSubmit(event: FormSubmitEvent<z.output<typeof schema>>) {
  if (!clienteId.value || !veiculoId.value) return
  emit('confirm', {
    clienteId: clienteId.value,
    veiculoId: veiculoId.value,
    funcionarioId: event.data.funcionarioId,
    quilometragem: event.data.quilometragem || undefined,
    combustivel: event.data.combustivel || undefined,
    previsaoEntrega: event.data.previsaoEntrega || undefined
  })
}
</script>

<template>
  <UModal
    :open="open"
    title="Editar Resumo"
    description="Alterar dados de entrada da OS."
    @update:open="v => emit('update:open', v)"
  >
    <template #body>
      <UForm
        id="os-editar-resumo"
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Cliente" required>
          <USelectMenu
            v-model="clienteId"
            v-model:search-term="buscaCliente"
            :items="clientesFiltrados"
            value-key="id"
            label-key="nome"
            ignore-filter
            placeholder="Buscar cliente..."
            icon="i-lucide-search"
          />
        </UFormField>
        <UFormField v-if="clienteId" label="Veículo" required>
          <USelect v-model="veiculoId" :items="veiculoItens" placeholder="Selecione o veículo" />
        </UFormField>
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Responsável" name="funcionarioId" required>
            <USelect v-model="state.funcionarioId" :items="RESPONSAVEIS" placeholder="Selecionar" />
          </UFormField>
          <UFormField label="Quilometragem" name="quilometragem">
            <UInput v-model="state.quilometragem" placeholder="Ex.: 85000">
              <template #trailing>
                <span class="text-xs text-muted">km</span>
              </template>
            </UInput>
          </UFormField>
          <UFormField label="Combustível" name="combustivel">
            <USelect v-model="state.combustivel" :items="COMBUSTIVEIS" placeholder="Nível" />
          </UFormField>
          <UFormField label="Previsão de entrega" name="previsaoEntrega">
            <UInput v-model="state.previsaoEntrega" type="date" />
          </UFormField>
        </div>
      </UForm>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="outline"
          @click="emit('update:open', false)"
        />
        <UButton
          type="submit"
          label="Salvar"
          icon="i-lucide-check"
          :loading="loading"
          :disabled="!clienteId || !veiculoId"
          form="os-editar-resumo"
        />
      </div>
    </template>
  </UModal>
</template>
