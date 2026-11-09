import type { AvatarProps } from '@nuxt/ui'

export type UserStatus = 'subscribed' | 'unsubscribed' | 'bounced'
export type SaleStatus = 'paid' | 'failed' | 'refunded'

// ═══ Cliente ═══

export interface Endereco {
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
}

export interface Cliente {
  id: number
  usuarioId: number
  nome: string
  nomeBusca?: string
  tipoPessoa: 'fisica' | 'juridica'
  cpf?: string
  razaoSocial?: string
  nomeFantasia?: string
  cnpj?: string
  telefone?: string
  email?: string
  endereco?: Endereco
  deletedAt?: string
  dataCriacao: string
  dataAtualizacao: string
}

// ═══ Veículo ═══

export interface Veiculo {
  id: number
  unidadeId: number
  clienteId: number
  tipo: string
  marca: string
  modelo: string
  versao?: string
  placa: string
  anoFabricacao: string | number
  anoModelo: string | number
  cor?: string
  combustivel?: string
  quilometragem?: number
  chassi?: string
  deletedAt?: string
  dataCriacao: string
  dataAtualizacao: string
}

// ═══ Catálogo ═══

export interface ItemCatalogo {
  id: number
  unidadeId: number
  nome: string
  nomeBusca?: string
  tipo: 'servico' | 'produto'
  sku?: string
  descricao?: string
  preco: number
  custo?: number
  unidade: string
  dataCriacao: string
  dataAtualizacao: string
}

// ═══ Estoque ═══

export interface ItemEstoque {
  id: number
  unidadeId: number
  catalogoId: number
  nome?: string
  nomeBusca?: string
  sku?: string
  unidade?: string
  quantidadeAtual: number
  quantidadeMinima?: number
  dataCriacao: string
  dataAtualizacao: string
}

export interface MovimentoEstoque {
  id: number
  unidadeId: number
  estoqueId?: number
  catalogoId?: number
  nome: string
  tipo: 'entrada' | 'saida' | 'entrada_inicial'
  quantidade: number
  origem: 'manual' | 'os_baixa' | 'os_estorno' | 'venda_baixa'
  documentoId?: number
  documentoTipo?: 'os' | 'venda'
  itemOsId?: number
  saldoApos: number
  observacao?: string
  usuarioId: number
  data: string
}

export interface ItemEstoqueListagem extends ItemEstoque {
  nome: string
  nomeBusca?: string
  tipo: 'produto'
  sku?: string
  descricao?: string
  preco: number
  custo?: number
  unidade: string
  repor: boolean
  estoqueNegativo: boolean
}

export interface ItemEstoqueDetalhe extends ItemEstoqueListagem {
  movimentos: MovimentoEstoque[]
}

// ═══ Carteiras ═══

export interface Carteira {
  id: number
  unidadeId: number
  tipo: 'banco' | 'cofre'
  nome: string
  nomeBusca?: string
  saldoInicial: number
  saldo?: number
  ativa: boolean
  dataCriacao: string
  dataAtualizacao?: string
}

// ═══ Caixa ═══

export interface Caixa {
  id: number
  unidadeId: number
  nome: string
  nomeBusca?: string
  ativo: boolean
  dataCriacao: string
  dataAtualizacao?: string
}

export interface CaixaUsuario {
  id: number
  unidadeId: number
  caixaId: number
  usuarioUnidadeId: number
  ativo: boolean
}

export interface SessaoCaixa {
  id: number
  unidadeId: number
  caixaId: number
  status: 'aberta' | 'fechada'
  abertaEm: string
  abertaPorUsuarioId: number
  responsavelNome?: string
  valorAbertura: number
  carteiraOrigemId?: number
  carteiraOrigemNome?: string
  fechadaEm?: string
  fechadaPorUsuarioId?: number
  saldoEsperadoFechamento?: number
  valorContado?: number
  diferenca?: number
  motivoFechamento?: string
  carteiraDestinoId?: number
  carteiraDestinoNome?: string
  saldoEsperado?: number
  lancamentos?: LancamentoCaixa[]
}

export interface LancamentoCaixa {
  id: number
  unidadeId: number
  tipo: 'entrada' | 'saida'
  carteiraId?: number
  sessaoCaixaId?: number
  valor: number
  data: string
  documentoId?: number
  documentoTipo?: 'os' | 'venda'
  modalidade: 'dinheiro' | 'pix' | 'credito' | 'debito' | 'boleto' | 'transferencia'
  categoria: string
  parId?: number
  estornoDe?: number
  observacao?: string
  criadoPorUsuarioId: number
  dataCriacao: string
}

export interface CaixaComEstado extends Caixa {
  status: 'aberto' | 'fechado'
  statusSessao: 'aberta' | 'fechada'
  aberta: boolean
  sessaoAberta: SessaoCaixa | null
  sessaoCaixaId: number | null
  responsavelId: number | null
  responsavel: string | null
  responsavelNome: string | null
  saldoEsperado: number
  valorAbertura: number
  lancamentosSessao: LancamentoCaixa[]
}

// ═══ Outros ═══

export interface User {
  id: number
  name: string
  email: string
  avatar?: AvatarProps
  status: UserStatus
  location: string
}

export interface Member {
  name: string
  username: string
  role: 'member' | 'owner'
  avatar: AvatarProps
}

export interface Stat {
  title: string
  icon: string
  value: number | string
  variation: number
  formatter?: (value: number) => string
}

export interface Sale {
  id: string
  date: string
  status: SaleStatus
  email: string
  amount: number
}

export interface Notification {
  id: number
  unread?: boolean
  sender: User
  body: string
  date: string
}

export type Period = 'daily' | 'weekly' | 'monthly'

export interface Range {
  start: Date
  end: Date
}
