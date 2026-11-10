<script setup lang="ts">
import type { ItemOSView, OSView, StatusOS } from '~/composables/useOS'
import { MOTIVO_OS_META, OS_TABS, STATUS_CANCELAVEIS, TRANSICOES, montarDocumentosOS, type TipoMotivoOS } from '~/utils/os-constants'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const unidadeId = computed(() => String(route.params.unidadeId ?? ''))
const osId = computed(() => String(route.params.osId))
const apiBase = computed(() => `/api/unidade/${unidadeId.value}/os/${osId.value}`)
const { statusMeta, formatarDinheiro, erroMensagem } = useOS()
const { config } = useConfig()
const { data: os, status, error, refresh } = await useFetch<OSView>(() => apiBase.value, { watch: [apiBase] })

const tab = computed<string>({
  get: () => OS_TABS.some(t => t.value === String(route.query.tab || '')) ? String(route.query.tab) : 'resumo',
  set: value => router.replace({ query: { ...route.query, tab: value } })
})
const statusAtual = computed<StatusOS | undefined>(() => os.value?.status)
const meta = computed(() => statusAtual.value ? statusMeta(statusAtual.value) : undefined)
const transicao = computed(() => statusAtual.value ? TRANSICOES[statusAtual.value] : undefined)
const edicaoPermitida = computed(() => statusAtual.value !== 'cancelada' && statusAtual.value !== 'entregue')
const documentos = computed(() => os.value ? montarDocumentosOS(os.value) : [])

const executando = ref(false)
const salvandoCampo = ref(false)
const modalItem = ref(false)
const modalEnviar = ref(false)
const modalEditarResumo = ref(false)
const enviandoComplementos = ref(false)
const impressaoRef = ref<{ imprimir: () => void, abrirPreview: (key: string) => void } | null>(null)
const motivoAtivo = ref<{ tipo: TipoMotivoOS, item?: ItemOSView } | null>(null)

const modalMotivoAberto = computed({
  get: () => motivoAtivo.value !== null,
  set: (v: boolean) => { if (!v) motivoAtivo.value = null }
})
const motivoProps = computed(() => {
  const m = motivoAtivo.value
  if (!m) return { title: '', confirmLabel: 'Confirmar', loading: executando.value }
  const base = MOTIVO_OS_META[m.tipo]
  return { ...base, ...(m.tipo === 'recusar' ? { title: `Recusar ${m.item?.nome || 'item'}` } : {}), loading: executando.value }
})
const menuGerenciar = computed(() => [[
  ...(statusAtual.value === 'aprovada' ? [{ label: 'Reverter aprovação', icon: 'i-lucide-undo-2', onSelect: () => { motivoAtivo.value = { tipo: 'reverter' } } }] : []),
  ...(statusAtual.value && STATUS_CANCELAVEIS.includes(statusAtual.value) ? [{ label: 'Cancelar OS', icon: 'i-lucide-ban', color: 'error' as const, onSelect: () => { motivoAtivo.value = { tipo: 'cancelar' } } }] : []),
  ...(statusAtual.value === 'aberta' ? [{ label: 'Apagar OS', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: apagarOS }] : [])
]])

async function executar(fn: () => Promise<unknown>, sucesso: string) {
  executando.value = true
  try {
    await fn()
    await refresh()
    toast.add({ title: sucesso, color: 'success' })
    return true
  } catch (err) {
    toast.add({ title: 'Não foi possível salvar', description: erroMensagem(err), color: 'error' })
    return false
  } finally {
    executando.value = false
  }
}

const post = (path: string, body?: Record<string, unknown>) => $fetch(`${apiBase.value}${path}`, { method: 'POST', body })
const transicionar = (acao: string, sucesso: string, motivo?: string) => executar(() => post('/transicionar', { acao, ...(motivo ? { motivo } : {}) }), sucesso)

async function apagarOS() {
  if (!window.confirm(`Deseja realmente apagar a OS #${os.value?.numero}?`)) return
  executando.value = true
  try {
    await $fetch(apiBase.value, { method: 'DELETE' })
    toast.add({ title: 'OS apagada', color: 'success' })
    await navigateTo(`/unidade/${unidadeId.value}/os`)
  } catch (err) {
    toast.add({ title: 'Não foi possível salvar', description: erroMensagem(err), color: 'error' })
  } finally {
    executando.value = false
  }
}

async function confirmarMotivo(motivo: string) {
  const m = motivoAtivo.value
  if (!m) return
  const acoes: Record<TipoMotivoOS, () => Promise<boolean>> = {
    ajustar: () => executar(() => post('/ajustar', { motivo }), 'Orçamento reaberto para ajuste'),
    recusar: () => m.item ? executar(() => post(`/itens/${m.item?.id}/recusar`, { motivo }), 'Item recusado') : Promise.resolve(false),
    cancelar: () => transicionar('cancelar', 'OS cancelada', motivo),
    reverter: () => transicionar('reverter_aprovacao', 'Aprovação revertida', motivo)
  }
  if (await acoes[m.tipo]()) motivoAtivo.value = null
}

async function aprovarTodos(subtotal: number) {
  if (window.confirm(`Aprovar todos os itens pendentes (${formatarDinheiro(subtotal)})?`)) await executar(() => post('/aprovar-todos'), 'Itens aprovados')
}

async function removerItem(item: ItemOSView) {
  if (window.confirm(`Remover "${item.nome}" da OS?`)) await executar(() => $fetch(`${apiBase.value}/itens/${item.id}`, { method: 'DELETE' }), 'Item removido')
}

