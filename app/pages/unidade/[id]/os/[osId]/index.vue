<script setup lang="ts">
import type { OSView, ItemOSView, StatusOS } from '~/composables/useOS'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const unidadeId = computed(() => route.path.match(/\/unidade\/([^/]+)/)?.[1] ?? String(route.params.id))
const osId = computed(() => String(route.params.osId))
const apiBase = computed(() => `/api/unidade/${unidadeId.value}/os/${osId.value}`)

const {
  PAGAMENTO_META, ITEM_META, RESPONSAVEIS,
  statusMeta, formatarDinheiro, parseCentavos, centavosParaInput, totalItem,
  formatarData, formatarDataHora, erroMensagem
} = useOS()

const { data: os, status, error, refresh } = await useFetch<OSView>(
  () => apiBase.value,
  { watch: [apiBase] }
)

// Tabs
const TABS = ['resumo', 'orcamento', 'faturamento'] as const
const tabs = [
  { label: 'Resumo', value: 'resumo', icon: 'i-lucide-clipboard-list' },
  { label: 'Orçamento', value: 'orcamento', icon: 'i-lucide-receipt-text' },
  { label: 'Faturamento', value: 'faturamento', icon: 'i-lucide-wallet' }
]
const tab = computed<string>({
  get: () => {
    const q = String(route.query.tab || '')
    return (TABS as readonly string[]).includes(q) ? q : 'resumo'
  },
  set: (value) => {
    router.replace({ query: { ...route.query, tab: value } })
  }
})

const statusAtual = computed<StatusOS | undefined>(() => os.value?.status)
const meta = computed(() => statusAtual.value ? statusMeta(statusAtual.value) : undefined)

// Execução de ações
const executando = ref(false)

async function executar(fn: () => Promise<unknown>, sucesso: string) {
  executando.value = true
  try {
    await fn()
    await refresh()
    toast.add({ title: sucesso, color: 'success' })
    return true
  } catch (err) {
    toast.add({
      title: 'Não foi possível salvar',
      description: erroMensagem(err),
      color: 'error'
    })
    return false
  } finally {
    executando.value = false
  }
}

function post(path: string, body?: Record<string, unknown>) {
  return $fetch(`${apiBase.value}${path}`, { method: 'POST', body })
}

// Transições (§5.2)
const TRANSICOES: Partial<Record<StatusOS, { acao: string, label: string, icon: string, sucesso: string }>> = {
  aberta: { acao: 'iniciar_diagnostico', label: 'Iniciar diagnóstico', icon: 'i-lucide-stethoscope', sucesso: 'Diagnóstico iniciado' },
  aprovada: { acao: 'iniciar_execucao', label: 'Iniciar execução', icon: 'i-lucide-wrench', sucesso: 'Execução iniciada' },
  em_execucao: { acao: 'concluir', label: 'Concluir', icon: 'i-lucide-check-check', sucesso: 'OS concluída' },
  concluida: { acao: 'entregar', label: 'Entregar', icon: 'i-lucide-package-check', sucesso: 'OS entregue' }
}
const transicao = computed(() => statusAtual.value ? TRANSICOES[statusAtual.value] : undefined)

const STATUS_COM_IMPRESSAO: StatusOS[] = [
  'aguardando_aprovacao', 'aprovada', 'em_execucao', 'concluida', 'entregue', 'cancelada'
]
const podeImprimir = computed(() => Boolean(statusAtual.value && STATUS_COM_IMPRESSAO.includes(statusAtual.value)))

function imprimir() {
  toast.add({ title: 'Impressão disponível em breve', color: 'neutral' })
}

const STATUS_CANCELAVEIS: StatusOS[] = ['aberta', 'em_diagnostico', 'aguardando_aprovacao', 'aprovada', 'em_execucao']

