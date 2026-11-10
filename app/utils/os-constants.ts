import type { OSView, StatusOS } from '~/composables/useOS'

export interface DocumentoImpressao {
  key: string
  label: string
  titulo: string
}

export interface StatusMeta {
  label: string
  color: 'neutral' | 'info' | 'success' | 'error' | 'warning'
  class?: string
}

export const STATUS_META: Record<StatusOS, StatusMeta> = {
  aberta: { label: 'Aberta', color: 'neutral' },
  em_diagnostico: {
    label: 'Em diagnóstico',
    color: 'neutral',
    class: 'bg-violet-500/10 text-violet-600 ring ring-inset ring-violet-500/25 dark:text-violet-400'
  },
  aguardando_aprovacao: { label: 'Aguardando aprovação', color: 'warning' },
  aprovada: { label: 'Aprovada', color: 'info' },
  em_execucao: { label: 'Em execução', color: 'info' },
  concluida: { label: 'Concluída', color: 'success' },
  entregue: { label: 'Entregue', color: 'neutral' },
  cancelada: { label: 'Cancelada', color: 'error' }
}

export const PAGAMENTO_META = {
  pendente: { label: 'Pendente', color: 'warning' as const },
  parcial: { label: 'Parcial', color: 'info' as const },
  pago: { label: 'Pago', color: 'success' as const }
}

export const ITEM_META = {
  pendente: { label: 'Pendente', color: 'warning' as const },
  aprovado: { label: 'Aprovado', color: 'success' as const },
  recusado: { label: 'Recusado', color: 'error' as const }
}

export const STATUS_LISTA: StatusOS[] = [
  'aberta',
  'em_diagnostico',
  'aguardando_aprovacao',
  'aprovada',
  'em_execucao',
  'concluida',
  'entregue',
  'cancelada'
]

export const RESPONSAVEIS = [
  { label: 'Responsável padrão', value: 1 }
]

export const COMBUSTIVEIS = ['E', '1/4', '2/4', '3/4', 'Cheio'].map(v => ({ label: v, value: v }))

export const TIPO_NOTA: Record<string, { label: string, dot: string }> = {
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

export const TRANSICOES: Partial<Record<StatusOS, { acao: string, label: string, icon: string, sucesso: string }>> = {
  aberta: { acao: 'iniciar_diagnostico', label: 'Iniciar diagnóstico', icon: 'i-lucide-stethoscope', sucesso: 'Diagnóstico iniciado' },
  aprovada: { acao: 'iniciar_execucao', label: 'Iniciar execução', icon: 'i-lucide-wrench', sucesso: 'Execução iniciada' },
  em_execucao: { acao: 'concluir', label: 'Concluir', icon: 'i-lucide-check-check', sucesso: 'OS concluída' },
  concluida: { acao: 'entregar', label: 'Entregar', icon: 'i-lucide-package-check', sucesso: 'OS entregue' }
}

export const STATUS_COM_IMPRESSAO: StatusOS[] = [
  'aguardando_aprovacao',
  'aprovada',
  'em_execucao',
  'concluida',
  'entregue',
  'cancelada'
]

export const STATUS_CANCELAVEIS: StatusOS[] = [
  'aberta',
  'em_diagnostico',
  'aguardando_aprovacao',
  'aprovada',
  'em_execucao'
]

export const OS_TABS = [
  { label: 'Resumo', value: 'resumo', icon: 'i-lucide-clipboard-list' },
  { label: 'Orçamento', value: 'orcamento', icon: 'i-lucide-receipt-text' },
  { label: 'Faturamento', value: 'faturamento', icon: 'i-lucide-wallet' }
]

export type TipoMotivoOS = 'ajustar' | 'recusar' | 'cancelar' | 'reverter'

export const MOTIVO_OS_META: Record<TipoMotivoOS, {
  title: string
  description?: string
  label: string
  confirmLabel: string
  color?: 'primary' | 'error' | 'neutral'
  confirmacao?: string
}> = {
  ajustar: {
    title: 'Ajustar orçamento',
    description: 'A OS volta para Em diagnóstico para edição do orçamento.',
    label: 'Motivo do ajuste',
    confirmLabel: 'Ajustar'
  },
  recusar: {
    title: 'Recusar item',
    label: 'Motivo da recusa',
    confirmLabel: 'Recusar',
    color: 'error'
  },
  cancelar: {
    title: 'Cancelar OS',
    description: 'Esta ação não pode ser desfeita.',
    label: 'Motivo do cancelamento',
    confirmLabel: 'Cancelar OS',
    color: 'error'
  },
  reverter: {
    title: 'Reverter aprovação',
    description: 'Os itens do orçamento principal voltam para pendente e a OS volta para Em diagnóstico.',
    label: 'Motivo da reversão',
    confirmLabel: 'Reverter aprovação',
    color: 'error',
    confirmacao: 'Confirmo a reversão da aprovação desta OS'
  }
}

export function montarDocumentosOS(os: OSView): DocumentoImpressao[] {
  if (!STATUS_COM_IMPRESSAO.includes(os.status)) return []
  const itens = os.itens ?? []
  const lista: DocumentoImpressao[] = []
  if (itens.some(i => i.lote === null || i.lote === undefined)) {
    lista.push({ key: 'principal', label: 'Orçamento Principal', titulo: 'Orçamento' })
  }
  const lotes = [...new Set(itens.filter(i => typeof i.lote === 'number').map(i => i.lote as number))].sort((a, b) => a - b)
  for (const lote of lotes) {
    lista.push({ key: `lote-${lote}`, label: `Complemento [lote ${lote}]`, titulo: `Complemento ${lote}` })
  }
  if (os.status === 'concluida' || os.status === 'entregue') {
    lista.push({ key: 'nota', label: 'Nota de Serviço', titulo: 'Nota de Serviço' })
  }
  return lista
}
