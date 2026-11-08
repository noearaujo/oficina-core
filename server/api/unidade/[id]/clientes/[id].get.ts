import { db } from '../../../../utils/storage'
import { stripAccents, type Cliente, type VeiculoVinculo } from '../../../../utils/clientes'

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname
  const unidadeMatch = pathname.match(/\/api\/unidade\/(\d+)/)
  const unidadeId = unidadeMatch ? Number(unidadeMatch[1]) : Number(getRouterParam(event, 'unidadeId') ?? getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const clienteId = Number(getRouterParam(event, 'clienteId') ?? getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(clienteId) || clienteId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de cliente inválido' })
  }

  const cliente = await db.get<Cliente>(unidadeId, 'clientes', clienteId)

  if (!cliente || cliente.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Cliente não encontrado' })
  }

  const veiculos = await db.list<VeiculoVinculo>(unidadeId, 'veiculos', veiculo => !veiculo.deletedAt)

  return {
    ...cliente,
    usuarioId: cliente.usuarioId ?? 1,
    nomeBusca: cliente.nomeBusca || stripAccents(cliente.nome).toLowerCase(),
    quantidadeVeiculos: veiculos.filter(veiculo => veiculo.clienteId === clienteId).length
  }
})
