<script setup lang="ts">
import type { OSView } from '~/composables/useOS'
import type { AgendamentoView } from '~/types'

const route = useRoute()
const toast = useToast()
const unidadeId = computed(() => String(route.params.unidadeId ?? ''))
const { statusMeta, erroMensagem, RESPONSAVEIS } = useOS()

type Visao = 'dia' | 'semana' | 'mes'
type Cor = 'azul' | 'violeta' | 'ambar' | 'verde' | 'cinza'

interface EventoAgenda {
  key: string
  tipo: 'agendamento' | 'os'
  data: Date
  titulo: string
  subtitulo: string
  rotulo: string
  cor: Cor
  busca: string
  agendamento?: AgendamentoView
  osId?: number
}

const COR_CLASSES: Record<Cor, { bloco: string, dot: string }> = {
  azul: { bloco: 'bg-blue-500/15 text-blue-700 ring ring-inset ring-blue-500/30 dark:text-blue-300', dot: 'bg-blue-500' },
  violeta: { bloco: 'bg-violet-500/15 text-violet-700 ring ring-inset ring-violet-500/30 dark:text-violet-300', dot: 'bg-violet-500' },
  ambar: { bloco: 'bg-amber-500/15 text-amber-700 ring ring-inset ring-amber-500/30 dark:text-amber-300', dot: 'bg-amber-500' },
  verde: { bloco: 'bg-green-500/15 text-green-700 ring ring-inset ring-green-500/30 dark:text-green-300', dot: 'bg-green-500' },
  cinza: { bloco: 'bg-neutral-500/10 text-muted ring ring-inset ring-neutral-500/25', dot: 'bg-neutral-400' }
}

const LEGENDA: { cor: Cor, label: string }[] = [
  { cor: 'azul', label: 'Agendado' },
  { cor: 'violeta', label: 'Em diagnóstico' },
  { cor: 'ambar', label: 'Aguardando' },
  { cor: 'verde', label: 'Em execução / Concluída' },
  { cor: 'cinza', label: 'Entregue / Cancelado' }
]

const HORAS = Array.from({ length: 10 }, (_, i) => i + 8) // 08:00 → 18:00
const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const visoes = [
  { label: 'Dia', value: 'dia' },
  { label: 'Semana', value: 'semana' },
  { label: 'Mês', value: 'mes' }
]

