import { listarOS } from '../../../../utils/os'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

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
  // Usado pela Agenda para incluir OSs pela data de previsão de entrega (relatórios mantêm falso para contar só entradas)
  const incluirPrevisao = query.incluirPrevisao === 'true' || query.incluirPrevisao === '1'
  const tipo = typeof query.tipo === 'string' ? query.tipo : undefined
  const dataInicio = typeof query.dataInicio === 'string' ? query.dataInicio : undefined
  const dataFim = typeof query.dataFim === 'string' ? query.dataFim : undefined

  return await listarOS(unidadeId, {
    status,
    q,
    ...(clienteId && Number.isSafeInteger(clienteId) && clienteId > 0 ? { clienteId } : {}),
    ...(veiculoId && Number.isSafeInteger(veiculoId) && veiculoId > 0 ? { veiculoId } : {}),
    tipo,
    dataInicio,
    dataFim,
    incluirPrevisao
  })
})
