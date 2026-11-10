import { atualizarConfig, configSchema } from '../../../../utils/config'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const resultado = configSchema.safeParse(await readBody(event))

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados de configuração inválidos',
      data: resultado.error.flatten()
    })
  }

  return await atualizarConfig(unidadeId, resultado.data)
})
