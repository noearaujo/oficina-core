<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/table-core'
import { getPaginationRowModel } from '@tanstack/table-core'

interface ClienteTabela extends Cliente {
  quantidadeVeiculos?: number
}

const route = useRoute()
const toast = useToast()
const unidadeId = computed(() => String(route.params.unidadeId ?? ''))

const busca = ref('')
const tipoFiltro = ref('todos')

const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})

const { data, status, error, refresh } = await useFetch<ClienteTabela[]>(
  () => `/api/unidade/${unidadeId.value}/clientes`,
  {
    default: () => [],
    watch: [unidadeId]
  }
)

function stripAccents(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

const clientesFiltrados = computed(() => {
  const termo = stripAccents(busca.value.trim()).toLowerCase()
  const termoDigitos = termo.replace(/\D/g, '')

  return data.value.filter((cliente) => {
    const nomeNormalizado = cliente.nomeBusca || stripAccents(cliente.nome).toLowerCase()
    const razaoNormalizada = stripAccents(cliente.razaoSocial || '').toLowerCase()
    const fantasiaNormalizada = stripAccents(cliente.nomeFantasia || '').toLowerCase()
    const emailNormalizado = (cliente.email || '').toLowerCase()
    const cpfDigitos = (cliente.cpf || '').replace(/\D/g, '')
    const cnpjDigitos = (cliente.cnpj || '').replace(/\D/g, '')
    const telefoneDigitos = (cliente.telefone || '').replace(/\D/g, '')

    const correspondeDigitos = Boolean(
      termoDigitos
      && (cpfDigitos.includes(termoDigitos)
        || cnpjDigitos.includes(termoDigitos)
        || telefoneDigitos.includes(termoDigitos))
    )

    const correspondeBusca
      = !termo
        || nomeNormalizado.includes(termo)
        || razaoNormalizada.includes(termo)
        || fantasiaNormalizada.includes(termo)
        || emailNormalizado.includes(termo)
        || (cliente.cpf || '').toLowerCase().includes(termo)
        || (cliente.cnpj || '').toLowerCase().includes(termo)
        || (cliente.telefone || '').toLowerCase().includes(termo)
        || String(cliente.id).includes(termo)
        || correspondeDigitos

    const correspondeTipo
      = tipoFiltro.value === 'todos'
        || cliente.tipoPessoa === tipoFiltro.value

    return correspondeBusca && correspondeTipo
  })
})

watch([busca, tipoFiltro], () => {
  pagination.value.pageIndex = 0
})

async function deletarCliente(cliente: ClienteTabela) {
  const confirmado = window.confirm(
    `Deseja realmente excluir o cliente ${cliente.nome}?`
  )

  if (!confirmado) return

  try {
    await $fetch(`/api/unidade/${unidadeId.value}/clientes/${cliente.id}`, {
      method: 'DELETE'
    })

    await refresh()

    toast.add({
      title: 'Cliente excluído',
      description: `${cliente.nome} foi excluído com sucesso.`,
      color: 'success'
    })
  } catch (err: unknown) {
    const statusMessage = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
    toast.add({
      title: 'Erro ao excluir',
      description: statusMessage || 'Não foi possível excluir o cliente.',
      color: 'error'
    })
  }
}

function getRowItems(row: Row<ClienteTabela>) {
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
        navigateTo(`/unidade/${unidadeId.value}/clientes/${cliente.id}`)
      }
    },
    {
      label: 'Editar',
      icon: 'i-lucide-pencil',
      onSelect() {
        navigateTo(`/unidade/${unidadeId.value}/clientes/${cliente.id}/editar`)
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

const columns: TableColumn<ClienteTabela>[] = [
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
    header: 'Tipo'
  },
  {
    id: 'documento',
    header: 'CPF / CNPJ',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'tabular-nums text-default' },
        (row.original.tipoPessoa === 'fisica' ? row.original.cpf : row.original.cnpj) || '—'
      )
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
    id: 'actions'
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
            :to="`/unidade/${unidadeId}/clientes/novo`"
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
          placeholder="Buscar por nome, CPF, CNPJ ou telefone..."
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

      <!-- Erro de fetch -->
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        title="Erro ao carregar clientes"
        description="Não foi possível buscar os clientes cadastrados."
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
        <template #tipoPessoa-cell="{ row }">
          <UBadge
            :label="row.original.tipoPessoa === 'fisica' ? 'Pessoa Física' : 'Pessoa Jurídica'"
            :color="row.original.tipoPessoa === 'fisica' ? 'info' : 'success'"
            variant="subtle"
          />
        </template>

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
            icon="i-lucide-users"
            :title="busca || tipoFiltro !== 'todos' ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'"
            :description="busca || tipoFiltro !== 'todos' ? 'Tente ajustar a busca ou os filtros.' : 'Cadastre seu primeiro cliente para começar.'"
          />
        </template>
      </UTable>
    </template>
  </UDashboardPanel>
</template>
