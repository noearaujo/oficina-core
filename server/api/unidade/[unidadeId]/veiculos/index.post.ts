import { db } from '../../../../utils/storage'
import { normalizarPlaca, veiculoSchema, type Veiculo } from '../../../../utils/veiculos'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

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

  const novo = resultado.data
  const placaNormalizada = normalizarPlaca(novo.placa)

  const veiculos = await db.list<Veiculo>(unidadeId, 'veiculos', veiculo => !veiculo.deletedAt)

  const placaExiste = veiculos.some(
    veiculo => normalizarPlaca(veiculo.placa) === placaNormalizada
  )

  if (placaExiste) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Já existe um veículo cadastrado com essa placa.'
    })
  }

  const agora = new Date().toISOString()
  const novoVeiculo = await db.insert<Veiculo>(unidadeId, 'veiculos', {
    ...novo,
    placa: placaNormalizada,
    dataCriacao: agora,
    dataAtualizacao: agora
  })

  return novoVeiculo
})
