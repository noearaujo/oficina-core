import { db } from '../../../../utils/storage'
import { stripAccents } from '../../../../utils/clientes'
import type { ItemCatalogo } from '../../../../utils/catalogo'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'id'))

  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const query = getQuery(event)
  const termo = typeof query.q === 'string' ? stripAccents(query.q.trim()).toLowerCase() : ''
  const tipo = typeof query.tipo === 'string' && query.tipo !== 'todos' ? query.tipo : ''

  const itens = await db.list<ItemCatalogo>(unidadeId, 'catalogo')

  return itens
    .map(item => ({
      ...item,
      nomeBusca: item.nomeBusca || stripAccents(item.nome).toLowerCase(),
      sku: item.tipo === 'produto' ? (item.sku || '') : '',
      descricao: item.descricao || '',
      preco: Math.round(Number(item.preco)),
      custo: item.custo !== undefined && item.custo !== null && String(item.custo) !== ''
        ? Math.round(Number(item.custo))
        : undefined
    }))
    .filter((item) => {
      const correspondeTipo = !tipo || item.tipo === tipo
      const correspondeBusca
        = !termo
          || item.nomeBusca.includes(termo)
          || (item.sku || '').toLowerCase().includes(termo)
          || stripAccents(item.descricao || '').toLowerCase().includes(termo)

      return correspondeTipo && correspondeBusca
    })
})
