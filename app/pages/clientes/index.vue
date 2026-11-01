<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/table-core'
import { getPaginationRowModel } from '@tanstack/table-core'

const toast = useToast()

const busca = ref('')
const tipoFiltro = ref('todos')

const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})

const { data, status, refresh } = await useFetch<Cliente[]>('/api/clientes', {
  default: () => []
})

const clientesFiltrados = computed(() => {
  const termo = busca.value.trim().toLocaleLowerCase('pt-BR')

  return data.value.filter((cliente) => {
    const correspondeBusca =
      !termo ||
      cliente.nome.toLocaleLowerCase('pt-BR').includes(termo) ||
      String(cliente.id).includes(termo) ||
      cliente.telefone?.includes(termo) ||
      cliente.email?.toLocaleLowerCase('pt-BR').includes(termo)

    const correspondeTipo =
      tipoFiltro.value === 'todos' ||
      cliente.tipoPessoa === tipoFiltro.value

    return correspondeBusca && correspondeTipo
  })
})

watch([busca, tipoFiltro], () => {
  pagination.value.pageIndex = 0
})

async function deletarCliente(cliente: Cliente) {
  const confirmado = window.confirm(
    `Deseja realmente excluir o cliente ${cliente.nome}?`
  )

  if (!confirmado) return

  try {
    await $fetch(`/api/clientes/${cliente.id}`, {
      method: 'DELETE'
    })

    await refresh()

    toast.add({
      title: 'Cliente excluído',
      description: `${cliente.nome} foi excluído com sucesso.`,
      color: 'success'
    })
  } catch (error: any) {
    toast.add({
      title: 'Erro ao excluir',
      description: error?.data?.statusMessage || 'Não foi possível excluir o cliente.',
      color: 'error'
    })
  }
}

function getRowItems(row: Row<Cliente>) {
  const cliente = row.original

  return [
    {
      label: 'Ações',
      type: 'label' as const
    },
    {
      label: 'Visualizar',
      icon: 'i-lucide-eye',
      onSelect() {
        navigateTo(`/clientes/${cliente.id}`)
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
        deletarCliente(cliente)
      }
    }
  ]
}

const columns: TableColumn<Cliente>[] = [
  {
    accessorKey: 'nome',
    header: 'Cliente',
    cell: ({ row }) =>
      h('div', { class: 'flex flex-col' }, [
        h('span', { class: 'font-medium text-highlighted' }, row.original.nome),
        h('span', { class: 'text-xs text-muted' }, `ID: ${row.original.id}`)
      ])
  },
  {
    accessorKey: 'tipoPessoa',
    header: 'Tipo',
    cell: ({ row }) => {
      const pessoaFisica = row.original.tipoPessoa === 'fisica'
      return h(UBadge, {
        label: pessoaFisica ? 'Pessoa Física' : 'Pessoa Jurídica',
        color: pessoaFisica ? 'info' : 'success',
        variant: 'subtle'
      })
    }
  },
  {
    id: 'contato',
    header: 'Contato',
    cell: ({ row }) =>
      h('div', { class: 'flex flex-col' }, [
        h('span', {}, row.original.telefone || '—'),
        h('span', { class: 'text-xs text-muted' }, row.original.email || '—')
      ])
  },
  {
    accessorKey: 'quantidadeVeiculos',
    header: 'Veículos'
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
  <UDashboardPanel id="clientes">
    <template #header>
      <UDashboardNavbar title="Clientes">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Novo cliente"
            icon="i-lucide-plus"
            to="/clientes/novo"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Busca + Filtro -->
      <div class="flex flex-wrap items-center justify-between gap-1.5">
        <UInput
          v-model="busca"
          icon="i-lucide-search"
          placeholder="Buscar clientes..."
          class="w-full sm:max-w-sm"
        />
        <USelect
          v-model="tipoFiltro"
          :items="[
            { label: 'Todos', value: 'todos' },
            { label: 'Pessoa Física', value: 'fisica' },
            { label: 'Pessoa Jurídica', value: 'juridica' }
          ]"
          class="w-full sm:w-48"
        />
      </div>

      <!-- Tabela -->
      <UTable
        v-model:pagination="pagination"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel(), pageSize: 10 }"
        :data="clientesFiltrados"
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
            icon="i-lucide-users"
            :title="busca || tipoFiltro !== 'todos' ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'"
            :description="busca || tipoFiltro !== 'todos' ? 'Tente ajustar a busca ou os filtros.' : 'Cadastre seu primeiro cliente para começar.'"
          />
        </template>
      </UTable>
    </template>
  </UDashboardPanel>
</template>   