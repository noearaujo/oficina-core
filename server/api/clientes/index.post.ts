import { clienteSchema, somenteNumeros, type Cliente } from '../../utils/clientes'

export default defineEventHandler(async (event) => {
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
  const novo = resultado.data

  const documento = novo.tipoPessoa === 'fisica' ? novo.cpf : novo.cnpj
  const documentoNormalizado = somenteNumeros(documento)

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

  const id = clientes.reduce((maior, cliente) => Math.max(maior, cliente.id), 0) + 1
  const cliente: Cliente = { ...novo, id }

  clientes.push(cliente)
  await storage.setItem('clientes', clientes)

  return cliente
})
