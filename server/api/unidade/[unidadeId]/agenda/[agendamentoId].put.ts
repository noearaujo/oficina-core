import { db } from '../../../../utils/storage'
import {
  editarAgendamentoSchema,
  exigirAgendado,
  obterAgendamento,
  validarAgendamentoId,
  validarUnidadeId,
  validarVinculos,
  type AgendamentoRecord
} from '../../../../utils/agenda'

export default defineEventHandler(async (event) => {
  const unidadeId = validarUnidadeId(getRouterParam(event, 'unidadeId'))
  const agendamentoId = validarAgendamentoId(getRouterParam(event, 'agendamentoId'))

  const resultado = editarAgendamentoSchema.safeParse((await readBody(event)) ?? {})
  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: resultado.error.issues[0]?.message || 'Dados do agendamento inválidos',
      data: resultado.error.flatten()
    })
  }

  const atual = await obterAgendamento(unidadeId, agendamentoId)
  exigirAgendado(atual, 'editar')

  const dados = resultado.data
  if (dados.veiculoId !== undefined) {
    await validarVinculos(unidadeId, atual.clienteId, dados.veiculoId)
  }

  const atualizado = await db.update<AgendamentoRecord>(unidadeId, 'agendamentos', agendamentoId, {
    ...(dados.veiculoId !== undefined ? { veiculoId: dados.veiculoId } : {}),
    ...(dados.dataHora ? { dataHora: dados.dataHora } : {}),
    ...(dados.servico ? { servico: dados.servico } : {}),
    ...(dados.observacao !== undefined ? { observacao: dados.observacao } : {})
  })

  return atualizado
})
