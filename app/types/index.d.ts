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
  quilometragem?: string | number
  chassi?: string
}

// ═══ Catálogo ═══

export interface ItemCatalogo {
  id: number
  nome: string
  tipo: 'servico' | 'produto'
  descricao?: string
  preco: number
  custo?: number
  unidade: string
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