const modalCancelar = ref(false)
const modalReverter = ref(false)
const modalAjustar = ref(false)
const modalRecusar = ref(false)
const modalEnviar = ref(false)
const modalItem = ref(false)
const enviandoComplementos = ref(false)
const itemRecusando = ref<ItemOSView | undefined>()

const menuGerenciar = computed(() => {
  const itens = []
  if (statusAtual.value === 'aprovada') {
    itens.push({
      label: 'Reverter aprovação',
      icon: 'i-lucide-undo-2',
      onSelect: () => { modalReverter.value = true }
    })
  }
  if (statusAtual.value && STATUS_CANCELAVEIS.includes(statusAtual.value)) {
    itens.push({
      label: 'Cancelar OS',
      icon: 'i-lucide-ban',
      color: 'error' as const,
      onSelect: () => { modalCancelar.value = true }
    })
  }
  if (statusAtual.value === 'aberta') {
    itens.push({
      label: 'Apagar OS',
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect: apagarOS
    })
  }
  return [itens]
})

function transicionar(acao: string, sucesso: string, motivo?: string) {
  return executar(() => post('/transicionar', { acao, ...(motivo ? { motivo } : {}) }), sucesso)
}

async function apagarOS() {
  if (!window.confirm(`Deseja realmente apagar a OS #${os.value?.numero}?`)) return
  try {
    await $fetch(apiBase.value, { method: 'DELETE' })
    toast.add({ title: 'OS apagada', color: 'success' })
    await navigateTo(`/unidade/${unidadeId.value}/os`)
  } catch (err) {
    toast.add({ title: 'Não foi possível salvar', description: erroMensagem(err), color: 'error' })
  }
}

async function confirmarCancelar(motivo: string) {
  if (await transicionar('cancelar', 'OS cancelada', motivo)) modalCancelar.value = false
}

async function confirmarReverter(motivo: string) {
  if (await transicionar('reverter_aprovacao', 'Aprovação revertida', motivo)) modalReverter.value = false
}

async function confirmarAjustar(motivo: string) {
  if (await executar(() => post('/ajustar', { motivo }), 'Orçamento reaberto para ajuste')) modalAjustar.value = false
}

async function confirmarRecusar(motivo: string) {
  const item = itemRecusando.value
  if (!item) return
  if (await executar(() => post(`/itens/${item.id}/recusar`, { motivo }), 'Item recusado')) {
    modalRecusar.value = false
  }
}

function abrirRecusar(item: ItemOSView) {
  itemRecusando.value = item
  modalRecusar.value = true
}

function aprovarItem(item: ItemOSView) {
  return executar(() => post(`/itens/${item.id}/aprovar`), 'Item aprovado')
}

async function aprovarTodos() {
  if (!window.confirm(`Aprovar todos os itens pendentes (${formatarDinheiro(subtotalOrcamento.value)})?`)) return
  await executar(() => post('/aprovar-todos'), 'Itens aprovados')
}

async function removerItem(item: ItemOSView) {
  if (!window.confirm(`Remover "${item.nome}" da OS?`)) return
  await executar(
    () => $fetch(`${apiBase.value}/itens/${item.id}`, { method: 'DELETE' }),
    'Item removido'
  )
}

async function adicionarItem(payload: Record<string, unknown>) {
  if (await executar(() => post('/itens', payload), 'Item adicionado')) modalItem.value = false
}

async function enviarOrcamento(canal: 'impressao' | 'imagem') {
  const body: Record<string, unknown> = { canal }
  if (enviandoComplementos.value) {
    body.itensIds = complementosPendentes.value.map(i => i.id)
  }
  if (await executar(() => post('/enviar-orcamento', body), enviandoComplementos.value ? 'Complementos enviados' : 'Orçamento enviado')) {
    modalEnviar.value = false
  }
}

function abrirEnviar(complementos: boolean) {
  enviandoComplementos.value = complementos
  modalEnviar.value = true
}