async function adicionarItem(payload: Record<string, unknown>) {
  if (await executar(() => post('/itens', payload), 'Item adicionado')) modalItem.value = false
}

async function salvarCampo(campo: 'queixa' | 'diagnostico' | 'avarias', valor: string, fechar: () => void) {
  salvandoCampo.value = true
  const ok = await executar(() => $fetch(apiBase.value, { method: 'PUT', body: { [campo]: valor } }), 'OS atualizada')
  salvandoCampo.value = false
  if (ok) fechar()
}

async function salvarResumo(payload: { clienteId?: number, veiculoId?: number, funcionarioId: number, quilometragem?: string, combustivel?: string, previsaoEntrega?: string }) {
  const body: Record<string, unknown> = { funcionarioId: payload.funcionarioId }
  if (payload.clienteId) body.clienteId = payload.clienteId
  if (payload.veiculoId) body.veiculoId = payload.veiculoId
  if (payload.quilometragem) body.quilometragem = Number(payload.quilometragem)
  if (payload.combustivel) body.combustivel = payload.combustivel
  body.previsaoEntrega = payload.previsaoEntrega ? new Date(`${payload.previsaoEntrega}T00:00:00`).toISOString() : null
  if (await executar(() => $fetch(apiBase.value, { method: 'PUT', body }), 'OS atualizada')) {
    modalEditarResumo.value = false
  }
}

async function enviarOrcamento(canal: 'impressao' | 'imagem') {
  const pendentes = (os.value?.itens ?? []).filter(i => typeof i.lote === 'number' && i.status === 'pendente' && !i.enviado)
  const body = { canal, ...(enviandoComplementos.value ? { itensIds: pendentes.map(i => i.id) } : {}) }
  const lote = enviandoComplementos.value ? pendentes[0]?.lote : undefined
  if (await executar(() => post('/enviar-orcamento', body), enviandoComplementos.value ? 'Complementos enviados' : 'Orçamento enviado')) {
    modalEnviar.value = false
    impressaoRef.value?.abrirPreview(typeof lote === 'number' ? `lote-${lote}` : 'principal')
  }
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
            v-bind="{ label: transicao.label, icon: transicao.icon, loading: executando }"
            @click="transicionar(transicao.acao, transicao.sucesso)"
          />
          <UButton
            v-if="documentos.length"
            v-bind="{ label: 'Imprimir', icon: 'i-lucide-printer', color: 'neutral', variant: 'outline' }"
            @click="impressaoRef?.imprimir()"
          />
          <UDropdownMenu v-if="menuGerenciar[0]!.length" :items="menuGerenciar" :content="{ align: 'end' }">
            <UButton v-bind="{ label: 'Gerenciar', icon: 'i-lucide-settings', color: 'neutral', variant: 'outline', loading: executando }" />
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
          :actions="[{ label: 'Voltar', color: 'neutral', variant: 'outline', to: `/unidade/${unidadeId}/os` }, { label: 'Tentar novamente', loading: status === 'pending', onClick: () => refresh() }]"
        />
        <template v-else>
          <div class="mb-4 flex items-center gap-2">
            <UBadge v-bind="{ label: meta?.label, color: meta?.color, class: meta?.class, variant: 'subtle' }" />
            <UBadge v-if="os.tipo === 'garantia'" v-bind="{ label: 'Garantia', color: 'info', variant: 'subtle' }" />
          </div>
          <UTabs v-model="tab" v-bind="{ items: OS_TABS, variant: 'pill', content: false }" class="mb-4 sm:mb-6" />
          <OsTabResumo
            v-if="tab === 'resumo'"
            v-bind="{ os, edicaoPermitida, salvandoCampo }"
            @salvar-campo="salvarCampo"
            @editar-resumo="modalEditarResumo = true"
          />
          <OsTabOrcamento
            v-else-if="tab === 'orcamento'"
            v-bind="{ os, statusAtual, executando }"
            @abrir-adicionar-item="modalItem = true"
            @abrir-enviar="c => { enviandoComplementos = c; modalEnviar = true }"
            @abrir-ajustar="motivoAtivo = { tipo: 'ajustar' }"
            @aprovar-todos="aprovarTodos"
            @aprovar-item="i => executar(() => post(`/itens/${i.id}/aprovar`), 'Item aprovado')"
            @abrir-recusar="i => { motivoAtivo = { tipo: 'recusar', item: i } }"
            @remover-item="removerItem"
            @salvar-desconto="d => executar(() => $fetch(`${apiBase}/desconto`, { method: 'PUT', body: { desconto: d } }), 'Desconto atualizado')"
          />
          <OsTabFaturamento v-else :faturamento="os.faturamento" />
          <OsHistorico :notas="os.notas" />
        </template>
      </div>

      <OsModalAdicionarItem v-model:open="modalItem" v-bind="{ unidadeId, loading: executando, complemento: statusAtual === 'em_execucao' }" @confirm="adicionarItem" />
      <OsModalEnviarOrcamento v-model:open="modalEnviar" v-bind="{ loading: executando, titulo: enviandoComplementos ? 'Enviar complementos' : 'Enviar orçamento' }" @confirm="enviarOrcamento" />
      <OsImpressao v-if="os" ref="impressaoRef" v-bind="{ os, config, documentos }" />
      <OsModalEditarResumo
        v-if="os"
        v-model:open="modalEditarResumo"
        v-bind="{ os, unidadeId, loading: executando }"
        @confirm="salvarResumo"
      />
      <OsModalMotivo v-model:open="modalMotivoAberto" v-bind="motivoProps" @confirm="confirmarMotivo" />
    </template>
  </UDashboardPanel>
</template>
