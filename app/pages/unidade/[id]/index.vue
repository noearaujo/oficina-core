<script setup lang="ts">
const route = useRoute()
const unidadeId = computed(() => route.path.match(/\/unidade\/([^/]+)/)?.[1] ?? String(route.params.id))

const { data: clientes, status: statusClientes } = await useFetch<Cliente[]>(
  () => `/api/unidade/${unidadeId.value}/clientes`,
  {
    default: () => [],
    watch: [unidadeId]
  }
)

const { data: veiculos, status: statusVeiculos } = await useFetch<Veiculo[]>(
  () => `/api/unidade/${unidadeId.value}/veiculos`,
  {
    default: () => [],
    watch: [unidadeId]
  }
)

const { data: catalogo, status: statusCatalogo } = await useFetch<ItemCatalogo[]>(
  () => `/api/unidade/${unidadeId.value}/catalogo`,
  {
    default: () => [],
    watch: [unidadeId]
  }
)

const carregando = computed(() =>
  statusClientes.value === 'pending' ||
  statusVeiculos.value === 'pending' ||
  statusCatalogo.value === 'pending'
)

const cards = computed(() => [
  {
    label: 'Clientes',
    valor: clientes.value.length,
    icon: 'i-lucide-users',
    to: `/unidade/${unidadeId.value}/clientes`
  },
  {
    label: 'Veículos',
    valor: veiculos.value.length,
    icon: 'i-lucide-car',
    to: `/unidade/${unidadeId.value}/veiculos`
  },
  {
    label: 'Itens no catálogo',
    valor: catalogo.value.length,
    icon: 'i-lucide-book-open',
    to: `/unidade/${unidadeId.value}/catalogo`
  }
])
</script>

<template>
  <UDashboardPanel id="dashboard">
    <template #header>
      <UDashboardNavbar title="Dashboard">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-3xl space-y-6">
        <div v-if="carregando" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <USkeleton class="h-28 w-full rounded-xl" />
          <USkeleton class="h-28 w-full rounded-xl" />
          <USkeleton class="h-28 w-full rounded-xl" />
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UPageCard
            v-for="card in cards"
            :key="card.label"
            :to="card.to"
            variant="subtle"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-medium text-muted uppercase tracking-wide">
                  {{ card.label }}
                </p>
                <p class="mt-2 text-2xl font-semibold text-highlighted tabular-nums">
                  {{ card.valor }}
                </p>
              </div>
              <UAvatar :icon="card.icon" size="lg" />
            </div>
          </UPageCard>
        </div>

        <div>
          <DashboardSectionHeader
            title="Acesso rápido"
            description="Navegue pelos módulos da unidade."
          />

          <UPageCard
            variant="subtle"
            :ui="{ container: 'p-0 sm:p-0 gap-y-0', wrapper: 'items-stretch' }"
          >
            <div class="divide-y divide-default">
              <DashboardListItem
                :to="`/unidade/${unidadeId}/clientes`"
                icon="i-lucide-users"
                title="Clientes"
                subtitle="Gerenciar cadastro de clientes"
              />
              <DashboardListItem
                :to="`/unidade/${unidadeId}/veiculos`"
                icon="i-lucide-car"
                title="Veículos"
                subtitle="Gerenciar frota e veículos vinculados"
              />
              <DashboardListItem
                :to="`/unidade/${unidadeId}/catalogo`"
                icon="i-lucide-book-open"
                title="Catálogo"
                subtitle="Gerenciar serviços e produtos"
              />
            </div>
          </UPageCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
