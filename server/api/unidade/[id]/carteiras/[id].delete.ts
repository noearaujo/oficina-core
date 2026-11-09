import { excluirCarteira } from '../../../../utils/carteiras'

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname
  const unidadeMatch = pathname.match(/\/api\/unidade\/(\d+)/)
  const unidadeId = unidadeMatch ? Number(unidadeMatch[1]) : Number(getRouterParam(event, 'unidadeId') ?? getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const carteiraId = Number(getRouterParam(event, 'carteiraId') ?? getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(carteiraId) || carteiraId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de carteira inválido' })
  }

  await excluirCarteira(unidadeId, carteiraId)

  return { success: true }
})