// Edição inline (PUT direto)
const salvandoCampo = ref(false)
const refQueixa = ref<{ fechar: () => void } | null>(null)
const refDiagnostico = ref<{ fechar: () => void } | null>(null)
const refAvarias = ref<{ fechar: () => void } | null>(null)

async function salvarCampo(campo: 'queixa' | 'diagnostico' | 'avarias', valor: string, el: { fechar: () => void } | null) {
  salvandoCampo.value = true
  const ok = await executar(
    () => $fetch(apiBase.value, { method: 'PUT', body: { [campo]: valor } }),
    'OS atualizada'
  )
  salvandoCampo.value = false
  if (ok) el?.fechar()
}

const edicaoPermitida = computed(() => statusAtual.value !== 'cancelada' && statusAtual.value !== 'entregue')

// Orçamento
const itens = computed(() => os.value?.itens ?? [])
const itensPrincipal = computed(() => itens.value.filter(i => i.lote === null || i.lote === undefined))
const lotes = computed(() =>
  [...new Set(itens.value.filter(i => typeof i.lote === 'number').map(i => i.lote as number))].sort((a, b) => a - b)
)
const itensDoLote = (lote: number) => itens.value.filter(i => i.lote === lote)

const complementosPendentes = computed(() =>
  itens.value.filter(i => typeof i.lote === 'number' && i.status === 'pendente' && !i.enviado)
)

const subtotalOrcamento = computed(() =>
  itens.value
    .filter(i => i.status !== 'recusado')
    .reduce((soma, i) => soma + totalItem(i), 0)
)
const descontoOrcamento = computed(() => os.value?.desconto || 0)
const totalOrcamento = computed(() => Math.max(0, subtotalOrcamento.value - descontoOrcamento.value))

const descontoEditavel = computed(() =>
  statusAtual.value === 'em_diagnostico' || statusAtual.value === 'aguardando_aprovacao'
)
const descontoInput = ref('0,00')
watch(() => os.value?.desconto, (v) => {
  descontoInput.value = centavosParaInput(v)
}, { immediate: true })

function salvarDesconto() {
  return executar(
    () => $fetch(`${apiBase.value}/desconto`, { method: 'PUT', body: { desconto: parseCentavos(descontoInput.value) } }),
    'Desconto atualizado'
  )
}

const podeAdicionarItem = computed(() => statusAtual.value === 'em_diagnostico' || statusAtual.value === 'em_execucao')
const podeEnviarOrcamento = computed(() => statusAtual.value === 'em_diagnostico')
const podeAjustar = computed(() => statusAtual.value === 'aguardando_aprovacao')
const podeAprovarTodos = computed(() => statusAtual.value === 'aguardando_aprovacao')
const podeEnviarComplementos = computed(() => statusAtual.value === 'em_execucao' && complementosPendentes.value.length > 0)

function podeDecidir(item: ItemOSView) {
  if (item.status !== 'pendente') return false
  if (statusAtual.value === 'aguardando_aprovacao') return item.lote === null || item.lote === undefined
  return statusAtual.value === 'em_execucao'
}

function podeEditar(item: ItemOSView) {
  if (item.status !== 'pendente') return false
  if (statusAtual.value !== 'em_diagnostico' && statusAtual.value !== 'em_execucao') return false
  return true
}

// Resumo
const responsavel = computed(() =>
  RESPONSAVEIS.find(r => r.value === os.value?.funcionarioId)?.label || (os.value ? `Responsável #${os.value.funcionarioId}` : '')
)
const veiculoNome = computed(() =>
  [os.value?.veiculoMarca, os.value?.veiculoModelo].filter(Boolean).join(' ') || 'Veículo'
)

// Histórico
const historico = computed(() =>
  [...(os.value?.notas ?? [])].sort((a, b) => {
    const diff = new Date(b.data).getTime() - new Date(a.data).getTime()
    return diff !== 0 ? diff : b.id - a.id
  })
)

