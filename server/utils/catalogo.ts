import * as z from 'zod'
import { stripAccents } from './clientes'

export const unidades = [
  { label: 'Unidade', value: 'un' },
  { label: 'Jogo', value: 'jogo' },
  { label: 'Par', value: 'par' },
  { label: 'Hora', value: 'h' },
  { label: 'Litro', value: 'litro' },
  { label: 'Metro', value: 'm' },
  { label: 'Quilo', value: 'kg' },
  { label: 'Peça', value: 'pca' }
]

export const catalogoSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do item'),
  nomeBusca: z.string().trim().optional(),
  tipo: z.enum(['servico', 'produto']),
  sku: z.string().trim().optional().default(''),
  descricao: z.string().trim().optional().default(''),
  preco: z.coerce.number().int('Preço deve ser inteiro em centavos').min(0, 'Preço inválido'),
  custo: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int('Custo deve ser inteiro em centavos').min(0, 'Custo inválido').optional()
  ),
  unidade: z.string().trim().min(1, 'Selecione a unidade'),
  dataCriacao: z.string().optional(),
  dataAtualizacao: z.string().optional()
}).transform(item => ({
  ...item,
  sku: item.tipo === 'produto' ? (item.sku || '') : '',
  nomeBusca: stripAccents(item.nome).toLowerCase()
}))

export type ItemCatalogoCadastro = z.output<typeof catalogoSchema>

export type ItemCatalogo = Omit<ItemCatalogoCadastro, 'dataCriacao' | 'dataAtualizacao'> & {
  id: number
  unidadeId: number
  dataCriacao: string
  dataAtualizacao: string
  [key: string]: unknown
}
