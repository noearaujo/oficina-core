import { db } from '../../../../utils/storage'
import { clienteSchema, somenteNumeros, type Cliente } from '../../../../utils/clientes'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
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

  const novo = resultado.data
  const documento = novo.tipoPessoa === 'fisica' ? novo.cpf : novo.cnpj
  const documentoNormalizado = somenteNumeros(documento)

  const clientes = await db.list<Cliente>(unidadeId, 'clientes')
  const duplicado = clientes.some((cliente) => {
    const documentoExistente = cliente.tipoPessoa === 'fisica' ? cliente.cpf : cliente.cnpj
    return somenteNumeros(documentoExistente ?? '') === documentoNormalizado
  })

  if (duplicado) {
    throw createError({
      statusCode: 409,
      statusMessage: novo.tipoPessoa === 'fisica' ? 'CPF já cadastrado' : 'CNPJ já cadastrado'
    })
  }

  const cliente = await db.insert<Cliente>(unidadeId, 'clientes', novo)

  return cliente
})
