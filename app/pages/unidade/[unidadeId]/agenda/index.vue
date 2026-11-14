<script setup lang="ts">
import type { OSView } from '~/composables/useOS'
import type { AgendamentoView } from '~/types'
import { CalendarDate } from '@internationalized/date'
import { startOfDay, addDays, startOfWeek, isSameDay, format } from 'date-fns'
import AgendaModalNovo from '~/components/agenda/AgendaModalNovo.vue'
import AgendaModalDetalhe from '~/components/agenda/AgendaModalDetalhe.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const unidadeId = computed(() => String(route.params.unidadeId ?? ''))
const { statusMeta, erroMensagem } = useOS()

type Visao = 'dia' | 'semana' | 'mes'
type Cor = 'azul' | 'violeta' | 'ambar' | 'verde' | 'cinza' | 'vermelho'

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
  cinza: { bloco: 'bg-neutral-500/10 text-muted ring ring-inset ring-neutral-500/25', dot: 'bg-neutral-400' },
  vermelho: { bloco: 'bg-red-500/15 text-red-700 ring ring-inset ring-red-500/30 dark:text-red-300', dot: 'bg-red-500' }
}

const LEGENDA: { cor: Cor, label: string }[] = [
  { cor: 'azul', label: 'Agendado' },
  { cor: 'violeta', label: 'Em diagnóstico' },
  { cor: 'ambar', label: 'Aguardando' },
  { cor: 'verde', label: 'Em execução / Concluída' },
  { cor: 'cinza', label: 'Entregue / Cancelado' },
  { cor: 'vermelho', label: 'Atrasada' }
]

const HORAS = Array.from({ length: 11 }, (_, i) => i + 8) // 08:00 → 18:00
const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const visoes = [
  { label: 'Dia', value: 'dia' },
  { label: 'Semana', value: 'semana' },
  { label: 'Mês', value: 'mes' }
]

// ── Datas ──
function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
function parseDataLocal(valor: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [ano, mes, dia] = valor.split('-').map(Number)
    return new Date(ano!, mes! - 1, dia!, 17, 0)
  }
  return new Date(valor)
}

// ── Estado com URL sync ──
const visao = ref<Visao>((route.query.visao as Visao) || 'semana')
const cursor = ref(
  route.query.data
    ? startOfDay(new Date(String(route.query.data) + 'T12:00:00'))
    : startOfDay(new Date())
)

// "Hoje" e "agora" reativos (atualiza a cada minuto para virada de dia)
const now = useNow({ interval: 60_000 })
const hoje = computed(() => startOfDay(now.value))
const horaAtual = computed(() => now.value.getHours())

// Sincroniza URL (sem disparo no mount)
watch([visao, cursor], ([v, c]) => {
  router.replace({
    query: {
      ...route.query,
      visao: v,
      data: format(c, 'yyyy-MM-dd')
    }
  })
}, { deep: false })

// ── Navegação ──
function navegar(direcao: -1 | 1) {
  const c = cursor.value
  if (visao.value === 'dia') cursor.value = addDays(c, direcao)
  else if (visao.value === 'semana') cursor.value = addDays(c, 7 * direcao)
  else cursor.value = new Date(c.getFullYear(), c.getMonth() + direcao, 1)
}
function irParaHoje() {
  cursor.value = startOfDay(new Date())
}
function abrirDia(d: Date) {
  cursor.value = startOfDay(d)
  visao.value = 'dia'
}

// ── Atalhos de teclado ──
defineShortcuts({
  h: () => irParaHoje(),
  d: () => { visao.value = 'dia' },
  w: () => { visao.value = 'semana' },
  m: () => { visao.value = 'mes' },
  a: () => abrirNovo(),
  arrowleft: () => navegar(-1),
  arrowright: () => navegar(1)
})

// ── UCalendar popover ──
const dataCalendario = computed({
  get: () => new CalendarDate(cursor.value.getFullYear(), cursor.value.getMonth() + 1, cursor.value.getDate()),
  set: (val: CalendarDate | null) => {
    if (val) cursor.value = new Date(val.year, val.month - 1, val.day)
  }
})

