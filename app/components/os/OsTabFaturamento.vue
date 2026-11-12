<script setup lang="ts">
import type { FaturamentoView } from '~/composables/useOS'

defineProps<{
  faturamento: FaturamentoView
}>()

const emit = defineEmits<{
  lancarPagamento: []
  devolver: []
}>()

const { PAGAMENTO_META, formatarDinheiro, formatarData } = useOS()
</script>

<template>
  <div>
    <DashboardSectionHeader title="Faturamento" description="Posição financeira da OS.">
      <div class="flex items-center justify-end gap-2">
        <UBadge
          v-if="faturamento.badge"
          :label="PAGAMENTO_META[faturamento.badge].label"
          :color="PAGAMENTO_META[faturamento.badge].color"
          variant="subtle"
        />
        <UButton
          v-if="faturamento.saldo > 0"
          label="Lançar pagamento"
          icon="i-lucide-plus"
          size="sm"
          @click="emit('lancarPagamento')"
        />
        <UButton
          v-if="faturamento.pago > 0"
          label="Devolver"
          icon="i-lucide-undo-2"
          size="sm"
          color="neutral"
          variant="outline"
          @click="emit('devolver')"
        />
      </div>
    </DashboardSectionHeader>

    <UPageCard variant="subtle" class="mb-4">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DashboardDataField label="Total aprovado" :value="formatarDinheiro(faturamento.total)" />
        <DashboardDataField label="Total pago" :value="formatarDinheiro(faturamento.pago)" />
        <DashboardDataField label="Saldo" :value="formatarDinheiro(faturamento.saldo)" />
      </div>
    </UPageCard>

    <UPageCard title="Lançamentos" variant="subtle">
      <UEmpty
        v-if="!faturamento.lancamentos.length"
        icon="i-lucide-wallet"
        title="Nenhum lançamento"
        description="Os pagamentos desta OS aparecerão aqui."
        class="py-8"
      />
      <ul v-else class="divide-y divide-default">
        <li
          v-for="l in faturamento.lancamentos"
          :key="l.id"
          class="flex flex-wrap items-center gap-3 py-3 text-sm"
        >
          <span class="w-24 text-muted">{{ formatarData(l.data) }}</span>
          <UBadge
            :label="l.tipo === 'entrada' ? 'Entrada' : 'Saída'"
            :color="l.tipo === 'entrada' ? 'success' : 'error'"
            variant="subtle"
          />
          <span class="flex-1 capitalize">{{ l.modalidade }} · {{ l.categoria }}</span>
          <span class="font-medium tabular-nums">{{ formatarDinheiro(l.valor) }}</span>
        </li>
      </ul>
    </UPageCard>
  </div>
</template>
