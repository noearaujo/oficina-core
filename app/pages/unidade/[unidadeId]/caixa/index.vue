<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CaixaComEstado, Carteira, LancamentoCaixa, SessaoCaixa } from '~/types'

const route = useRoute()
const toast = useToast()
const unidadeId = computed(() => String(route.params.unidadeId ?? ''))

const busca = ref('')
const statusFiltro = ref('todos')

const {
  data: caixas,
  status: statusCaixas,
  error: errorCaixas,
  refresh: refreshCaixas
} = await useFetch<CaixaComEstado[]>(
  () => `/api/unidade/${unidadeId.value}/caixa`,
  {
    default: () => [],
    watch: [unidadeId]
  }
)

const {
  data: carteiras,
  refresh: refreshCarteiras
} = await useFetch<Carteira[]>(
  () => `/api/unidade/${unidadeId.value}/carteiras`,
  {
    default: () => [],
    watch: [unidadeId]
  }
)

const cofresAtivos = computed(() =>
  carteiras.value.filter(c => c.tipo === 'cofre' && c.ativa !== false)
)

const opcoesCofres = computed(() =>
  cofresAtivos.value.map(c => ({
    label: `${c.nome} (${formatarPreco(c.saldo ?? c.saldoInicial)})`,
    value: c.id
  }))
)

function stripAccents(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

const caixasFiltrados = computed(() => {
  const termo = stripAccents(busca.value.trim()).toLowerCase()

  return caixas.value.filter((caixa) => {
    const nomeNormalizado = caixa.nomeBusca || stripAccents(caixa.nome).toLowerCase()
    const responsavelNormalizado = caixa.responsavelNome
      ? stripAccents(caixa.responsavelNome).toLowerCase()
      : ''

    const correspondeBusca
      = !termo
        || nomeNormalizado.includes(termo)
        || responsavelNormalizado.includes(termo)

    const correspondeStatus
      = statusFiltro.value === 'todos'
        || caixa.status === statusFiltro.value
        || caixa.statusSessao === statusFiltro.value

    return correspondeBusca && correspondeStatus
  })
})

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

function labelCategoria(categoria: string) {
  const mapa: Record<string, string> = {
    transferencia: 'Transferência Cofre',
    retirada_rapida: 'Retirada Rápida',
    pagamento: 'Recebimento em espécie',
    devolucao: 'Devolução',
    sobra_caixa: 'Sobra de Caixa',
    quebra_caixa: 'Quebra de Caixa',
    aporte: 'Aporte',
    emprestimo_socio: 'Empréstimo de sócio'
  }
  return mapa[categoria] || categoria
}

// ═══ Histórico de Sessões ═══
const caixaHistoricoId = ref<number | undefined>(undefined)
const sessoesHistorico = ref<SessaoCaixa[]>([])
const carregandoSessoes = ref(false)

async function carregarSessoes(caixaId?: number) {
  const idAlvo = caixaId ?? caixaHistoricoId.value ?? caixas.value[0]?.id
  if (!idAlvo) {
    sessoesHistorico.value = []
    return
  }
  caixaHistoricoId.value = idAlvo
  carregandoSessoes.value = true
  try {
    const lista = await $fetch<SessaoCaixa[]>(
      `/api/unidade/${unidadeId.value}/caixa/${idAlvo}/sessoes`
    )
    sessoesHistorico.value = lista
  } catch {
    sessoesHistorico.value = []
  } finally {
    carregandoSessoes.value = false
  }
}

watch(
  () => caixas.value,
  (lista) => {
    if (lista.length > 0) {
      const existe = lista.some(c => c.id === caixaHistoricoId.value)
      const alvo = existe ? caixaHistoricoId.value : lista[0]?.id
      if (alvo) {
        carregarSessoes(alvo)
      }
    } else {
      sessoesHistorico.value = []
    }
  },
  { immediate: true }
)

const sessoesFechadas = computed(() =>
  sessoesHistorico.value.filter(s => s.status === 'fechada')
)

const opcoesCaixasHistorico = computed(() =>
  caixas.value.map(c => ({
    label: c.nome,
    value: c.id
  }))
)

async function recarregarTudo(caixaId?: number) {
  await Promise.all([refreshCaixas(), refreshCarteiras()])
  await carregarSessoes(caixaId ?? caixaHistoricoId.value)
}

// ═══ Modal: Novo Caixa ═══
const modalNovoCaixaOpen = ref(false)
const enviandoNovoCaixa = ref(false)

const schemaNovoCaixa = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do Caixa')
})

type SchemaNovoCaixa = z.output<typeof schemaNovoCaixa>

const stateNovoCaixa = reactive<SchemaNovoCaixa>({
  nome: ''
})

