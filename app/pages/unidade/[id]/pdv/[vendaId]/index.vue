<script setup lang="ts">
import type { Venda, VendaItem } from '~/types'

const route = useRoute()
const router = useRouter()

const unidadeId = computed(() => route.path.match(/\/unidade\/([^/]+)/)?.[1] ?? String(route.params.id))
const vendaId = computed(() => String(route.params.vendaId ?? route.params.id))

const {
  data: venda,
  status,
  error,
  refresh
} = await useFetch<Venda>(
  () => `/api/unidade/${unidadeId.value}/pdv/${vendaId.value}`,
  { watch: [unidadeId, vendaId] }
)

function formatarPreco(centavos: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((centavos || 0) / 100)
}

function formatarData(iso?: string) {
  if (!iso) return 'Não informado'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(iso))
}

function labelFormaPagamento(forma?: string) {
  if (!forma) return 'Não informado'
  const mapa: Record<string, string> = {
    dinheiro: 'Dinheiro',
    pix: 'PIX',
    credito: 'Cartão de Crédito',
    debito: 'Cartão de Débito'
  }
  return mapa[forma] || forma.toUpperCase()
}

function totalItem(item: VendaItem): number {
  return Math.round(Number(item.quantidade || 0) * Math.round(Number(item.precoUnitario || 0)))
}

const totalCalculado = computed(() => {
  if (!venda.value?.itens?.length) return 0
  return venda.value.itens.reduce((acc, item) => acc + totalItem(item), 0)
})

const destinoPagamento = computed(() => {
  if (!venda.value) return 'Não informado'
  return venda.value.caixaNome || venda.value.carteiraNome || 'Não informado'
})

function imprimirRecibo() {
  if (import.meta.client) {
    window.print()
  }
}
</script>

<template>
  <UDashboardPanel id="pdv-recibo">
    <template #header>
      <UDashboardNavbar :title="venda ? `Recibo ${venda.numero}` : 'Recibo de Venda'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Loading -->
      <div v-if="status === 'pending'" class="mx-auto w-full max-w-3xl">
        <USkeleton class="h-96 w-full rounded-xl" />
      </div>

      <!-- Erro -->
      <UEmpty
        v-else-if="error || !venda"
        icon="i-lucide-receipt"
        title="Venda não encontrada"
        description="Não foi possível carregar os dados deste recibo de venda."
        :actions="[
          {
            label: 'Voltar para o PDV',
            icon: 'i-lucide-arrow-left',
            color: 'neutral',
            variant: 'outline',
            onClick: () => router.push(`/unidade/${unidadeId}/pdv`)
          },
          {
            label: 'Tentar novamente',
            icon: 'i-lucide-refresh-cw',
            onClick: () => refresh()
          }
        ]"
      />

      <!-- Recibo (PrintPreview modo RECIBO) -->
      <div v-else class="mx-auto w-full max-w-3xl">
        <DashboardSectionHeader
          title="Recibo de Venda"
          :description="`Documento emitido em modo RECIBO para a venda ${venda.numero}.`"
          class="print:hidden"
        >
          <div class="flex flex-wrap items-center gap-2 lg:ms-auto">
            <UButton
              label="Voltar"
              icon="i-lucide-arrow-left"
              color="neutral"
              variant="outline"
              :to="`/unidade/${unidadeId}/pdv`"
            />
            <UButton
              label="Imprimir / PDF"
              icon="i-lucide-printer"
              @click="imprimirRecibo"
            />
          </div>
        </DashboardSectionHeader>

        <!-- Documento A4 / PrintPreview modo RECIBO -->
        <UPageCard variant="subtle" class="mb-4 sm:mb-6 print:border-0 print:shadow-none">
          <div class="space-y-6 p-2 sm:p-4">
            <!-- Cabeçalho do Documento -->
            <div class="flex flex-wrap items-start justify-between gap-4 border-b border-default pb-4">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wider text-muted">
                  Oficina Core · Unidade #{{ venda.unidadeId }}
                </p>
                <h2 class="text-xl font-bold text-highlighted mt-1">
                  RECIBO · {{ venda.numero }}
                </h2>
                <p class="text-sm text-muted mt-0.5">
                  Data: {{ formatarData(venda.dataCriacao) }}
                </p>
              </div>

              <UBadge color="success" variant="subtle">
                RECIBO
              </UBadge>
            </div>

            <!-- Dados do Cliente e Pagamento -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <DashboardDataField
                label="Cliente"
                :value="venda.clienteNome || 'Avulso'"
              />
              <DashboardDataField
                label="Forma de pagamento"
                :value="labelFormaPagamento(venda.formaPagamento)"
              />
              <DashboardDataField
                label="Destino financeiro"
                :value="destinoPagamento"
              />
              <DashboardDataField
                label="Data da venda"
                :value="formatarData(venda.dataCriacao)"
              />
            </div>

            <!-- Tabela de Itens -->
            <div class="space-y-2">
              <p class="text-xs font-semibold uppercase tracking-wider text-muted">
                Itens
              </p>

              <div class="overflow-x-auto rounded-lg border border-default">
                <table class="w-full text-left text-sm">
                  <thead class="bg-elevated/50 text-xs uppercase text-muted border-b border-default">
                    <tr>
                      <th class="px-3 py-2.5 font-medium">
                        #
                      </th>
                      <th class="px-3 py-2.5 font-medium">
                        Descrição
                      </th>
                      <th class="px-3 py-2.5 font-medium">
                        Tipo
                      </th>
                      <th class="px-3 py-2.5 font-medium text-right">
                        Qtd
                      </th>
                      <th class="px-3 py-2.5 font-medium text-right">
                        Unit.
                      </th>
                      <th class="px-3 py-2.5 font-medium text-right">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-default">
                    <tr
                      v-for="(item, index) in venda.itens"
                      :key="item.id || index"
                    >
                      <td class="px-3 py-2.5 text-muted tabular-nums">
                        {{ index + 1 }}
                      </td>
                      <td class="px-3 py-2.5 font-medium text-highlighted">
                        {{ item.nome }}
                      </td>
                      <td class="px-3 py-2.5 text-muted">
                        Produto
                      </td>
                      <td class="px-3 py-2.5 text-right tabular-nums">
                        {{ item.quantidade }}{{ item.unidade ? ` ${item.unidade}` : '' }}
                      </td>
                      <td class="px-3 py-2.5 text-right tabular-nums">
                        {{ formatarPreco(item.precoUnitario) }}
                      </td>
                      <td class="px-3 py-2.5 text-right font-semibold tabular-nums text-highlighted">
                        {{ formatarPreco(totalItem(item)) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Total e Resumo do Recibo -->
            <div class="flex flex-col items-end gap-1 border-t border-default pt-4">
              <div class="flex items-center justify-between w-full sm:w-64 text-base font-bold text-highlighted">
                <span>TOTAL:</span>
                <span class="tabular-nums">{{ formatarPreco(totalCalculado) }}</span>
              </div>
              <p class="text-xs text-muted">
                Forma de pagamento: {{ labelFormaPagamento(venda.formaPagamento) }} · Data: {{ formatarData(venda.dataCriacao) }}
              </p>
            </div>

            <!-- Assinatura -->
            <div class="pt-8 text-center sm:text-left">
              <div class="inline-block border-t border-default pt-2 min-w-56 text-xs text-muted">
                Assinatura
              </div>
            </div>
          </div>
        </UPageCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
