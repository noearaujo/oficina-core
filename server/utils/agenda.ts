import * as z from 'zod'
import { db } from './storage'

export const STATUS_AGENDAMENTO = ['agendado', 'realizado', 'cancelado'] as const

export type StatusAgendamento = (typeof STATUS_AGENDAMENTO)[number]

export interface AgendamentoRecord {
  id: number
  unidadeId: number
  clienteId: number
  veiculoId?: number
  dataHora: string
  servico: string
  status: StatusAgendamento
  osId?: number
  observacao?: string
  criadoPor: number
  dataCriacao: string
  [key: string]: unknown
}

function vazioParaUndefined(v: unknown) {
  return v === '' || v === null ? undefined : v
}

const dataISO = (mensagem: string) =>
  z.string({ message: mensagem }).refine(v => !Number.isNaN(new Date(v).getTime()), mensagem)

export const criarAgendamentoSchema = z.object({
  clienteId: z.preprocess(
    vazioParaUndefined,
    z.coerce.number({ message: 'Selecione o cliente' }).int().positive('Selecione o cliente')
  ),
  veiculoId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional()),
  dataHora: dataISO('Informe uma data e hora válidas'),
  servico: z.string({ message: 'Informe o serviço' }).trim().min(1, 'Informe o serviço'),
  observacao: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
}).transform(d => ({ ...d, dataHora: new Date(d.dataHora).toISOString() }))

export const editarAgendamentoSchema = z.object({
  veiculoId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional()),
  dataHora: dataISO('Informe uma data e hora válidas').optional(),
  servico: z.string().trim().min(1, 'Informe o serviço').optional(),
  observacao: z.string().trim().optional()
}).transform(d => ({
  ...d,
  ...(d.dataHora ? { dataHora: new Date(d.dataHora).toISOString() } : {})
}))

export const converterAgendamentoSchema = z.object({
  veiculoId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional()),
  funcionarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional()),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
})

export const filtroAgendaSchema = z.object({
  dataInicio: z.preprocess(vazioParaUndefined, dataISO('dataInicio inválida').optional()),
  dataFim: z.preprocess(vazioParaUndefined, dataISO('dataFim inválida').optional()),
  status: z.preprocess(vazioParaUndefined, z.enum(STATUS_AGENDAMENTO).optional())
})

export function validarUnidadeId(valor: unknown): number {
  const unidadeId = Number(valor)
  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }
  return unidadeId
}

export function validarAgendamentoId(valor: unknown): number {
  const id = Number(valor)
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de agendamento inválido' })
  }
  return id
}

export async function obterAgendamento(unidadeId: number, id: number): Promise<AgendamentoRecord> {
  const ag = await db.get<AgendamentoRecord>(unidadeId, 'agendamentos', id)
  if (!ag) {
    throw createError({ statusCode: 404, statusMessage: 'Agendamento não encontrado' })
  }
  return ag
}

export function exigirAgendado(ag: AgendamentoRecord, acao: string) {
  if (ag.status !== 'agendado') {
    throw createError({ statusCode: 409, statusMessage: `Só é possível ${acao} agendamentos com status "agendado"` })
  }
}

export async function validarVinculos(unidadeId: number, clienteId: number, veiculoId?: number) {
  const cliente = await db.get<{ id: number, unidadeId: number, deletedAt?: string }>(unidadeId, 'clientes', clienteId)
  if (!cliente || cliente.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Cliente não encontrado' })
  }
  if (veiculoId !== undefined) {
    const veiculo = await db.get<{ id: number, unidadeId: number, clienteId: number, deletedAt?: string }>(unidadeId, 'veiculos', veiculoId)
    if (!veiculo || veiculo.deletedAt || veiculo.clienteId !== clienteId) {
      throw createError({ statusCode: 404, statusMessage: 'Veículo não encontrado para este cliente' })
    }
  }
}

export async function listarAgendamentos(
  unidadeId: number,
  filtro: z.output<typeof filtroAgendaSchema>
) {
  const inicio = filtro.dataInicio ? new Date(filtro.dataInicio).getTime() : undefined
  const fim = filtro.dataFim ? new Date(filtro.dataFim).getTime() : undefined

  const [itens, clientes, veiculos] = await Promise.all([
    db.list<AgendamentoRecord>(unidadeId, 'agendamentos', (ag) => {
      const t = new Date(ag.dataHora).getTime()
      if (inicio !== undefined && t < inicio) return false
      if (fim !== undefined && t > fim) return false
      if (filtro.status && ag.status !== filtro.status) return false
      return true
    }),
    db.list<{ id: number, unidadeId: number, nome: string }>(unidadeId, 'clientes'),
    db.list<{ id: number, unidadeId: number, placa: string, marca?: string, modelo?: string }>(unidadeId, 'veiculos')
  ])

  return itens
    .map((ag) => {
      const cliente = clientes.find(c => c.id === ag.clienteId)
      const veiculo = ag.veiculoId ? veiculos.find(v => v.id === ag.veiculoId) : undefined
      return {
        ...ag,
        clienteNome: cliente?.nome,
        veiculoPlaca: veiculo?.placa,
        veiculoDescricao: veiculo ? [veiculo.marca, veiculo.modelo].filter(Boolean).join(' ') : undefined
      }
    })
    .sort((a, b) => a.dataHora.localeCompare(b.dataHora))
}
