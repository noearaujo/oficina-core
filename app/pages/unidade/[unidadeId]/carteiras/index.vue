<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Carteira } from '~/types'

const route = useRoute()
const toast = useToast()
const unidadeId = computed(() => String(route.params.unidadeId ?? ''))

const busca = ref('')
const tipoFiltro = ref('todos')

const { data, status, error, refresh } = await useFetch<Carteira[]>(
  () => `/api/unidade/${unidadeId.value}/carteiras`,
  {
    default: () => [],
    watch: [unidadeId]
  }
)

function stripAccents(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

const carteirasFiltradas = computed(() => {
  const termo = stripAccents(busca.value.trim()).toLowerCase()

  return data.value.filter((carteira) => {
    const nomeNormalizado = carteira.nomeBusca || stripAccents(carteira.nome).toLowerCase()

    const correspondeBusca
      = !termo
        || nomeNormalizado.includes(termo)
        || carteira.tipo.toLowerCase().includes(termo)

    const correspondeTipo
      = tipoFiltro.value === 'todos'
        || carteira.tipo === tipoFiltro.value

    return correspondeBusca && correspondeTipo
  })
})

function formatarPreco(centavos: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100)
}

// Modal (Novo / Editar)
const modalOpen = ref(false)
const carteiraEditando = ref<Carteira | null>(null)
const enviando = ref(false)

const tiposCarteira = [
  { label: 'Banco', value: 'banco' },
  { label: 'Cofre', value: 'cofre' }
]

const schema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da carteira'),
  tipo: z.enum(['banco', 'cofre'], {
    message: 'Selecione o tipo da carteira'
  }),
  saldoInicial: z.coerce.number().min(0, 'Saldo inicial inválido'),
  ativa: z.boolean().default(true)
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  nome: '',
  tipo: 'banco',
  saldoInicial: 0,
  ativa: true
})

function abrirNova(tipoInicial: 'banco' | 'cofre' = 'banco') {
  carteiraEditando.value = null
  state.nome = ''
  state.tipo = tipoInicial
  state.saldoInicial = 0
  state.ativa = true
  modalOpen.value = true
}

function abrirEdicao(carteira: Carteira) {
  carteiraEditando.value = carteira
  state.nome = carteira.nome
  state.tipo = carteira.tipo
  state.saldoInicial = Number(((carteira.saldoInicial ?? 0) / 100).toFixed(2))
  state.ativa = carteira.ativa !== false
  modalOpen.value = true
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  const d = event.data
  enviando.value = true

  const payload = {
    nome: d.nome,
    tipo: d.tipo,
    saldoInicial: Math.round(Number(d.saldoInicial) * 100),
    ativa: d.ativa
  }

  try {
    if (carteiraEditando.value) {
      await $fetch(`/api/unidade/${unidadeId.value}/carteiras/${carteiraEditando.value.id}`, {
        method: 'PUT',
        body: payload
      })
      toast.add({
        title: 'Carteira atualizada',
        description: 'Os dados da carteira foram salvos com sucesso.',
        color: 'success'
      })
    } else {
      await $fetch(`/api/unidade/${unidadeId.value}/carteiras`, {
        method: 'POST',
        body: payload
      })
      toast.add({
        title: 'Carteira criada',
        description: 'A carteira foi cadastrada com sucesso.',
        color: 'success'
      })
    }

    await refresh()
    modalOpen.value = false
  } catch (err: unknown) {
    const statusMessage = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
    toast.add({
      title: 'Não foi possível salvar',
      description: statusMessage || 'Verifique os dados e tente novamente.',
      color: 'error'
    })
  } finally {
    enviando.value = false
  }
}

