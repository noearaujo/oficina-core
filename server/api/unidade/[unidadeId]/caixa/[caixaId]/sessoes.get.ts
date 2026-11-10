import { listarSessoesCaixa } from '../../../../../utils/caixa'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const caixaId = Number(getRouterParam(event, 'caixaId'))

  if (!Number.isSafeInteger(caixaId) || caixaId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de Caixa inválido' })
  }

  const query = getQuery(event)
  const status = typeof query.status === 'string' ? query.status : ''

  return await listarSessoesCaixa(unidadeId, caixaId, { status })
})
