import {
  ajusteEstoqueSchema,
  ajustarEstoqueManual,
  criarEstoqueProduto,
  itemEstoqueSchema
} from '../../../../utils/estoque'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const body = await readBody(event)

  // Se enviar tipo ('entrada' | 'saida') + quantidade, trata como ajuste manual de estoque
  if (body && (body.tipo === 'entrada' || body.tipo === 'saida')) {
    const resultadoAjuste = ajusteEstoqueSchema.safeParse(body)
    if (!resultadoAjuste.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Dados de ajuste de estoque inválidos',
        data: resultadoAjuste.error.flatten()
      })
    }
    return await ajustarEstoqueManual(unidadeId, resultadoAjuste.data)
  }

  const resultado = itemEstoqueSchema.safeParse(body)

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados de estoque inválidos',
      data: resultado.error.flatten()
    })
  }

  return await criarEstoqueProduto(unidadeId, resultado.data)
})
