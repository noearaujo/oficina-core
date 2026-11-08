import * as z from 'zod'
import { db } from './storage'
import { stripAccents } from './clientes'
import type { ItemCatalogo } from './catalogo'

export const itemEstoqueSchema = z.object({
  catalogoId: z.coerce.number().int().positive('Selecione o produto do catálogo'),
  quantidadeAtual: z.coerce.number().default(0),
  quantidadeMinima: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(0, 'Quantidade mínima inválida').optional()
  ),
  saldoInicial: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().optional()
  ),
  observacao: z.string().trim().optional().default(''),
  usuarioId: z.coerce.number().int().positive().default(1),
  dataCriacao: z.string().optional(),
  dataAtualizacao: z.string().optional()
})

export const estoqueSchema = itemEstoqueSchema

export const movimentoEstoqueSchema = z.object({
  catalogoId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive('Informe o produto').optional()
  ),
  nome: z.string().trim().min(1, 'Informe o nome do produto'),
  tipo: z.enum(['entrada', 'saida']),
  quantidade: z.coerce.number().positive('A quantidade deve ser maior que zero'),
  origem: z.enum(['manual', 'os_baixa', 'os_estorno', 'venda_baixa']).default('manual'),
  documentoId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  documentoTipo: z.enum(['os', 'venda']).optional(),
  itemOsId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  saldoApos: z.coerce.number(),
  observacao: z.string().trim().optional().default(''),
  usuarioId: z.coerce.number().int().positive().default(1),
  data: z.string().optional()
}).superRefine((movimento, ctx) => {
  if (movimento.origem === 'manual' && movimento.tipo === 'saida' && !movimento.observacao.trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['observacao'],
      message: 'A observação é obrigatória nas saídas manuais'
    })
  }
})

export const ajusteEstoqueSchema = z.object({
  catalogoId: z.coerce.number().int().positive('Selecione o produto'),
  tipo: z.enum(['entrada', 'saida']),
  quantidade: z.coerce.number().positive('A quantidade deve ser maior que zero'),
  observacao: z.string().trim().optional().default(''),
  quantidadeMinima: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(0, 'Quantidade mínima inválida').optional()
  ),
  usuarioId: z.coerce.number().int().positive().default(1)
}).superRefine((ajuste, ctx) => {
  if (ajuste.tipo === 'saida' && !ajuste.observacao.trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['observacao'],
      message: 'A observação é obrigatória nas saídas manuais'
    })
  }
})

export const estoqueUpdateSchema = z.object({
  quantidadeMinima: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(0, 'Quantidade mínima inválida').optional()
  ),
  tipo: z.enum(['entrada', 'saida']).optional(),
  quantidade: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().positive('A quantidade deve ser maior que zero').optional()
  ),
  observacao: z.string().trim().optional().default(''),
  usuarioId: z.coerce.number().int().positive().default(1)
}).superRefine((dados, ctx) => {
  if (dados.tipo && !dados.quantidade) {
    ctx.addIssue({
      code: 'custom',
      path: ['quantidade'],
      message: 'Informe a quantidade do movimento'
    })
  }
  if (dados.quantidade && !dados.tipo) {
    ctx.addIssue({
      code: 'custom',
      path: ['tipo'],
      message: 'Selecione o tipo de movimento (entrada ou saída)'
    })
  }
  if (dados.tipo === 'saida' && dados.quantidade && !dados.observacao.trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['observacao'],
      message: 'A observação é obrigatória nas saídas manuais'
    })
  }
})

export type ItemEstoqueCadastro = z.output<typeof itemEstoqueSchema>
export type MovimentoEstoqueCadastro = z.output<typeof movimentoEstoqueSchema>
export type AjusteEstoqueInput = z.output<typeof ajusteEstoqueSchema>
export type EstoqueUpdateInput = z.output<typeof estoqueUpdateSchema>