// ── Datas do período ──
const dias = computed(() => {
  if (visao.value === 'dia') return [cursor.value]
  const ini = startOfWeek(cursor.value, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => addDays(ini, i))
})

const diasMes = computed(() => {
  const primeiro = new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1)
  const ini = startOfWeek(primeiro, { weekStartsOn: 1 })
  const ultimo = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + 1, 0)
  const total = Math.ceil((((ultimo.getTime() - ini.getTime()) / 86400000) + 1) / 7) * 7
  return Array.from({ length: total }, (_, i) => addDays(ini, i))
})

const periodo = computed(() => {
  if (visao.value === 'dia') {
    return { inicio: startOfDay(cursor.value), fim: addDays(startOfDay(cursor.value), 1) }
  }
  if (visao.value === 'semana') {
    const ini = startOfWeek(cursor.value, { weekStartsOn: 1 })
    return { inicio: ini, fim: addDays(ini, 7) }
  }
  const lista = diasMes.value
  return { inicio: lista[0]!, fim: addDays(lista[lista.length - 1]!, 1) }
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

useHead({ title: computed(() => `Agenda — ${titulo.value}`) })

// ── Dados (useLazyFetch — ssr: false) ──
const { data: agendamentos, status: statusAg, error: erroAg, refresh: refreshAg } = useLazyFetch<AgendamentoView[]>(
  () => `/api/unidade/${unidadeId.value}/agenda`,
  {
    default: () => [],
    query: computed(() => ({
      dataInicio: periodo.value.inicio.toISOString(),
      dataFim: periodo.value.fim.toISOString()
    }))
  }
)

const { data: listaOS, refresh: refreshOS } = useLazyFetch<OSView[]>(
  () => `/api/unidade/${unidadeId.value}/os`,
  {
    default: () => [],
    query: computed(() => ({
      dataInicio: periodo.value.inicio.toISOString(),
      dataFim: periodo.value.fim.toISOString(),
      incluirPrevisao: 'true'
    }))
  }
)

// Clientes e veículos: zero carga inicial
const { data: clientes, execute: fetchClientes } = useFetch<Cliente[]>(
  () => `/api/unidade/${unidadeId.value}/clientes`,
  { default: () => [], immediate: false }
)
const { data: veiculos, execute: fetchVeiculos } = useFetch<Veiculo[]>(
  () => `/api/unidade/${unidadeId.value}/veiculos`,
  { default: () => [], immediate: false }
)

async function recarregar() {
  await Promise.all([refreshAg(), refreshOS()])
}

// ── Busca (refDebounced) ──
const buscaDigitada = ref('')
const buscaAtiva = refDebounced(buscaDigitada, 300)

// ── Filtro por cor (legenda clicável) ──
const coresOcultas = ref<Set<Cor>>(new Set())
function alternarCor(cor: Cor) {
  const proximo = new Set(coresOcultas.value)
  if (proximo.has(cor)) proximo.delete(cor)
  else proximo.add(cor)
  coresOcultas.value = proximo
}

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
  const termo = buscaAtiva.value.trim().toLowerCase()

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
      const dataPrevista = parseDataLocal(os.previsaoEntrega)
      const atrasada = os.status === 'em_execucao' && dataPrevista < now.value
      lista.push({
        ...base,
        key: `os-previsao-${os.id}`,
        data: dataPrevista,
        subtitulo: 'Previsão de entrega',
        rotulo: atrasada ? 'Atrasada' : statusMeta(os.status).label,
        cor: atrasada ? 'vermelho' : corOS(os.status)
      })
    }
  }

  return lista
    .filter(e => !coresOcultas.value.has(e.cor))
    .filter(e => termo.length < 3 || e.busca.includes(termo))
    .sort((a, b) => a.data.getTime() - b.data.getTime())
})

const eventosPorDia = computed(() => {
  const mapa = new Map<string, EventoAgenda[]>()
  for (const e of eventos.value) {
    const k = format(e.data, 'yyyy-MM-dd')
    mapa.set(k, [...(mapa.get(k) ?? []), e])
  }
  return mapa
})

