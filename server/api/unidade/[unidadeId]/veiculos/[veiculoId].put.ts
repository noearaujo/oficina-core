import { db } from '../../../../utils/storage'
import { normalizarPlaca, veiculoSchema, type Veiculo } from '../../../../utils/veiculos'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const veiculoId = Number(getRouterParam(event, 'veiculoId'))

  if (!Number.isSafeInteger(veiculoId) || veiculoId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID inválido' })
  }

  const body = await readBody(event)
  const resultado = veiculoSchema.safeParse(body)

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados do veículo inválidos',
      data: resultado.error.flatten()
    })
  }

  const veiculoExistente = await db.get<Veiculo>(unidadeId, 'veiculos', veiculoId)

  if (!veiculoExistente || veiculoExistente.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Veículo não encontrado' })
  }

  const novo = resultado.data
  const placaNormalizada = normalizarPlaca(novo.placa)

  const veiculos = await db.list<Veiculo>(unidadeId, 'veiculos', veiculo => !veiculo.deletedAt)
  const duplicado = veiculos.some((v) => {
    if (v.id === veiculoId) return false
    return normalizarPlaca(v.placa) === placaNormalizada
  })

  if (duplicado) {
    throw createError({ statusCode: 409, statusMessage: 'Placa já cadastrada em outro veículo' })
  }

  const agora = new Date().toISOString()
  const veiculoAtualizado = await db.update<Veiculo>(unidadeId, 'veiculos', veiculoId, {
    ...novo,
    placa: placaNormalizada,
    dataCriacao: veiculoExistente.dataCriacao || agora,
    dataAtualizacao: agora
  })

  return veiculoAtualizado
})
