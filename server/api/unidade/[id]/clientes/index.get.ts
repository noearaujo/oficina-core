import { db } from '../../../../utils/storage'
import type { Cliente, VeiculoVinculo } from '../../../../utils/clientes'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const clientes = await db.list<Cliente>(unidadeId, 'clientes')
  const veiculos = await db.list<VeiculoVinculo>(unidadeId, 'veiculos')

  return clientes.map(cliente => ({
    ...cliente,
    quantidadeVeiculos: veiculos.filter(veiculo => veiculo.clienteId === cliente.id).length
  }))
})
