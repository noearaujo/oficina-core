import { db } from '../../../../utils/storage'
import { catalogoSchema, type ItemCatalogo } from '../../../../utils/catalogo'
import type { ItemEstoque } from '../../../../utils/estoque'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const itemId = Number(getRouterParam(event, 'itemId'))

  if (!Number.isSafeInteger(itemId) || itemId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID inválido' })
  }

  const itemExistente = await db.get<ItemCatalogo>(unidadeId, 'catalogo', itemId)

  if (!itemExistente) {
    throw createError({ statusCode: 404, statusMessage: 'Item não encontrado' })
  }

  const body = await readBody(event)

  // Tipo é imutável — rejeita se tentar mudar
  if (body?.tipo !== undefined && body.tipo !== itemExistente.tipo) {
    throw createError({
      statusCode: 400,
      statusMessage: 'O tipo do item é imutável e não pode ser alterado'
    })
  }

  const resultado = catalogoSchema.safeParse({
    ...body,
    tipo: body?.tipo ?? itemExistente.tipo
  })

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados do item inválidos',
      data: resultado.error.flatten()
    })
  }

  const { saldoInicial: _s, quantidadeMinima: _q, ...dadosCatalogo } = resultado.data
  const agora = new Date().toISOString()

  return await db.transaction(async () => {
    const itemAtualizado = await db.update<ItemCatalogo>(unidadeId, 'catalogo', itemId, {
      ...dadosCatalogo,
      tipo: itemExistente.tipo,
      sku: itemExistente.tipo === 'produto' ? (dadosCatalogo.sku || '') : '',
      dataCriacao: itemExistente.dataCriacao || agora,
      dataAtualizacao: agora
    })

    if (itemExistente.tipo === 'produto' && itemAtualizado) {
      const estoques = await db.list<ItemEstoque>(
        unidadeId,
        'estoque',
        est => Number(est.catalogoId) === itemId
      )

      for (const est of estoques) {
        await db.update<ItemEstoque>(unidadeId, 'estoque', est.id, {
          nome: itemAtualizado.nome,
          nomeBusca: itemAtualizado.nomeBusca,
          sku: itemAtualizado.sku || '',
          unidade: itemAtualizado.unidade,
          dataAtualizacao: agora
        })
      }
    }

    return itemAtualizado
  })
})
