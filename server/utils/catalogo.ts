import * as z from 'zod'

export const unidades = [
  { label: 'Unidade', value: 'un' },
  { label: 'Jogo', value: 'jogo' },
  { label: 'Par', value: 'par' },
  { label: 'Hora', value: 'h' },
  { label: 'Litro', value: 'litro' },
  { label: 'Metro', value: 'm' },
  { label: 'Quilo', value: 'kg' },
  { label: 'Peça', value: 'pca' },
]

export const catalogoSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do item'),
  tipo: z.enum(['servico', 'produto']),
  descricao: z.string().optional().default(''),
  preco: z.coerce.number().min(0, 'Preço inválido'),
  custo: z.coerce.number().min(0).optional(),
  unidade: z.string().min(1, 'Selecione a unidade')
})

export type ItemCatalogoCadastro = z.infer<typeof catalogoSchema>

export interface ItemCatalogo extends ItemCatalogoCadastro {
  id: number
}