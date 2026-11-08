import * as z from 'zod'

export function normalizarPlaca(valor: string) {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export const veiculoSchema = z.object({
  clienteId: z.coerce.number().int().positive('Selecione o cliente'),
  tipo: z.string().trim().min(1, 'Selecione o tipo de veículo'),
  marca: z.string().trim().min(1, 'Informe a marca'),
  modelo: z.string().trim().min(1, 'Informe o modelo'),
  versao: z.string().trim().optional().default(''),
  placa: z.string()
    .trim()
    .transform(value => normalizarPlaca(value))
    .refine(value => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(value), 'Informe uma placa válida'),
  anoFabricacao: z.union([
    z.string().trim().min(1, 'Informe o ano de fabricação'),
    z.number().int().positive()
  ]),
  anoModelo: z.union([
    z.string().trim().min(1, 'Informe o ano do modelo'),
    z.number().int().positive()
  ]),
  cor: z.string().trim().optional().default(''),
  combustivel: z.string().trim().optional().default(''),
  quilometragem: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().min(0, 'Informe uma quilometragem válida').optional()
  ),
  chassi: z.string().trim().optional().default(''),
  deletedAt: z.string().optional(),
  dataCriacao: z.string().optional(),
  dataAtualizacao: z.string().optional()
}).superRefine((data, ctx) => {
  if (Number(data.anoModelo) < Number(data.anoFabricacao)) {
    ctx.addIssue({
      code: 'custom',
      path: ['anoModelo'],
      message: 'O ano do modelo não pode ser anterior ao ano de fabricação.'
    })
  }
})

export type VeiculoCadastro = z.output<typeof veiculoSchema>

export type Veiculo = Omit<VeiculoCadastro, 'dataCriacao' | 'dataAtualizacao'> & {
  id: number
  unidadeId: number
  dataCriacao: string
  dataAtualizacao: string
  [key: string]: unknown
}
