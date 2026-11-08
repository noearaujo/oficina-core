import { db } from '../../../../utils/storage'
import { catalogoSchema, type ItemCatalogo } from '../../../../utils/catalogo'
import type { ItemEstoque, MovimentoEstoque } from '../../../../utils/estoque'

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
      const qtdInicial = saldoInicial !== undefined ? saldoInicial : 0

      const novoEstoque = await db.insert<ItemEstoque>(unidadeId, 'estoque', {
        catalogoId: novoItem.id,
        nome: novoItem.nome,
        nomeBusca: novoItem.nomeBusca,
        sku: novoItem.sku || '',
        unidade: novoItem.unidade,
        quantidadeAtual: qtdInicial,
        ...(quantidadeMinima !== undefined ? { quantidadeMinima } : {}),
        dataCriacao: agora,
        dataAtualizacao: agora
      })

      if (saldoInicial !== undefined && saldoInicial > 0) {
        await db.insert<MovimentoEstoque>(unidadeId, 'movimentos', {
          catalogoId: novoItem.id,
          estoqueId: novoEstoque.id,
          nome: novoItem.nome,
          tipo: 'entrada_inicial',
          quantidade: saldoInicial,
          origem: 'manual',
          saldoApos: saldoInicial,
          observacao: 'Saldo inicial',
          usuarioId: 1,
          data: agora
        })
      }
    }

    return novoItem
  })
})
