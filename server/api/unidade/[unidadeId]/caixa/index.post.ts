import { caixaSchema, criarCaixa } from '../../../../utils/caixa'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const body = await readBody(event)
  const payload = body && typeof body === 'object'
    ? {
        ...body,
        ativo: body.ativo ?? body.ativa
      }
    : body

  const resultado = caixaSchema.safeParse(payload)

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados do Caixa inválidos',
      data: resultado.error.flatten()
    })
  }

  return await criarCaixa(unidadeId, resultado.data)
})
