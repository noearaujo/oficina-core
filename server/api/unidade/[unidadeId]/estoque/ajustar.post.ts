import { ajusteEstoqueSchema, ajustarEstoqueManual } from '../../../../utils/estoque'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const body = await readBody(event)
  const resultado = ajusteEstoqueSchema.safeParse(body)

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados de ajuste de estoque inválidos',
      data: resultado.error.flatten()
    })
  }

  return await ajustarEstoqueManual(unidadeId, resultado.data)
})
