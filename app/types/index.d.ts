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
  id: numbe
  usuarioId: numbe
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
  id: numbe
  unidadeId: numbe
  clienteId: numbe
  tipo: string
  marca: string
  modelo: string
  versao?: string
  placa: string
  anoFabricacao: string | numbe
  anoModelo: string | numbe
  cor?: string
  combustivel?: string
  quilometragem?: numbe
  chassi?: string
  deletedAt?: string
  dataCriacao: string
  dataAtualizacao: string
}

// ═══ Catálogo ═══

export interface ItemCatalogo {
  id: numbe
  unidadeId: numbe
  nome: string
  nomeBusca?: string
  tipo: 'servico' | 'produto'
  sku?: string
  descricao?: string
  preco: numbe
  custo?: numbe
  unidade: string
  dataCriacao: string
  dataAtualizacao: string
}

// ═══ Outros ═══

export interface User {
  id: numbe
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
  variation: numbe
  formatter?: (value: number) => string
}

export interface Sale {
  id: string
  date: string
  status: SaleStatus
  email: string
  amount: numbe
}

export interface Notification {
  id: numbe
  unread?: boolean
  sender: Use
  body: string
  date: string
}

export type Period = 'daily' | 'weekly' | 'monthly'

export interface Range {
  start: Date
  end: Date
}
