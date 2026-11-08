import { db } from '../../../../utils/storage'
import { catalogoSchema, type ItemCatalogo } from '../../../../utils/catalogo'

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

  const body = await readBody(event)
  const resultado = catalogoSchema.safeParse(body)

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados do item inválidos',
      data: resultado.error.flatten()
    })
  }

  const itemExistente = await db.get<ItemCatalogo>(unidadeId, 'catalogo', itemId)

  if (!itemExistente) {
    throw createError({ statusCode: 404, statusMessage: 'Item não encontrado' })
  }

  // Tipo é imutável — preserva o original
  const itemAtualizado = await db.update<ItemCatalogo>(unidadeId, 'catalogo', itemId, {
    ...resultado.data,
    tipo: itemExistente.tipo
  })

  return itemAtualizado
})
