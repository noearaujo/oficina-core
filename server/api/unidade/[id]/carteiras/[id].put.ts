import { atualizarCarteira, carteiraUpdateSchema } from '../../../../utils/carteiras'

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
