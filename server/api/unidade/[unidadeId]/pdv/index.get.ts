import { listarVendas } from '../../../../utils/pdv'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q : ''
  const formaPagamento = typeof query.formaPagamento === 'string' ? query.formaPagamento : ''
  const clienteId = query.clienteId ? Number(query.clienteId) : undefined

  return await listarVendas(unidadeId, {
    q,
    formaPagamento,
    ...(clienteId && Number.isSafeInteger(clienteId) && clienteId > 0 ? { clienteId } : {})
  })
})