function eventosDoDia(d: Date) {
  return eventosPorDia.value.get(format(d, 'yyyy-MM-dd')) ?? []
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

// ── Drag-and-drop (remarcar otimista) ──
const arrastando = ref<AgendamentoView | null>(null)
const celulaAlvo = ref<string | null>(null)
const setCelulaAlvo = useThrottleFn((key: string | null) => {
  celulaAlvo.value = key
}, 50)

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
  celulaAlvo.value = null
  if (!ag) return

  const atual = new Date(ag.dataHora)
  const nova = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hora, atual.getMinutes())
  if (nova.getTime() === atual.getTime()) return

  if (nova < now.value) {
    toast.add({ title: 'Não permitido', description: 'Não é possível remarcar para um horário no passado.', color: 'error' })
    return
  }

  // Verifica conflito: outro agendamento na mesma célula
  const conflito = (agendamentos.value ?? []).some(
    a => a.id !== ag.id && a.status === 'agendado'
      && isSameDay(new Date(a.dataHora), nova)
      && new Date(a.dataHora).getHours() === nova.getHours()
  )
  if (conflito) {
    toast.add({ title: 'Conflito de horário', description: 'Já existe um agendamento neste horário.', color: 'error' })
    return
  }

  await salvarRemarcacao(ag.id, { dataHora: nova.toISOString() })
}

async function salvarRemarcacao(id: number, body: { dataHora?: string, veiculoId?: number }) {
  const backup = [...(agendamentos.value ?? [])]

  // Atualização otimista
  if (agendamentos.value) {
    agendamentos.value = agendamentos.value.map(ag =>
      ag.id === id ? { ...ag, ...body } as AgendamentoView : ag
    )
  }

  try {
    await $fetch(`/api/unidade/${unidadeId.value}/agenda/${id}`, { method: 'PUT', body })
    toast.add({ title: 'Agendamento remarcado', color: 'success' })
    await refreshAg()
    return true
  } catch (err) {
    agendamentos.value = backup
    toast.add({ title: 'Não foi possível salvar', description: erroMensagem(err), color: 'error' })
    return false
  }
}

// ── Modais ──
const modalNovoRef = ref<InstanceType<typeof AgendaModalNovo>>()
const modalDetalheRef = ref<InstanceType<typeof AgendaModalDetalhe>>()
const selecionado = ref<AgendamentoView | null>(null)

function abrirNovo(base?: Date) {
  modalNovoRef.value?.abrir(base)
  if (!clientes.value?.length) void fetchClientes()
  if (!veiculos.value?.length) void fetchVeiculos()
}

