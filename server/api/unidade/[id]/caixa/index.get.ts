import { listarCaixas } from '../../../../utils/caixa'

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname
  const unidadeMatch = pathname.match(/\/api\/unidade\/(\d+)/)
  const unidadeId = unidadeMatch ? Number(unidadeMatch[1]) : Number(getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q : ''
  const status = typeof query.status === 'string' ? query.status : ''

  return await listarCaixas(unidadeId, { q, status })
})
