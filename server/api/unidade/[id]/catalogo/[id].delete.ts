import { db } from '../../../../utils/storage'
import type { ItemCatalogo } from '../../../../utils/catalogo'
import type { ItemEstoque, MovimentoEstoque } from '../../../../utils/estoque'

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

  await db.transaction(async () => {
    if (item.tipo === 'produto') {
      const estoques = await db.list<ItemEstoque>(
        unidadeId,
        'estoque',
        est => Number(est.catalogoId) === itemId
      )
      const estoqueIds = new Set(estoques.map(est => est.id))

      for (const est of estoques) {
        await db.delete(unidadeId, 'estoque', est.id)
      }

      const movimentos = await db.list<MovimentoEstoque>(
        unidadeId,
        'movimentos',
        mov =>
          Number(mov.catalogoId) === itemId
          || (mov.estoqueId !== undefined && estoqueIds.has(Number(mov.estoqueId)))
      )

      for (const mov of movimentos) {
        await db.delete(unidadeId, 'movimentos', mov.id)
      }
    }

    await db.delete(unidadeId, 'catalogo', itemId)
  })

  return { success: true }
})