const TIPO_NOTA: Record<string, { label: string, dot: string }> = {
  item_add: { label: 'Item adicionado', dot: 'bg-info' },
  item_edit: { label: 'Item editado', dot: 'bg-info' },
  item_remove: { label: 'Item removido', dot: 'bg-error' },
  item_approve: { label: 'Item aprovado', dot: 'bg-success' },
  item_reject: { label: 'Item recusado', dot: 'bg-error' },
  envio: { label: 'Envio', dot: 'bg-primary' },
  ajuste: { label: 'Ajuste', dot: 'bg-warning' },
  reversao: { label: 'Reversão', dot: 'bg-warning' },
  cancelar: { label: 'Cancelamento', dot: 'bg-error' },
  pagamento: { label: 'Pagamento', dot: 'bg-success' },
  transicao: { label: 'Transição', dot: 'bg-muted' },
  estoque: { label: 'Estoque', dot: 'bg-muted' }
}
</script>

<template>
  <UDashboardPanel id="os-detalhe">
    <template #header>
      <UDashboardNavbar :title="os ? `OS #${os.numero}` : 'OS'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template v-if="os" #right>
          <UButton
            v-if="transicao"
            :label="transicao.label"
            :icon="transicao.icon"
            :loading="executando"
            @click="transicionar(transicao.acao, transicao.sucesso)"
          />
          <UButton
            v-if="podeImprimir"
            label="Imprimir"
            icon="i-lucide-printer"
            color="neutral"
            variant="outline"
            @click="imprimir"
          />
          <UDropdownMenu
            v-if="menuGerenciar[0]!.length"
            :items="menuGerenciar"
            :content="{ align: 'end' }"
          >
            <UButton
              label="Gerenciar"
              icon="i-lucide-settings"
              color="neutral"
              variant="outline"
            />
          </UDropdownMenu>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-3xl">
        <USkeleton v-if="status === 'pending' && !os" class="h-96 rounded-xl" />

        <UEmpty
          v-else-if="error || !os"
          icon="i-lucide-circle-alert"
          title="OS não encontrada"
          description="Não foi possível carregar esta ordem de serviço."
          :actions="[
            { label: 'Voltar', color: 'neutral', variant: 'outline', to: `/unidade/${unidadeId}/os` },
            { label: 'Tentar novamente', onClick: () => refresh() }
          ]"
        />

        <template v-else>
          <div class="mb-4 flex items-center gap-2">
            <UBadge
              :label="meta?.label"
              :color="meta?.color"
              :class="meta?.class"
              variant="subtle"
            />
            <UBadge
              v-if="os.tipo === 'garantia'"
              label="Garantia"
              color="info"
              variant="subtle"
            />
          </div>

          <UTabs
            v-model="tab"
            :items="tabs"
            variant="pill"
            :content="false"
            class="mb-4 sm:mb-6"
          />

          <!-- Resumo -->
          <div v-if="tab === 'resumo'" class="space-y-4">
            <UPageCard variant="subtle">
              <div class="flex flex-wrap items-center gap-3">
                <UAvatar icon="i-lucide-car" size="lg" />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-highlighted truncate">
                    {{ veiculoNome }}
                  </p>
                  <p class="text-sm text-muted tabular-nums">
                    {{ os.veiculoPlaca || 'Não informado' }}
                  </p>
                </div>
                <UBadge
                  v-if="os.tipo === 'garantia'"
                  label="Garantia"
                  color="info"
                  variant="subtle"
                />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DashboardDataField label="Cliente" :value="os.clienteNome" />
                <DashboardDataField label="Responsável" :value="responsavel" />
              </div>
              <div class="grid grid-cols-2 gap-4">
                <DashboardDataField label="Quilometragem" :value="os.quilometragem !== undefined ? `${os.quilometragem} km` : undefined" />
                <DashboardDataField label="Combustível" :value="os.combustivel" />
                <DashboardDataField label="Data de entrada" :value="formatarData(os.dataEntrada)" />
                <DashboardDataField label="Previsão de entrega" :value="formatarData(os.previsaoEntrega)" />
              </div>
            </UPageCard>

            <OsCampoEditavel
              ref="refQueixa"
              titulo="Queixa"
              :valor="os.queixa"
              :editavel="edicaoPermitida"
              :salvando="salvandoCampo"
              obrigatorio
              placeholder="Queixa do cliente"
              @salvar="v => salvarCampo('queixa', v, refQueixa)"
            />
            <OsCampoEditavel
              ref="refDiagnostico"
              titulo="Diagnóstico"
              :valor="os.diagnostico"
              :editavel="edicaoPermitida"
              :salvando="salvandoCampo"
              placeholder="Diagnóstico do mecânico"
              @salvar="v => salvarCampo('diagnostico', v, refDiagnostico)"
            />
            <OsCampoEditavel
              ref="refAvarias"
              titulo="Avarias"
              :valor="os.avarias"
              :editavel="edicaoPermitida"
              :salvando="salvandoCampo"
              placeholder="Avarias na entrada"
              @salvar="v => salvarCampo('avarias', v, refAvarias)"
            />
          </div>

          <!-- Orçamento -->
          <div v-else-if="tab === 'orcamento'">
            <DashboardSectionHeader title="Orçamento" description="Itens, complementos e totais.">
              <div class="flex flex-wrap justify-end gap-2">
                <UButton
                  v-if="podeAdicionarItem"
                  :label="statusAtual === 'em_execucao' ? 'Adicionar complemento' : 'Adicionar item'"
                  icon="i-lucide-plus"
                  @click="modalItem = true"
                />
                <UButton
                  v-if="podeEnviarOrcamento"
                  label="Enviar orçamento"
                  icon="i-lucide-send"
                  color="neutral"
                  variant="outline"
                  :disabled="!itens.length"
                  @click="abrirEnviar(false)"
                />
                <UButton
                  v-if="podeEnviarComplementos"
                  label="Enviar complementos"
                  icon="i-lucide-send"
                  color="neutral"
                  variant="outline"
                  @click="abrirEnviar(true)"
                />
                <UButton
                  v-if="podeAjustar"
                  label="Ajustar"
                  icon="i-lucide-pencil-ruler"
                  color="neutral"
                  variant="outline"
                  @click="modalAjustar = true"
                />
                <UButton
                  v-if="podeAprovarTodos"
                  label="Aprovar todos"
                  icon="i-lucide-check-check"
                  @click="aprovarTodos"
                />
              </div>
            </DashboardSectionHeader>

            <UEmpty
              v-if="!itens.length"
              icon="i-lucide-receipt-text"
              title="Nenhum item no orçamento"
              description="Adicione serviços e produtos para montar o orçamento."
              class="py-8"
            />

            <template v-else>
              <UPageCard
                v-for="grupo in [{ titulo: 'Orçamento principal', itens: itensPrincipal }, ...lotes.map(l => ({ titulo: `Complemento ${l}`, itens: itensDoLote(l) }))]"
                :key="grupo.titulo"
                :title="grupo.titulo"
                variant="subtle"
                class="mb-4"
              >
                <p v-if="!grupo.itens.length" class="text-sm text-muted">
                  Sem itens.
                </p>
                <ul v-else class="divide-y divide-default">
                  <li
                    v-for="item in grupo.itens"
                    :key="item.id"
                    class="flex flex-wrap items-center gap-3 py-3"
                  >
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-highlighted truncate">
                        {{ item.nome }}
                      </p>
                      <p class="text-xs text-muted">
                        {{ item.tipo === 'servico' ? 'Serviço' : 'Produto' }}
                        · {{ item.quantidade }}{{ item.unidade ? ` ${item.unidade}` : '' }}
                        × {{ formatarDinheiro(item.precoUnitario) }}
                      </p>
                      <p v-if="item.status === 'recusado' && item.motivoRecusa" class="text-xs text-muted">
                        Motivo: {{ item.motivoRecusa }}
                      </p>
                    </div>
                    <span
                      v-if="item.status === 'pendente' && item.enviado"
                      class="text-xs text-primary"
                    >● enviado</span>
                    <UBadge
                      :label="ITEM_META[item.status].label"
                      :color="ITEM_META[item.status].color"
                      variant="subtle"
                    />
                    <span class="w-24 text-right text-sm font-medium tabular-nums">
                      {{ formatarDinheiro(totalItem(item)) }}
                    </span>
                    <div class="flex gap-1">
                      <template v-if="podeDecidir(item)">
                        <UButton
                          icon="i-lucide-check"
                          color="success"
                          variant="ghost"
                          size="sm"
                          aria-label="Aprovar item"
                          @click="aprovarItem(item)"
                        />
                        <UButton
                          icon="i-lucide-x"
                          color="error"
                          variant="ghost"
                          size="sm"
                          aria-label="Recusar item"
                          @click="abrirRecusar(item)"
                        />
                      </template>
                      <UButton
                        v-if="podeEditar(item) && !(item.enviado && statusAtual === 'aguardando_aprovacao')"
                        icon="i-lucide-trash-2"
                        color="error"
                        variant="ghost"
                        size="sm"
                        aria-label="Remover item"
                        @click="removerItem(item)"
                      />
                    </div>
                  </li>
                </ul>
              </UPageCard>

              <UPageCard title="Totais" variant="subtle">
                <dl class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <dt class="text-muted">
                      Subtotal
                    </dt>
                    <dd class="tabular-nums">
                      {{ formatarDinheiro(subtotalOrcamento) }}
                    </dd>
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <dt class="text-muted">
                      Desconto
                    </dt>
                    <dd v-if="descontoEditavel" class="flex items-center gap-2">
                      <UInput
                        v-model="descontoInput"
                        inputmode="decimal"
                        size="sm"
                        class="w-32"
                      >
                        <template #leading>
                          <span class="text-xs text-muted">R$</span>
                        </template>
                      </UInput>
                      <UButton
                        label="Aplicar"
                        size="sm"
                        color="neutral"
                        variant="outline"
                        :loading="executando"
                        @click="salvarDesconto"
                      />
                    </dd>
                    <dd v-else class="tabular-nums">
                      − {{ formatarDinheiro(descontoOrcamento) }}
                    </dd>
                  </div>
                  <div class="flex justify-between border-t border-default pt-2 font-semibold text-highlighted">
                    <dt>Total</dt>
                    <dd class="tabular-nums">
                      {{ formatarDinheiro(totalOrcamento) }}
                    </dd>
                  </div>
                </dl>
              </UPageCard>
            </template>
          </div>

          <!-- Faturamento -->
          <div v-else>
            <DashboardSectionHeader title="Faturamento" description="Posição financeira da OS.">
              <div class="flex justify-end">
                <UBadge
                  v-if="os.faturamento.badge"
                  :label="PAGAMENTO_META[os.faturamento.badge].label"
                  :color="PAGAMENTO_META[os.faturamento.badge].color"
                  variant="subtle"
                />
              </div>
            </DashboardSectionHeader>

            <UPageCard variant="subtle" class="mb-4">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <DashboardDataField label="Total aprovado" :value="formatarDinheiro(os.faturamento.total)" />
                <DashboardDataField label="Total pago" :value="formatarDinheiro(os.faturamento.pago)" />
                <DashboardDataField label="Saldo" :value="formatarDinheiro(os.faturamento.saldo)" />
              </div>
            </UPageCard>

            <UPageCard title="Lançamentos" variant="subtle">
              <UEmpty
                v-if="!os.faturamento.lancamentos.length"
                icon="i-lucide-wallet"
                title="Nenhum lançamento"
                description="Os pagamentos desta OS aparecerão aqui."
                class="py-8"
              />
              <ul v-else class="divide-y divide-default">
                <li
                  v-for="l in os.faturamento.lancamentos"
                  :key="l.id"
                  class="flex flex-wrap items-center gap-3 py-3 text-sm"
                >
                  <span class="w-24 text-muted">{{ formatarData(l.data) }}</span>
                  <UBadge
                    :label="l.tipo === 'entrada' ? 'Entrada' : 'Saída'"
                    :color="l.tipo === 'entrada' ? 'success' : 'error'"
                    variant="subtle"
                  />
                  <span class="flex-1 capitalize">{{ l.modalidade }} · {{ l.categoria }}</span>
                  <span class="font-medium tabular-nums">{{ formatarDinheiro(l.valor) }}</span>
                </li>
              </ul>
            </UPageCard>
          </div>

          <!-- Histórico -->
          <UPageCard title="Histórico" variant="subtle" class="mt-4 sm:mt-6">
            <div class="max-h-[120px] overflow-y-auto">
              <p v-if="!historico.length" class="text-sm text-muted">
                Sem registros.
              </p>
              <ul v-else class="space-y-1.5">
                <li
                  v-for="nota in historico"
                  :key="nota.id"
                  class="flex items-start gap-2 text-xs"
                >
                  <span
                    class="mt-1 size-2 shrink-0 rounded-full"
                    :class="TIPO_NOTA[nota.tipo]?.dot || 'bg-muted'"
                  />
                  <span class="font-medium text-highlighted">{{ TIPO_NOTA[nota.tipo]?.label || nota.tipo }}</span>
                  <span class="text-muted">{{ formatarDataHora(nota.data) }}</span>
                  <span class="text-muted">{{ nota.role }}</span>
                  <span class="min-w-0 flex-1">{{ nota.texto }}</span>
                </li>
              </ul>
            </div>
          </UPageCard>
        </template>
      </div>

      <OsModalAdicionarItem
        v-model:open="modalItem"
        :unidade-id="unidadeId"
        :loading="executando"
        :complemento="statusAtual === 'em_execucao'"
        @confirm="adicionarItem"
      />
      <OsModalEnviarOrcamento
        v-model:open="modalEnviar"
        :loading="executando"
        :titulo="enviandoComplementos ? 'Enviar complementos' : 'Enviar orçamento'"
        @confirm="enviarOrcamento"
      />
      <OsModalMotivo
        v-model:open="modalAjustar"
        title="Ajustar orçamento"
        description="A OS volta para Em diagnóstico para edição do orçamento."
        label="Motivo do ajuste"
        confirm-label="Ajustar"
        :loading="executando"
        @confirm="confirmarAjustar"
      />
      <OsModalMotivo
        v-model:open="modalRecusar"
        :title="`Recusar ${itemRecusando?.nome || 'item'}`"
        label="Motivo da recusa"
        confirm-label="Recusar"
        color="error"
        :loading="executando"
        @confirm="confirmarRecusar"
      />
      <OsModalMotivo
        v-model:open="modalCancelar"
        title="Cancelar OS"
        description="Esta ação não pode ser desfeita."
        label="Motivo do cancelamento"
        confirm-label="Cancelar OS"
        color="error"
        :loading="executando"
        @confirm="confirmarCancelar"
      />
      <OsModalMotivo
        v-model:open="modalReverter"
        title="Reverter aprovação"
        description="Os itens do orçamento principal voltam para pendente e a OS volta para Em diagnóstico."
        label="Motivo da reversão"
        confirm-label="Reverter aprovação"
        color="error"
        confirmacao="Confirmo a reversão da aprovação desta OS"
        :loading="executando"
        @confirm="confirmarReverter"
      />
    </template>
  </UDashboardPanel>
</template>
