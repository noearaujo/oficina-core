import { aprovarTodos } from '../../../../../utils/os'

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

  const body = (await readBody(event).catch(() => ({}))) ?? {}
  const headerRole = getHeader(event, 'x-user-role') ?? getHeader(event, 'x-role')
  const headerUserId = getHeader(event, 'x-user-id')

  const role = body.role ?? body.papel ?? headerRole
  const usuarioIdRaw = body.usuarioId ?? headerUserId
  const usuarioId = usuarioIdRaw ? Number(usuarioIdRaw) : undefined

  return await aprovarTodos(unidadeId, osId, {
    role,
    ...(usuarioId && Number.isSafeInteger(usuarioId) && usuarioId > 0 ? { usuarioId } : {})
  })
})