// ── Datas (visualização em horário local; storage em ISO UTC) ──
function inicioDoDia(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function somarDias(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes())
}
function inicioDaSemana(d: Date) {
  const base = inicioDoDia(d)
  return somarDias(base, -((base.getDay() + 6) % 7))
}
function mesmoDia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function chaveDia(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
function paraInputLocal(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function deInputLocal(valor: string) {
  return new Date(valor).toISOString()
}
function formatarHora(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const visao = ref<Visao>('semana')
const cursor = ref(inicioDoDia(new Date()))

const dias = computed(() => {
  if (visao.value === 'dia') return [cursor.value]
  const ini = inicioDaSemana(cursor.value)
  return Array.from({ length: 7 }, (_, i) => somarDias(ini, i))
})

const diasMes = computed(() => {
  const primeiro = new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1)
  const ini = inicioDaSemana(primeiro)
  const ultimo = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + 1, 0)
  const total = Math.ceil((((ultimo.getTime() - ini.getTime()) / 86400000) + 1) / 7) * 7
  return Array.from({ length: total }, (_, i) => somarDias(ini, i))
})

const periodo = computed(() => {
  if (visao.value === 'dia') {
    return { inicio: inicioDoDia(cursor.value), fim: somarDias(inicioDoDia(cursor.value), 1) }
  }
  if (visao.value === 'semana') {
    const ini = inicioDaSemana(cursor.value)
    return { inicio: ini, fim: somarDias(ini, 7) }
  }
  const lista = diasMes.value
  return { inicio: lista[0]!, fim: somarDias(lista[lista.length - 1]!, 1) }
})

const titulo = computed(() => {
  const c = cursor.value
  if (visao.value === 'mes') {
    return capitalizar(c.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))
  }
  if (visao.value === 'dia') {
    return capitalizar(c.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
  }
  const ini = dias.value[0]!
  const fim = dias.value[6]!
  const f = (d: Date) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
  return `${f(ini)} – ${f(fim)} ${fim.getFullYear()}`
})

function navegar(direcao: -1 | 1) {
  const c = cursor.value
  if (visao.value === 'dia') cursor.value = somarDias(c, direcao)
  else if (visao.value === 'semana') cursor.value = somarDias(c, 7 * direcao)
  else cursor.value = new Date(c.getFullYear(), c.getMonth() + direcao, 1)
}
function irParaHoje() {
  cursor.value = inicioDoDia(new Date())
}
function abrirDia(d: Date) {
  cursor.value = inicioDoDia(d)
  visao.value = 'dia'
}

// ── Dados ──
const { data: agendamentos, status: statusAg, error: erroAg, refresh: refreshAg } = await useFetch<AgendamentoView[]>(
  () => `/api/unidade/${unidadeId.value}/agenda`,
  {
    default: () => [],
    watch: [unidadeId],
    query: computed(() => ({
      dataInicio: periodo.value.inicio.toISOString(),
      dataFim: periodo.value.fim.toISOString()
    }))
  }
)

const { data: listaOS, refresh: refreshOS } = await useFetch<OSView[]>(
  () => `/api/unidade/${unidadeId.value}/os`,
  { default: () => [], watch: [unidadeId] }
)

const { data: clientes } = await useFetch<Cliente[]>(
  () => `/api/unidade/${unidadeId.value}/clientes`,
  { default: () => [], watch: [unidadeId] }
)

const { data: veiculos } = await useFetch<Veiculo[]>(
  () => `/api/unidade/${unidadeId.value}/veiculos`,
  { default: () => [], watch: [unidadeId] }
)

async function recarregar() {
  await Promise.all([refreshAg(), refreshOS()])
}

// ── Busca (debounce 300ms, mínimo 3 caracteres) ──
const buscaDigitada = ref('')
const buscaAtiva = ref('')
let timerBusca: ReturnType<typeof setTimeout> | undefined

watch(buscaDigitada, (v) => {
  clearTimeout(timerBusca)
  timerBusca = setTimeout(() => {
    const termo = v.trim().toLowerCase()
    buscaAtiva.value = termo.length >= 3 ? termo : ''
  }, 300)
})
onBeforeUnmount(() => clearTimeout(timerBusca))

// ── Eventos ──
function corOS(status: OSView['status']): Cor {
  if (status === 'em_diagnostico') return 'violeta'
  if (status === 'aguardando_aprovacao') return 'ambar'
  if (status === 'em_execucao' || status === 'concluida') return 'verde'
  if (status === 'entregue' || status === 'cancelada') return 'cinza'
  return 'azul'
}

const eventos = computed<EventoAgenda[]>(() => {
  const lista: EventoAgenda[] = []

  for (const ag of agendamentos.value ?? []) {
    if (ag.status === 'realizado') continue
    const cancelado = ag.status === 'cancelado'
    lista.push({
      key: `ag-${ag.id}`,
      tipo: 'agendamento',
      data: new Date(ag.dataHora),
      titulo: [ag.clienteNome || 'Não informado', ag.veiculoPlaca].filter(Boolean).join(' · '),
      subtitulo: ag.servico,
      rotulo: cancelado ? 'Cancelado' : 'Agendado',
      cor: cancelado ? 'cinza' : 'azul',
      busca: `${ag.clienteNome ?? ''} ${ag.veiculoPlaca ?? ''} ${ag.servico}`.toLowerCase(),
      agendamento: ag
    })
  }

  for (const os of listaOS.value ?? []) {
    const base = {
      tipo: 'os' as const,
      titulo: `OS ${os.numero} · ${os.veiculoPlaca || os.clienteNome || 'Não informado'}`,
      busca: `${os.clienteNome ?? ''} ${os.veiculoPlaca ?? ''} ${os.queixa ?? ''}`.toLowerCase(),
      osId: os.id,
      cor: corOS(os.status)
    }
    if (['aberta', 'em_diagnostico', 'aguardando_aprovacao', 'aprovada'].includes(os.status) && os.dataEntrada) {
      lista.push({
        ...base,
        key: `os-entrada-${os.id}`,
        data: new Date(os.dataEntrada),
        subtitulo: 'Entrada',
        rotulo: statusMeta(os.status).label
      })
    }
    if (['em_execucao', 'concluida'].includes(os.status) && os.previsaoEntrega) {
      lista.push({
        ...base,
        key: `os-previsao-${os.id}`,
        data: new Date(os.previsaoEntrega),
        subtitulo: 'Previsão de entrega',
        rotulo: statusMeta(os.status).label
      })
    }
  }

  return lista
    .filter(e => !buscaAtiva.value || e.busca.includes(buscaAtiva.value))
    .sort((a, b) => a.data.getTime() - b.data.getTime())
})

const eventosPorDia = computed(() => {
  const mapa = new Map<string, EventoAgenda[]>()
  for (const e of eventos.value) {
    const k = chaveDia(e.data)
    mapa.set(k, [...(mapa.get(k) ?? []), e])
  }
  return mapa
})

function eventosDoDia(d: Date) {
  return eventosPorDia.value.get(chaveDia(d)) ?? []
}

function eventosDaCelula(d: Date, hora: number) {
  return eventosDoDia(d).filter((e) => {
    const h = e.data.getHours()
    const linha = Math.min(Math.max(h, HORAS[0]!), HORAS[HORAS.length - 1]!)
    return linha === hora
  })
}

function abrirEvento(e: EventoAgenda) {
  if (e.tipo === 'os' && e.osId) {
    return navigateTo(`/unidade/${unidadeId.value}/os/${e.osId}`)
  }
  if (e.agendamento) abrirDetalhe(e.agendamento)
}

// ── Drag-and-drop (remarcar) ──
const arrastando = ref<AgendamentoView | null>(null)

function iniciarArraste(ev: DragEvent, e: EventoAgenda) {
  if (e.tipo !== 'agendamento' || e.agendamento?.status !== 'agendado') {
    ev.preventDefault()
    return
  }
  arrastando.value = e.agendamento
  ev.dataTransfer?.setData('text/plain', String(e.agendamento.id))
  if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
}

async function soltar(dia: Date, hora: number) {
  const ag = arrastando.value
  arrastando.value = null
  if (!ag) return
  const atual = new Date(ag.dataHora)
  const nova = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hora, atual.getMinutes())
  if (nova.getTime() === atual.getTime()) return
  await salvarRemarcacao(ag.id, { dataHora: nova.toISOString() })
}

