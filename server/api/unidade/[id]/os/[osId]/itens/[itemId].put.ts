import { editarItem, editarItemOsSchema } from '../../../../../../utils/os'

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

  const body = (await readBody(event)) ?? {}
  const headerRole = getHeader(event, 'x-user-role') ?? getHeader(event, 'x-role')
  const headerUserId = getHeader(event, 'x-user-id')

  const resultado = editarItemOsSchema.safeParse({
    ...body,
    role: body.role ?? body.papel ?? headerRole,
    usuarioId: body.usuarioId ?? headerUserId
  })

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: resultado.error.issues[0]?.message || 'Dados para edição do item inválidos',
      data: resultado.error.flatten()
    })
  }

  return await editarItem(unidadeId, osId, itemId, resultado.data)
})
