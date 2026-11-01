import type { Veiculo } from '../../utils/veiculos'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))

  // Valida o ID recebido pela URL
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID do veículo inválido.'
    })
  }

  // Busca os veículos no Storage
  const storage = useStorage('data')
  const veiculos = await storage.getItem<Veiculo[]>('veiculos') ?? []

  // Procura somente o veículo solicitado
  const veiculo = veiculos.find(v => v.id === id)

  // Retorna erro caso não encontre
  if (!veiculo) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Veículo não encontrado.'
    })
  }

  return veiculo
})