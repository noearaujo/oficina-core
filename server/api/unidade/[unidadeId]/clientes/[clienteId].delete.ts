import { db } from '../../../../utils/storage'
import type { Cliente, VeiculoVinculo } from '../../../../utils/clientes'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const clienteId = Number(getRouterParam(event, 'clienteId'))

  if (!Number.isSafeInteger(clienteId) || clienteId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de cliente inválido' })
  }

  const cliente = await db.get<Cliente>(unidadeId, 'clientes', clienteId)

  if (!cliente || cliente.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Cliente não encontrado' })
  }

  const veiculos = await db.list<VeiculoVinculo>(unidadeId, 'veiculos', veiculo => !veiculo.deletedAt)
  const possuiVeiculos = veiculos.some(veiculo => veiculo.clienteId === clienteId)

  if (possuiVeiculos) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Não é possível excluir um cliente que possui veículos vinculados'
    })
  }

  const agora = new Date().toISOString()
  await db.update<Cliente>(unidadeId, 'clientes', clienteId, {
    deletedAt: agora,
    dataAtualizacao: agora
  })

  return { success: true }
})
