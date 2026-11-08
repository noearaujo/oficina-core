<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const unidadeId = computed(() => route.path.match(/\/unidade\/([^/]+)/)?.[1] ?? String(route.params.id))
const id = computed(() => String(route.params.id))

const { data: cliente, status, error, refresh } = await useFetch<Cliente>(
  () => `/api/unidade/${unidadeId.value}/clientes/${id.value}`,
  { watch: [unidadeId, id] }
)

const { data: veiculos, status: statusVeiculos, refresh: refreshVeiculos } = await useFetch<Veiculo[]>(
  () => `/api/unidade/${unidadeId.value}/veiculos`,
  { default: () => [], watch: [unidadeId] }
)

const veiculosDoCliente = computed(() =>
  (veiculos.value ?? []).filter(v => v.clienteId === cliente.value?.id)
)

const endereco = computed<Endereco>(() => cliente.value?.endereco ?? {})
const enderecoCompleto = computed(() => {
  const e = endereco.value
  return [
    [e.logradouro, e.numero].filter(Boolean).join(', '),
    [e.complemento, e.bairro].filter(Boolean).join(' · '),
    [e.cidade, e.estado].filter(Boolean).join(' / '),
    e.cep ? `CEP ${e.cep}` : ''
  ].filter(Boolean)
})

const possuiEndereco = computed(() => enderecoCompleto.value.length > 0)

const nomeExibicao = computed(() => {
  if (!cliente.value) return ''
  if (cliente.value.tipoPessoa === 'fisica') return cliente.value.nome
  return cliente.value.nomeFantasia || cliente.value.razaoSocial || ''
})

function formatarAno(veiculo: Veiculo) {
  return [veiculo.anoFabricacao, veiculo.anoModelo].filter(Boolean).join('/')
}

watch(id, async () => {
  await Promise.all([refresh(), refreshVeiculos()])
})
</script>

<template>
  <UDashboardPanel id="cliente-detalhe">
    <template #header>
      <UDashboardNavbar title="Perfil do Cliente">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Loading -->
      <div v-if="status === 'pending'" class="mx-auto w-full max-w-3xl space-y-4">
        <USkeleton class="h-64 w-full rounded-xl" />
        <USkeleton class="h-40 w-full rounded-xl" />
      </div>

      <!-- Erro -->
      <UEmpty
        v-else-if="error || !cliente"
        icon="i-lucide-user-round-x"
        title="Cliente não encontrado"
        description="Não foi possível carregar os dados deste cliente."
        :actions="[
          { label: 'Voltar para clientes', icon: 'i-lucide-arrow-left', color: 'neutral', variant: 'outline', onClick: () => router.push(`/unidade/${unidadeId}/clientes`) },
          { label: 'Tentar novamente', icon: 'i-lucide-refresh-cw', onClick: () => refresh() }
        ]"
      />

      <!-- Conteúdo -->
      <div v-else class="mx-auto w-full max-w-3xl">
        <!-- ═══ Seção: Dados cadastrais ═══ -->
        <DashboardSectionHeader title="Dados cadastrais" description="Informações pessoais e de contato.">
          <UButton
            label="Editar"
            icon="i-lucide-pencil"
            color="neutral"
            variant="outline"
            class="w-fit lg:ms-auto"
            :to="`/unidade/${unidadeId}/clientes/${cliente.id}/editar`"
          />
        </DashboardSectionHeader>

        <UPageCard variant="subtle" class="mb-4 sm:mb-6 lg:mb-12">
          <template #header>
            <div class="flex items-center gap-3">
              <UAvatar :alt="nomeExibicao" size="lg" />
              <div>
                <h2 class="text-sm font-semibold text-highlighted">
                  {{ nomeExibicao }}
                </h2>
                <UBadge
                  :color="cliente.tipoPessoa === 'fisica' ? 'info' : 'success'"
                  variant="subtle"
                  size="sm"
                >
                  {{ cliente.tipoPessoa === 'fisica' ? 'Pessoa Física' : 'Pessoa Jurídica' }}
                </UBadge>
              </div>
            </div>
          </template>

          <template #body>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              <!-- PF -->
              <DashboardDataField v-if="cliente.tipoPessoa === 'fisica'" label="CPF" :value="cliente.cpf" />

              <!-- PJ -->
              <template v-else>
                <DashboardDataField label="Razão social" :value="cliente.razaoSocial" />
                <DashboardDataField label="Nome fantasia" :value="cliente.nomeFantasia" />
                <DashboardDataField label="CNPJ" :value="cliente.cnpj" />
              </template>

              <!-- Contato -->
              <DashboardDataField label="Telefone" :value="cliente.telefone" />
              <DashboardDataField label="E-mail" :value="cliente.email" />

              <!-- Endereço -->
              <div class="sm:col-span-2">
                <DashboardDataField label="Endereço" :value="possuiEndereco ? enderecoCompleto.join(' · ') : ''" />
              </div>
            </div>
          </template>
        </UPageCard>

        <!-- ═══ Seção: Veículos vinculados ═══ -->
        <DashboardSectionHeader
          title="Veículos vinculados"
          :description="`${veiculosDoCliente.length} ${veiculosDoCliente.length === 1 ? 'veículo vinculado' : 'veículos vinculados'} a este cliente.`"
        >
          <UButton
            label="Cadastrar veículo"
            icon="i-lucide-plus"
            color="neutral"
            :to="cliente ? `/unidade/${unidadeId}/veiculos/novo?clienteId=${cliente.id}` : undefined"
            :disabled="!cliente"
            class="w-fit lg:ms-auto"
          />
        </DashboardSectionHeader>

        <UPageCard
          variant="subtle"
          :ui="{ container: 'p-0 sm:p-0 gap-y-0', wrapper: 'items-stretch' }"
        >
          <!-- Loading -->
          <div v-if="statusVeiculos === 'pending'" class="divide-y divide-default">
            <div class="flex items-center gap-3 p-4">
              <USkeleton class="size-10 rounded-full" />
              <div class="flex-1 space-y-2">
                <USkeleton class="h-4 w-32" />
                <USkeleton class="h-3 w-24" />
              </div>
            </div>
            <div class="flex items-center gap-3 p-4">
              <USkeleton class="size-10 rounded-full" />
              <div class="flex-1 space-y-2">
                <USkeleton class="h-4 w-40" />
                <USkeleton class="h-3 w-28" />
              </div>
            </div>
          </div>

          <!-- Lista -->
          <div v-else-if="veiculosDoCliente.length" class="divide-y divide-default">
            <DashboardListItem
              v-for="veiculo in veiculosDoCliente"
              :key="veiculo.id"
              :to="`/unidade/${unidadeId}/veiculos/${veiculo.id}`"
              icon="i-lucide-car"
              :title="`${veiculo.marca} ${veiculo.modelo}${veiculo.versao ? ' ' + veiculo.versao : ''}`"
              :subtitle="`${veiculo.placa} · ${formatarAno(veiculo)}`"
            />
          </div>

          <!-- Vazio -->
          <UEmpty
            v-else
            icon="i-lucide-car"
            title="Nenhum veículo"
            description="Este cliente ainda não possui veículos cadastrados."
            class="py-8"
          />
        </UPageCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
