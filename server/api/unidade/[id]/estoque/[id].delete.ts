import { db } from '../../../../utils/storage'
import type { ItemEstoque } from '../../../../utils/estoque'

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

  const estoques = await db.list<ItemEstoque>(unidadeId, 'estoque')
  const item
    = estoques.find(est => est.id === itemId)
      ?? estoques.find(est => Number(est.catalogoId) === itemId)

  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'Item de estoque não encontrado' })
  }

  await db.delete(unidadeId, 'estoque', item.id)

  return { success: true }
})
