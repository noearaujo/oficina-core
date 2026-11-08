<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/table-core'
import { getPaginationRowModel } from '@tanstack/table-core'

interface VeiculoTabela extends Veiculo {
  clienteNome: string
  clienteNomeBusca: string
  clienteCpf: string
}

const route = useRoute()
const toast = useToast()
const unidadeId = computed(() => route.path.match(/\/unidade\/([^/]+)/)?.[1] ?? String(route.params.id))

const busca = ref('')

const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})

const {
  data: veiculos,
  status,
  error,
  refresh
} = await useFetch<Veiculo[]>(() => `/api/unidade/${unidadeId.value}/veiculos`, {
  default: () => [],
  watch: [unidadeId]
})

const { data: clientes } = await useFetch<Cliente[]>(() => `/api/unidade/${unidadeId.value}/clientes`, {
  default: () => [],
  watch: [unidadeId]
})

function stripAccents(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

const veiculosTabela = computed<VeiculoTabela[]>(() => {
  return veiculos.value.map((veiculo) => {
    const cliente = clientes.value.find(c => c.id === veiculo.clienteId)
    const clienteNome = cliente?.nome ?? 'Cliente não encontrado'

    return {
      ...veiculo,
      clienteNome,
      clienteNomeBusca: cliente?.nomeBusca || stripAccents(clienteNome).toLowerCase(),
      clienteCpf: cliente?.cpf ?? ''
    }
  })
})

const veiculosFiltrados = computed(() => {
  const termo = stripAccents(busca.value.trim()).toLowerCase()
  const termoDigitos = termo.replace(/\D/g, '')

  return veiculosTabela.value.filter((veiculo) => {
    if (!termo) return true

    const placaNormalizada = veiculo.placa.toLowerCase()
    const marcaNormalizada = stripAccents(veiculo.marca).toLowerCase()
    const modeloNormalizado = stripAccents(veiculo.modelo).toLowerCase()
    const versaoNormalizada = stripAccents(veiculo.versao || '').toLowerCase()
    const cpfDigitos = veiculo.clienteCpf.replace(/\D/g, '')

    const correspondeCpf = Boolean(
      (termoDigitos && cpfDigitos.includes(termoDigitos))
      || veiculo.clienteCpf.toLowerCase().includes(termo)
    )

    return (
      placaNormalizada.includes(termo)
      || marcaNormalizada.includes(termo)
      || modeloNormalizado.includes(termo)
      || versaoNormalizada.includes(termo)
      || veiculo.clienteNomeBusca.includes(termo)
      || correspondeCpf
      || String(veiculo.id).includes(termo)
    )
  })
})

watch(busca, () => {
  pagination.value.pageIndex = 0
})

async function deletarVeiculo(veiculo: VeiculoTabela) {
  const confirmado = window.confirm(
    `Deseja realmente excluir o veículo ${veiculo.placa}?`
  )

  if (!confirmado) return

  try {
    await $fetch(`/api/unidade/${unidadeId.value}/veiculos/${veiculo.id}`, {
      method: 'DELETE'
    })

    await refresh()

    toast.add({
      title: 'Veículo excluído',
      description: `${veiculo.placa} foi excluído com sucesso.`,
      color: 'success'
    })
  } catch (err: unknown) {
    const statusMessage = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
    toast.add({
      title: 'Erro ao excluir',
      description: statusMessage || 'Não foi possível excluir o veículo.',
      color: 'error'
    })
  }
}

function getRowItems(row: Row<VeiculoTabela>) {
  const veiculo = row.original

  return [
    {
      label: 'Ações',
      type: 'label' as const
    },
    {
      label: 'Visualizar',
      icon: 'i-lucide-eye',
      onSelect() {
        navigateTo(`/unidade/${unidadeId.value}/veiculos/${veiculo.id}`)
      }
    },
    {
      label: 'Editar',
      icon: 'i-lucide-pencil',
      onSelect() {
        navigateTo(`/unidade/${unidadeId.value}/veiculos/${veiculo.id}/editar`)
      }
    },
    {
      type: 'separator' as const
    },
    {
      label: 'Deletar',
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect() {
        deletarVeiculo(veiculo)
      }
    }
  ]
}

const columns: TableColumn<VeiculoTabela>[] = [
  {
    accessorKey: 'placa',
    header: 'Placa',
    cell: ({ row }) =>
      h('span', {
        class: 'font-semibold text-highlighted uppercase tabular-nums'
      }, row.original.placa)
  },
  {
    id: 'veiculo',
    header: 'Veículo',
    cell: ({ row }) =>
      h('div', { class: 'flex flex-col' }, [
        h(
          'span',
          { class: 'font-medium text-highlighted' },
          `${row.original.marca} ${row.original.modelo}`
        ),
        h(
          'span',
          { class: 'text-xs text-muted' },
          [
            row.original.versao,
            row.original.tipo,
            `ID: ${row.original.id}`
          ].filter(Boolean).join(' · ')
        )
      ])
  },
  {
    id: 'ano',
    header: 'Ano',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'text-muted tabular-nums' },
        `${row.original.anoFabricacao}/${row.original.anoModelo}`
      )
  },
  {
    accessorKey: 'clienteNome',
    header: 'Proprietário',
    cell: ({ row }) =>
      h('span', { class: 'text-default' }, row.original.clienteNome)
  },
  {
    id: 'actions'
  }
]
</script>

<template>
  <UDashboardPanel id="veiculos">
    <template #header>
      <UDashboardNavbar title="Veículos">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Novo veículo"
            icon="i-lucide-plus"
            :to="`/unidade/${unidadeId}/veiculos/novo`"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Busca -->
      <div class="flex flex-wrap items-center justify-between gap-1.5">
        <UInput
          v-model="busca"
          icon="i-lucide-search"
          placeholder="Buscar por placa, veículo, proprietário ou CPF..."
          class="w-full sm:max-w-sm"
        />
      </div>

      <!-- Erro de fetch -->
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        title="Erro ao carregar veículos"
        description="Não foi possível buscar os veículos cadastrados."
        class="mb-4"
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

      <!-- Tabela -->
      <UTable
        v-model:pagination="pagination"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        :data="veiculosFiltrados"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
          separator: 'h-0'
        }"
      >
        <template #actions-cell="{ row }">
          <div class="text-right">
            <UDropdownMenu
              :content="{ align: 'end' }"
              :items="getRowItems(row)"
            >
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                class="ml-auto"
              />
            </UDropdownMenu>
          </div>
        </template>

        <template #empty>
          <UEmpty
            icon="i-lucide-car"
            :title="busca ? 'Nenhum veículo encontrado' : 'Nenhum veículo cadastrado'"
            :description="busca ? 'Tente ajustar a busca.' : 'Cadastre seu primeiro veículo para começar.'"
          />
        </template>
      </UTable>
    </template>
  </UDashboardPanel>
</template>
