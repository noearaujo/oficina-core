import { db } from '../../../../utils/storage'
import type { ItemCatalogo } from '../../../../utils/catalogo'
import { removerEstoqueDoProduto } from '../../../../utils/estoque'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const itemId = Number(getRouterParam(event, 'itemId'))

  if (!Number.isSafeInteger(itemId) || itemId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID inválido' })
  }

  const item = await db.get<ItemCatalogo>(unidadeId, 'catalogo', itemId)

  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'Item não encontrado' })
  }

  await db.transaction(async () => {
    if (item.tipo === 'produto') {
      await removerEstoqueDoProduto(unidadeId, itemId)
    }

    await db.delete(unidadeId, 'catalogo', itemId)
  })

  return { success: true }
})
