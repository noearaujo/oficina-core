import { abrirCaixa, abrirCaixaSchema } from '../../../../../utils/caixa'

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname
  const unidadeMatch = pathname.match(/\/api\/unidade\/(\d+)/)
  const unidadeId = unidadeMatch ? Number(unidadeMatch[1]) : Number(getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const caixaId = Number(getRouterParam(event, 'caixaId'))

  if (!Number.isSafeInteger(caixaId) || caixaId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de Caixa inválido' })
  }

  const body = await readBody(event)
  const resultado = abrirCaixaSchema.safeParse(body ?? {})

  if (!resultado.success) {
    const primeiraMensagem = resultado.error.issues[0]?.message || 'Dados de abertura de Caixa inválidos'
    throw createError({
      statusCode: 400,
      statusMessage: primeiraMensagem,
      data: resultado.error.flatten()
    })
  }

  return await abrirCaixa(unidadeId, caixaId, resultado.data)
})