export interface ItemEstoque {
  id: number
  unidadeId: number
  catalogoId: number
  nome?: string
  nomeBusca?: string
  sku?: string
  unidade?: string
  quantidadeAtual: number
  quantidadeMinima?: number
  dataCriacao: string
  dataAtualizacao: string
  [key: string]: unknown
}

export interface MovimentoEstoque {
  id: number
  unidadeId: number
  estoqueId?: number
  catalogoId?: number
  nome: string
  tipo: 'entrada' | 'saida' | 'entrada_inicial'
  quantidade: number
  origem: 'manual' | 'os_baixa' | 'os_estorno' | 'venda_baixa'
  documentoId?: number
  documentoTipo?: 'os' | 'venda'
  itemOsId?: number
  saldoApos: number
  observacao?: string
  usuarioId: number
  data: string
  [key: string]: unknown
}

export interface ItemEstoqueComCatalogo extends ItemEstoque {
  nome: string
  nomeBusca: string
  tipo: 'produto'
  sku: string
  descricao: string
  preco: number
  custo?: number
  unidade: string
  repor: boolean
  estoqueNegativo: boolean
}

export type ItemEstoqueListagem = ItemEstoqueComCatalogo

export interface ItemEstoqueDetalhe extends ItemEstoqueComCatalogo {
  movimentos: MovimentoEstoque[]
}

export async function calcularStatusEstoque(
  quantidadeAtual: number,
  quantidadeMinima?: number
): Promise<{ repor: boolean, estoqueNegativo: boolean }> {
  const estoqueNegativo = quantidadeAtual < 0
  const repor
    = quantidadeMinima !== undefined
      && quantidadeMinima !== null
      && Number.isFinite(Number(quantidadeMinima))
      && quantidadeAtual <= Number(quantidadeMinima)

  return { repor, estoqueNegativo }
}

export async function sincronizarEstoqueUnidade(unidadeId: number): Promise<void> {
  await db.transaction(async () => {
    const catalogo = await db.list<ItemCatalogo>(unidadeId, 'catalogo')
    const estoques = await db.list<ItemEstoque>(unidadeId, 'estoque')

    const produtosMap = new Map<number, ItemCatalogo>()
    for (const item of catalogo) {
      if (item.tipo === 'produto') {
        produtosMap.set(item.id, item)
      }
    }

    // Cascade cleanup: remove estoques órfãos ou vinculados a serviço
    const vistosPorCatalogo = new Set<number>()
    for (const est of estoques) {
      const catId = Number(est.catalogoId)
      if (!produtosMap.has(catId) || vistosPorCatalogo.has(catId)) {
        await db.delete(unidadeId, 'estoque', est.id)
      } else {
        vistosPorCatalogo.add(catId)
      }
    }

    // Garante 1:1 para todo produto do catálogo
    const agora = new Date().toISOString()
    for (const [catalogoId, produto] of produtosMap.entries()) {
      if (!vistosPorCatalogo.has(catalogoId)) {
        const dataRef = produto.dataCriacao || agora
        await db.insert<ItemEstoque>(unidadeId, 'estoque', {
          catalogoId,
          nome: produto.nome,
          nomeBusca: produto.nomeBusca || stripAccents(produto.nome).toLowerCase(),
          sku: produto.sku || '',
          unidade: produto.unidade,
          quantidadeAtual: 0,
          dataCriacao: dataRef,
          dataAtualizacao: dataRef
        })
      }
    }
  })
}

