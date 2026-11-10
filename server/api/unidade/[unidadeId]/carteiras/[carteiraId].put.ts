import { atualizarCarteira, carteiraUpdateSchema } from '../../../../utils/carteiras'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const carteiraId = Number(getRouterParam(event, 'carteiraId'))

  if (!Number.isSafeInteger(carteiraId) || carteiraId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de carteira inválido' })
  }

  const body = await readBody(event)
  const payload = body && typeof body === 'object'
    ? {
        ...body,
        ativa: body.ativa ?? body.ativo
      }
    : body

  const resultado = carteiraUpdateSchema.safeParse(payload)

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados da carteira inválidos',
      data: resultado.error.flatten()
    })
  }

  const atualizada = await atualizarCarteira(unidadeId, carteiraId, resultado.data)

  if (!atualizada) {
    throw createError({ statusCode: 404, statusMessage: 'Carteira não encontrada' })
  }

  return atualizada
})
