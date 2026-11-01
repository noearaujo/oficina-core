import { clienteSchema, somenteNumeros, type Cliente } from '../../utils/clientes'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const idNumber = Number(id)

  if (!idNumber || Number.isNaN(idNumber)) {
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

  const storage = useStorage('data')
  const clientes = await storage.getItem<Cliente[]>('clientes') ?? []

  const index = clientes.findIndex((c) => c.id === idNumber)

  if (index === -1) {
    throw createError({ statusCode: 404, statusMessage: 'Cliente não encontrado' })
  }

  const novo = resultado.data
  const documento = novo.tipoPessoa === 'fisica' ? novo.cpf : novo.cnpj
  const documentoNormalizado = somenteNumeros(documento)

  const duplicado = clientes.some((cliente, i) => {
    if (i === index) return false
    const documentoExistente = cliente.tipoPessoa === 'fisica' ? cliente.cpf : cliente.cnpj
    return somenteNumeros(documentoExistente ?? '') === documentoNormalizado
  })

  if (duplicado) {
    throw createError({
      statusCode: 409,
      statusMessage: novo.tipoPessoa === 'fisica' ? 'CPF já cadastrado em outro cliente' : 'CNPJ já cadastrado em outro cliente'
    })
  }

  clientes[index] = { ...novo, id: idNumber }
  await storage.setItem('clientes', clientes)

  return clientes[index]
})