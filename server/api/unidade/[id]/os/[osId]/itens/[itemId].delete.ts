import { removerItem } from '../../../../../../utils/os'

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

  const itemId = Number(getRouterParam(event, 'itemId'))
  if (!Number.isSafeInteger(itemId) || itemId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID do item inválido' })
  }

  const query = getQuery(event)
  const headerRole = getHeader(event, 'x-user-role') ?? getHeader(event, 'x-role')
  const headerUserId = getHeader(event, 'x-user-id')
  const role = typeof query.role === 'string' ? query.role : headerRole
  const usuarioId = query.usuarioId ? Number(query.usuarioId) : headerUserId ? Number(headerUserId) : undefined

  return await removerItem(unidadeId, osId, itemId, {
    role,
    ...(usuarioId && Number.isSafeInteger(usuarioId) && usuarioId > 0 ? { usuarioId } : {})
  })
})
