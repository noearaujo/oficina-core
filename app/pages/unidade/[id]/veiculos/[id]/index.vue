<script setup lang="ts">

const route = useRoute()
const router = useRouter()
const toast = useToast()
const unidadeId = computed(() => route.path.match(/\/unidade\/([^/]+)/)?.[1] ?? String(route.params.id))
const id = computed(() => String(route.params.id))

const { data: veiculo, status, error, refresh } = await useFetch<Veiculo>(
  () => `/api/unidade/${unidadeId.value}/veiculos/${id.value}`,
  { watch: [unidadeId, id] }
)

const cliente = ref<Cliente | null>(null)
const statusCliente = ref<'idle' | 'pending' | 'success' | 'error'>('idle')

watch(() => veiculo.value?.clienteId, async (clienteId) => {
  if (!clienteId) {
    cliente.value = null
    statusCliente.value = 'idle'
    return
  }
  statusCliente.value = 'pending'
  try {
    cliente.value = await $fetch<Cliente>(`/api/unidade/${unidadeId.value}/clientes/${clienteId}`)
    statusCliente.value = 'success'
  } catch {
    cliente.value = null
    statusCliente.value = 'error'
  }
}, { immediate: true })

const quilometragemFormatada = computed(() => {
  const valor = veiculo.value?.quilometragem
  if (valor === undefined || valor === null || valor === '') return ''
  const numero = Number(valor)
  return Number.isFinite(numero) ? `${new Intl.NumberFormat('pt-BR').format(numero)} km` : `${valor} km`
})

const nomeExibicao = computed(() => {
  if (!veiculo.value) return ''
  return [veiculo.value.marca, veiculo.value.modelo, veiculo.value.versao].filter(Boolean).join(' ')
})

watch(id, refresh)
</script>

<template>
  <UDashboardPanel id="veiculo-detalhe">
    <template #header>
      <UDashboardNavbar title="Perfil do Veículo">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>

      <!-- Loading -->
      <div v-if="status === 'pending'" class="mx-auto w-full max-w-3xl space-y-4">
        <USkeleton class="h-64 w-full rounded-xl" />
        <USkeleton class="h-32 w-full rounded-xl" />
      </div>

      <!-- Erro -->
      <UEmpty
        v-else-if="error || !veiculo"
        icon="i-lucide-car-front"
        title="Veículo não encontrado"
        description="Não foi possível carregar os dados deste veículo."
        :actions="[
          { label: 'Voltar para veículos', icon: 'i-lucide-arrow-left', color: 'neutral', variant: 'outline', onClick: () => router.push(`/unidade/${unidadeId}/veiculos`) },
          { label: 'Tentar novamente', icon: 'i-lucide-refresh-cw', onClick: refresh }
        ]"
      />

      <!-- Conteúdo -->
      <div v-else class="mx-auto w-full max-w-3xl">

        <!-- ═══ Seção: Dados do veículo ═══ -->
        <DashboardSectionHeader title="Dados do veículo" description="Informações de identificação e características.">
          <UButton
            label="Editar"
            icon="i-lucide-pencil"
            color="neutral"
            variant="outline"
            class="w-fit lg:ms-auto"
            :to="`/unidade/${unidadeId}/veiculos/${veiculo.id}/editar`"
          />
        </DashboardSectionHeader>

        <UPageCard variant="subtle" class="mb-4 sm:mb-6 lg:mb-12">
          <template #header>
            <div class="flex items-center gap-3">
              <UAvatar :alt="veiculo.placa" icon="i-lucide-car" size="lg" />
              <div>
                <h2 class="text-sm font-semibold text-highlighted">{{ nomeExibicao }}</h2>
              </div>
            </div>
          </template>

          <template #body>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              <DashboardDataField label="Placa" :value="veiculo.placa" />
              <DashboardDataField label="Tipo" :value="veiculo.tipo" />
              <DashboardDataField label="Ano de fabricação" :value="String(veiculo.anoFabricacao)" />
              <DashboardDataField label="Ano do modelo" :value="String(veiculo.anoModelo)" />
              <DashboardDataField label="Cor" :value="veiculo.cor" />
              <DashboardDataField label="Combustível" :value="veiculo.combustivel" />
              <DashboardDataField label="Quilometragem" :value="quilometragemFormatada" />
              <DashboardDataField label="Chassi" :value="veiculo.chassi" />
            </div>
          </template>
        </UPageCard>

        <!-- ═══ Seção: Proprietário ═══ -->
        <DashboardSectionHeader title="Proprietário" description="Cliente vinculado a este veículo." />

        <UPageCard
          variant="subtle"
          :ui="{ container: 'p-0 sm:p-0 gap-y-0', wrapper: 'items-stretch' }"
        >
          <!-- Loading -->
          <div v-if="statusCliente === 'pending'" class="p-4">
            <div class="flex items-center gap-3">
              <USkeleton class="size-10 rounded-full" />
              <div class="flex-1 space-y-2">
                <USkeleton class="h-4 w-40" />
                <USkeleton class="h-3 w-32" />
              </div>
            </div>
          </div>

          <!-- Conteúdo -->
          <DashboardListItem
            v-else-if="cliente"
            :to="`/unidade/${unidadeId}/clientes/${cliente.id}`"
            :avatar="cliente.nome"
            :title="cliente.nome"
            :subtitle="`${cliente.tipoPessoa === 'fisica' ? 'Pessoa Física' : 'Pessoa Jurídica'}${cliente.telefone ? ' · ' + cliente.telefone : ''}`"
          />

          <!-- Erro -->
          <p v-else class="p-4 text-sm text-muted">Não foi possível localizar o proprietário vinculado.</p>
        </UPageCard>

        <!--
          ═══ Seção: Ordens de Serviço (FUTURA) ═══

          Segue o MESMO padrão das seções acima:

          1. UPageCard variant="naked" orientation="horizontal" class="mb-4 sm:mb-6"
             - title="Ordens de serviço"
             - description="X ordem(ns) de serviço para este veículo."
             - Slot: UButton "Nova OS" (color="neutral", :to="/os/novo?veiculoId=X", class="w-fit lg:ms-auto")

          2. UPageCard variant="subtle" :ui="{ container: 'p-0 sm:p-0 gap-y-0', wrapper: 'items-stretch' }"
             - Lista com divide-y divide-default
             - Cada item: NuxtLink para /os/[id]
               - UAvatar icon="i-lucide-clipboard-list" class="size-10"
               - flex-1 min-w-0:
                 - p: identificador da OS (text-sm font-medium text-highlighted)
                 - p: status + data (text-sm text-muted)
               - UIcon chevron-right (group-hover:translate-x-0.5)
             - UEmpty se não houver OS
        -->

      </div>
    </template>
  </UDashboardPanel>
</template>
