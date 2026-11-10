import { registrarRetiradaRapida, retiradaRapidaSchema } from '../../../../../utils/caixa'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const caixaId = Number(getRouterParam(event, 'caixaId'))

  if (!Number.isSafeInteger(caixaId) || caixaId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de Caixa inválido' })
  }

  const body = await readBody(event)
  const resultado = retiradaRapidaSchema.safeParse(body ?? {})

  if (!resultado.success) {
    const primeiraMensagem = resultado.error.issues[0]?.message || 'Dados da retirada rápida inválidos'
    throw createError({
      statusCode: 400,
      statusMessage: primeiraMensagem,
      data: resultado.error.flatten()
    })
  }

  return await registrarRetiradaRapida(unidadeId, caixaId, resultado.data)
})
