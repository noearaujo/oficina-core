import { estornarLancamento, estornoSchema } from '../../../../../utils/movimentacoes'

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname
  const unidadeMatch = pathname.match(/\/api\/unidade\/(\d+)/)
  const unidadeId = unidadeMatch ? Number(unidadeMatch[1]) : Number(getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const lancamentoId = Number(getRouterParam(event, 'lancamentoId'))

  if (!Number.isSafeInteger(lancamentoId) || lancamentoId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de lançamento inválido' })
  }

  const body = await readBody(event)
  const resultado = estornoSchema.safeParse(body ?? {})

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: resultado.error.issues[0]?.message || 'Dados do estorno inválidos',
      data: resultado.error.flatten()
    })
  }

  return await estornarLancamento(unidadeId, lancamentoId, resultado.data)
})
