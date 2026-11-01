import type { Cliente, VeiculoVinculo } from '../../utils/clientes'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de cliente inválido' })
  }

  const storage = useStorage('data')
  const clientes = await storage.getItem<Cliente[]>('clientes') ?? []
  const cliente = clientes.find(item => item.id === id)

  if (!cliente) {
    throw createError({ statusCode: 404, statusMessage: 'Cliente não encontrado' })
  }

  const veiculos = await storage.getItem<VeiculoVinculo[]>('veiculos') ?? []

  return {
    ...cliente,
    quantidadeVeiculos: veiculos.filter(veiculo => veiculo.clienteId === id).length
  }
})
