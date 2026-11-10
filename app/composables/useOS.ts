import { formatarDinheiro as formatarMoeda } from '~/utils/dinheiro'
import {
  ITEM_META,
  PAGAMENTO_META,
  RESPONSAVEIS,
  STATUS_LISTA,
  STATUS_META,
  TIPO_NOTA
} from '~/utils/os-constants'

export type StatusOS
  = | 'aberta'
    | 'em_diagnostico'
    | 'aguardando_aprovacao'
    | 'aprovada'
    | 'em_execucao'
    | 'concluida'
    | 'entregue'
    | 'cancelada'

export interface ItemOSView {
  id: number
  osId: number
  catalogoId?: number
  nome: string
  tipo: 'servico' | 'produto'
  unidade?: string
  quantidade: number
  precoUnitario: number
  status: 'pendente' | 'aprovado' | 'recusado'
  lote: number | null
  enviado: boolean
  motivoRecusa?: string
}

export interface NotaView {
  id: number
  texto: string
  tipo: string
  role: string
  data: string
}

export interface LancamentoView {
  id: number
  tipo: 'entrada' | 'saida'
  valor: number
  data: string
  modalidade: string
  categoria: string
}

export interface FaturamentoView {
  subtotal: number
  desconto: number
  total: number
  pago: number
  saldo: number
  badge: 'pago' | 'parcial' | 'pendente' | null
  lancamentos: LancamentoView[]
}

export interface OSView {
  id: number
  numero: string
  tipo: 'normal' | 'garantia'
  osOriginalId?: number
  veiculoId: number
  clienteId: number
  funcionarioId: number
  status: StatusOS
  queixa: string
  diagnostico?: string
  avarias?: string
  combustivel?: string
  quilometragem?: number
  dataEntrada: string
  previsaoEntrega?: string
  desconto?: number
  orcamentoEnviado: boolean
  itens: ItemOSView[]
  notas: NotaView[]
  faturamento: FaturamentoView
  clienteNome?: string
  clienteCpf?: string
  veiculoPlaca?: string
  veiculoMarca?: string
  veiculoModelo?: string
}

export function useOS() {
  function statusMeta(status: StatusOS) {
    return STATUS_META[status] ?? { label: status, color: 'neutral' as const }
  }

  function formatarDinheiro(centavos?: number | null) {
    return formatarMoeda(Math.round(Number(centavos || 0)))
  }

  /** "85,50" | "85" | "1.234,5" → centavos (inteiro, sem float). */
  function parseCentavos(valor: string | number | undefined | null): number {
    if (valor === undefined || valor === null) return 0
    const texto = String(valor).trim().replace(/[^\d,.]/g, '')
    if (!texto) return 0
    const separador = texto.includes(',') ? ',' : '.'
    const partes = texto.split(separador)
    const decimais = partes.length > 1 ? partes.pop()! : ''
    const inteiros = partes.join('').replace(/\D/g, '')
    const centavos = (decimais.replace(/\D/g, '') + '00').slice(0, 2)
    return Number(inteiros || '0') * 100 + Number(centavos)
  }

  function centavosParaInput(centavos?: number | null) {
    const valor = Math.round(Number(centavos || 0))
    const reais = Math.floor(valor / 100)
    const resto = String(valor % 100).padStart(2, '0')
    return `${reais},${resto}`
  }

  function totalItem(item: Pick<ItemOSView, 'quantidade' | 'precoUnitario'>) {
    return Math.round(Number(item.quantidade) * Number(item.precoUnitario))
  }

  function formatarData(iso?: string | null) {
    if (!iso) return ''
    const data = new Date(iso)
    if (Number.isNaN(data.getTime())) return ''
    return data.toLocaleDateString('pt-BR')
  }

  function formatarDataHora(iso?: string | null) {
    if (!iso) return ''
    const data = new Date(iso)
    if (Number.isNaN(data.getTime())) return ''
    return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  }

  function erroMensagem(err: unknown, fallback = 'Verifique os dados e tente novamente.') {
    const e = err as { data?: { statusMessage?: string }, statusMessage?: string }
    return e?.data?.statusMessage || e?.statusMessage || fallback
  }

  return {
    STATUS_LISTA,
    PAGAMENTO_META,
    ITEM_META,
    RESPONSAVEIS,
    TIPO_NOTA,
    statusMeta,
    formatarDinheiro,
    parseCentavos,
    centavosParaInput,
    totalItem,
    formatarData,
    formatarDataHora,
    erroMensagem
  }
}