async function salvarRemarcacao(id: number, body: { dataHora?: string, veiculoId?: number }) {
  try {
    await $fetch(`/api/unidade/${unidadeId.value}/agenda/${id}`, { method: 'PUT', body })
    toast.add({ title: 'Agendamento remarcado', color: 'success' })
    await refreshAg()
    return true
  } catch (err) {
    toast.add({ title: 'Não foi possível salvar', description: erroMensagem(err), color: 'error' })
    return false
  }
}

// ── Modal: novo agendamento ──
const modalNovo = ref(false)
const salvandoNovo = ref(false)
const novo = reactive<{
  cliente: Cliente | undefined
  veiculoId: number | undefined
  dataHora: string
  servico: string
  observacao: string
}>({ cliente: undefined, veiculoId: undefined, dataHora: '', servico: '', observacao: '' })

const veiculosDoCliente = computed(() =>
  (veiculos.value ?? []).filter(v => v.clienteId === novo.cliente?.id)
)
const veiculoItens = computed(() =>
  veiculosDoCliente.value.map(v => ({
    label: `${v.placa} — ${[v.marca, v.modelo].filter(Boolean).join(' ')}`,
    value: v.id
  }))
)

watch(() => novo.cliente, () => {
  novo.veiculoId = undefined
})

function abrirNovo(base?: Date) {
  const d = base ? new Date(base) : new Date()
  if (!base) {
    d.setMinutes(0, 0, 0)
    d.setHours(Math.min(Math.max(d.getHours() + 1, 8), 17))
  }
  Object.assign(novo, {
    cliente: undefined,
    veiculoId: undefined,
    dataHora: paraInputLocal(d.toISOString()),
    servico: '',
    observacao: ''
  })
  modalNovo.value = true
}

async function criarAgendamento() {
  if (!novo.cliente || !novo.dataHora || !novo.servico.trim()) {
    toast.add({ title: 'Não foi possível salvar', description: 'Informe cliente, data/hora e serviço.', color: 'error' })
    return
  }
  salvandoNovo.value = true
  try {
    await $fetch(`/api/unidade/${unidadeId.value}/agenda`, {
      method: 'POST',
      body: {
        clienteId: novo.cliente.id,
        veiculoId: novo.veiculoId,
        dataHora: deInputLocal(novo.dataHora),
        servico: novo.servico.trim(),
        observacao: novo.observacao.trim() || undefined
      }
    })
    toast.add({ title: 'Agendamento criado', color: 'success' })
    modalNovo.value = false
    await refreshAg()
  } catch (err) {
    toast.add({ title: 'Não foi possível salvar', description: erroMensagem(err), color: 'error' })
  } finally {
    salvandoNovo.value = false
  }
}

