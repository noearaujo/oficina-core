import { obterDetalheEstoque } from '../../../../utils/estoque'

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname
  const unidadeMatch = pathname.match(/\/api\/unidade\/(\d+)/)
  const unidadeId = unidadeMatch ? Number(unidadeMatch[1]) : Number(getRouterParam(event, 'unidadeId') ?? getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const itemId = Number(getRouterParam(event, 'estoqueId') ?? getRouterParam(event, 'catalogoId') ?? getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(itemId) || itemId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID inválido' })
  }

  const detalhe = await obterDetalheEstoque(unidadeId, itemId)

  if (!detalhe) {
    throw createError({ statusCode: 404, statusMessage: 'Item de estoque não encontrado' })
  }

  return detalhe
})