function abrirDetalhe(ag: AgendamentoView) {
  selecionado.value = ag
  modalDetalheRef.value?.abrir(ag)
  if (!veiculos.value?.length) void fetchVeiculos()
}
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
        <!-- Toolbar -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="outline"
              aria-label="Anterior"
              @click="navegar(-1)"
            />

            <!-- UCalendar popover para salto rápido -->
            <UPopover>
              <UButton
                :label="titulo"
                color="neutral"
                variant="ghost"
                trailing-icon="i-lucide-calendar-days"
                class="min-w-48 justify-center text-sm font-semibold sm:text-base"
              />
              <template #content>
                <UCalendar v-model="dataCalendario" class="p-2" />
              </template>
            </UPopover>

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
              @click="irParaHoje()"
            />
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UInput
              v-model="buscaDigitada"
              icon="i-lucide-search"
              placeholder="Buscar por cliente, placa ou serviço..."
              class="min-w-64"
              clearable
            />
            <UTabs
              :model-value="visao"
              :items="visoes"
              :content="false"
              variant="pill"
              size="sm"
              @update:model-value="(v: any) => visao = v as Visao"
            />
          </div>
        </div>

        <!-- Legenda clicável (filtro) -->
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <button
            v-for="l in LEGENDA"
            :key="l.cor"
            type="button"
            class="flex items-center gap-1.5 rounded-full px-2 py-1 transition-opacity"
            :class="coresOcultas.has(l.cor) ? 'opacity-40 line-through' : 'hover:bg-elevated/50'"
            @click="alternarCor(l.cor)"
          >
            <span class="size-2.5 rounded-full" :class="COR_CLASSES[l.cor].dot" />
            {{ l.label }}
          </button>
        </div>

        <!-- Erro -->
        <UAlert
          v-if="erroAg"
          color="error"
          variant="subtle"
          title="Não foi possível carregar a agenda"
          :actions="[{ label: 'Tentar novamente', color: 'neutral', variant: 'outline', onClick: recarregar }]"
        />

        <!-- Loading -->
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
              :key="format(d, 'yyyy-MM-dd')"
              type="button"
              class="border-b border-l border-default px-2 py-2 text-center text-xs font-medium hover:bg-elevated/50"
              :class="isSameDay(d, hoje) ? 'text-primary' : 'text-muted'"
              @click="abrirDia(d)"
            >
              {{ DIAS_SEMANA[(d.getDay() + 6) % 7] }} {{ d.getDate() }}
            </button>

            <template v-for="h in HORAS" :key="h">
              <!-- Indicador "agora" -->
              <div
                class="relative border-b border-default px-2 py-1 text-right text-xs"
                :class="isSameDay(hoje, hoje) && horaAtual === h ? 'text-primary font-semibold' : 'text-muted'"
              >
                <span
                  v-if="horaAtual === h"
                  class="absolute left-0 top-1/2 h-px w-4 -translate-y-1/2 bg-primary"
                />
                {{ String(h).padStart(2, '0') }}:00
              </div>
              <!-- Linha "agora" em destaque sutil -->
              <div
                v-for="d in dias"
                :key="`${format(d, 'yyyy-MM-dd')}-${h}`"
                class="group relative flex min-h-16 flex-col gap-1 border-b border-l border-default p-1 transition-colors"
                :class="[
                  celulaAlvo === `${format(d, 'yyyy-MM-dd')}-${h}` ? 'bg-primary/10 ring-1 ring-inset ring-primary/40' : '',
                  isSameDay(d, hoje) && horaAtual === h ? 'bg-primary/[0.03]' : ''
                ]"
                @dragover.prevent="setCelulaAlvo(`${format(d, 'yyyy-MM-dd')}-${h}`)"
                @dragleave="setCelulaAlvo(null)"
                @drop.prevent="setCelulaAlvo(null); soltar(d, h)"
                @dblclick="abrirNovo(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h))"
              >
                <button
                  v-if="!eventosDaCelula(d, h).length"
                  type="button"
                  class="hidden group-hover:flex w-full items-center justify-center rounded-md py-1 text-xs text-muted hover:bg-elevated/50 hover:text-default"
                  @click="abrirNovo(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h))"
                >
                  + Agendar
                </button>
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
                    <UIcon :name="e.tipo === 'agendamento' ? 'i-lucide-calendar' : 'i-lucide-car'" class="mr-1 size-3" />
                    {{ format(e.data, 'HH:mm') }} · {{ e.titulo }}
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
              :key="format(d, 'yyyy-MM-dd')"
              type="button"
              class="flex min-h-24 flex-col items-start gap-2 border-b border-l border-default p-2 text-left hover:bg-elevated/50"
              :class="d.getMonth() === cursor.getMonth() ? '' : 'opacity-40'"
              @click="abrirDia(d)"
            >
              <span class="flex w-full items-center justify-between">
                <span
                  class="text-xs font-medium"
                  :class="isSameDay(d, hoje) ? 'text-primary' : 'text-muted'"
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

        <!-- Vazio -->
        <UEmpty
          v-if="statusAg !== 'pending' && !eventos.length"
          icon="i-lucide-calendar"
          :title="buscaAtiva.trim().length >= 3 || coresOcultas.size ? 'Nenhum resultado' : 'Nenhum agendamento neste período.'"
          :description="buscaAtiva.trim().length >= 3 || coresOcultas.size ? 'Tente outro termo ou ajuste os filtros.' : 'Clique em Agendar para criar o primeiro.'"
          class="py-8"
        />
      </div>

      <AgendaModalNovo
        ref="modalNovoRef"
        :clientes="clientes ?? []"
        :veiculos="veiculos ?? []"
        @criado="refreshAg()"
      />
      <AgendaModalDetalhe
        ref="modalDetalheRef"
        :agendamento="selecionado"
        :veiculos="veiculos ?? []"
        @remarcado="refreshAg()"
        @cancelado="refreshAg()"
        @convertido="() => {}"
      />
    </template>
  </UDashboardPanel>
</template>
