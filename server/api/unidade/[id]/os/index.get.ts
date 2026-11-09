import { listarOS } from '../../../../utils/os'

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname
  const unidadeMatch = pathname.match(/\/api\/unidade\/(\d+)/)
  const unidadeId = unidadeMatch ? Number(unidadeMatch[1]) : Number(getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const query = getQuery(event)
  const status = typeof query.status === 'string' ? query.status : undefined
  const q = typeof query.q === 'string'
    ? query.q
    : typeof query.busca === 'string'
      ? query.busca
      : typeof query.search === 'string'
        ? query.search
        : undefined
  const clienteId = query.clienteId ? Number(query.clienteId) : undefined
  const veiculoId = query.veiculoId ? Number(query.veiculoId) : undefined
  const tipo = typeof query.tipo === 'string' ? query.tipo : undefined

  return await listarOS(unidadeId, {
    status,
    q,
    ...(clienteId && Number.isSafeInteger(clienteId) && clienteId > 0 ? { clienteId } : {}),
    ...(veiculoId && Number.isSafeInteger(veiculoId) && veiculoId > 0 ? { veiculoId } : {}),
    tipo
  })
})
