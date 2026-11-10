import type { LancamentoCaixa } from '../caixa'

export const STATUS_OS = [
  'aberta',
  'em_diagnostico',
  'aguardando_aprovacao',
  'aprovada',
  'em_execucao',
  'concluida',
  'entregue',
  'cancelada'
] as const

export type StatusOS = (typeof STATUS_OS)[number]

export const STATUS_ITEM_OS = ['pendente', 'aprovado', 'recusado'] as const
export type StatusItemOS = (typeof STATUS_ITEM_OS)[number]

export const TIPOS_NOTA = [
  'item_add',
  'item_edit',
  'item_remove',
  'item_approve',
  'item_reject',
  'envio',
  'ajuste',
  'reversao',
  'cancelar',
  'pagamento',
  'transicao',
  'estoque'
] as const

export type TipoNota = (typeof TIPOS_NOTA)[number]

export const ROLES_VALIDOS = ['owner', 'admin', 'gerente', 'mecanico', 'recepcionista'] as const
export type RoleUsuario = (typeof ROLES_VALIDOS)[number]

export const ACOES_TRANSICAO = [
  'iniciar_diagnostico',
  'iniciar_execucao',
  'concluir',
  'entregar',
  'cancelar',
  'reverter_aprovacao'
] as const

export type AcaoTransicaoOS = (typeof ACOES_TRANSICAO)[number]

export interface ItemOS {
  id: number
  unidadeId: number
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
  dataAprovacao?: string
  dataRecusa?: string
  motivoRecusa?: string
  estoqueBaixado?: boolean
  [key: string]: unknown
}

export interface Nota {
  id: number
  unidadeId: number
  osId: number
  texto: string
  tipo: TipoNota
  role: string
  data: string
  [key: string]: unknown
}

export interface EnvioOrcamento {
  id: number
  osId: number
  unidadeId: number
  canal: 'impressao' | 'imagem' | 'email' | 'link'
  status: 'pendente' | 'enviado' | 'gerado' | 'falhou'
  itensIds: number[]
  solicitadoEm: string
  concluidoEm?: string
  referencia?: string
  erro?: string
  usuarioId: number
  [key: string]: unknown
}

export interface OrdemServico {
  id: number
  unidadeId: number
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
  itens: ItemOS[]
  desconto?: number
  orcamentoEnviado: boolean
  token: string
  notas: Nota[]
  deletedAt?: string
  dataCriacao: string
  dataAtualizacao: string
  dataAprovacao?: string
  dataConclusao?: string
  dataEntrega?: string
  motivoCancelamento?: string
  [key: string]: unknown
}

export interface FaturamentoOS {
  subtotal: number
  desconto: number
  total: number
  pago: number
  saldo: number
  badge: 'pago' | 'parcial' | 'pendente' | null
  lancamentos: LancamentoCaixa[]
}

export interface OrdemServicoDetalhe extends OrdemServico {
  faturamento: FaturamentoOS
  envios: EnvioOrcamento[]
  clienteNome?: string
  clienteCpf?: string
  clienteTelefone?: string
  veiculoPlaca?: string
  veiculoMarca?: string
  veiculoModelo?: string
  veiculoCor?: string
  veiculoAno?: string | number
}

export interface ClienteRecord {
  id: number
  unidadeId: number
  usuarioId?: number
  nome: string
  nomeBusca?: string
  cpf?: string
  cnpj?: string
  telefone?: string
  razaoSocial?: string
  nomeFantasia?: string
  deletedAt?: string
  [key: string]: unknown
}

export interface VeiculoRecord {
  id: number
  unidadeId: number
  clienteId: number
  marca: string
  modelo: string
  versao?: string
  placa: string
  cor?: string
  combustivel?: string
  quilometragem?: number
  anoFabricacao?: string | number
  anoModelo?: string | number
  deletedAt?: string
  [key: string]: unknown
}

export interface UnidadeRecord {
  id: number
  unidadeId: number
  nome?: string
  ativo?: boolean
  nextOsNumber?: number
  nextVendaNumber?: number
  dataCriacao?: string
  [key: string]: unknown
}
