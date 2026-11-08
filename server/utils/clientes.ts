import * as z from 'zod'

export function stripAccents(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function somenteNumeros(valor: string) {
  return valor.replace(/\D/g, '')
}

export const enderecoSchema = z.object({
  cep: z.string().trim().optional().default(''),
  logradouro: z.string().trim().optional().default(''),
  numero: z.string().trim().optional().default(''),
  complemento: z.string().trim().optional().default(''),
  bairro: z.string().trim().optional().default(''),
  cidade: z.string().trim().optional().default(''),
  estado: z.string().trim().optional().default('')
})

export const clienteSchema = z.object({
  usuarioId: z.coerce.number().int().positive().default(1),
  tipoPessoa: z.enum(['fisica', 'juridica']),
  // Nome usado na listagem: nome completo (PF) ou nome fantasia/razão social (PJ).
  nome: z.string().trim().min(1, 'Informe o nome do cliente'),
  nomeBusca: z.string().trim().optional(),
  cpf: z.string().trim().optional().default(''),
  razaoSocial: z.string().trim().optional().default(''),
  nomeFantasia: z.string().trim().optional().default(''),
  cnpj: z.string().trim().optional().default(''),
  telefone: z.string().trim().min(8, 'Informe um telefone válido'),
  email: z.string().trim().email('E-mail inválido').or(z.literal('')).default(''),
  endereco: enderecoSchema.default({
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: ''
  }),
  deletedAt: z.string().optional(),
  dataCriacao: z.string().optional(),
  dataAtualizacao: z.string().optional()
}).superRefine((cliente, ctx) => {
  if (cliente.tipoPessoa === 'fisica') {
    if (!cliente.cpf.trim()) {
      ctx.addIssue({ code: 'custom', path: ['cpf'], message: 'Informe o CPF' })
    }
  } else {
    if (!cliente.razaoSocial.trim()) {
      ctx.addIssue({ code: 'custom', path: ['razaoSocial'], message: 'Informe a razão social' })
    }
    if (!cliente.cnpj.trim()) {
      ctx.addIssue({ code: 'custom', path: ['cnpj'], message: 'Informe o CNPJ' })
    }
  }
}).transform(cliente => ({
  ...cliente,
  nomeBusca: stripAccents(cliente.nome).toLowerCase()
}))

export type ClienteCadastro = z.output<typeof clienteSchema>

export type Cliente = Omit<ClienteCadastro, 'dataCriacao' | 'dataAtualizacao'> & {
  id: number
  unidadeId: number
  dataCriacao: string
  dataAtualizacao: string
  [key: string]: unknown
}

export interface VeiculoVinculo {
  id: number
  unidadeId: number
  clienteId: number
  deletedAt?: string
  [key: string]: unknown
}
