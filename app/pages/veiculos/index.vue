<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/table-core'
import { getPaginationRowModel } from '@tanstack/table-core'

interface VeiculoTabela extends Veiculo {
  clienteNome: string
}

const toast = useToast()

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
} = await useFetch<Veiculo[]>('/api/veiculos', {
  default: () => []
})

const { data: clientes } = await useFetch<Cliente[]>('/api/clientes', {
  default: () => []
})

const veiculosTabela = computed<VeiculoTabela[]>(() => {
  return veiculos.value.map((veiculo) => ({
    ...veiculo,
    clienteNome: clientes.value.find(
      cliente => cliente.id === veiculo.clienteId
    )?.nome ?? 'Cliente não encontrado'
  }))
})

const veiculosFiltrados = computed(() => {
  const termo = busca.value.trim().toLocaleLowerCase('pt-BR')

  return veiculosTabela.value.filter((veiculo) => {
    return (
      !termo ||
      veiculo.placa.toLocaleLowerCase('pt-BR').includes(termo) ||
      veiculo.marca.toLocaleLowerCase('pt-BR').includes(termo) ||
      veiculo.modelo.toLocaleLowerCase('pt-BR').includes(termo) ||
      veiculo.clienteNome.toLocaleLowerCase('pt-BR').includes(termo) ||
      String(veiculo.id).includes(termo)
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
    await $fetch(`/api/veiculos/${veiculo.id}`, {
      method: 'DELETE'
    })

    await refresh()

    toast.add({
      title: 'Veículo excluído',
      description: `${veiculo.placa} foi excluído com sucesso.`,
      color: 'success'
    })
  } catch {
    toast.add({
      title: 'Erro ao excluir',
      description: 'Não foi possível excluir o veículo.',
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
        navigateTo(`/veiculos/${veiculo.id}`)
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
    id: 'actions',
    cell: ({ row }) =>
      h('div', { class: 'text-right' },
        h(UDropdownMenu, {
          content: { align: 'end' },
          items: getRowItems(row)
        }, () =>
          h(UButton, {
            icon: 'i-lucide-ellipsis-vertical',
            color: 'neutral',
            variant: 'ghost',
            class: 'ml-auto'
          })
        )
      )
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
            to="/veiculos/novo"
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
          placeholder="Buscar por placa, veículo ou proprietário..."
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
            @click="refresh"
          />
        </template>
      </UAlert>

      <!-- Tabela -->
      <UTable
        v-model:pagination="pagination"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel(), pageSize: 10 }"
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