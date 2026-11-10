<script setup lang="ts">
import type { OSView } from '~/composables/useOS'

const props = defineProps<{
  os: OSView
  edicaoPermitida: boolean
  salvandoCampo: boolean
}>()

const emit = defineEmits<{
  'salvarCampo': [campo: 'queixa' | 'diagnostico' | 'avarias', valor: string, fechar: () => void]
  'editar-resumo': []
}>()

const { RESPONSAVEIS, formatarData } = useOS()

const refQueixa = ref<{ fechar: () => void } | null>(null)
const refDiagnostico = ref<{ fechar: () => void } | null>(null)
const refAvarias = ref<{ fechar: () => void } | null>(null)

const responsavel = computed(() =>
  RESPONSAVEIS.find(r => r.value === props.os.funcionarioId)?.label || `Responsável #${props.os.funcionarioId}`
)

const veiculoNome = computed(() =>
  [props.os.veiculoMarca, props.os.veiculoModelo].filter(Boolean).join(' ') || 'Veículo'
)

function salvar(campo: 'queixa' | 'diagnostico' | 'avarias', valor: string, el: { fechar: () => void } | null) {
  emit('salvarCampo', campo, valor, () => el?.fechar())
}
</script>

<template>
  <div class="space-y-4">
    <UPageCard variant="subtle">
      <template #title>
        <div class="flex items-center justify-between w-full">
          <span>Resumo</span>
          <UButton
            v-if="edicaoPermitida"
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="emit('editar-resumo')"
          />
        </div>
      </template>
      <div class="flex flex-wrap items-center gap-3">
        <UAvatar icon="i-lucide-car" size="lg" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-highlighted truncate">
            {{ veiculoNome }}
          </p>
          <p class="text-sm text-muted tabular-nums">
            {{ os.veiculoPlaca || 'Não informado' }}
          </p>
        </div>
        <UBadge
          v-if="os.tipo === 'garantia'"
          label="Garantia"
          color="info"
          variant="subtle"
        />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DashboardDataField label="Cliente" :value="os.clienteNome" />
        <DashboardDataField label="Responsável" :value="responsavel" />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <DashboardDataField label="Quilometragem" :value="os.quilometragem !== undefined ? `${os.quilometragem} km` : undefined" />
        <DashboardDataField label="Combustível" :value="os.combustivel" />
        <DashboardDataField label="Data de entrada" :value="formatarData(os.dataEntrada)" />
        <DashboardDataField label="Previsão de entrega" :value="formatarData(os.previsaoEntrega)" />
      </div>
    </UPageCard>

    <OsCampoEditavel
      ref="refQueixa"
      titulo="Queixa"
      :valor="os.queixa"
      :editavel="edicaoPermitida"
      :salvando="salvandoCampo"
      obrigatorio
      placeholder="Queixa do cliente"
      @salvar="v => salvar('queixa', v, refQueixa)"
    />
    <OsCampoEditavel
      ref="refDiagnostico"
      titulo="Diagnóstico"
      :valor="os.diagnostico"
      :editavel="edicaoPermitida"
      :salvando="salvandoCampo"
      placeholder="Diagnóstico do mecânico"
      @salvar="v => salvar('diagnostico', v, refDiagnostico)"
    />
    <OsCampoEditavel
      ref="refAvarias"
      titulo="Avarias"
      :valor="os.avarias"
      :editavel="edicaoPermitida"
      :salvando="salvandoCampo"
      placeholder="Avarias na entrada"
      @salvar="v => salvar('avarias', v, refAvarias)"
    />
  </div>
</template>
