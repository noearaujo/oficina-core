<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatarDinheiro } from '~/utils/dinheiro'

const route = useRoute()
const unidadeId = computed(() => route.path.match(/\/unidade\/([^/]+)/)?.[1] ?? String(route.params.id))

const periodoSelecionado = ref<'hoje' | 'semana' | 'mes' | 'personalizado'>('mes')

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

const { data, status } = await useFetch(
  () => `/api/unidade/${unidadeId.value}/relatorios/financeiro`,
  {
    query: computed(() => ({
      dataInicio: datasPeriodo.value.dataInicio,
      dataFim: datasPeriodo.value.dataFim
    })),
    watch: [unidadeId, datasPeriodo]
  }
)

const carregando = computed(() => status.value === 'pending')

function formatarData(dataIso?: string | null): string {
  if (!dataIso) return '—'
  const d = new Date(dataIso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR').format(d)
}

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

function exportarCSV(tipo: 'os' | 'lancamentos') {
  const url = `/api/unidade/${unidadeId.value}/relatorios/exportar-csv?tipo=${tipo}&dataInicio=${datasPeriodo.value.dataInicio}&dataFim=${datasPeriodo.value.dataFim}`
  window.open(url, '_blank')
}

// Interfaces e colunas das tabelas
interface AReceberItem {
  id: number
  numero: string
  clienteNome: string
  status: string
  dataEntrada: string
  previsaoEntrega?: string
  total: number
  pago: number
  saldo: number
  badge?: string | null
}

interface CarteiraItem {
  id: number
  nome: string
  tipo: string
  saldoInicial: number
  saldo: number
  ativa: boolean
}

interface CaixaItem {
  sessaoId: number
  caixaId: number
  caixaNome: string
  responsavelNome: string
  abertaEm: string
  valorAbertura: number
  saldoEsperado: number
}

interface LancamentoItem {
  id: number
  data: string
  tipo: 'entrada' | 'saida'
  categoria: string
  modalidade: string
  local: string
  valor: number
  observacao?: string
}

const colunasAReceber: TableColumn<AReceberItem>[] = [
  { accessorKey: 'numero', header: 'N° OS' },
  { accessorKey: 'clienteNome', header: 'Cliente' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'dataEntrada', header: 'Data entrada' },
  { accessorKey: 'total', header: 'Total' },
  { accessorKey: 'pago', header: 'Pago' },
  { accessorKey: 'saldo', header: 'Saldo em aberto' }
]

const colunasCarteiras: TableColumn<CarteiraItem>[] = [
  { accessorKey: 'nome', header: 'Carteira' },
  { accessorKey: 'tipo', header: 'Tipo' },
  { accessorKey: 'saldoInicial', header: 'Saldo Inicial' },
  { accessorKey: 'saldo', header: 'Saldo Atual' }
]

const colunasCaixas: TableColumn<CaixaItem>[] = [
  { accessorKey: 'caixaNome', header: 'Caixa' },
  { accessorKey: 'responsavelNome', header: 'Responsável' },
  { accessorKey: 'abertaEm', header: 'Aberta em' },
  { accessorKey: 'saldoEsperado', header: 'Saldo Esperado' }
]

const colunasLancamentos: TableColumn<LancamentoItem>[] = [
  { accessorKey: 'data', header: 'Data' },
  { accessorKey: 'tipo', header: 'Tipo' },
  { accessorKey: 'categoria', header: 'Categoria' },
  { accessorKey: 'modalidade', header: 'Modalidade' },
  { accessorKey: 'local', header: 'Local' },
  { accessorKey: 'valor', header: 'Valor' }
]

const CATEGORIAS_HUMANAS: Record<string, string> = {
  pagamento: 'Pagamento',
  devolucao: 'Devolução',
  peca: 'Peça',
  material: 'Material',
  alimento: 'Alimento',
  fixo: 'Custo fixo',
  folha: 'Folha',
  imposto: 'Imposto',
  taxa_adquirente: 'Taxa adquirente',
  retirada_rapida: 'Retirada rápida',
  aporte: 'Aporte',
  emprestimo_socio: 'Empréstimo',
  transferencia: 'Transferência',
  sobra_caixa: 'Sobra de caixa',
  quebra_caixa: 'Quebra de caixa',
  outro: 'Outro'
}

const STATUS_OS_HUMANO: Record<string, string> = {
  aberta: 'Aberta',
  em_diagnostico: 'Em diagnóstico',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovada: 'Aprovada',
  em_execucao: 'Em execução',
  concluida: 'Concluída',
  entregue: 'Entregue',
  cancelada: 'Cancelada'
}
</script>

<template>
  <UDashboardPanel id="relatorio-financeiro">
    <template #header>
      <UDashboardNavbar title="Relatório Financeiro">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              label="Exportar Lançamentos"
              icon="i-lucide-download"
              color="neutral"
              variant="outline"
              size="sm"
              @click="exportarCSV('lancamentos')"
            />
            <UButton
              label="Exportar OS"
              icon="i-lucide-download"
              color="neutral"
              variant="outline"
              size="sm"
              @click="exportarCSV('os')"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-3xl space-y-6">
        <!-- Filtro de Período -->
        <UCard>
          <div class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <span class="text-sm font-semibold text-highlighted">Período de Análise</span>
              <USelect
                v-model="periodoSelecionado"
                :items="opcoesPeriodo"
                class="w-44"
              />
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
          <!-- Resultado do Período -->
          <DashboardSectionHeader
            title="Resultado do Período"
            description="Receitas e despesas operacionais no intervalo selecionado."
          />

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <UCard>
              <div class="space-y-1">
                <span class="text-xs font-medium text-muted uppercase tracking-wider">
                  Receitas Operacionais
                </span>
                <p class="text-2xl font-bold text-success tabular-nums">
                  {{ formatarDinheiro(data.resultado?.receitasOperacionais) }}
                </p>
                <p class="text-xs text-muted">
                  Recebimentos de OS e vendas
                </p>
              </div>
            </UCard>

            <UCard>
              <div class="space-y-1">
                <span class="text-xs font-medium text-muted uppercase tracking-wider">
                  Despesas Operacionais
                </span>
                <p class="text-2xl font-bold text-error tabular-nums">
                  {{ formatarDinheiro(data.resultado?.despesasOperacionais) }}
                </p>
                <p class="text-xs text-muted">
                  Peças, materiais, fixos, taxas e retiradas
                </p>
              </div>
            </UCard>

            <UCard>
              <div class="space-y-1">
                <span class="text-xs font-medium text-muted uppercase tracking-wider">
                  Resultado Operacional
                </span>
                <p
                  class="text-2xl font-bold tabular-nums"
                  :class="(data.resultado?.resultadoOperacional ?? 0) >= 0 ? 'text-success' : 'text-error'"
                >
                  {{ formatarDinheiro(data.resultado?.resultadoOperacional) }}
                </p>
                <p class="text-xs text-muted">
                  Margem operacional do período
                </p>
              </div>
            </UCard>
          </div>

          <!-- Movimentações não operacionais (mostradas separadamente conforme regra) -->
          <UCard>
            <div class="space-y-2">
              <span class="text-xs font-medium text-muted uppercase tracking-wider">
                Movimentações Não Operacionais & Outros
              </span>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <span class="text-xs text-muted block">Aportes e Empréstimos</span>
                  <span class="text-sm font-semibold text-highlighted tabular-nums">
                    {{ formatarDinheiro(data.resultado?.receitasNaoOperacionais) }}
                  </span>
                </div>
                <div>
                  <span class="text-xs text-muted block">Devoluções de Clientes</span>
                  <span class="text-sm font-semibold text-error tabular-nums">
                    {{ formatarDinheiro(data.resultado?.devolucoes) }}
                  </span>
                </div>
                <div>
                  <span class="text-xs text-muted block">Transferências entre Contas</span>
                  <span class="text-sm font-semibold text-muted tabular-nums">
                    {{ formatarDinheiro(data.resultado?.transferencias) }}
                  </span>
                </div>
              </div>
            </div>
          </UCard>

          <!-- A Receber -->
          <DashboardSectionHeader
            title="A Receber"
            :description="`Total pendente em ordens de serviço aprovadas: ${formatarDinheiro(data.aReceber?.total)}`"
          />

          <UTable
            :data="data.aReceber?.itens || []"
            :columns="colunasAReceber"
            class="border border-default rounded-xl overflow-hidden"
          >
            <template #numero-cell="{ row }">
              <span class="font-medium text-highlighted tabular-nums">#{{ row.original.numero }}</span>
            </template>
            <template #status-cell="{ row }">
              <UBadge
                :label="STATUS_OS_HUMANO[row.original.status] || row.original.status"
                variant="subtle"
              />
            </template>
            <template #dataEntrada-cell="{ row }">
              {{ formatarData(row.original.dataEntrada) }}
            </template>
            <template #total-cell="{ row }">
              <span class="tabular-nums">{{ formatarDinheiro(row.original.total) }}</span>
            </template>
            <template #pago-cell="{ row }">
              <span class="tabular-nums text-muted">{{ formatarDinheiro(row.original.pago) }}</span>
            </template>
            <template #saldo-cell="{ row }">
              <span class="tabular-nums font-semibold text-highlighted">{{ formatarDinheiro(row.original.saldo) }}</span>
            </template>
            <template #empty>
              <UEmpty
                icon="i-lucide-check-circle"
                title="Nenhum valor a receber"
                description="Todas as ordens de serviço aprovadas estão com pagamentos quitados."
              />
            </template>
          </UTable>

          <!-- Saldo por Carteira -->
          <DashboardSectionHeader
            title="Saldo por Carteira"
            :description="`Saldo consolidado em bancos e cofres: ${formatarDinheiro(data.carteiras?.total)}`"
          />

          <UTable
            :data="data.carteiras?.itens || []"
            :columns="colunasCarteiras"
            class="border border-default rounded-xl overflow-hidden"
          >
            <template #tipo-cell="{ row }">
              <UBadge
                :label="row.original.tipo === 'banco' ? 'Banco' : 'Cofre'"
                variant="subtle"
              />
            </template>
            <template #saldoInicial-cell="{ row }">
              <span class="tabular-nums text-muted">{{ formatarDinheiro(row.original.saldoInicial) }}</span>
            </template>
            <template #saldo-cell="{ row }">
              <span
                class="tabular-nums font-semibold"
                :class="row.original.saldo >= 0 ? 'text-highlighted' : 'text-error'"
              >
                {{ formatarDinheiro(row.original.saldo) }}
              </span>
            </template>
            <template #empty>
              <UEmpty
                icon="i-lucide-wallet"
                title="Nenhuma carteira cadastrada"
                description="Cadastre carteiras bancárias ou cofres no módulo Carteiras."
              />
            </template>
          </UTable>

          <!-- Saldo por Caixa -->
          <DashboardSectionHeader
            title="Saldo por Caixa"
            :description="`Saldo em sessões abertas no momento: ${formatarDinheiro(data.caixas?.total)}`"
          />

          <UTable
            :data="data.caixas?.itens || []"
            :columns="colunasCaixas"
            class="border border-default rounded-xl overflow-hidden"
          >
            <template #abertaEm-cell="{ row }">
              {{ formatarDataHora(row.original.abertaEm) }}
            </template>
            <template #saldoEsperado-cell="{ row }">
              <span class="tabular-nums font-semibold text-highlighted">{{ formatarDinheiro(row.original.saldoEsperado) }}</span>
            </template>
            <template #empty>
              <UEmpty
                icon="i-lucide-banknote"
                title="Nenhum caixa aberto"
                description="Não há sessões de caixa em aberto no momento."
              />
            </template>
          </UTable>

          <!-- Últimos Lançamentos (Extrato) -->
          <DashboardSectionHeader
            title="Extrato de Lançamentos"
            description="Lançamentos financeiros realizados no período filtrado."
          />

          <UTable
            :data="data.lancamentos || []"
            :columns="colunasLancamentos"
            class="border border-default rounded-xl overflow-hidden"
          >
            <template #data-cell="{ row }">
              {{ formatarDataHora(row.original.data) }}
            </template>
            <template #tipo-cell="{ row }">
              <UBadge
                :label="row.original.tipo === 'entrada' ? 'Entrada' : 'Saída'"
                :color="row.original.tipo === 'entrada' ? 'success' : 'error'"
                variant="subtle"
              />
            </template>
            <template #categoria-cell="{ row }">
              {{ CATEGORIAS_HUMANAS[row.original.categoria] || row.original.categoria }}
            </template>
            <template #modalidade-cell="{ row }">
              <span class="capitalize text-muted">{{ row.original.modalidade }}</span>
            </template>
            <template #valor-cell="{ row }">
              <span
                class="tabular-nums font-semibold"
                :class="row.original.tipo === 'entrada' ? 'text-success' : 'text-error'"
              >
                {{ row.original.tipo === 'entrada' ? '+' : '-' }} {{ formatarDinheiro(row.original.valor) }}
              </span>
            </template>
            <template #empty>
              <UEmpty
                icon="i-lucide-receipt"
                title="Nenhum lançamento no período"
                description="Não foram registrados lançamentos financeiros no período selecionado."
              />
            </template>
          </UTable>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
