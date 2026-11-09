<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatarDinheiro } from '~/utils/dinheiro'

const route = useRoute()
const unidadeId = computed(() => route.path.match(/\/unidade\/([^/]+)/)?.[1] ?? String(route.params.id))

const periodoSelecionado = ref<'hoje' | 'semana' | 'mes' | 'personalizado'>('mes')
const caixaSelecionado = ref<string>('todos')

function formatarYMD(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const agora = new Date()
const dataInicioPersonalizada = ref(formatarYMD(new Date(agora.getFullYear(), agora.getMonth(), 1)))
const dataFimPersonalizada = ref(formatarYMD(agora))

const datasPeriodo = computed(() => {
  const refDate = new Date()
  if (periodoSelecionado.value === 'hoje') {
    const hojeStr = formatarYMD(refDate)
    return { dataInicio: hojeStr, dataFim: hojeStr }
  }
  if (periodoSelecionado.value === 'semana') {
    const day = refDate.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const segunda = new Date(refDate)
    segunda.setDate(refDate.getDate() + diff)
    const domingo = new Date(segunda)
    domingo.setDate(segunda.getDate() + 6)
    return { dataInicio: formatarYMD(segunda), dataFim: formatarYMD(domingo) }
  }
  if (periodoSelecionado.value === 'mes') {
    const primeiro = new Date(refDate.getFullYear(), refDate.getMonth(), 1)
    const ultimo = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0)
    return { dataInicio: formatarYMD(primeiro), dataFim: formatarYMD(ultimo) }
  }
  return {
    dataInicio: dataInicioPersonalizada.value,
    dataFim: dataFimPersonalizada.value
  }
})

interface CaixaItemOption {
  id: number
  nome: string
}

// Lista de caixas para o filtro
const { data: caixasCadastrados } = await useFetch<CaixaItemOption[]>(
  () => `/api/unidade/${unidadeId.value}/caixa`,
  {
    default: () => [],
    watch: [unidadeId]
  }
)

const opcoesCaixas = computed(() => [
  { label: 'Todos os caixas', value: 'todos' },
  ...((caixasCadastrados.value || []).map(c => ({
    label: c.nome,
    value: String(c.id)
  })))
])

const { data, status } = await useFetch(
  () => `/api/unidade/${unidadeId.value}/relatorios/caixa`,
  {
    query: computed(() => ({
      dataInicio: datasPeriodo.value.dataInicio,
      dataFim: datasPeriodo.value.dataFim,
      ...(caixaSelecionado.value !== 'todos' ? { caixaId: caixaSelecionado.value } : {})
    })),
    watch: [unidadeId, datasPeriodo, caixaSelecionado]
  }
)

const carregando = computed(() => status.value === 'pending')

function formatarDataHora(dataIso?: string | null): string {
  if (!dataIso) return '—'
  const d = new Date(dataIso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d)
}

const opcoesPeriodo = [
  { label: 'Hoje', value: 'hoje' },
  { label: 'Esta semana', value: 'semana' },
  { label: 'Este mês', value: 'mes' },
  { label: 'Personalizado', value: 'personalizado' }
]

// Interfaces das tabelas
interface FechamentoItem {
  sessaoId: number
  caixaId: number
  caixaNome: string
  responsavel: string
  abertaEm: string
  fechadaEm: string
  valorAbertura: number
  entradas: number
  saidas: number
  esperado: number
  contado: number
  diferenca: number
  destino: string
  motivoFechamento: string
}

interface SobraQuebraItem {
  sessaoId: number
  caixaId: number
  caixaNome: string
  responsavel: string
  data: string
  esperado: number
  contado: number
  diferenca: number
  tipo: 'sobra' | 'quebra'
  motivo: string
}

interface RetiradaItem {
  id: number
  sessaoId: number
  caixaId: number
  caixaNome: string
  data: string
  valor: number
  justificativa: string
  responsavel: string
}

// Colunas das tabelas
const colunasFechamentos: TableColumn<FechamentoItem>[] = [
  { accessorKey: 'caixaNome', header: 'Caixa' },
  { accessorKey: 'sessaoId', header: 'Sessão' },
  { accessorKey: 'responsavel', header: 'Responsável' },
  { accessorKey: 'fechadaEm', header: 'Fechado em' },
  { accessorKey: 'valorAbertura', header: 'Abertura' },
  { accessorKey: 'entradas', header: 'Entradas' },
  { accessorKey: 'saidas', header: 'Saídas' },
  { accessorKey: 'esperado', header: 'Esperado' },
  { accessorKey: 'contado', header: 'Contado' },
  { accessorKey: 'diferenca', header: 'Diferença' },
  { accessorKey: 'destino', header: 'Destino' }
]

