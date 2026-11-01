import { catalogoSchema, type ItemCatalogo } from '../../utils/catalogo'

export default defineEventHandler(async (event) => {
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

  const id = itens.reduce((maior, item) => Math.max(maior, item.id), 0) + 1
  const novo: ItemCatalogo = { ...resultado.data, id }

  itens.push(novo)
  await storage.setItem('catalogo', itens)

  return novo
})