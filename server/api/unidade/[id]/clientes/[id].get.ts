import { db } from '../../../../utils/storage'
import type { Cliente, VeiculoVinculo } from '../../../../utils/clientes'

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

  if (!cliente) {
    throw createError({ statusCode: 404, statusMessage: 'Cliente não encontrado' })
  }

  const veiculos = await db.list<VeiculoVinculo>(unidadeId, 'veiculos')

  return {
    ...cliente,
    quantidadeVeiculos: veiculos.filter(veiculo => veiculo.clienteId === clienteId).length
  }
})
