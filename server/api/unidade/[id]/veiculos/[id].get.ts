import { db } from '../../../../utils/storage'
import { normalizarPlaca, type Veiculo } from '../../../../utils/veiculos'

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname
  const unidadeMatch = pathname.match(/\/api\/unidade\/(\d+)/)
  const unidadeId = unidadeMatch ? Number(unidadeMatch[1]) : Number(getRouterParam(event, 'unidadeId') ?? getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const veiculoId = Number(getRouterParam(event, 'veiculoId') ?? getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(veiculoId) || veiculoId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID do veículo inválido.'
    })
  }

  const veiculo = await db.get<Veiculo>(unidadeId, 'veiculos', veiculoId)

  if (!veiculo || veiculo.deletedAt) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Veículo não encontrado.'
    })
  }

  return {
    ...veiculo,
    placa: normalizarPlaca(veiculo.placa),
    quilometragem: veiculo.quilometragem !== undefined && veiculo.quilometragem !== null && String(veiculo.quilometragem) !== ''
      ? Number(veiculo.quilometragem)
      : undefined
  }
})
