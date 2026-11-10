import { listarEstoque } from '../../../../utils/estoque'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q : ''
  const abaixoMinimo
    = query.abaixoMinimo === 'true'
      || query.abaixoMinimo === '1'
      || query.abaixoMinimo === true

  return await listarEstoque(unidadeId, { q, abaixoMinimo })
})
