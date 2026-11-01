import type { ItemCatalogo } from '../../utils/catalogo'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const idNumber = Number(id)

  if (!idNumber || Number.isNaN(idNumber)) {
    throw createError({ statusCode: 400, statusMessage: 'ID inválido' })
  }

  const storage = useStorage('data')
  const itens = await storage.getItem<ItemCatalogo[]>('catalogo') ?? []

  const index = itens.findIndex((item) => item.id === idNumber)

  if (index === -1) {
    throw createError({ statusCode: 404, statusMessage: 'Item não encontrado' })
  }

  itens.splice(index, 1)
  await storage.setItem('catalogo', itens)

  return { success: true }
})   