import { criarOS, criarOsSchema } from '../../../../utils/os'

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname
  const unidadeMatch = pathname.match(/\/api\/unidade\/(\d+)/)
  const unidadeId = unidadeMatch ? Number(unidadeMatch[1]) : Number(getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const body = (await readBody(event)) ?? {}
  const headerRole = getHeader(event, 'x-user-role') ?? getHeader(event, 'x-role')
  const headerUserId = getHeader(event, 'x-user-id')

  const resultado = criarOsSchema.safeParse({
    ...body,
    role: body.role ?? body.papel ?? headerRole,
    usuarioId: body.usuarioId ?? headerUserId
  })

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: resultado.error.issues[0]?.message || 'Dados da OS inválidos',
      data: resultado.error.flatten()
    })
  }

  return await criarOS(unidadeId, resultado.data)
})
