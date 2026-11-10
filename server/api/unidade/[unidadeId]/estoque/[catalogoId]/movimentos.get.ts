import { obterDetalheEstoque } from '../../../../../utils/estoque'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const catalogoId = Number(getRouterParam(event, 'catalogoId'))

  if (!Number.isSafeInteger(catalogoId) || catalogoId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID inválido' })
  }

  const detalhe = await obterDetalheEstoque(unidadeId, catalogoId)

  if (!detalhe) {
    throw createError({ statusCode: 404, statusMessage: 'Produto não encontrado no estoque' })
  }

  return detalhe.movimentos
})
