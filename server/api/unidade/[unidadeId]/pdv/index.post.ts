import { finalizarVenda, vendaSchema } from '../../../../utils/pdv'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const body = await readBody(event)
  const resultado = vendaSchema.safeParse(body ?? {})

  if (!resultado.success) {
    const primeiraMensagem = resultado.error.issues[0]?.message || 'Dados da venda inválidos'
    throw createError({
      statusCode: 400,
      statusMessage: primeiraMensagem,
      data: resultado.error.flatten()
    })
  }

  return await finalizarVenda(unidadeId, resultado.data)
})