function abrirModalNovoCaixa() {
  stateNovoCaixa.nome = ''
  modalNovoCaixaOpen.value = true
}

async function onSubmitNovoCaixa(event: FormSubmitEvent<SchemaNovoCaixa>) {
  enviandoNovoCaixa.value = true
  try {
    const criado = await $fetch<CaixaComEstado>(`/api/unidade/${unidadeId.value}/caixa`, {
      method: 'POST',
      body: { nome: event.data.nome }
    })
    toast.add({
      title: 'Caixa cadastrado',
      description: `O Caixa "${criado.nome}" foi criado com sucesso.`,
      color: 'success'
    })
    await recarregarTudo(criado.id)
    modalNovoCaixaOpen.value = false
  } catch (err: unknown) {
    const statusMessage = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
    toast.add({
      title: 'Não foi possível salvar',
      description: statusMessage || 'Verifique os dados e tente novamente.',
      color: 'error'
    })
  } finally {
    enviandoNovoCaixa.value = false
  }
}

// ═══ Modal: Abrir Caixa ═══
const modalAbrirOpen = ref(false)
const caixaSelecionado = ref<CaixaComEstado | null>(null)
const enviandoAbrir = ref(false)

const schemaAbrir = z.object({
  valorAbertura: z.coerce.number().min(0, 'O valor não pode ser negativo'),
  carteiraOrigemId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive('Selecione o Cofre de origem').optional()
  ),
  responsavelNome: z.string().trim().min(1, 'Informe o responsável pela sessão')
}).superRefine((dados, ctx) => {
  if (Math.round(dados.valorAbertura * 100) > 0 && !dados.carteiraOrigemId) {
    ctx.addIssue({
      code: 'custom',
      path: ['carteiraOrigemId'],
      message: 'Selecione o Cofre de origem quando o valor de abertura for maior que zero'
    })
  }
})

type SchemaAbrir = z.output<typeof schemaAbrir>

const stateAbrir = reactive<{
  valorAbertura: number
  carteiraOrigemId: number | undefined
  responsavelNome: string
}>({
  valorAbertura: 0,
  carteiraOrigemId: undefined,
  responsavelNome: 'Operador'
})

function abrirModalAbertura(caixa: CaixaComEstado) {
  if (cofresAtivos.value.length === 0) {
    toast.add({
      title: 'Cofre necessário',
      description: 'Crie um Cofre antes de abrir o Caixa.',
      color: 'error'
    })
    return
  }
  caixaSelecionado.value = caixa
  stateAbrir.valorAbertura = 0
  stateAbrir.carteiraOrigemId = cofresAtivos.value[0]?.id
  stateAbrir.responsavelNome = 'Operador'
  modalAbrirOpen.value = true
}

async function onSubmitAbrir(event: FormSubmitEvent<SchemaAbrir>) {
  if (!caixaSelecionado.value) return
  enviandoAbrir.value = true

  const valorCentavos = Math.round(Number(event.data.valorAbertura) * 100)

  try {
    await $fetch(`/api/unidade/${unidadeId.value}/caixa/${caixaSelecionado.value.id}/abrir`, {
      method: 'POST',
      body: {
        valorAbertura: valorCentavos,
        ...(valorCentavos > 0 ? { carteiraOrigemId: event.data.carteiraOrigemId } : {}),
        responsavelNome: event.data.responsavelNome
      }
    })
    toast.add({
      title: 'Caixa aberto',
      description: `Sessão iniciada em "${caixaSelecionado.value.nome}".`,
      color: 'success'
    })
    await recarregarTudo(caixaSelecionado.value.id)
    modalAbrirOpen.value = false
  } catch (err: unknown) {
    const statusMessage = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
    toast.add({
      title: 'Não foi possível abrir o Caixa',
      description: statusMessage || 'Verifique os dados e tente novamente.',
      color: 'error'
    })
  } finally {
    enviandoAbrir.value = false
  }
}

// ═══ Modal: Fechar Caixa ═══
const modalFecharOpen = ref(false)
const enviandoFechar = ref(false)

const stateFechar = reactive<{
  valorContado: number
  carteiraCofreId: number | undefined
  motivo: string
}>({
  valorContado: 0,
  carteiraCofreId: undefined,
  motivo: ''
})

const diferencaFechamentoCentavos = computed(() => {
  if (!caixaSelecionado.value) return 0
  const contadoCentavos = Math.round(Number(stateFechar.valorContado || 0) * 100)
  return contadoCentavos - caixaSelecionado.value.saldoEsperado
})

