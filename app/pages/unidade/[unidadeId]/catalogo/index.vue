<script setup lang="ts">
const route = useRoute()
const unidadeId = computed(() => String(route.params.unidadeId ?? ''))

const busca = ref('')
const tipoFiltro = ref('todos')

const { data, status, error, refresh } = await useFetch<ItemCatalogo[]>(
  () => `/api/unidade/${unidadeId.value}/catalogo`,
  {
    default: () => [],
    watch: [unidadeId]
  }
)

function stripAccents(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

const itensFiltrados = computed(() => {
  const termo = stripAccents(busca.value.trim()).toLowerCase()

  return data.value.filter((item) => {
    const nomeNormalizado = item.nomeBusca || stripAccents(item.nome).toLowerCase()
    const skuNormalizado = (item.sku || '').toLowerCase()
    const descricaoNormalizada = stripAccents(item.descricao || '').toLowerCase()

    const correspondeBusca
      = !termo
        || nomeNormalizado.includes(termo)
        || skuNormalizado.includes(termo)
        || descricaoNormalizada.includes(termo)

    const correspondeTipo
      = tipoFiltro.value === 'todos'
        || item.tipo === tipoFiltro.value

    return correspondeBusca && correspondeTipo
  })
})

// Modal
const modalOpen = ref(false)
const itemEditando = ref<ItemCatalogo | null>(null)

function abrirNovo() {
  itemEditando.value = null
  modalOpen.value = true
}

function abrirEdicao(item: ItemCatalogo) {
  itemEditando.value = item
  modalOpen.value = true
}

function formatarPreco(centavos: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100)
}
</script>

<template>
  <UDashboardPanel id="catalogo">
    <template #header>
      <UDashboardNavbar title="Catálogo">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton label="Novo item" icon="i-lucide-plus" @click="abrirNovo" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-3xl space-y-4 sm:space-y-6">
        <!-- Busca + Filtro -->
        <div class="flex flex-wrap items-center justify-between gap-1.5">
          <UInput
            v-model="busca"
            icon="i-lucide-search"
            placeholder="Buscar por nome ou SKU..."
            class="w-full sm:max-w-sm"
          />
          <USelect
            v-model="tipoFiltro"
            :items="[
              { label: 'Todos', value: 'todos' },
              { label: 'Serviços', value: 'servico' },
              { label: 'Produtos', value: 'produto' }
            ]"
            class="w-full sm:w-48"
          />
        </div>

        <!-- Erro -->
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          title="Erro ao carregar catálogo"
          description="Não foi possível buscar os itens."
        >
          <template #actions>
            <UButton
              label="Tentar novamente"
              color="error"
              variant="soft"
              @click="() => refresh()"
            />
          </template>
        </UAlert>

        <!-- Lista -->
        <div v-if="status === 'pending'" class="space-y-3">
          <USkeleton class="h-14 w-full rounded-lg" />
          <USkeleton class="h-14 w-full rounded-lg" />
          <USkeleton class="h-14 w-full rounded-lg" />
        </div>

        <UPageCard
          v-else
          variant="subtle"
          :ui="{ container: 'p-0 sm:p-0 gap-y-0', wrapper: 'items-stretch' }"
        >
          <div v-if="itensFiltrados.length" class="divide-y divide-default">
            <div
              v-for="item in itensFiltrados"
              :key="item.id"
              class="group flex items-center gap-3 p-4 hover:bg-elevated/50 transition-colors cursor-pointer"
              @click="abrirEdicao(item)"
            >
              <!-- Ícone -->
              <UAvata
                :alt="item.nome"
                :icon="item.tipo === 'servico' ? 'i-lucide-wrench' : 'i-lucide-package'"
                class="size-10"
              />

              <!-- Texto -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-highlighted truncate">
                  {{ item.nome }}
                </p>
                <p class="text-sm text-muted truncate">
                  {{ item.tipo === 'servico' ? 'Serviço' : 'Produto' }} · {{ item.unidade }}<template v-if="item.sku">
                    · SKU: {{ item.sku }}
                  </template><template v-if="item.custo !== undefined">
                    · Custo: {{ formatarPreco(item.custo) }}
                  </template>
                </p>
              </div>

              <!-- Preço -->
              <span class="text-sm font-medium tabular-nums shrink-0">
                {{ formatarPreco(item.preco) }}
              </span>

              <!-- Chevron -->
              <UIcon
                name="i-lucide-chevron-right"
                class="size-4 text-muted shrink-0 group-hover:translate-x-0.5 transition-transform"
              />
            </div>
          </div>

          <!-- Empty -->
          <UEmpty
            v-else
            icon="i-lucide-package"
            :title="busca || tipoFiltro !== 'todos' ? 'Nenhum item encontrado' : 'Nenhum item cadastrado'"
            :description="busca || tipoFiltro !== 'todos' ? 'Tente ajustar a busca ou os filtros.' : 'Adicione itens ao catálogo para agilizar seus orçamentos.'"
            class="py-8"
          />
        </UPageCard>

        <!-- Modal -->
        <CatalogoItemModal
          v-model:open="modalOpen"
          :item="itemEditando"
          @saved="() => refresh()"
          @deleted="() => refresh()"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
