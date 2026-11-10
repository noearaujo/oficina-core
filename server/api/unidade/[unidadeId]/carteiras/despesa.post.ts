import { despesaCarteiraSchema, registrarDespesaCarteira } from '../../../../utils/movimentacoes'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const body = await readBody(event)
  const resultado = despesaCarteiraSchema.safeParse(body ?? {})

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: resultado.error.issues[0]?.message || 'Dados da despesa inválidos',
      data: resultado.error.flatten()
    })
  }

  return await registrarDespesaCarteira(unidadeId, resultado.data)
})
