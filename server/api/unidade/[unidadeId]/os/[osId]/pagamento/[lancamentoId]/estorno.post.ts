import { estornarPagamentoOS, estornoPagamentoOsSchema } from '../../../../../../../utils/os'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const osId = Number(getRouterParam(event, 'osId'))
  if (!Number.isSafeInteger(osId) || osId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de OS inválido' })
  }

  const lancamentoId = Number(getRouterParam(event, 'lancamentoId'))
  if (!Number.isSafeInteger(lancamentoId) || lancamentoId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID do lançamento inválido' })
  }

  const body = (await readBody(event)) ?? {}
  const headerRole = getHeader(event, 'x-user-role') ?? getHeader(event, 'x-role')
  const headerUserId = getHeader(event, 'x-user-id')

  const resultado = estornoPagamentoOsSchema.safeParse({
    ...body,
    lancamentoId,
    role: body.role ?? body.papel ?? headerRole,
    usuarioId: body.usuarioId ?? headerUserId
  })

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: resultado.error.issues[0]?.message || 'Dados de estorno inválidos',
      data: resultado.error.flatten()
    })
  }

  return await estornarPagamentoOS(unidadeId, osId, resultado.data)
})
