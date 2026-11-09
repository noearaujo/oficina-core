import { listarCarteiras } from '../../../../utils/carteiras'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q : ''
  const tipo = typeof query.tipo === 'string' ? query.tipo : ''
  const ativa
    = query.ativa === 'true' || query.ativa === '1'
      ? true
      : query.ativa === 'false' || query.ativa === '0'
        ? false
        : undefined

  return await listarCarteiras(unidadeId, { q, tipo, ativa })
})
