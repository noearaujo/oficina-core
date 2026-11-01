
import type { Veiculo } from '../../utils/veiculos'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID do veículo inválido.'
    })
  }

  const storage = useStorage('data')
  const veiculos = await storage.getItem<Veiculo[]>('veiculos') ?? []

  const index = veiculos.findIndex(veiculo => veiculo.id === id)

  if (index === -1) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Veículo não encontrado.'
    })
  }

  const [removido] = veiculos.splice(index, 1)
  await storage.setItem('veiculos', veiculos)

  return removido
})
