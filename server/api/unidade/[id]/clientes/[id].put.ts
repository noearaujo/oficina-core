import { db } from '../../../../utils/storage'
import { clienteSchema, somenteNumeros, type Cliente } from '../../../../utils/clientes'

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname
  const unidadeMatch = pathname.match(/\/api\/unidade\/(\d+)/)
  const unidadeId = unidadeMatch ? Number(unidadeMatch[1]) : Number(getRouterParam(event, 'unidadeId') ?? getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const clienteId = Number(getRouterParam(event, 'clienteId') ?? getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(clienteId) || clienteId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID inválido' })
  }

  const body = await readBody(event)
  const resultado = clienteSchema.safeParse(body)

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados do cliente inválidos',
      data: resultado.error.flatten()
    })
  }

  const clienteExistente = await db.get<Cliente>(unidadeId, 'clientes', clienteId)

  if (!clienteExistente || clienteExistente.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Cliente não encontrado' })
  }

  const novo = resultado.data
  const documento = novo.tipoPessoa === 'fisica' ? novo.cpf : novo.cnpj
  const documentoNormalizado = somenteNumeros(documento)

  const clientes = await db.list<Cliente>(unidadeId, 'clientes', cliente => !cliente.deletedAt)
  const duplicado = clientes.some((cliente) => {
    if (cliente.id === clienteId) return false
    const documentoExistente = cliente.tipoPessoa === 'fisica' ? cliente.cpf : cliente.cnpj
    return somenteNumeros(documentoExistente ?? '') === documentoNormalizado
  })

  if (duplicado) {
    throw createError({
      statusCode: 409,
      statusMessage: novo.tipoPessoa === 'fisica' ? 'CPF já cadastrado em outro cliente' : 'CNPJ já cadastrado em outro cliente'
    })
  }

  const agora = new Date().toISOString()
  const clienteAtualizado = await db.update<Cliente>(unidadeId, 'clientes', clienteId, {
    ...novo,
    usuarioId: clienteExistente.usuarioId ?? novo.usuarioId ?? 1,
    dataCriacao: clienteExistente.dataCriacao || agora,
    dataAtualizacao: agora
  })

  return clienteAtualizado
})
