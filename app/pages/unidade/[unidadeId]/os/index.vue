<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import { refDebounced } from '@vueuse/core'
import type { OSView, StatusOS } from '~/composables/useOS'

const route = useRoute()
const unidadeId = computed(() => String(route.params.unidadeId ?? ''))
const { STATUS_LISTA, PAGAMENTO_META, statusMeta, formatarDinheiro, formatarData } = useOS()

const busca = ref('')
const buscaDebounced = refDebounced(busca, 300)
const termo = computed(() => buscaDebounced.value.trim().length >= 3 ? buscaDebounced.value.trim() : '')
const statusFiltro = ref<'todos' | StatusOS>('todos')

const pagination = ref({ pageIndex: 0, pageSize: 10 })

const { data, status, error, refresh } = await useFetch<OSView[]>(
  () => `/api/unidade/${unidadeId.value}/os`,
  {
    default: () => [],
    query: computed(() => ({
      ...(termo.value ? { q: termo.value } : {}),
      ...(statusFiltro.value !== 'todos' ? { status: statusFiltro.value } : {})
    })),
    watch: [unidadeId]
  }
)

watch([termo, statusFiltro], () => {
  pagination.value.pageIndex = 0
})

const filtrosAtivos = computed(() => Boolean(termo.value) || statusFiltro.value !== 'todos')

const chips = computed(() => [
  { value: 'todos' as const, label: 'Todas' },
  ...STATUS_LISTA.map(s => ({ value: s, label: statusMeta(s).label }))
])

const columns: TableColumn<OSView>[] = [
  { accessorKey: 'numero', header: 'N°' },
  { id: 'cliente', header: 'Cliente' },
  { id: 'veiculo', header: 'Veículo' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'dataEntrada', header: 'Data entrada' },
  { id: 'previsao', header: 'Previsão' },
  { id: 'total', header: 'Total' },
  { id: 'pagamento', header: 'Pagamento' }
]

function abrirOS(_e: Event, row: { original: OSView }) {
  navigateTo(`/unidade/${unidadeId.value}/os/${row.original.id}`)
}
</script>

<template>
  <UDashboardPanel id="os">
    <template #header>
      <UDashboardNavbar title="Ordens de serviço">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Nova OS"
            icon="i-lucide-plus"
            :to="`/unidade/${unidadeId}/os/novo`"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UInput
        v-model="busca"
        icon="i-lucide-search"
        placeholder="Buscar por número, cliente, placa ou CPF..."
        class="sm:max-w-sm"
      />

      <div class="flex flex-wrap gap-1.5">
        <UButton
          v-for="chip in chips"
          :key="chip.value"
          :label="chip.label"
          size="sm"
          :color="statusFiltro === chip.value ? 'primary' : 'neutral'"
          :variant="statusFiltro === chip.value ? 'subtle' : 'outline'"
          @click="statusFiltro = chip.value"
        />
      </div>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        title="Erro ao carregar OS"
        description="Não foi possível buscar as ordens de serviço."
      >
        <template #actions>
          <UButton
            label="Tentar novamente"
            color="error"
            variant="soft"
            :loading="status === 'pending'"
            @click="() => refresh()"
          />
        </template>
      </UAlert>

      <UTable
        v-model:pagination="pagination"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        :data="data"
        :columns="columns"
        :loading="status === 'pending'"
        class="cursor-pointer"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
          separator: 'h-0'
        }"
        @select="abrirOS"
      >
        <template #numero-cell="{ row }">
          <span class="font-medium text-highlighted tabular-nums">#{{ row.original.numero }}</span>
        </template>

        <template #cliente-cell="{ row }">
          <span class="truncate">{{ row.original.clienteNome || 'Não informado' }}</span>
        </template>

        <template #veiculo-cell="{ row }">
          <div class="flex flex-col">
            <span class="font-medium tabular-nums">{{ row.original.veiculoPlaca || '—' }}</span>
            <span class="text-xs text-muted">
              {{ [row.original.veiculoMarca, row.original.veiculoModelo].filter(Boolean).join(' ') }}
            </span>
          </div>
        </template>

        <template #status-cell="{ row }">
          <UBadge
            :label="statusMeta(row.original.status).label"
            :color="statusMeta(row.original.status).color"
            :class="statusMeta(row.original.status).class"
            variant="subtle"
          />
        </template>

        <template #dataEntrada-cell="{ row }">
          {{ formatarData(row.original.dataEntrada) || '—' }}
        </template>

        <template #previsao-cell="{ row }">
          {{ formatarData(row.original.previsaoEntrega) || '—' }}
        </template>

        <template #total-cell="{ row }">
          <span class="tabular-nums">{{ formatarDinheiro(row.original.faturamento?.total) }}</span>
        </template>

        <template #pagamento-cell="{ row }">
          <UBadge
            v-if="row.original.faturamento?.badge"
            :label="PAGAMENTO_META[row.original.faturamento.badge].label"
            :color="PAGAMENTO_META[row.original.faturamento.badge].color"
            variant="subtle"
          />
          <span v-else class="text-muted">—</span>
        </template>

        <template #empty>
          <UEmpty
            icon="i-lucide-clipboard-list"
            :title="filtrosAtivos ? 'Nenhuma OS encontrada' : 'Nenhuma OS aberta.'"
            :description="filtrosAtivos ? 'Tente ajustar a busca ou os filtros.' : 'Crie sua primeira OS para começar.'"
          />
        </template>
      </UTable>
    </template>
  </UDashboardPanel>
</template>
