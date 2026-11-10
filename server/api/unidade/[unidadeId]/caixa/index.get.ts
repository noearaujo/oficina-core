import { listarCaixas } from '../../../../utils/caixa'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q : ''
  const status = typeof query.status === 'string' ? query.status : ''

  return await listarCaixas(unidadeId, { q, status })
})