const schemaFechar = z.object({
  valorContado: z.coerce.number().min(0, 'O valor contado não pode ser negativo'),
  carteiraCofreId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive('Selecione o Cofre de destino').optional()
  ),
  motivo: z.string().trim().optional().default('')
}).superRefine((dados, ctx) => {
  const esperado = caixaSelecionado.value?.saldoEsperado ?? 0
  const contado = Math.round(Number(dados.valorContado || 0) * 100)

  if (contado > 0 && !dados.carteiraCofreId) {
    ctx.addIssue({
      code: 'custom',
      path: ['carteiraCofreId'],
      message: 'Selecione o Cofre de destino para transferir o valor contado'
    })
  }

  if (contado !== esperado && !dados.motivo.trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['motivo'],
      message: 'Informe o motivo da diferença entre o valor contado e o saldo esperado'
    })
  }
})

type SchemaFechar = z.output<typeof schemaFechar>

function abrirModalFechamento(caixa: CaixaComEstado) {
  caixaSelecionado.value = caixa
  stateFechar.valorContado = Number(((caixa.saldoEsperado ?? 0) / 100).toFixed(2))
  stateFechar.carteiraCofreId
    = caixa.sessaoAberta?.carteiraOrigemId
      ?? cofresAtivos.value[0]?.id
  stateFechar.motivo = ''
  modalFecharOpen.value = true
}

async function onSubmitFechar(event: FormSubmitEvent<SchemaFechar>) {
  if (!caixaSelecionado.value) return
  enviandoFechar.value = true

  const valorContadoCentavos = Math.round(Number(event.data.valorContado) * 100)

  try {
    await $fetch(`/api/unidade/${unidadeId.value}/caixa/${caixaSelecionado.value.id}/fechar`, {
      method: 'POST',
      body: {
        valorContado: valorContadoCentavos,
        carteiraCofreId: event.data.carteiraCofreId,
        motivo: event.data.motivo
      }
    })
    toast.add({
      title: 'Caixa fechado',
      description: `A sessão de "${caixaSelecionado.value.nome}" foi encerrada com sucesso.`,
      color: 'success'
    })
    await recarregarTudo(caixaSelecionado.value.id)
    modalFecharOpen.value = false
  } catch (err: unknown) {
    const statusMessage = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
    toast.add({
      title: 'Não foi possível fechar o Caixa',
      description: statusMessage || 'Verifique os dados e tente novamente.',
      color: 'error'
    })
  } finally {
    enviandoFechar.value = false
  }
}

// ═══ Modal: Retirada Rápida ═══
const modalRetiradaOpen = ref(false)
const enviandoRetirada = ref(false)

const schemaRetirada = z.object({
  valor: z.coerce.number().positive('Informe um valor maior que zero'),
  justificativa: z.string().trim().min(1, 'Informe a justificativa da retirada rápida')
})

type SchemaRetirada = z.output<typeof schemaRetirada>

const stateRetirada = reactive<SchemaRetirada>({
  valor: 0,
  justificativa: ''
})

function abrirModalRetirada(caixa: CaixaComEstado) {
  caixaSelecionado.value = caixa
  stateRetirada.valor = 0
  stateRetirada.justificativa = ''
  modalRetiradaOpen.value = true
}

async function onSubmitRetirada(event: FormSubmitEvent<SchemaRetirada>) {
  if (!caixaSelecionado.value) return
  enviandoRetirada.value = true

  try {
    await $fetch(`/api/unidade/${unidadeId.value}/caixa/${caixaSelecionado.value.id}/retirada-rapida`, {
      method: 'POST',
      body: {
        valor: Math.round(Number(event.data.valor) * 100),
        justificativa: event.data.justificativa
      }
    })
    toast.add({
      title: 'Retirada registrada',
      description: 'Despesa em espécie lançada na sessão do Caixa.',
      color: 'success'
    })
    await recarregarTudo(caixaSelecionado.value.id)
    modalRetiradaOpen.value = false
  } catch (err: unknown) {
    const statusMessage = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
    toast.add({
      title: 'Não foi possível registrar a retirada',
      description: statusMessage || 'Verifique o saldo da sessão e tente novamente.',
      color: 'error'
    })
  } finally {
    enviandoRetirada.value = false
  }
}

// ═══ Modal: Reforço (Cofre → Sessão) ═══
const modalReforcoOpen = ref(false)
const enviandoReforco = ref(false)

const schemaReforco = z.object({
  valor: z.coerce.number().positive('Informe um valor maior que zero'),
  carteiraOrigemId: z.coerce.number().int().positive('Selecione o Cofre de origem'),
  motivo: z.string().trim().min(1, 'Informe o motivo do reforço')
})

type SchemaReforco = z.output<typeof schemaReforco>

const stateReforco = reactive<{
  valor: number
  carteiraOrigemId: number | undefined
  motivo: string
}>({
  valor: 0,
  carteiraOrigemId: undefined,
  motivo: ''
})

