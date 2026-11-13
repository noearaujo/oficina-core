<script setup lang="ts">
import { format, parse } from 'date-fns'
import type { AgendamentoView, Veiculo } from '~/types'

const props = defineProps<{
  agendamento: AgendamentoView | null
  veiculos: Veiculo[]
}>()

const emit = defineEmits<{
  remarcado: []
  cancelado: []
  convertido: []
}>()

const route = useRoute()
const toast = useToast()
const { erroMensagem, RESPONSAVEIS } = useOS()

const unidadeId = computed(() => String(route.params.unidadeId ?? ''))

const COR_CLASSES: Record<'azul' | 'cinza', { bloco: string }> = {
  azul: { bloco: 'bg-blue-500/15 text-blue-700 ring ring-inset ring-blue-500/30 dark:text-blue-300' },
  cinza: { bloco: 'bg-neutral-500/10 text-muted ring ring-inset ring-neutral-500/25' }
}

const modalAberto = ref(false)
const mostrandoRemarcar = ref(false)
const acaoEmCurso = ref<'remarcar' | 'converter' | 'cancelar' | null>(null)
const remarcar = reactive<{
  dataHora: string
  veiculoId: number | undefined
}>({
  dataHora: '',
  veiculoId: undefined
})

const veiculosDoSelecionado = computed(() =>
  props.veiculos
    .filter(v => v.clienteId === props.agendamento?.clienteId)
    .map(v => ({
      label: `${v.placa} — ${[v.marca, v.modelo].filter(Boolean).join(' ')}`,
      value: v.id
    }))
)

const detalheCor = computed<'azul' | 'cinza'>(() =>
  props.agendamento?.status === 'agendado' ? 'azul' : 'cinza'
)

const detalheStatus = computed(() => {
  const s = props.agendamento?.status
  return s === 'realizado' ? 'Realizado' : s === 'cancelado' ? 'Cancelado' : 'Agendado'
})

function abrir(ag: AgendamentoView) {
  mostrandoRemarcar.value = false
  remarcar.dataHora = format(new Date(ag.dataHora), 'yyyy-MM-dd\'T\'HH:mm')
  remarcar.veiculoId = ag.veiculoId
  modalAberto.value = true
}

async function remarcarSelecionado() {
  const ag = props.agendamento
  if (!ag || !remarcar.dataHora) return

  acaoEmCurso.value = 'remarcar'
  try {
    await $fetch(`/api/unidade/${unidadeId.value}/agenda/${ag.id}`, {
      method: 'PUT',
      body: {
        dataHora: parse(remarcar.dataHora, 'yyyy-MM-dd\'T\'HH:mm', new Date()).toISOString(),
        veiculoId: remarcar.veiculoId
      }
    })
    toast.add({ title: 'Agendamento remarcado', color: 'success' })
    mostrandoRemarcar.value = false
    emit('remarcado')
    modalAberto.value = false
  } catch (err) {
    toast.add({ title: 'Não foi possível salvar', description: erroMensagem(err), color: 'error' })
  } finally {
    acaoEmCurso.value = null
  }
}

async function cancelarSelecionado(): Promise<boolean> {
  const ag = props.agendamento
  if (!ag) return false

  acaoEmCurso.value = 'cancelar'
  try {
    await $fetch(`/api/unidade/${unidadeId.value}/agenda/${ag.id}/cancelar`, { method: 'POST' })
    toast.add({ title: 'Agendamento cancelado', color: 'success' })
    emit('cancelado')
    modalAberto.value = false
    return true
  } catch (err) {
    toast.add({ title: 'Não foi possível cancelar', description: erroMensagem(err), color: 'error' })
    return false
  } finally {
    acaoEmCurso.value = null
  }
}

