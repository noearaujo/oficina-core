import { db } from '../../../../utils/storage'
import { catalogoSchema, type ItemCatalogo } from '../../../../utils/catalogo'
import { criarEstoqueInicialProduto } from '../../../../utils/estoque'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const body = await readBody(event)
  const payload = body && typeof body === 'object'
    ? {
        ...body,
        saldoInicial: body.saldoInicial ?? body.quantidadeInicial ?? body.quantidadeAtual
      }
    : body

  const resultado = catalogoSchema.safeParse(payload)

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados do item inválidos',
      data: resultado.error.flatten()
    })
  }

  const { saldoInicial, quantidadeMinima, ...dadosCatalogo } = resultado.data
  const agora = new Date().toISOString()

  return await db.transaction(async () => {
    const novoItem = await db.insert<ItemCatalogo>(unidadeId, 'catalogo', {
      ...dadosCatalogo,
      dataCriacao: agora,
      dataAtualizacao: agora
    })

    if (novoItem.tipo === 'produto') {
      await criarEstoqueInicialProduto(unidadeId, novoItem, {
        saldoInicial,
        quantidadeMinima,
        data: agora
      })
    }

    return novoItem
  })
})
