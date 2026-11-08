import { db } from '../../../../utils/storage'
import type { ItemCatalogo } from '../../../../utils/catalogo'

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname
  const unidadeMatch = pathname.match(/\/api\/unidade\/(\d+)/)
  const unidadeId = unidadeMatch ? Number(unidadeMatch[1]) : Number(getRouterParam(event, 'unidadeId') ?? getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const itemId = Number(getRouterParam(event, 'catalogoId') ?? getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(itemId) || itemId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID inválido' })
  }

  const item = await db.get<ItemCatalogo>(unidadeId, 'catalogo', itemId)

  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'Item não encontrado' })
  }

  await db.delete(unidadeId, 'catalogo', itemId)

  return { success: true }
})
