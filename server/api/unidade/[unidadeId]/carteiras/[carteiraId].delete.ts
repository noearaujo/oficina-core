import { excluirCarteira } from '../../../../utils/carteiras'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const carteiraId = Number(getRouterParam(event, 'carteiraId'))

  if (!Number.isSafeInteger(carteiraId) || carteiraId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de carteira inválido' })
  }

  await excluirCarteira(unidadeId, carteiraId)

  return { success: true }
})
