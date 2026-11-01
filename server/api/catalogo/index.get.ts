import type { ItemCatalogo } from '../../utils/catalogo'

export default defineEventHandler(async (event) => {
  const storage = useStorage('data')
  return await storage.getItem<ItemCatalogo[]>('catalogo') ?? []
})