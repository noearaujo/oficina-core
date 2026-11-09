import { db } from '../../../../../utils/storage'
import { criarOS } from '../../../../../utils/os'
import {
  converterAgendamentoSchema,
  exigirAgendado,
  obterAgendamento,
  validarAgendamentoId,
  validarUnidadeId,
  type AgendamentoRecord
} from '../../../../../utils/agenda'

export default defineEventHandler(async (event) => {
  const unidadeId = validarUnidadeId(getRouterParam(event, 'id'))
  const agendamentoId = validarAgendamentoId(getRouterParam(event, 'agendamentoId'))

  const body = (await readBody(event)) ?? {}
  const resultado = converterAgendamentoSchema.safeParse({
    ...body,
    role: body.role ?? body.papel ?? getHeader(event, 'x-user-role') ?? getHeader(event, 'x-role'),
    usuarioId: body.usuarioId ?? getHeader(event, 'x-user-id')
  })
  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: resultado.error.issues[0]?.message || 'Dados inválidos',
      data: resultado.error.flatten()
    })
  }

  const agendamento = await obterAgendamento(unidadeId, agendamentoId)
  exigirAgendado(agendamento, 'converter')

  const dados = resultado.data
  const veiculoId = agendamento.veiculoId ?? dados.veiculoId
  if (veiculoId === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Selecione o veículo para criar a OS' })
  }

  // Mesma regra do POST /os (criarOS valida cliente, veículo e permissão)
  const os = await criarOS(unidadeId, {
    clienteId: agendamento.clienteId,
    veiculoId,
    funcionarioId: dados.funcionarioId ?? dados.usuarioId ?? 1,
    queixa: agendamento.servico,
    role: dados.role,
    usuarioId: dados.usuarioId
  } as Parameters<typeof criarOS>[1])

  const atualizado = await db.update<AgendamentoRecord>(unidadeId, 'agendamentos', agendamentoId, {
    veiculoId,
    status: 'realizado',
    osId: os.id
  })

  return { agendamento: atualizado, os }
})
