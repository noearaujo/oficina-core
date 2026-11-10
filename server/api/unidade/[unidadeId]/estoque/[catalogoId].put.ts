import { atualizarItemEstoque, estoqueUpdateSchema } from '../../../../utils/estoque'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const catalogoId = Number(getRouterParam(event, 'catalogoId'))

  if (!Number.isSafeInteger(catalogoId) || catalogoId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID inválido' })
  }

  const body = await readBody(event)
  const resultado = estoqueUpdateSchema.safeParse(body)

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados de estoque inválidos',
      data: resultado.error.flatten()
    })
  }

  const atualizado = await atualizarItemEstoque(unidadeId, catalogoId, resultado.data)

  if (!atualizado) {
    throw createError({ statusCode: 404, statusMessage: 'Item de estoque não encontrado' })
  }

  return atualizado
})
