import * as z from 'zod'
import { ACOES_TRANSICAO } from './types'

const vazioParaUndefined = (value: unknown) =>
  value === '' || value === null || value === undefined ? undefined : value

export const criarOsSchema = z.object({
  clienteId: z.preprocess(
    vazioParaUndefined,
    z.coerce.number({ message: 'Selecione o cliente' }).int().positive('Selecione o cliente')
  ),
  veiculoId: z.preprocess(
    vazioParaUndefined,
    z.coerce.number({ message: 'Selecione o veículo' }).int().positive('Selecione o veículo')
  ),
  funcionarioId: z.preprocess(
    vazioParaUndefined,
    z.coerce.number({ message: 'Selecione o responsável pela OS' }).int().positive('Selecione o responsável pela OS')
  ),
  queixa: z.string({ message: 'Informe a queixa do cliente' }).trim().min(1, 'Informe a queixa do cliente'),
  tipo: z.enum(['normal', 'garantia']).optional().default('normal'),
  osOriginalId: z.preprocess(
    vazioParaUndefined,
    z.coerce.number().int().positive().optional()
  ),
  diagnostico: z.string().trim().optional(),
  avarias: z.string().trim().optional(),
  combustivel: z.string().trim().optional(),
  quilometragem: z.preprocess(
    vazioParaUndefined,
    z.coerce.number().int().min(0, 'Quilometragem inválida').optional()
  ),
  dataEntrada: z.preprocess(
    vazioParaUndefined,
    z.string().refine(v => !Number.isNaN(new Date(v).getTime()), 'Data de entrada inválida').optional()
  ),
  previsaoEntrega: z.preprocess(
    vazioParaUndefined,
    z.string().refine(v => !Number.isNaN(new Date(v).getTime()), 'Previsão de entrega inválida').optional()
  ),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
}).transform(d => ({
  clienteId: d.clienteId,
  veiculoId: d.veiculoId,
  funcionarioId: d.funcionarioId,
  queixa: d.queixa,
  tipo: d.tipo,
  osOriginalId: d.tipo === 'garantia' ? d.osOriginalId : undefined,
  diagnostico: d.diagnostico,
  avarias: d.avarias,
  combustivel: d.combustivel,
  quilometragem: d.quilometragem,
  dataEntrada: d.dataEntrada,
  previsaoEntrega: d.previsaoEntrega,
  role: d.role,
  usuarioId: d.usuarioId
}))

export const editarOsSchema = z.object({
  queixa: z.string().trim().min(1, 'A queixa não pode ficar vazia').optional(),
  diagnostico: z.string().trim().optional(),
  avarias: z.string().trim().optional(),
  combustivel: z.string().trim().optional(),
  quilometragem: z.preprocess(
    value => (value === '' ? null : value),
    z.coerce.number().int().min(0, 'Quilometragem inválida').nullable().optional()
  ),
  previsaoEntrega: z.preprocess(
    value => (value === '' ? null : value),
    z.string().refine(v => !Number.isNaN(new Date(v).getTime()), 'Previsão de entrega inválida').nullable().optional()
  ),
  funcionarioId: z.preprocess(
    vazioParaUndefined,
    z.coerce.number().int().positive().optional()
  ),
  clienteId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional()),
  veiculoId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional()),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
}).transform(d => ({
  queixa: d.queixa,
  diagnostico: d.diagnostico,
  avarias: d.avarias,
  combustivel: d.combustivel,
  quilometragem: d.quilometragem,
  previsaoEntrega: d.previsaoEntrega,
  funcionarioId: d.funcionarioId,
  clienteId: d.clienteId,
  veiculoId: d.veiculoId,
  role: d.role,
  usuarioId: d.usuarioId
}))

export const transicionarOsSchema = z.object({
  acao: z.enum(ACOES_TRANSICAO, {
    message: 'Ação de transição inválida. Use: iniciar_diagnostico, iniciar_execucao, concluir, entregar, cancelar ou reverter_aprovacao'
  }),
  motivo: z.string().trim().optional(),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
})

export const adicionarItemOsSchema = z.object({
  catalogoId: z.coerce.number().int().positive('Selecione um item do catálogo'),
  quantidade: z.preprocess(
    value => (value === '' || value === null || value === undefined ? 1 : value),
    z.coerce.number({ message: 'Informe a quantidade' }).positive('A quantidade deve ser maior que zero')
  ),
  precoUnitario: z.preprocess(
    vazioParaUndefined,
    z.coerce.number().int('Preço deve ser inteiro em centavos').min(0, 'Preço não pode ser negativo').optional()
  ),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
})

export const adicionarItensOsSchema = z.object({
  itens: z.array(adicionarItemOsSchema).min(1, 'Adicione ao menos um item'),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
})

export const editarItemOsSchema = z.object({
  quantidade: z.preprocess(
    vazioParaUndefined,
    z.coerce.number().positive('A quantidade deve ser maior que zero').optional()
  ),
  precoUnitario: z.preprocess(
    vazioParaUndefined,
    z.coerce.number().int('Preço deve ser inteiro em centavos').min(0, 'Preço não pode ser negativo').optional()
  ),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
})

export const recusarItemOsSchema = z.object({
  motivo: z.string({ message: 'Informe o motivo da recusa' }).trim().min(1, 'Informe o motivo da recusa'),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
})

export const ajustarOsSchema = z.object({
  motivo: z.string({ message: 'Informe o motivo do ajuste' }).trim().min(1, 'Informe o motivo do ajuste'),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
})

export const enviarOrcamentoSchema = z.object({
  canal: z.enum(['impressao', 'imagem', 'email', 'link'], {
    message: 'Selecione um canal válido (impressao ou imagem)'
  }),
  itensIds: z.array(z.coerce.number().int().positive()).optional(),
  referencia: z.string().trim().optional(),
  erro: z.string().trim().optional(),
  falhou: z.boolean().optional(),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
})

export const descontoOsSchema = z.object({
  desconto: z.preprocess(
    value => (value === '' || value === null || value === undefined ? 0 : value),
    z.coerce.number({ message: 'Informe o valor do desconto' })
      .int('O desconto deve ser inteiro em centavos')
      .min(0, 'O desconto não pode ser negativo')
  ),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
})

export type CriarOSInput = z.output<typeof criarOsSchema>
export type EditarOSInput = z.output<typeof editarOsSchema>
export type TransicionarOSInput = z.output<typeof transicionarOsSchema>
export type AdicionarItemOSInput = z.output<typeof adicionarItemOsSchema>
export type AdicionarItensOSInput = z.output<typeof adicionarItensOsSchema>
export type EditarItemOSInput = z.output<typeof editarItemOsSchema>
export type RecusarItemOSInput = z.output<typeof recusarItemOsSchema>
export type AjustarOSInput = z.output<typeof ajustarOsSchema>
export type EnviarOrcamentoInput = z.output<typeof enviarOrcamentoSchema>
export type DescontoOSInput = z.output<typeof descontoOsSchema>
