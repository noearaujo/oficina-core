<script setup lang="ts">
import { formatarDinheiro } from '~/utils/dinheiro'

const route = useRoute()
const unidadeId = computed(() => String(route.params.unidadeId ?? ''))

const { data: financeiro, status } = await useFetch(
  () => `/api/unidade/${unidadeId.value}/relatorios/financeiro`,
  {
    watch: [unidadeId]
  }
)

const carregando = computed(() => status.value === 'pending')

const cards = computed(() => [
  {
    titulo: 'Relatório Financeiro',
    descricao: 'Demonstrativo do resultado do período, despesas operacionais, valores a receber, saldos de carteiras e caixas.',
    icone: 'i-lucide-circle-dollar-sign',
    to: `/unidade/${unidadeId.value}/relatorios/financeiro`,
    destaque: financeiro.value?.resultado
      ? formatarDinheiro(financeiro.value.resultado.resultadoOperacional)
      : 'R$ 0,00',
    destaqueLabel: 'Resultado operacional (mês)'
  },
  {
    titulo: 'Relatório de Caixa',
    descricao: 'Histórico de fechamentos de sessões, auditoria de sobras e quebras e controle de retiradas rápidas.',
    icone: 'i-lucide-banknote',
    to: `/unidade/${unidadeId.value}/relatorios/caixa`,
    destaque: financeiro.value?.caixas
      ? formatarDinheiro(financeiro.value.caixas.total)
      : 'R$ 0,00',
    destaqueLabel: 'Saldo em caixas abertos'
  }
])
</script>

<template>
  <UDashboardPanel id="relatorios-index">
    <template #header>
      <UDashboardNavbar title="Relatórios">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-3xl space-y-6">
        <!-- Resumo Rápido -->
        <DashboardSectionHeader
          title="Visão Geral do Mês"
          description="Indicadores consolidados da unidade no período atual."
        />

        <div v-if="carregando" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <USkeleton class="h-24 w-full rounded-xl" />
          <USkeleton class="h-24 w-full rounded-xl" />
          <USkeleton class="h-24 w-full rounded-xl" />
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UCard>
            <div class="space-y-1">
              <span class="text-xs font-medium text-muted uppercase tracking-wider">
                Resultado Operacional
              </span>
              <p
                class="text-2xl font-bold tabular-nums"
                :class="(financeiro?.resultado?.resultadoOperacional ?? 0) >= 0 ? 'text-success' : 'text-error'"
              >
                {{ formatarDinheiro(financeiro?.resultado?.resultadoOperacional) }}
              </p>
              <p class="text-xs text-muted">
                Receitas menos despesas operacionais
              </p>
            </div>
          </UCard>

          <UCard>
            <div class="space-y-1">
              <span class="text-xs font-medium text-muted uppercase tracking-wider">
                A Receber
              </span>
              <p class="text-2xl font-bold text-highlighted tabular-nums">
                {{ formatarDinheiro(financeiro?.aReceber?.total) }}
              </p>
              <p class="text-xs text-muted">
                {{ financeiro?.aReceber?.itens?.length || 0 }} OS com saldo em aberto
              </p>
            </div>
          </UCard>

          <UCard>
            <div class="space-y-1">
              <span class="text-xs font-medium text-muted uppercase tracking-wider">
                Saldo Disponível
              </span>
              <p class="text-2xl font-bold text-highlighted tabular-nums">
                {{ formatarDinheiro(financeiro?.saldoGeral) }}
              </p>
              <p class="text-xs text-muted">
                Carteiras bancárias, cofres e caixas
              </p>
            </div>
          </UCard>
        </div>

        <!-- Módulos de Relatórios -->
        <DashboardSectionHeader
          title="Módulos de Relatório"
          description="Selecione um módulo para consultar dados detalhados ou exportar planilhas."
        />

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UCard
            v-for="card in cards"
            :key="card.titulo"
            class="flex flex-col justify-between"
          >
            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-primary/10 text-primary">
                  <UIcon :name="card.icone" class="size-6" />
                </div>
                <h3 class="font-semibold text-highlighted text-base">
                  {{ card.titulo }}
                </h3>
              </div>
              <p class="text-sm text-muted">
                {{ card.descricao }}
              </p>
            </div>

            <div class="mt-6 pt-4 border-t border-default flex items-center justify-between">
              <div>
                <span class="text-xs text-muted block">{{ card.destaqueLabel }}</span>
                <span class="font-semibold text-highlighted tabular-nums text-sm">{{ card.destaque }}</span>
              </div>
              <UButton
                :to="card.to"
                label="Acessar"
                icon="i-lucide-arrow-right"
                trailing
                size="sm"
              />
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
