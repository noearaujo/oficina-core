import { db } from '../../../../utils/storage'
import { normalizarPlaca, type Veiculo } from '../../../../utils/veiculos'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const veiculos = await db.list<Veiculo>(unidadeId, 'veiculos', veiculo => !veiculo.deletedAt)

  return veiculos.map(veiculo => ({
    ...veiculo,
    placa: normalizarPlaca(veiculo.placa),
    quilometragem: veiculo.quilometragem !== undefined && veiculo.quilometragem !== null && String(veiculo.quilometragem) !== ''
      ? Number(veiculo.quilometragem)
      : undefined
  }))
})
