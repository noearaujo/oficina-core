import { gerarCsv } from '../../../../../utils/config'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const entidade = String(getRouterParam(event, 'entidade') ?? '')
  const csv = await gerarCsv(unidadeId, entidade)

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="${entidade}.csv"`)
  return csv
})