function abrirModalReforco(caixa: CaixaComEstado) {
  caixaSelecionado.value = caixa
  stateReforco.valor = 0
  stateReforco.carteiraOrigemId
    = caixa.sessaoAberta?.carteiraOrigemId
      ?? cofresAtivos.value[0]?.id
  stateReforco.motivo = ''
  modalReforcoOpen.value = true
}

async function onSubmitReforco(event: FormSubmitEvent<SchemaReforco>) {
  if (!caixaSelecionado.value) return
  enviandoReforco.value = true

  try {
    await $fetch(`/api/unidade/${unidadeId.value}/caixa/${caixaSelecionado.value.id}/reforco`, {
      method: 'POST',
      body: {
        valor: Math.round(Number(event.data.valor) * 100),
        carteiraOrigemId: event.data.carteiraOrigemId,
        motivo: event.data.motivo
      }
    })
    toast.add({
      title: 'Reforço registrado',
      description: 'Transferência do Cofre para a sessão realizada com sucesso.',
      color: 'success'
    })
    await recarregarTudo(caixaSelecionado.value.id)
    modalReforcoOpen.value = false
  } catch (err: unknown) {
    const statusMessage = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
    toast.add({
      title: 'Não foi possível registrar o reforço',
      description: statusMessage || 'Verifique os dados e tente novamente.',
      color: 'error'
    })
  } finally {
    enviandoReforco.value = false
  }
}

// ═══ Modal: Sangria (Sessão → Cofre) ═══
const modalSangriaOpen = ref(false)
const enviandoSangria = ref(false)

const schemaSangria = z.object({
  valor: z.coerce.number().positive('Informe um valor maior que zero'),
  carteiraDestinoId: z.coerce.number().int().positive('Selecione o Cofre de destino'),
  motivo: z.string().trim().min(1, 'Informe o motivo da sangria')
})

type SchemaSangria = z.output<typeof schemaSangria>

const stateSangria = reactive<{
  valor: number
  carteiraDestinoId: number | undefined
  motivo: string
}>({
  valor: 0,
  carteiraDestinoId: undefined,
  motivo: ''
})

function abrirModalSangria(caixa: CaixaComEstado) {
  caixaSelecionado.value = caixa
  stateSangria.valor = 0
  stateSangria.carteiraDestinoId
    = caixa.sessaoAberta?.carteiraOrigemId
      ?? cofresAtivos.value[0]?.id
  stateSangria.motivo = ''
  modalSangriaOpen.value = true
}

async function onSubmitSangria(event: FormSubmitEvent<SchemaSangria>) {
  if (!caixaSelecionado.value) return
  enviandoSangria.value = true

  try {
    await $fetch(`/api/unidade/${unidadeId.value}/caixa/${caixaSelecionado.value.id}/sangria`, {
      method: 'POST',
      body: {
        valor: Math.round(Number(event.data.valor) * 100),
        carteiraDestinoId: event.data.carteiraDestinoId,
        motivo: event.data.motivo
      }
    })
    toast.add({
      title: 'Sangria registrada',
      description: 'Transferência da sessão para o Cofre realizada com sucesso.',
      color: 'success'
    })
    await recarregarTudo(caixaSelecionado.value.id)
    modalSangriaOpen.value = false
  } catch (err: unknown) {
    const statusMessage = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
    toast.add({
      title: 'Não foi possível registrar a sangria',
      description: statusMessage || 'Verifique o saldo da sessão e tente novamente.',
      color: 'error'
    })
  } finally {
    enviandoSangria.value = false
  }
}

function selecionarHistoricoCaixa(caixa: CaixaComEstado) {
  carregarSessoes(caixa.id)
}
</script>

