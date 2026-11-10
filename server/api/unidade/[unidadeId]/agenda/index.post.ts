import { db } from '../../../../utils/storage'
import {
  criarAgendamentoSchema,
  validarUnidadeId,
  validarVinculos,
  type AgendamentoRecord
} from '../../../../utils/agenda'

export default defineEventHandler(async (event) => {
  const unidadeId = validarUnidadeId(getRouterParam(event, 'unidadeId'))
  const body = (await readBody(event)) ?? {}

  const resultado = criarAgendamentoSchema.safeParse({
    ...body,
    usuarioId: body.usuarioId ?? getHeader(event, 'x-user-id')
  })
  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: resultado.error.issues[0]?.message || 'Dados do agendamento inválidos',
      data: resultado.error.flatten()
    })
  }

  const { usuarioId, ...dados } = resultado.data
  await validarVinculos(unidadeId, dados.clienteId, dados.veiculoId)

  return await db.insert<AgendamentoRecord>(unidadeId, 'agendamentos', {
    clienteId: dados.clienteId,
    ...(dados.veiculoId !== undefined ? { veiculoId: dados.veiculoId } : {}),
    dataHora: dados.dataHora,
    servico: dados.servico,
    status: 'agendado',
    ...(dados.observacao ? { observacao: dados.observacao } : {}),
    criadoPor: usuarioId ?? 1,
    dataCriacao: new Date().toISOString()
  })
})
