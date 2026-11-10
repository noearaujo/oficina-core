import { filtroAgendaSchema, listarAgendamentos, validarUnidadeId } from '../../../../utils/agenda'

export default defineEventHandler(async (event) => {
  const unidadeId = validarUnidadeId(getRouterParam(event, 'unidadeId'))

  const resultado = filtroAgendaSchema.safeParse(getQuery(event))
  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: resultado.error.issues[0]?.message || 'Filtro inválido',
      data: resultado.error.flatten()
    })
  }

  return await listarAgendamentos(unidadeId, resultado.data)
})