const colunasSobrasQuebras: TableColumn<SobraQuebraItem>[] = [
  { accessorKey: 'data', header: 'Data fechamento' },
  { accessorKey: 'caixaNome', header: 'Caixa' },
  { accessorKey: 'tipo', header: 'Tipo' },
  { accessorKey: 'esperado', header: 'Saldo esperado' },
  { accessorKey: 'contado', header: 'Valor contado' },
  { accessorKey: 'diferenca', header: 'Diferença' },
  { accessorKey: 'motivo', header: 'Motivo / Justificativa' }
]

const colunasRetiradas: TableColumn<RetiradaItem>[] = [
  { accessorKey: 'data', header: 'Data/Hora' },
  { accessorKey: 'caixaNome', header: 'Caixa' },
  { accessorKey: 'responsavel', header: 'Responsável' },
  { accessorKey: 'justificativa', header: 'Justificativa' },
  { accessorKey: 'valor', header: 'Valor' }
]
</script>

<template>
  <UDashboardPanel id="relatorio-caixa">
    <template #header>
      <UDashboardNavbar title="Relatório de Caixa">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-3xl space-y-6">
        <!-- Filtros -->
        <UCard>
          <div class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <UFormField label="Período">
                <USelect
                  v-model="periodoSelecionado"
                  :items="opcoesPeriodo"
                />
              </UFormField>
              <UFormField label="Caixa">
                <USelect
                  v-model="caixaSelecionado"
                  :items="opcoesCaixas"
                />
              </UFormField>
            </div>

            <div v-if="periodoSelecionado === 'personalizado'" class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-default">
              <UFormField label="Data inicial">
                <UInput
                  v-model="dataInicioPersonalizada"
                  type="date"
                />
              </UFormField>
              <UFormField label="Data final">
                <UInput
                  v-model="dataFimPersonalizada"
                  type="date"
                />
              </UFormField>
            </div>
          </div>
        </UCard>

        <!-- Loading Skeleton -->
        <div v-if="carregando" class="space-y-4">
          <USkeleton class="h-28 w-full rounded-xl" />
          <USkeleton class="h-64 w-full rounded-xl" />
        </div>

        <template v-else-if="data">
          <!-- Resumo de Indicadores -->
          <DashboardSectionHeader
            title="Auditoria de Fechamentos"
            description="Visão consolidada de fechamentos, diferenças e retiradas rápidas."
          />

          <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <UCard>
              <div class="space-y-1">
                <span class="text-xs font-medium text-muted uppercase tracking-wider">
                  Fechamentos
                </span>
                <p class="text-2xl font-bold text-highlighted tabular-nums">
                  {{ data.fechamentos?.total || 0 }}
                </p>
                <p class="text-xs text-muted">
                  Sessões fechadas
                </p>
              </div>
            </UCard>

            <UCard>
              <div class="space-y-1">
                <span class="text-xs font-medium text-muted uppercase tracking-wider">
                  Sobras de Caixa
                </span>
                <p class="text-2xl font-bold text-success tabular-nums">
                  {{ formatarDinheiro(data.sobrasQuebras?.totalSobras) }}
                </p>
                <p class="text-xs text-muted">
                  Valor contado maior
                </p>
              </div>
            </UCard>

            <UCard>
              <div class="space-y-1">
                <span class="text-xs font-medium text-muted uppercase tracking-wider">
                  Quebras de Caixa
                </span>
                <p class="text-2xl font-bold text-error tabular-nums">
                  {{ formatarDinheiro(data.sobrasQuebras?.totalQuebras) }}
                </p>
                <p class="text-xs text-muted">
                  Valor contado menor
                </p>
              </div>
            </UCard>

            <UCard>
              <div class="space-y-1">
                <span class="text-xs font-medium text-muted uppercase tracking-wider">
                  Retiradas Rápidas
                </span>
                <p class="text-2xl font-bold text-highlighted tabular-nums">
                  {{ formatarDinheiro(data.retiradasRapidas?.total) }}
                </p>
                <p class="text-xs text-muted">
                  {{ data.retiradasRapidas?.itens?.length || 0 }} saídas avulsas
                </p>
              </div>
            </UCard>
          </div>

          <!-- Histórico de Fechamentos -->
          <DashboardSectionHeader
            title="Histórico de Fechamentos"
            description="Sessões fechadas com apuração de saldo esperado, valor contado e diferença."
          />

          <UTable
            :data="data.fechamentos?.itens || []"
            :columns="colunasFechamentos"
            class="border border-default rounded-xl overflow-hidden"
          >
            <template #sessaoId-cell="{ row }">
              <span class="font-medium text-highlighted tabular-nums">#{{ row.original.sessaoId }}</span>
            </template>
            <template #fechadaEm-cell="{ row }">
              {{ formatarDataHora(row.original.fechadaEm) }}
            </template>
            <template #valorAbertura-cell="{ row }">
              <span class="tabular-nums text-muted">{{ formatarDinheiro(row.original.valorAbertura) }}</span>
            </template>
            <template #entradas-cell="{ row }">
              <span class="tabular-nums text-success">{{ formatarDinheiro(row.original.entradas) }}</span>
            </template>
            <template #saidas-cell="{ row }">
              <span class="tabular-nums text-error">{{ formatarDinheiro(row.original.saidas) }}</span>
            </template>
            <template #esperado-cell="{ row }">
              <span class="tabular-nums font-semibold">{{ formatarDinheiro(row.original.esperado) }}</span>
            </template>
            <template #contado-cell="{ row }">
              <span class="tabular-nums font-semibold text-highlighted">{{ formatarDinheiro(row.original.contado) }}</span>
            </template>
            <template #diferenca-cell="{ row }">
              <span
                class="tabular-nums font-semibold"
                :class="row.original.diferenca > 0 ? 'text-success' : row.original.diferenca < 0 ? 'text-error' : 'text-muted'"
              >
                {{ row.original.diferenca > 0 ? '+' : '' }}{{ formatarDinheiro(row.original.diferenca) }}
              </span>
            </template>
            <template #empty>
              <UEmpty
                icon="i-lucide-clock"
                title="Nenhum fechamento registrado"
                description="Não há histórico de fechamento de caixa para os filtros selecionados."
              />
            </template>
          </UTable>

          <!-- Sobras e Quebras -->
          <DashboardSectionHeader
            title="Sobras e Quebras"
            description="Divergências registradas nos fechamentos de caixa."
          />

          <UTable
            :data="data.sobrasQuebras?.itens || []"
            :columns="colunasSobrasQuebras"
            class="border border-default rounded-xl overflow-hidden"
          >
            <template #data-cell="{ row }">
              {{ formatarDataHora(row.original.data) }}
            </template>
            <template #tipo-cell="{ row }">
              <UBadge
                :label="row.original.tipo === 'sobra' ? 'Sobra' : 'Quebra'"
                :color="row.original.tipo === 'sobra' ? 'success' : 'error'"
                variant="subtle"
              />
            </template>
            <template #esperado-cell="{ row }">
              <span class="tabular-nums">{{ formatarDinheiro(row.original.esperado) }}</span>
            </template>
            <template #contado-cell="{ row }">
              <span class="tabular-nums text-highlighted">{{ formatarDinheiro(row.original.contado) }}</span>
            </template>
            <template #diferenca-cell="{ row }">
              <span
                class="tabular-nums font-semibold"
                :class="row.original.tipo === 'sobra' ? 'text-success' : 'text-error'"
              >
                {{ row.original.diferenca > 0 ? '+' : '' }}{{ formatarDinheiro(row.original.diferenca) }}
              </span>
            </template>
            <template #motivo-cell="{ row }">
              <span class="text-muted text-xs">{{ row.original.motivo || 'Sem justificativa informada' }}</span>
            </template>
            <template #empty>
              <UEmpty
                icon="i-lucide-check-check"
                title="Nenhuma divergência apurada"
                description="Não houve registro de sobras ou quebras nos fechamentos do período."
              />
            </template>
          </UTable>

          <!-- Retiradas Rápidas -->
          <DashboardSectionHeader
            title="Retiradas Rápidas"
            description="Valores retirados do caixa no balcão com justificativa de saída."
          />

          <UTable
            :data="data.retiradasRapidas?.itens || []"
            :columns="colunasRetiradas"
            class="border border-default rounded-xl overflow-hidden"
          >
            <template #data-cell="{ row }">
              {{ formatarDataHora(row.original.data) }}
            </template>
            <template #justificativa-cell="{ row }">
              <span class="font-medium text-highlighted">{{ row.original.justificativa }}</span>
            </template>
            <template #valor-cell="{ row }">
              <span class="tabular-nums font-semibold text-error">
                - {{ formatarDinheiro(row.original.valor) }}
              </span>
            </template>
            <template #empty>
              <UEmpty
                icon="i-lucide-receipt"
                title="Nenhuma retirada rápida"
                description="Não foram efetuadas retiradas rápidas no período selecionado."
              />
            </template>
          </UTable>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