async function excluir() {
  if (!carteiraEditando.value) return
  const confirmado = window.confirm(`Deseja realmente excluir a carteira "${carteiraEditando.value.nome}"?`)
  if (!confirmado) return

  enviando.value = true
  try {
    await $fetch(`/api/unidade/${unidadeId.value}/carteiras/${carteiraEditando.value.id}`, {
      method: 'DELETE'
    })
    toast.add({
      title: 'Carteira excluída',
      description: `"${carteiraEditando.value.nome}" foi removida.`,
      color: 'success'
    })
    await refresh()
    modalOpen.value = false
  } catch (err: unknown) {
    const statusMessage = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
    toast.add({
      title: 'Erro ao excluir',
      description: statusMessage || 'Não foi possível excluir a carteira.',
      color: 'error'
    })
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="carteiras">
    <template #header>
      <UDashboardNavbar title="Carteiras">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Nova carteira"
            icon="i-lucide-plus"
            @click="abrirNova()"
          />
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
            placeholder="Buscar por nome..."
            class="w-full sm:max-w-sm"
          />
          <USelect
            v-model="tipoFiltro"
            :items="[
              { label: 'Todos os tipos', value: 'todos' },
              { label: 'Banco', value: 'banco' },
              { label: 'Cofre', value: 'cofre' }
            ]"
            class="w-full sm:w-48"
          />
        </div>

        <!-- Erro -->
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          title="Erro ao carregar carteiras"
          description="Não foi possível buscar as carteiras da unidade."
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

        <!-- Loading -->
        <div v-if="status === 'pending'" class="space-y-3">
          <USkeleton class="h-14 w-full rounded-xl" />
          <USkeleton class="h-14 w-full rounded-xl" />
          <USkeleton class="h-14 w-full rounded-xl" />
        </div>

        <!-- Lista members-style -->
        <UPageCard
          v-else
          variant="subtle"
          :ui="{ container: 'p-0 sm:p-0 gap-y-0', wrapper: 'items-stretch' }"
        >
          <div v-if="carteirasFiltradas.length" class="divide-y divide-default">
            <div
              v-for="carteira in carteirasFiltradas"
              :key="carteira.id"
              class="group flex items-center gap-3 p-4 hover:bg-elevated/50 transition-colors cursor-pointer"
              @click="abrirEdicao(carteira)"
            >
              <!-- Ícone -->
              <UAvatar
                :alt="carteira.nome"
                :icon="carteira.tipo === 'banco' ? 'i-lucide-landmark' : 'i-lucide-vault'"
                class="size-10"
              />

              <!-- Informações da carteira -->
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-sm font-medium text-highlighted truncate">
                    {{ carteira.nome }}
                  </p>
                  <UBadge
                    :color="carteira.tipo === 'banco' ? 'info' : 'warning'"
                    variant="subtle"
                    size="sm"
                  >
                    {{ carteira.tipo === 'banco' ? 'Banco' : 'Cofre' }}
                  </UBadge>
                  <UBadge
                    v-if="carteira.ativa === false"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                  >
                    Inativa
                  </UBadge>
                </div>

                <p class="text-sm text-muted truncate">
                  Saldo inicial: {{ formatarPreco(carteira.saldoInicial) }}
                </p>
              </div>

              <!-- Saldo calculado -->
              <div class="text-right shrink-0">
                <p class="text-sm font-semibold tabular-nums text-highlighted">
                  {{ formatarPreco(carteira.saldo ?? carteira.saldoInicial) }}
                </p>
                <p class="text-xs text-muted">
                  Saldo atual
                </p>
              </div>

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
            icon="i-lucide-wallet"
            :title="busca || tipoFiltro !== 'todos' ? 'Nenhuma carteira encontrada' : 'Nenhuma carteira cadastrada'"
            :description="busca || tipoFiltro !== 'todos' ? 'Tente ajustar a busca ou o filtro de tipo.' : 'Crie sua primeira carteira (Banco ou Cofre) para registrar movimentações financeiras.'"
            class="py-8"
          >
            <template v-if="!busca && tipoFiltro === 'todos'" #actions>
              <UButton
                label="Criar Banco"
                icon="i-lucide-landmark"
                color="neutral"
                variant="outline"
                @click="abrirNova('banco')"
              />
              <UButton
                label="Criar Cofre"
                icon="i-lucide-vault"
                color="neutral"
                variant="outline"
                @click="abrirNova('cofre')"
              />
            </template>
          </UEmpty>
        </UPageCard>

        <!-- Modal (Nova / Editar Carteira) -->
        <UModal
          v-model:open="modalOpen"
          :title="carteiraEditando ? 'Editar carteira' : 'Nova carteira'"
          :description="carteiraEditando ? 'Altere os dados da carteira e salve.' : 'Preencha os dados para cadastrar uma carteira.'"
        >
          <template #body>
            <UForm
              id="carteira-form"
              :schema="schema"
              :state="state"
              :loading="enviando"
              class="space-y-4"
              @submit="onSubmit"
            >
              <UFormField label="Nome" name="nome" required>
                <UInput
                  v-model="state.nome"
                  placeholder="Ex.: Banco Principal ou Cofre Recepção"
                />
              </UFormField>

              <UFormField label="Tipo" name="tipo" required>
                <URadioGroup
                  v-model="state.tipo"
                  :items="tiposCarteira"
                  orientation="horizontal"
                />
              </UFormField>

              <UFormField label="Saldo inicial (R$)" name="saldoInicial" required>
                <UInput
                  v-model="state.saldoInicial"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                />
              </UFormField>

              <UFormField v-if="carteiraEditando" label="Status" name="ativa">
                <USwitch
                  v-model="state.ativa"
                  :label="state.ativa ? 'Ativa' : 'Inativa'"
                />
              </UFormField>
            </UForm>
          </template>

          <template #footer="{ close }">
            <UButton
              v-if="carteiraEditando"
              icon="i-lucide-trash-2"
              label="Excluir"
              color="error"
              variant="ghost"
              size="sm"
              @click="excluir"
            />
            <div class="flex-1" />
            <UButton
              label="Cancelar"
              color="neutral"
              variant="outline"
              @click="close"
            />
            <UButton
              type="submit"
              :label="carteiraEditando ? 'Salvar alterações' : 'Criar'"
              icon="i-lucide-check"
              :loading="enviando"
              form="carteira-form"
            />
          </template>
        </UModal>
      </div>
    </template>
  </UDashboardPanel>
</template>