async function converterSelecionado() {
  const ag = props.agendamento
  if (!ag) return

  const veiculoId = ag.veiculoId ?? remarcar.veiculoId
  if (!veiculoId) {
    toast.add({
      title: 'Não foi possível converter',
      description: 'Selecione o veículo para criar a OS.',
      color: 'error'
    })
    return
  }

  acaoEmCurso.value = 'converter'
  try {
    const res = await $fetch<{ os: { id: number } }>(
      `/api/unidade/${unidadeId.value}/agenda/${ag.id}/converter`,
      {
        method: 'POST',
        body: { veiculoId, funcionarioId: RESPONSAVEIS[0]?.value }
      }
    )
    toast.add({ title: 'OS criada', color: 'success' })
    emit('convertido')
    modalAberto.value = false
    await navigateTo(`/unidade/${unidadeId.value}/os/${res.os.id}`)
  } catch (err) {
    toast.add({ title: 'Não foi possível converter', description: erroMensagem(err), color: 'error' })
  } finally {
    acaoEmCurso.value = null
  }
}

defineExpose({ abrir })
</script>

<template>
  <UModal v-model:open="modalAberto" size="lg" title="Agendamento">
    <template #body>
      <div
        v-if="agendamento"
        class="flex flex-col gap-4 border-l-4 pl-4"
        :class="detalheCor === 'azul' ? 'border-l-blue-500' : 'border-l-neutral-400'"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-base font-semibold">{{ agendamento.servico }}</span>
          <UBadge
            :label="detalheStatus"
            color="neutral"
            variant="subtle"
            :class="COR_CLASSES[detalheCor].bloco"
          />
        </div>

        <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt class="flex items-center gap-1.5 text-muted">
              <UIcon name="i-lucide-user" class="size-3.5" />
              Cliente
            </dt>
            <dd>{{ agendamento.clienteNome || 'Não informado' }}</dd>
          </div>
          <div>
            <dt class="flex items-center gap-1.5 text-muted">
              <UIcon name="i-lucide-car" class="size-3.5" />
              Veículo
            </dt>
            <dd>
              {{ agendamento.veiculoPlaca
                ? `${agendamento.veiculoPlaca} — ${agendamento.veiculoDescricao || ''}`
                : 'Não informado' }}
            </dd>
          </div>
          <div>
            <dt class="flex items-center gap-1.5 text-muted">
              <UIcon name="i-lucide-calendar" class="size-3.5" />
              Data e hora
            </dt>
            <dd>{{ format(new Date(agendamento.dataHora), 'dd/MM/yyyy HH:mm') }}</dd>
          </div>
          <div>
            <dt class="flex items-center gap-1.5 text-muted">
              <UIcon name="i-lucide-notebook-pen" class="size-3.5" />
              Observação
            </dt>
            <dd>{{ agendamento.observacao || 'Não informado' }}</dd>
          </div>
        </dl>

        <div v-if="mostrandoRemarcar" class="flex flex-col gap-3 rounded-lg bg-elevated/50 p-3">
          <UFormField label="Remarcar para">
            <UInput v-model="remarcar.dataHora" type="datetime-local" />
          </UFormField>
          <UFormField v-if="!agendamento.veiculoId" label="Veículo">
            <USelect
              v-model="remarcar.veiculoId"
              :items="veiculosDoSelecionado"
              placeholder="Selecione o veículo"
            />
          </UFormField>
        </div>

        <UButton
          v-if="agendamento.osId"
          label="Ver OS"
          icon="i-lucide-external-link"
          color="neutral"
          variant="outline"
          :to="`/unidade/${unidadeId}/os/${agendamento.osId}`"
        />
      </div>
    </template>
    <template v-if="agendamento?.status === 'agendado'" #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <UButton
          label="Cancelar"
          icon="i-lucide-x"
          color="error"
          variant="outline"
          :loading="acaoEmCurso === 'cancelar'"
          @click="cancelarSelecionado"
        />
        <div class="flex gap-2">
          <UButton
            :label="mostrandoRemarcar ? 'Salvar remarcação' : 'Remarcar'"
            :icon="mostrandoRemarcar ? 'i-lucide-check' : 'i-lucide-calendar-clock'"
            color="neutral"
            variant="outline"
            :loading="acaoEmCurso === 'remarcar'"
            @click="mostrandoRemarcar ? remarcarSelecionado() : (mostrandoRemarcar = true)"
          />
          <UButton
            label="Converter em OS"
            icon="i-lucide-clipboard-check"
            :loading="acaoEmCurso === 'converter'"
            @click="converterSelecionado"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