export async function montarItemEstoqueComCatalogo(
  estoque: ItemEstoque,
  produto: ItemCatalogo
): Promise<ItemEstoqueComCatalogo> {
  const quantidadeAtual = Number(estoque.quantidadeAtual ?? 0)
  const quantidadeMinima
    = estoque.quantidadeMinima !== undefined && estoque.quantidadeMinima !== null && String(estoque.quantidadeMinima) !== ''
      ? Number(estoque.quantidadeMinima)
      : undefined
  const custo
    = produto.custo !== undefined && produto.custo !== null && String(produto.custo) !== ''
      ? Math.round(Number(produto.custo))
      : undefined

  const { repor, estoqueNegativo } = await calcularStatusEstoque(quantidadeAtual, quantidadeMinima)

  return {
    id: estoque.id,
    unidadeId: estoque.unidadeId,
    catalogoId: Number(estoque.catalogoId),
    quantidadeAtual,
    ...(quantidadeMinima !== undefined ? { quantidadeMinima } : {}),
    dataCriacao: estoque.dataCriacao,
    dataAtualizacao: estoque.dataAtualizacao,
    nome: produto.nome,
    nomeBusca: produto.nomeBusca || stripAccents(produto.nome).toLowerCase(),
    tipo: 'produto',
    sku: produto.sku || '',
    descricao: produto.descricao || '',
    preco: Math.round(Number(produto.preco)),
    ...(custo !== undefined ? { custo } : {}),
    unidade: produto.unidade,
    repor,
    estoqueNegativo
  }
}

export async function listarEstoque(
  unidadeId: number,
  filtros?: { q?: string, abaixoMinimo?: boolean }
): Promise<ItemEstoqueComCatalogo[]> {
  await sincronizarEstoqueUnidade(unidadeId)

  const [catalogo, estoques] = await Promise.all([
    db.list<ItemCatalogo>(unidadeId, 'catalogo'),
    db.list<ItemEstoque>(unidadeId, 'estoque')
  ])

  const produtosPorId = new Map<number, ItemCatalogo>()
  for (const item of catalogo) {
    if (item.tipo === 'produto') {
      produtosPorId.set(item.id, item)
    }
  }

  const termo = filtros?.q ? stripAccents(filtros.q.trim()).toLowerCase() : ''
  const apenasAbaixoMinimo = Boolean(filtros?.abaixoMinimo)

  const resultado: ItemEstoqueComCatalogo[] = []

  for (const est of estoques) {
    const produto = produtosPorId.get(Number(est.catalogoId))
    if (!produto) continue

    const itemJoin = await montarItemEstoqueComCatalogo(est, produto)

    const correspondeBusca
      = !termo
        || itemJoin.nomeBusca.includes(termo)
        || itemJoin.sku.toLowerCase().includes(termo)
        || stripAccents(itemJoin.descricao).toLowerCase().includes(termo)

    const correspondeMinimo
      = !apenasAbaixoMinimo
        || itemJoin.repor
        || itemJoin.estoqueNegativo

    if (correspondeBusca && correspondeMinimo) {
      resultado.push(itemJoin)
    }
  }

  return resultado
}

export async function obterDetalheEstoque(
  unidadeId: number,
  idOuCatalogoId: number
): Promise<ItemEstoqueDetalhe | null> {
  await sincronizarEstoqueUnidade(unidadeId)

  const [catalogo, estoques, movimentos] = await Promise.all([
    db.list<ItemCatalogo>(unidadeId, 'catalogo'),
    db.list<ItemEstoque>(unidadeId, 'estoque'),
    db.list<MovimentoEstoque>(unidadeId, 'movimentos')
  ])

  const estoque
    = estoques.find(item => item.id === idOuCatalogoId)
      ?? estoques.find(item => Number(item.catalogoId) === idOuCatalogoId)

  if (!estoque) return null

  const produto = catalogo.find(
    item => item.id === Number(estoque.catalogoId) && item.tipo === 'produto'
  )

  if (!produto) return null

  const itemJoin = await montarItemEstoqueComCatalogo(estoque, produto)

  const historico = movimentos
    .filter(mov => Number(mov.catalogoId) === produto.id)
    .sort((a, b) => {
      const diffData = new Date(b.data).getTime() - new Date(a.data).getTime()
      return diffData !== 0 ? diffData : b.id - a.id
    })

  return {
    ...itemJoin,
    movimentos: historico
  }
}

