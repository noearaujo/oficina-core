import { obterVenda } from '../../../../utils/pdv'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const vendaIdParam = getRouterParam(event, 'vendaId')
  const vendaId = Number(vendaIdParam)

  if (!Number.isSafeInteger(vendaId) || vendaId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de venda inválido' })
  }

  const venda = await obterVenda(unidadeId, vendaId)

  if (!venda) {
    throw createError({ statusCode: 404, statusMessage: 'Venda não encontrada' })
  }

  return venda
})
