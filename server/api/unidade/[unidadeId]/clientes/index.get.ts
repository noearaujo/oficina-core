import { db } from '../../../../utils/storage'
import { stripAccents, type Cliente, type VeiculoVinculo } from '../../../../utils/clientes'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const clientes = await db.list<Cliente>(unidadeId, 'clientes', cliente => !cliente.deletedAt)
  const veiculos = await db.list<VeiculoVinculo>(unidadeId, 'veiculos', veiculo => !veiculo.deletedAt)

  return clientes.map(cliente => ({
    ...cliente,
    usuarioId: cliente.usuarioId ?? 1,
    nomeBusca: cliente.nomeBusca || stripAccents(cliente.nome).toLowerCase(),
    quantidadeVeiculos: veiculos.filter(veiculo => veiculo.clienteId === cliente.id).length
  }))
})
