import { catalogoSchema, type ItemCatalogo } from '../../utils/catalogo'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const idNumber = Number(id)

  if (!idNumber || Number.isNaN(idNumber)) {
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

  const storage = useStorage('data')
  const itens = await storage.getItem<ItemCatalogo[]>('catalogo') ?? []

  const index = itens.findIndex((item) => item.id === idNumber)

  if (index === -1) {
    throw createError({ statusCode: 404, statusMessage: 'Item não encontrado' })
  }

  // Tipo é imutável — preserva o original
  itens[index] = { ...resultado.data, id: idNumber, tipo: itens[index].tipo }
  await storage.setItem('catalogo', itens)

  return itens[index]
})   