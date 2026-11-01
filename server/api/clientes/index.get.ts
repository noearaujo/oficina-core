import type { Cliente, VeiculoVinculo } from '../../utils/clientes'

export default defineEventHandler(async () => {
  const storage = useStorage('data')
  const clientes = await storage.getItem<Cliente[]>('clientes') ?? []
  const veiculos = await storage.getItem<VeiculoVinculo[]>('veiculos') ?? []

  // O map percorre TODOS os clientes; clientes sem veículos recebem quantidadeVeiculos = 0.
  return clientes.map(cliente => ({
    ...cliente,
    quantidadeVeiculos: veiculos.filter(veiculo => veiculo.clienteId === cliente.id).length
  }))
})
