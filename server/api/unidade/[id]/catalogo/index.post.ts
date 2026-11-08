import { db } from '../../../../utils/storage'
import { catalogoSchema, type ItemCatalogo } from '../../../../utils/catalogo'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
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

  const novoItem = await db.insert<ItemCatalogo>(unidadeId, 'catalogo', resultado.data)

  return novoItem
})
