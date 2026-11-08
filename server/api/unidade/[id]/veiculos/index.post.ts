import { db } from '../../../../utils/storage'
import { veiculoSchema, type Veiculo } from '../../../../utils/veiculos'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const body = await readBody(event)
  const resultado = veiculoSchema.safeParse(body)

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados do veículo inválidos.',
      data: resultado.error.flatten()
    })
  }

  const veiculos = await db.list<Veiculo>(unidadeId, 'veiculos')

  const placaExiste = veiculos.some(
    veiculo => veiculo.placa === resultado.data.placa
  )

  if (placaExiste) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Já existe um veículo cadastrado com essa placa.'
    })
  }

  const novoVeiculo = await db.insert<Veiculo>(unidadeId, 'veiculos', resultado.data)

  return novoVeiculo
})
