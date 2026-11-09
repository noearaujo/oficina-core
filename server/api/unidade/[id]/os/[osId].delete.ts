import { excluirOS } from '../../../../utils/os'

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

  const query = getQuery(event)
  const headerRole = getHeader(event, 'x-user-role') ?? getHeader(event, 'x-role')
  const role = typeof query.role === 'string' ? query.role : headerRole

  return await excluirOS(unidadeId, osId, { role })
})
