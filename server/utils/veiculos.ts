
import * as z from 'zod'

export const veiculoSchema = z.object({
  clienteId: z.number().int().positive(),
  tipo: z.string().min(1),
  marca: z.string().trim().min(1),
  modelo: z.string().trim().min(1),
  versao: z.string().optional(),
  placa: z.string()
    .trim()
    .regex(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/)
    .transform(value => value.toUpperCase()),
  anoFabricacao: z.string().min(1),
  anoModelo: z.string().min(1),
  cor: z.string().optional(),
  combustivel: z.string().optional(),
  quilometragem: z.string()
    .refine(value => !value || /^\d+$/.test(value)),
  chassi: z.string().optional()
}).superRefine((data, ctx) => {
  if (Number(data.anoModelo) < Number(data.anoFabricacao)) {
    ctx.addIssue({
      code: 'custom',
      path: ['anoModelo'],
      message: 'O ano do modelo não pode ser anterior ao ano de fabricação.'
    })
  }
})

export type VeiculoCadastro = z.infer<typeof veiculoSchema>

export interface Veiculo extends VeiculoCadastro {
  id: number
}
