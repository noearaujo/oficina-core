import { carteiraSchema, criarCarteira } from '../../../../utils/carteiras'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const body = await readBody(event)
  const payload = body && typeof body === 'object'
    ? {
        ...body,
        ativa: body.ativa ?? body.ativo
      }
    : body

  const resultado = carteiraSchema.safeParse(payload)

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados da carteira inválidos',
      data: resultado.error.flatten()
    })
  }

  return await criarCarteira(unidadeId, resultado.data)
})