export async function criarEstoqueProduto(
  unidadeId: number,
  dados: ItemEstoqueCadastro
): Promise<ItemEstoqueDetalhe> {
  return await db.transaction(async () => {
    const produto = await db.get<ItemCatalogo>(unidadeId, 'catalogo', dados.catalogoId)

    if (!produto) {
      throw createError({ statusCode: 404, statusMessage: 'Produto não encontrado no catálogo' })
    }

    if (produto.tipo !== 'produto') {
      throw createError({ statusCode: 400, statusMessage: 'Serviço não possui controle de estoque' })
    }

    const existentes = await db.list<ItemEstoque>(
      unidadeId,
      'estoque',
      item => Number(item.catalogoId) === produto.id
    )

    const agora = new Date().toISOString()
    const saldoInicial = dados.saldoInicial !== undefined ? dados.saldoInicial : dados.quantidadeAtual

    let estoqueAtual: ItemEstoque

    if (existentes.length > 0) {
      const atual = existentes[0]!
      const delta = Number(saldoInicial || 0)
      const novoSaldo = Number((Number(atual.quantidadeAtual || 0) + delta).toFixed(3))

      estoqueAtual = (await db.update<ItemEstoque>(unidadeId, 'estoque', atual.id, {
        quantidadeAtual: novoSaldo,
        ...(dados.quantidadeMinima !== undefined ? { quantidadeMinima: dados.quantidadeMinima } : {}),
        dataAtualizacao: agora
      }))!

      if (delta !== 0) {
        await db.insert<MovimentoEstoque>(unidadeId, 'movimentos', {
          catalogoId: produto.id,
          nome: produto.nome,
          tipo: delta > 0 ? 'entrada' : 'saida',
          quantidade: Math.abs(delta),
          origem: 'manual',
          saldoApos: novoSaldo,
          observacao: dados.observacao || 'Saldo inicial',
          usuarioId: dados.usuarioId || 1,
          data: agora
        })
      }
    } else {
      const saldo = Number(saldoInicial || 0)
      estoqueAtual = await db.insert<ItemEstoque>(unidadeId, 'estoque', {
        catalogoId: produto.id,
        quantidadeAtual: saldo,
        ...(dados.quantidadeMinima !== undefined ? { quantidadeMinima: dados.quantidadeMinima } : {}),
        dataCriacao: agora,
        dataAtualizacao: agora
      })

      if (saldo !== 0) {
        await db.insert<MovimentoEstoque>(unidadeId, 'movimentos', {
          catalogoId: produto.id,
          nome: produto.nome,
          tipo: saldo > 0 ? 'entrada' : 'saida',
          quantidade: Math.abs(saldo),
          origem: 'manual',
          saldoApos: saldo,
          observacao: dados.observacao || 'Saldo inicial',
          usuarioId: dados.usuarioId || 1,
          data: agora
        })
      }
    }

    const itemJoin = await montarItemEstoqueComCatalogo(estoqueAtual, produto)
    const movimentos = await db.list<MovimentoEstoque>(
      unidadeId,
      'movimentos',
      mov => Number(mov.catalogoId) === produto.id
    )

    return {
      ...itemJoin,
      movimentos: movimentos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    }
  })
}

