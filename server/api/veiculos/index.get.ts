
import type { Veiculo } from '../../utils/veiculos'

export default defineEventHandler(async () => {
  const storage = useStorage('data')
  return await storage.getItem<Veiculo[]>('veiculos') ?? []
})
