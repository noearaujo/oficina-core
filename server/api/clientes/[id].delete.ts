import type { Cliente, VeiculoVinculo } from '../../utils/clientes'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de cliente inválido' })
  }

  const storage = useStorage('data')
  const clientes = await storage.getItem<Cliente[]>('clientes') ?? []
  const indice = clientes.findIndex(cliente => cliente.id === id)

  if (indice === -1) {
    throw createError({ statusCode: 404, statusMessage: 'Cliente não encontrado' })
  }

  const veiculos = await storage.getItem<VeiculoVinculo[]>('veiculos') ?? []
  const possuiVeiculos = veiculos.some(veiculo => veiculo.clienteId === id)

  if (possuiVeiculos) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Não é possível excluir um cliente que possui veículos vinculados'
    })
  }

  clientes.splice(indice, 1)
  await storage.setItem('clientes', clientes)

  return { success: true }
})
