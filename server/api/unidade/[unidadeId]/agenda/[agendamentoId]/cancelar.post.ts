import { db } from '../../../../../utils/storage'
import {
  exigirAgendado,
  obterAgendamento,
  validarAgendamentoId,
  validarUnidadeId,
  type AgendamentoRecord
} from '../../../../../utils/agenda'

export default defineEventHandler(async (event) => {
  const unidadeId = validarUnidadeId(getRouterParam(event, 'unidadeId'))
  const agendamentoId = validarAgendamentoId(getRouterParam(event, 'agendamentoId'))

  const atual = await obterAgendamento(unidadeId, agendamentoId)
  exigirAgendado(atual, 'cancelar')

  return await db.update<AgendamentoRecord>(unidadeId, 'agendamentos', agendamentoId, {
    status: 'cancelado'
  })
})