// ── Modal: detalhes do agendamento ──
const modalDetalhe = ref(false)
const selecionado = ref<AgendamentoView | null>(null)
const remarcar = reactive<{ dataHora: string, veiculoId: number | undefined }>({ dataHora: '', veiculoId: undefined })
const acaoEmCurso = ref<'remarcar' | 'converter' | 'cancelar' | null>(null)

const veiculosDoSelecionado = computed(() =>
  (veiculos.value ?? [])
    .filter(v => v.clienteId === selecionado.value?.clienteId)
    .map(v => ({
      label: `${v.placa} — ${[v.marca, v.modelo].filter(Boolean).join(' ')}`,
      value: v.id
    }))
)

function abrirDetalhe(ag: AgendamentoView) {
  selecionado.value = ag
  remarcar.dataHora = paraInputLocal(ag.dataHora)
  remarcar.veiculoId = ag.veiculoId
  modalDetalhe.value = true
}

async function remarcarSelecionado() {
  const ag = selecionado.value
  if (!ag || !remarcar.dataHora) return
  acaoEmCurso.value = 'remarcar'
  const ok = await salvarRemarcacao(ag.id, {
    dataHora: deInputLocal(remarcar.dataHora),
    veiculoId: remarcar.veiculoId
  })
  acaoEmCurso.value = null
  if (ok) modalDetalhe.value = false
}

async function cancelarSelecionado() {
  const ag = selecionado.value
  if (!ag || !window.confirm('Cancelar este agendamento?')) return
  acaoEmCurso.value = 'cancelar'
  try {
    await $fetch(`/api/unidade/${unidadeId.value}/agenda/${ag.id}/cancelar`, { method: 'POST' })
    toast.add({ title: 'Agendamento cancelado', color: 'success' })
    modalDetalhe.value = false
    await refreshAg()
  } catch (err) {
    toast.add({ title: 'Não foi possível cancelar', description: erroMensagem(err), color: 'error' })
  } finally {
    acaoEmCurso.value = null
  }
}

async function converterSelecionado() {
  const ag = selecionado.value
  if (!ag) return
  const veiculoId = ag.veiculoId ?? remarcar.veiculoId
  if (!veiculoId) {
    toast.add({ title: 'Não foi possível converter', description: 'Selecione o veículo para criar a OS.', color: 'error' })
    return
  }
  acaoEmCurso.value = 'converter'
  try {
    const res = await $fetch<{ os: { id: number } }>(
      `/api/unidade/${unidadeId.value}/agenda/${ag.id}/converter`,
      { method: 'POST', body: { veiculoId, funcionarioId: RESPONSAVEIS[0]?.value } }
    )
    toast.add({ title: 'OS criada', color: 'success' })
    modalDetalhe.value = false
    await navigateTo(`/unidade/${unidadeId.value}/os/${res.os.id}`)
  } catch (err) {
    toast.add({ title: 'Não foi possível converter', description: erroMensagem(err), color: 'error' })
  } finally {
    acaoEmCurso.value = null
  }
}

const detalheCor = computed<Cor>(() => (selecionado.value?.status === 'agendado' ? 'azul' : 'cinza'))
const detalheStatus = computed(() => {
  const s = selecionado.value?.status
  return s === 'realizado' ? 'Realizado' : s === 'cancelado' ? 'Cancelado' : 'Agendado'
})
</script>