export async function ajustarEstoqueManual(
  unidadeId: number,
  dados: AjusteEstoqueInput
): Promise<ItemEstoqueDetalhe> {
  return await db.transaction(async () => {
    const produto = await db.get<ItemCatalogo>(unidadeId, 'catalogo', dados.catalogoId)

    if (!produto) {
      throw createError({ statusCode: 404, statusMessage: 'Produto não encontrado no catálogo' })
    }

    if (produto.tipo !== 'produto') {
      throw createError({ statusCode: 400, statusMessage: 'Serviço não possui controle de estoque' })
    }

    const existentes = await db.list<ItemEstoque>(
      unidadeId,
      'estoque',
      item => Number(item.catalogoId) === produto.id
    )

    const agora = new Date().toISOString()
    let estoque = existentes[0]

    if (!estoque) {
      estoque = await db.insert<ItemEstoque>(unidadeId, 'estoque', {
        catalogoId: produto.id,
        quantidadeAtual: 0,
        ...(dados.quantidadeMinima !== undefined ? { quantidadeMinima: dados.quantidadeMinima } : {}),
        dataCriacao: agora,
        dataAtualizacao: agora
      })
    }

    const delta = dados.tipo === 'entrada' ? Number(dados.quantidade) : -Number(dados.quantidade)
    const novoSaldo = Number((Number(estoque.quantidadeAtual || 0) + delta).toFixed(3))

    const atualizado = (await db.update<ItemEstoque>(unidadeId, 'estoque', estoque.id, {
      quantidadeAtual: novoSaldo,
      ...(dados.quantidadeMinima !== undefined ? { quantidadeMinima: dados.quantidadeMinima } : {}),
      dataAtualizacao: agora
    }))!

    await db.insert<MovimentoEstoque>(unidadeId, 'movimentos', {
      catalogoId: produto.id,
      nome: produto.nome,
      tipo: dados.tipo,
      quantidade: Number(dados.quantidade),
      origem: 'manual',
      saldoApos: novoSaldo,
      ...(dados.observacao ? { observacao: dados.observacao } : {}),
      usuarioId: dados.usuarioId || 1,
      data: agora
    })

    const itemJoin = await montarItemEstoqueComCatalogo(atualizado, produto)
    const movimentos = await db.list<MovimentoEstoque>(
      unidadeId,
      'movimentos',
      mov => Number(mov.catalogoId) === produto.id
    )

    return {
      ...itemJoin,
      movimentos: movimentos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    }
  })
}

export async function atualizarItemEstoque(
  unidadeId: number,
  idOuCatalogoId: number,
  dados: EstoqueUpdateInput
): Promise<ItemEstoqueDetalhe | null> {
  await sincronizarEstoqueUnidade(unidadeId)

  return await db.transaction(async () => {
    const estoques = await db.list<ItemEstoque>(unidadeId, 'estoque')
    const estoque
      = estoques.find(item => item.id === idOuCatalogoId)
        ?? estoques.find(item => Number(item.catalogoId) === idOuCatalogoId)

    if (!estoque) return null

    const produto = await db.get<ItemCatalogo>(unidadeId, 'catalogo', Number(estoque.catalogoId))
    if (!produto || produto.tipo !== 'produto') return null

    const agora = new Date().toISOString()
    let novoSaldo = Number(estoque.quantidadeAtual || 0)

    if (dados.tipo && dados.quantidade) {
      const delta = dados.tipo === 'entrada' ? Number(dados.quantidade) : -Number(dados.quantidade)
      novoSaldo = Number((novoSaldo + delta).toFixed(3))

      await db.insert<MovimentoEstoque>(unidadeId, 'movimentos', {
        catalogoId: produto.id,
        nome: produto.nome,
        tipo: dados.tipo,
        quantidade: Number(dados.quantidade),
        origem: 'manual',
        saldoApos: novoSaldo,
        ...(dados.observacao ? { observacao: dados.observacao } : {}),
        usuarioId: dados.usuarioId || 1,
        data: agora
      })
    }

    const atualizado = (await db.update<ItemEstoque>(unidadeId, 'estoque', estoque.id, {
      quantidadeAtual: novoSaldo,
      quantidadeMinima: dados.quantidadeMinima,
      dataAtualizacao: agora
    }))!

    const itemJoin = await montarItemEstoqueComCatalogo(atualizado, produto)
    const movimentos = await db.list<MovimentoEstoque>(
      unidadeId,
      'movimentos',
      mov => Number(mov.catalogoId) === produto.id
    )

    return {
      ...itemJoin,
      movimentos: movimentos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    }
  })
}
