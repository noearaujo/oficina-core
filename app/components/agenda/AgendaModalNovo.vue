<script setup lang="ts">
import { format, parse } from 'date-fns'
import type { Cliente, Veiculo } from '~/types'

const props = defineProps<{
  clientes: Cliente[]
  veiculos: Veiculo[]
}>()

const emit = defineEmits<{
  criado: []
}>()

const route = useRoute()
const toast = useToast()
const { erroMensagem } = useOS()

const unidadeId = computed(() => String(route.params.unidadeId ?? ''))

const modalAberto = ref(false)
const salvando = ref(false)
const novo = reactive<{
  cliente: Cliente | undefined
  veiculoId: number | undefined
  dataHora: string
  servico: string
  observacao: string
}>({
  cliente: undefined,
  veiculoId: undefined,
  dataHora: '',
  servico: '',
  observacao: ''
})

watch(() => novo.cliente, () => {
  novo.veiculoId = undefined
})

const veiculosDoCliente = computed(() =>
  props.veiculos.filter(v => v.clienteId === novo.cliente?.id)
)

const veiculoItens = computed(() =>
  veiculosDoCliente.value.map(v => ({
    label: `${v.placa} — ${[v.marca, v.modelo].filter(Boolean).join(' ')}`,
    value: v.id
  }))
)

function abrir(base?: Date) {
  const d = base ? new Date(base) : new Date()
  if (!base) {
    d.setMinutes(0, 0, 0)
    d.setHours(Math.min(Math.max(d.getHours() + 1, 8), 17))
  }
  Object.assign(novo, {
    cliente: undefined,
    veiculoId: undefined,
    dataHora: format(d, 'yyyy-MM-dd\'T\'HH:mm'),
    servico: '',
    observacao: ''
  })
  modalAberto.value = true
}

async function criar() {
  if (!novo.cliente || !novo.dataHora || !novo.servico.trim()) {
    toast.add({
      title: 'Não foi possível salvar',
      description: 'Informe cliente, data/hora e serviço.',
      color: 'error'
    })
    return
  }

  salvando.value = true
  try {
    await $fetch(`/api/unidade/${unidadeId.value}/agenda`, {
      method: 'POST',
      body: {
        clienteId: novo.cliente.id,
        veiculoId: novo.veiculoId,
        dataHora: parse(novo.dataHora, 'yyyy-MM-dd\'T\'HH:mm', new Date()).toISOString(),
        servico: novo.servico.trim(),
        observacao: novo.observacao.trim() || undefined
      }
    })
    toast.add({ title: 'Agendamento criado', color: 'success' })
    emit('criado')
    modalAberto.value = false
  } catch (err) {
    toast.add({
      title: 'Não foi possível salvar',
      description: erroMensagem(err),
      color: 'error'
    })
  } finally {
    salvando.value = false
  }
}

defineExpose({ abrir })
</script>

<template>
  <UModal
    v-model:open="modalAberto"
    size="lg"
    title="Novo agendamento"
    description="Informe o cliente, a data e o serviço."
  >
    <template #body>
      <UForm
        id="form-novo-agendamento"
        :state="novo"
        class="flex flex-col gap-4"
        @submit="criar"
      >
        <UFormField label="Cliente" required>
          <USelectMenu
            v-model="novo.cliente"
            :items="clientes"
            label-key="nome"
            placeholder="Digite o nome do cliente..."
            icon="i-lucide-search"
          />
        </UFormField>
        <UFormField label="Veículo">
          <USelect
            v-model="novo.veiculoId"
            :items="veiculoItens"
            :disabled="!novo.cliente"
            placeholder="Selecione o veículo (opcional)"
          />
        </UFormField>

        <UFormField label="Data e hora" required>
          <UInput
            v-model="novo.dataHora"
            type="datetime-local"
            :min="format(new Date(), 'yyyy-MM-dd\'T\'HH:mm')"
          />
        </UFormField>
        <UFormField label="Serviço" required>
          <UInput v-model="novo.servico" placeholder="Ex.: Troca de óleo" />
        </UFormField>
        <UFormField label="Observação">
          <UInput v-model="novo.observacao" placeholder="Opcional" />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="outline"
          @click="modalAberto = false"
        />
        <UButton
          label="Criar"
          icon="i-lucide-check"
          type="submit"
          form="form-novo-agendamento"
          :loading="salvando"
        />
      </div>
    </template>
  </UModal>
</template>