<template>
  <UDashboardPanel id="agenda">
    <template #header>
      <UDashboardNavbar title="Agenda">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="Agendar" @click="abrirNovo()" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="outline"
              aria-label="Anterior"
              @click="navegar(-1)"
            />
            <span class="min-w-48 text-center text-sm font-semibold sm:text-base">{{ titulo }}</span>
            <UButton
              icon="i-lucide-chevron-right"
              color="neutral"
              variant="outline"
              aria-label="Próximo"
              @click="navegar(1)"
            />
            <UButton
              label="Hoje"
              color="neutral"
              variant="outline"
              @click="irParaHoje"
            />
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UInput
              v-model="buscaDigitada"
              icon="i-lucide-search"
              placeholder="Buscar por cliente, placa ou serviço..."
              class="min-w-64"
            />
            <div class="flex gap-1">
              <UButton
                v-for="v in visoes"
                :key="v.value"
                :label="v.label"
                :color="visao === v.value ? 'primary' : 'neutral'"
                :variant="visao === v.value ? 'solid' : 'outline'"
                @click="visao = v.value as Visao"
              />
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span v-for="l in LEGENDA" :key="l.cor" class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-full" :class="COR_CLASSES[l.cor].dot" />
            {{ l.label }}
          </span>
        </div>

        <UAlert
          v-if="erroAg"
          color="error"
          variant="subtle"
          title="Não foi possível carregar a agenda"
          :actions="[{ label: 'Tentar novamente', color: 'neutral', variant: 'outline', onClick: recarregar }]"
        />

        <USkeleton v-if="statusAg === 'pending' && !(agendamentos ?? []).length" class="h-96 rounded-xl" />

        <!-- Dia / Semana -->
        <div
          v-else-if="visao !== 'mes'"
          class="overflow-x-auto rounded-xl border border-default"
        >
          <div
            class="grid min-w-[640px]"
            :style="{ gridTemplateColumns: `4rem repeat(${dias.length}, minmax(0, 1fr))` }"
          >
            <div class="border-b border-default" />
            <button
              v-for="d in dias"
              :key="chaveDia(d)"
              type="button"
              class="border-b border-l border-default px-2 py-2 text-center text-xs font-medium hover:bg-elevated/50"
              :class="mesmoDia(d, new Date()) ? 'text-primary' : 'text-muted'"
              @click="abrirDia(d)"
            >
              {{ DIAS_SEMANA[(d.getDay() + 6) % 7] }} {{ d.getDate() }}
            </button>

            <template v-for="h in HORAS" :key="h">
              <div class="border-b border-default px-2 py-1 text-right text-xs text-muted">
                {{ String(h).padStart(2, '0') }}:00
              </div>
              <div
                v-for="d in dias"
                :key="`${chaveDia(d)}-${h}`"
                class="flex min-h-16 flex-col gap-1 border-b border-l border-default p-1"
                @dragover.prevent
                @drop.prevent="soltar(d, h)"
                @dblclick="abrirNovo(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h))"
              >
                <button
                  v-for="e in eventosDaCelula(d, h)"
                  :key="e.key"
                  type="button"
                  :draggable="e.tipo === 'agendamento' && e.agendamento?.status === 'agendado'"
                  class="w-full rounded-md px-2 py-1 text-left text-xs"
                  :class="COR_CLASSES[e.cor].bloco"
                  @dragstart="iniciarArraste($event, e)"
                  @click="abrirEvento(e)"
                >
                  <span class="block truncate font-medium">
                    {{ e.tipo === 'agendamento' ? '📅' : '🚗' }} {{ formatarHora(e.data) }} · {{ e.titulo }}
                  </span>
                  <span class="block truncate opacity-80">{{ e.subtitulo }} · {{ e.rotulo }}</span>
                </button>
              </div>
            </template>
          </div>
        </div>

        <!-- Mês -->
        <div v-else class="overflow-hidden rounded-xl border border-default">
          <div class="grid grid-cols-7 border-b border-default">
            <div
              v-for="n in DIAS_SEMANA"
              :key="n"
              class="px-2 py-2 text-center text-xs font-medium text-muted"
            >
              {{ n }}
            </div>
          </div>
          <div class="grid grid-cols-7">
            <button
              v-for="d in diasMes"
              :key="chaveDia(d)"
              type="button"
              class="flex min-h-24 flex-col items-start gap-2 border-b border-l border-default p-2 text-left hover:bg-elevated/50"
              :class="d.getMonth() === cursor.getMonth() ? '' : 'opacity-40'"
              @click="abrirDia(d)"
            >
              <span class="flex w-full items-center justify-between">
                <span
                  class="text-xs font-medium"
                  :class="mesmoDia(d, new Date()) ? 'text-primary' : 'text-muted'"
                >
                  {{ d.getDate() }}
                </span>
                <UBadge
                  v-if="eventosDoDia(d).length"
                  :label="String(eventosDoDia(d).length)"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                />
              </span>
              <span class="flex flex-wrap gap-1">
                <span
                  v-for="e in eventosDoDia(d).slice(0, 6)"
                  :key="e.key"
                  class="size-2 rounded-full"
                  :class="COR_CLASSES[e.cor].dot"
                />
              </span>
            </button>
          </div>
        </div>

        <UEmpty
          v-if="statusAg !== 'pending' && !eventos.length"
          icon="i-lucide-calendar"
          :title="buscaAtiva ? 'Nenhum resultado' : 'Nenhum agendamento neste período.'"
          :description="buscaAtiva ? 'Tente outro termo de busca.' : 'Clique em Agendar para criar o primeiro.'"
          class="py-8"
        />
      </div>

      <!-- Novo agendamento -->
      <UModal v-model:open="modalNovo" title="Novo agendamento" description="Informe o cliente, a data e o serviço.">
        <template #body>
          <div class="flex flex-col gap-4">
            <UFormField label="Cliente" required>
              <USelectMenu
                v-model="novo.cliente"
                :items="clientes ?? []"
                label-key="nome"
                placeholder="Digite o nome do cliente..."
                icon="i-lucide-search"
              />
            </UFormField>
            <UFormField label="Veículo">
              <USelect
                v-model="novo.veiculoId"
                :items="veiculoItens"
                :disabled="!novo.cliente"
                placeholder="Selecione o veículo (opcional)"
              />
            </UFormField>
            <UFormField label="Data e hora" required>
              <UInput v-model="novo.dataHora" type="datetime-local" />
            </UFormField>
            <UFormField label="Serviço" required>
              <UInput v-model="novo.servico" placeholder="Ex.: Troca de óleo" />
            </UFormField>
            <UFormField label="Observação">
              <UInput v-model="novo.observacao" placeholder="Opcional" />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton
              label="Cancelar"
              color="neutral"
              variant="outline"
              @click="modalNovo = false"
            />
            <UButton
              label="Criar"
              icon="i-lucide-check"
              :loading="salvandoNovo"
              @click="criarAgendamento"
            />
          </div>
        </template>
      </UModal>

      <!-- Detalhes do agendamento -->
      <UModal v-model:open="modalDetalhe" title="Agendamento">
        <template #body>
          <div v-if="selecionado" class="flex flex-col gap-4">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">{{ selecionado.servico }}</span>
              <UBadge
                :label="detalheStatus"
                color="neutral"
                variant="subtle"
                :class="COR_CLASSES[detalheCor].bloco"
              />
            </div>

            <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt class="text-muted">
                  Cliente
                </dt>
                <dd>{{ selecionado.clienteNome || 'Não informado' }}</dd>
              </div>
              <div>
                <dt class="text-muted">
                  Veículo
                </dt>
                <dd>
                  {{ selecionado.veiculoPlaca
                    ? `${selecionado.veiculoPlaca} — ${selecionado.veiculoDescricao || ''}`
                    : 'Não informado' }}
                </dd>
              </div>
              <div>
                <dt class="text-muted">
                  Data e hora
                </dt>
                <dd>{{ formatarDataHora(selecionado.dataHora) }}</dd>
              </div>
              <div>
                <dt class="text-muted">
                  Observação
                </dt>
                <dd>{{ selecionado.observacao || 'Não informado' }}</dd>
              </div>
            </dl>

            <template v-if="selecionado.status === 'agendado'">
              <UFormField label="Remarcar para">
                <UInput v-model="remarcar.dataHora" type="datetime-local" />
              </UFormField>
              <UFormField v-if="!selecionado.veiculoId" label="Veículo (necessário para criar a OS)">
                <USelect
                  v-model="remarcar.veiculoId"
                  :items="veiculosDoSelecionado"
                  placeholder="Selecione o veículo"
                />
              </UFormField>
            </template>

            <UButton
              v-if="selecionado.osId"
              label="Ver OS"
              icon="i-lucide-external-link"
              color="neutral"
              variant="outline"
              :to="`/unidade/${unidadeId}/os/${selecionado.osId}`"
            />
          </div>
        </template>
        <template v-if="selecionado?.status === 'agendado'" #footer>
          <div class="flex w-full flex-wrap justify-between gap-2">
            <UButton
              label="Cancelar agendamento"
              icon="i-lucide-x"
              color="error"
              variant="outline"
              :loading="acaoEmCurso === 'cancelar'"
              @click="cancelarSelecionado"
            />
            <div class="flex gap-2">
              <UButton
                label="Remarcar"
                icon="i-lucide-calendar-clock"
                color="neutral"
                variant="outline"
                :loading="acaoEmCurso === 'remarcar'"
                @click="remarcarSelecionado"
              />
              <UButton
                label="Converter em OS"
                icon="i-lucide-clipboard-check"
                :loading="acaoEmCurso === 'converter'"
                @click="converterSelecionado"
              />
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
