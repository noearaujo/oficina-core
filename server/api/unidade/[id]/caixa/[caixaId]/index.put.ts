import { caixaUpdateSchema } from '../../../../../utils/caixa'
import type { Caixa } from '../../../../../utils/caixa'
import { db } from '../../../../../utils/storage'

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname
  const unidadeMatch = pathname.match(/\/api\/unidade\/(\d+)/)
  const unidadeId = unidadeMatch ? Number(unidadeMatch[1]) : NaN
  const caixaId = Number(getRouterParam(event, 'caixaId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }
  if (!Number.isSafeInteger(caixaId) || caixaId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de caixa inválido' })
  }

  const resultado = caixaUpdateSchema.safeParse(await readBody(event))
  if (!resultado.success) {
    throw createError({ statusCode: 400, statusMessage: 'Dados do Caixa inválidos', data: resultado.error.flatten() })
  }

  const { ativo } = resultado.data
  const atualizado = await db.transaction(async () => {
    return await db.update<Caixa>(unidadeId, 'caixas', caixaId, {
      ...(ativo !== undefined ? { ativo } : {}),
      dataAtualizacao: new Date().toISOString()
    })
  })

  if (!atualizado) {
    throw createError({ statusCode: 404, statusMessage: 'Caixa não encontrado' })
  }
  return atualizado
})
