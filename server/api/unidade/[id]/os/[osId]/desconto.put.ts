import { aplicarDesconto, descontoOsSchema } from '../../../../../utils/os'

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname
  const unidadeMatch = pathname.match(/\/api\/unidade\/(\d+)/)
  const unidadeId = unidadeMatch ? Number(unidadeMatch[1]) : Number(getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const osId = Number(getRouterParam(event, 'osId'))
  if (!Number.isSafeInteger(osId) || osId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de OS inválido' })
  }

  const body = (await readBody(event)) ?? {}
  const headerRole = getHeader(event, 'x-user-role') ?? getHeader(event, 'x-role')
  const headerUserId = getHeader(event, 'x-user-id')

  const resultado = descontoOsSchema.safeParse({
    ...body,
    role: body.role ?? body.papel ?? headerRole,
    usuarioId: body.usuarioId ?? headerUserId
  })

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: resultado.error.issues[0]?.message || 'Valor de desconto inválido',
      data: resultado.error.flatten()
    })
  }

  return await aplicarDesconto(unidadeId, osId, resultado.data)
})
