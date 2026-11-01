import * as z from 'zod'

const enderecoSchema = z.object({
  cep: z.string().optional().default(''),
  logradouro: z.string().optional().default(''),
  numero: z.string().optional().default(''),
  complemento: z.string().optional().default(''),
  bairro: z.string().optional().default(''),
  cidade: z.string().optional().default(''),
  estado: z.string().optional().default('')
})

export const clienteSchema = z.object({
  tipoPessoa: z.enum(['fisica', 'juridica']),
  // Nome usado na listagem: nome completo (PF) ou nome fantasia/razão social (PJ).
  nome: z.string().trim().min(1, 'Informe o nome do cliente'),
  cpf: z.string().optional().default(''),
  razaoSocial: z.string().optional().default(''),
  nomeFantasia: z.string().optional().default(''),
  cnpj: z.string().optional().default(''),
  telefone: z.string().trim().min(8, 'Informe um telefone válido'),
  email: z.string().trim().email('E-mail inválido').or(z.literal('')).default(''),
  endereco: enderecoSchema.default({})
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
})

export type ClienteCadastro = z.output<typeof clienteSchema>
export type Cliente = ClienteCadastro & { id: number }

export interface VeiculoVinculo {
  id: number
  clienteId: number
}

export function somenteNumeros(valor: string) {
  return valor.replace(/\D/g, '')
}