<template>
  <UDashboardPanel id="caixa">
    <template #header>
      <UDashboardNavbar title="Caixa">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Novo Caixa"
            icon="i-lucide-plus"
            @click="abrirModalNovoCaixa"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-3xl space-y-6">
        <!-- Aviso se não houver Cofre ativo -->
        <UAlert
          v-if="cofresAtivos.length === 0"
          color="warning"
          variant="subtle"
          icon="i-lucide-vault"
          title="Crie um Cofre antes de abrir o Caixa."
          description="O Caixa opera exclusivamente com dinheiro em espécie e exige uma Carteira do tipo Cofre ativa como origem e destino."
        >
          <template #actions>
            <UButton
              label="Ir para Carteiras"
              icon="i-lucide-arrow-right"
              color="neutral"
              variant="outline"
              :to="`/unidade/${unidadeId}/carteiras`"
            />
          </template>
        </UAlert>

        <!-- Busca + Filtro -->
        <div class="flex flex-wrap items-center justify-between gap-1.5">
          <UInput
            v-model="busca"
            icon="i-lucide-search"
            placeholder="Buscar Caixa ou responsável..."
            class="w-full sm:max-w-sm"
          />
          <USelect
            v-model="statusFiltro"
            :items="[
              { label: 'Todos os status', value: 'todos' },
              { label: 'Aberto', value: 'aberto' },
              { label: 'Fechado', value: 'fechado' }
            ]"
            class="w-full sm:w-48"
          />
        </div>

        <!-- Erro -->
        <UAlert
          v-if="errorCaixas"
          color="error"
          variant="subtle"
          title="Erro ao carregar Caixas"
          description="Não foi possível buscar os Caixas da unidade."
        >
          <template #actions>
            <UButton
              label="Tentar novamente"
              color="error"
              variant="soft"
              @click="() => recarregarTudo()"
            />
          </template>
        </UAlert>

        <!-- Loading -->
        <div v-if="statusCaixas === 'pending'" class="space-y-3">
          <USkeleton class="h-24 w-full rounded-xl" />
          <USkeleton class="h-24 w-full rounded-xl" />
        </div>

        <!-- Lista de Caixas Operacionais -->
        <UPageCard
          v-else
          variant="subtle"
          :ui="{ container: 'p-0 sm:p-0 gap-y-0', wrapper: 'items-stretch' }"
        >
          <div v-if="caixasFiltrados.length" class="divide-y divide-default">
            <div
              v-for="caixa in caixasFiltrados"
              :key="caixa.id"
              class="p-4 space-y-3"
            >
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <UAvatar
                    :alt="caixa.nome"
                    icon="i-lucide-banknote"
                    class="size-10"
                  />
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="text-sm font-medium text-highlighted truncate">
                        {{ caixa.nome }}
                      </p>
                      <UBadge
                        :color="caixa.aberta ? 'success' : 'neutral'"
                        variant="subtle"
                        size="sm"
                      >
                        {{ caixa.aberta ? 'Aberto' : 'Fechado' }}
                      </UBadge>
                    </div>
                    <p class="text-sm text-muted truncate">
                      Responsável: {{ caixa.responsavelNome || 'Não informado' }}
                      <template v-if="caixa.sessaoAberta?.abertaEm">
                        · Aberto em {{ formatarData(caixa.sessaoAberta.abertaEm) }}
                      </template>
                    </p>
                  </div>
                </div>

                <!-- Saldo Esperado e Ação Principal -->
                <div class="flex items-center gap-4 shrink-0">
                  <div class="text-right">
                    <p class="text-sm font-semibold tabular-nums text-highlighted">
                      {{ formatarPreco(caixa.saldoEsperado) }}
                    </p>
                    <p class="text-xs text-muted">
                      Saldo esperado
                    </p>
                  </div>

                  <UButton
                    v-if="!caixa.aberta"
                    label="Abrir"
                    icon="i-lucide-lock-open"
                    @click="abrirModalAbertura(caixa)"
                  />
                  <UButton
                    v-else
                    label="Fechar"
                    icon="i-lucide-lock"
                    color="neutral"
                    variant="outline"
                    @click="abrirModalFechamento(caixa)"
                  />
                </div>
              </div>

              <!-- Atalhos da Sessão Aberta (somente espécie) -->
              <div
                v-if="caixa.aberta"
                class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-default"
              >
                <div class="flex flex-wrap items-center gap-2">
                  <UButton
                    label="Retirada Rápida"
                    icon="i-lucide-arrow-up-right"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    @click="abrirModalRetirada(caixa)"
                  />
                  <UButton
                    label="Reforço"
                    icon="i-lucide-arrow-down-left"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    @click="abrirModalReforco(caixa)"
                  />
                  <UButton
                    label="Sangria"
                    icon="i-lucide-vault"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    @click="abrirModalSangria(caixa)"
                  />
                </div>

                <UButton
                  label="Ver histórico"
                  icon="i-lucide-history"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="selecionarHistoricoCaixa(caixa)"
                />
              </div>

              <!-- Movimentações recentes da sessão aberta -->
              <div
                v-if="caixa.aberta && caixa.lancamentosSessao?.length"
                class="rounded-lg border border-default divide-y divide-default max-h-44 overflow-y-auto"
              >
                <div
                  v-for="lanc in (caixa.lancamentosSessao as LancamentoCaixa[])"
                  :key="lanc.id"
                  class="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                >
                  <div class="min-w-0 flex-1">
                    <span class="font-medium text-highlighted">
                      {{ labelCategoria(lanc.categoria) }}
                    </span>
                    <span v-if="lanc.observacao" class="text-muted">
                      · {{ lanc.observacao }}
                    </span>
                  </div>
                  <span
                    class="font-semibold tabular-nums shrink-0"
                    :class="lanc.tipo === 'entrada' ? 'text-success' : 'text-error'"
                  >
                    {{ lanc.tipo === 'entrada' ? '+' : '-' }}{{ formatarPreco(lanc.valor) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <UEmpty
            v-else
            icon="i-lucide-banknote"
            :title="busca || statusFiltro !== 'todos' ? 'Nenhum Caixa encontrado' : 'Nenhum Caixa cadastrado'"
            :description="busca || statusFiltro !== 'todos' ? 'Tente ajustar a busca ou o filtro de status.' : 'Cadastre seu primeiro Caixa operacional (ex.: Recepção, Balcão 1) para operar em espécie.'"
            class="py-8"
          >
            <template v-if="!busca && statusFiltro === 'todos'" #actions>
              <UButton
                label="Novo Caixa"
                icon="i-lucide-plus"
                @click="abrirModalNovoCaixa"
              />
            </template>
          </UEmpty>
        </UPageCard>

        <!-- Histórico de Sessões Fechadas -->
        <div v-if="caixas.length > 0">
          <DashboardSectionHeader
            title="Histórico de sessões fechadas"
            description="Consulte aberturas, fechamentos, valores contados e sobras/quebras."
          >
            <USelect
              v-if="caixas.length > 1"
              v-model="caixaHistoricoId"
              :items="opcoesCaixasHistorico"
              class="w-48"
              @update:model-value="(val) => carregarSessoes(Number(val))"
            />
          </DashboardSectionHeader>

          <UPageCard
            variant="subtle"
            :ui="{ container: 'p-0 sm:p-0 gap-y-0', wrapper: 'items-stretch' }"
          >
            <div v-if="carregandoSessoes" class="p-4 space-y-2">
              <USkeleton class="h-12 w-full rounded-lg" />
              <USkeleton class="h-12 w-full rounded-lg" />
            </div>

            <div v-else-if="sessoesFechadas.length" class="divide-y divide-default">
              <div
                v-for="sessao in sessoesFechadas"
                :key="sessao.id"
                class="p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div class="space-y-1 min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="text-sm font-medium text-highlighted">
                      Sessão #{{ sessao.id }} · {{ sessao.responsavelNome || 'Operador' }}
                    </p>
                    <UBadge color="neutral" variant="subtle" size="sm">
                      Fechado
                    </UBadge>
                    <UBadge
                      v-if="(sessao.diferenca ?? 0) > 0"
                      color="success"
                      variant="subtle"
                      size="sm"
                    >
                      Sobra: +{{ formatarPreco(sessao.diferenca ?? 0) }}
                    </UBadge>
                    <UBadge
                      v-else-if="(sessao.diferenca ?? 0) < 0"
                      color="error"
                      variant="subtle"
                      size="sm"
                    >
                      Quebra: {{ formatarPreco(sessao.diferenca ?? 0) }}
                    </UBadge>
                  </div>

                  <p class="text-xs text-muted">
                    Abertura: {{ formatarData(sessao.abertaEm) }} ({{ formatarPreco(sessao.valorAbertura) }})
                    · Fechamento: {{ formatarData(sessao.fechadaEm) }}
                  </p>
                  <p v-if="sessao.motivoFechamento" class="text-xs text-muted">
                    Motivo: {{ sessao.motivoFechamento }}
                  </p>
                </div>

                <div class="text-right shrink-0">
                  <p class="text-sm font-semibold tabular-nums text-highlighted">
                    Contado: {{ formatarPreco(sessao.valorContado ?? 0) }}
                  </p>
                  <p class="text-xs text-muted tabular-nums">
                    Esperado: {{ formatarPreco(sessao.saldoEsperadoFechamento ?? 0) }}
                  </p>
                </div>
              </div>
            </div>

            <UEmpty
              v-else
              icon="i-lucide-history"
              title="Nenhuma sessão fechada"
              description="As sessões encerradas aparecerão aqui com os valores esperados e contados."
              class="py-8"
            />
          </UPageCard>
        </div>

        <!-- Modal: Novo Caixa -->
        <UModal
          v-model:open="modalNovoCaixaOpen"
          title="Novo Caixa"
          description="Cadastre um ponto operacional de Caixa para movimentações em espécie."
        >
          <template #body>
            <UForm
              id="novo-caixa-form"
              :schema="schemaNovoCaixa"
              :state="stateNovoCaixa"
              :loading="enviandoNovoCaixa"
              class="space-y-4"
              @submit="onSubmitNovoCaixa"
            >
              <UFormField label="Nome do Caixa" name="nome" required>
                <UInput
                  v-model="stateNovoCaixa.nome"
                  placeholder="Ex.: Recepção, Balcão 1"
                />
              </UFormField>
            </UForm>
          </template>

          <template #footer="{ close }">
            <div class="flex-1" />
            <UButton
              label="Cancelar"
              color="neutral"
              variant="outline"
              @click="close"
            />
            <UButton
              type="submit"
              label="Criar"
              icon="i-lucide-check"
              :loading="enviandoNovoCaixa"
              form="novo-caixa-form"
            />
          </template>
        </UModal>

        <!-- Modal: Abrir Caixa -->
        <UModal
          v-model:open="modalAbrirOpen"
          title="Abrir Caixa"
          :description="caixaSelecionado ? `Iniciar sessão em ${caixaSelecionado.nome}` : 'Informe o valor de abertura e o Cofre de origem.'"
        >
          <template #body>
            <UForm
              id="abrir-caixa-form"
              :schema="schemaAbrir"
              :state="stateAbrir"
              :loading="enviandoAbrir"
              class="space-y-4"
              @submit="onSubmitAbrir"
            >
              <UFormField label="Responsável" name="responsavelNome" required>
                <UInput
                  v-model="stateAbrir.responsavelNome"
                  placeholder="Nome do operador responsável"
                />
              </UFormField>

              <UFormField label="Valor de abertura (R$)" name="valorAbertura" required>
                <UInput
                  v-model="stateAbrir.valorAbertura"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                />
              </UFormField>

              <UFormField
                label="Cofre de origem"
                name="carteiraOrigemId"
                :required="Number(stateAbrir.valorAbertura) > 0"
              >
                <USelect
                  v-model="stateAbrir.carteiraOrigemId"
                  :items="opcoesCofres"
                  placeholder="Selecione o Cofre"
                />
              </UFormField>
            </UForm>
          </template>

          <template #footer="{ close }">
            <div class="flex-1" />
            <UButton
              label="Cancelar"
              color="neutral"
              variant="outline"
              @click="close"
            />
            <UButton
              type="submit"
              label="Abrir sessão"
              icon="i-lucide-check"
              :loading="enviandoAbrir"
              form="abrir-caixa-form"
            />
          </template>
        </UModal>

        <!-- Modal: Fechar Caixa -->
        <UModal
          v-model:open="modalFecharOpen"
          title="Fechar Caixa"
          :description="caixaSelecionado ? `${caixaSelecionado.nome} · Saldo esperado: ${formatarPreco(caixaSelecionado.saldoEsperado)}` : 'Confira o valor em espécie e encerre a sessão.'"
        >
          <template #body>
            <UForm
              id="fechar-caixa-form"
              :schema="schemaFechar"
              :state="stateFechar"
              :loading="enviandoFechar"
              class="space-y-4"
              @submit="onSubmitFechar"
            >
              <div class="rounded-lg border border-default p-3 flex items-center justify-between text-sm">
                <span class="text-muted">Saldo esperado na sessão:</span>
                <span class="font-semibold tabular-nums text-highlighted">
                  {{ formatarPreco(caixaSelecionado?.saldoEsperado ?? 0) }}
                </span>
              </div>

              <UFormField label="Valor contado em espécie (R$)" name="valorContado" required>
                <UInput
                  v-model="stateFechar.valorContado"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                />
              </UFormField>

              <div
                v-if="diferencaFechamentoCentavos !== 0"
                class="rounded-lg p-3 text-xs font-medium flex items-center justify-between"
                :class="diferencaFechamentoCentavos > 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'"
              >
                <span>
                  {{ diferencaFechamentoCentavos > 0 ? 'Sobra de Caixa detectada:' : 'Quebra de Caixa detectada:' }}
                </span>
                <span class="tabular-nums">
                  {{ diferencaFechamentoCentavos > 0 ? '+' : '' }}{{ formatarPreco(diferencaFechamentoCentavos) }}
                </span>
              </div>

              <UFormField
                label="Cofre de destino"
                name="carteiraCofreId"
                :required="Number(stateFechar.valorContado) > 0"
              >
                <USelect
                  v-model="stateFechar.carteiraCofreId"
                  :items="opcoesCofres"
                  placeholder="Selecione o Cofre de destino"
                />
              </UFormField>

              <UFormField
                label="Motivo / Observação"
                name="motivo"
                :required="diferencaFechamentoCentavos !== 0"
              >
                <UInput
                  v-model="stateFechar.motivo"
                  :placeholder="diferencaFechamentoCentavos !== 0 ? 'Obrigatório quando houver diferença' : 'Observação opcional do fechamento'"
                />
              </UFormField>
            </UForm>
          </template>

          <template #footer="{ close }">
            <div class="flex-1" />
            <UButton
              label="Cancelar"
              color="neutral"
              variant="outline"
              @click="close"
            />
            <UButton
              type="submit"
              label="Fechar caixa"
              icon="i-lucide-lock"
              :loading="enviandoFechar"
              form="fechar-caixa-form"
            />
          </template>
        </UModal>

        <!-- Modal: Retirada Rápida -->
        <UModal
          v-model:open="modalRetiradaOpen"
          title="Retirada Rápida"
          :description="caixaSelecionado ? `Registrar despesa em espécie em ${caixaSelecionado.nome} (Saldo: ${formatarPreco(caixaSelecionado.saldoEsperado)})` : 'Despesa rápida em espécie na sessão.'"
        >
          <template #body>
            <UForm
              id="retirada-rapida-form"
              :schema="schemaRetirada"
              :state="stateRetirada"
              :loading="enviandoRetirada"
              class="space-y-4"
              @submit="onSubmitRetirada"
            >
              <UFormField label="Valor (R$)" name="valor" required>
                <UInput
                  v-model="stateRetirada.valor"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0,00"
                />
              </UFormField>

              <UFormField label="Justificativa" name="justificativa" required>
                <UInput
                  v-model="stateRetirada.justificativa"
                  placeholder="Ex.: Compra de insumo urgente, café"
                />
              </UFormField>
            </UForm>
          </template>

          <template #footer="{ close }">
            <div class="flex-1" />
            <UButton
              label="Cancelar"
              color="neutral"
              variant="outline"
              @click="close"
            />
            <UButton
              type="submit"
              label="Confirmar"
              icon="i-lucide-check"
              :loading="enviandoRetirada"
              form="retirada-rapida-form"
            />
          </template>
        </UModal>

        <!-- Modal: Reforço -->
        <UModal
          v-model:open="modalReforcoOpen"
          title="Reforço de Caixa"
          :description="caixaSelecionado ? `Transferir espécie do Cofre para ${caixaSelecionado.nome}` : 'Transferência Cofre → sessão.'"
        >
          <template #body>
            <UForm
              id="reforco-caixa-form"
              :schema="schemaReforco"
              :state="stateReforco"
              :loading="enviandoReforco"
              class="space-y-4"
              @submit="onSubmitReforco"
            >
              <UFormField label="Valor (R$)" name="valor" required>
                <UInput
                  v-model="stateReforco.valor"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0,00"
                />
              </UFormField>

              <UFormField label="Cofre de origem" name="carteiraOrigemId" required>
                <USelect
                  v-model="stateReforco.carteiraOrigemId"
                  :items="opcoesCofres"
                  placeholder="Selecione o Cofre"
                />
              </UFormField>

              <UFormField label="Motivo" name="motivo" required>
                <UInput
                  v-model="stateReforco.motivo"
                  placeholder="Ex.: Reforço de troco"
                />
              </UFormField>
            </UForm>
          </template>

          <template #footer="{ close }">
            <div class="flex-1" />
            <UButton
              label="Cancelar"
              color="neutral"
              variant="outline"
              @click="close"
            />
            <UButton
              type="submit"
              label="Confirmar"
              icon="i-lucide-check"
              :loading="enviandoReforco"
              form="reforco-caixa-form"
            />
          </template>
        </UModal>

        <!-- Modal: Sangria -->
        <UModal
          v-model:open="modalSangriaOpen"
          title="Sangria de Caixa"
          :description="caixaSelecionado ? `Transferir espécie de ${caixaSelecionado.nome} para o Cofre (Saldo: ${formatarPreco(caixaSelecionado.saldoEsperado)})` : 'Transferência sessão → Cofre.'"
        >
          <template #body>
            <UForm
              id="sangria-caixa-form"
              :schema="schemaSangria"
              :state="stateSangria"
              :loading="enviandoSangria"
              class="space-y-4"
              @submit="onSubmitSangria"
            >
              <UFormField label="Valor (R$)" name="valor" required>
                <UInput
                  v-model="stateSangria.valor"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0,00"
                />
              </UFormField>

              <UFormField label="Cofre de destino" name="carteiraDestinoId" required>
                <USelect
                  v-model="stateSangria.carteiraDestinoId"
                  :items="opcoesCofres"
                  placeholder="Selecione o Cofre"
                />
              </UFormField>

              <UFormField label="Motivo" name="motivo" required>
                <UInput
                  v-model="stateSangria.motivo"
                  placeholder="Ex.: Alívio de numerário na gaveta"
                />
              </UFormField>
            </UForm>
          </template>

          <template #footer="{ close }">
            <div class="flex-1" />
            <UButton
              label="Cancelar"
              color="neutral"
              variant="outline"
              @click="close"
            />
            <UButton
              type="submit"
              label="Confirmar"
              icon="i-lucide-check"
              :loading="enviandoSangria"
              form="sangria-caixa-form"
            />
          </template>
        </UModal>
      </div>
    </template>
  </UDashboardPanel>
</template>
