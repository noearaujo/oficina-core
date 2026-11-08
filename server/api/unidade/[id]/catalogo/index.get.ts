import { db } from '../../../../utils/storage'
import type { ItemCatalogo } from '../../../../utils/catalogo'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  return await db.list<ItemCatalogo>(unidadeId, 'catalogo')
})
