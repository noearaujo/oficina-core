import * as z from 'zod'
import { db } from './storage'
import { stripAccents } from './clientes'
import { baixarEstoqueVenda } from './estoque'
import type { ItemCatalogo } from './catalogo'
import type { Caixa, LancamentoCaixa, SessaoCaixa } from './caixa'
import type { Carteira } from './carteiras'

export const formasPagamentoPdv = [
  { label: 'Dinheiro', value: 'dinheiro' },
  { label: 'Pix', value: 'pix' },
  { label: 'Cartão de Crédito', value: 'credito' },
  { label: 'Cartão de Débito', value: 'debito' }
] as const

export type FormaPagamentoPDV = (typeof formasPagamentoPdv)[number]['value']

export const vendaItemSchema = z.object({
  catalogoId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive('Selecione um produto do catálogo').optional()
  ),
  produtoId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  nome: z.string().trim().optional().default(''),
  tipo: z.string().trim().optional(),
  unidade: z.string().trim().optional(),
  quantidade: z.coerce.number().positive('A quantidade deve ser maior que zero'),
  precoUnitario: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int('Preço unitário deve ser inteiro em centavos').min(0, 'Preço unitário inválido').optional()
  ),
  preco: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int('Preço deve ser inteiro em centavos').min(0, 'Preço inválido').optional()
  )
}).superRefine((item, ctx) => {
  if (item.tipo && item.tipo !== 'produto') {
    ctx.addIssue({
      code: 'custom',
      path: ['tipo'],
      message: 'Apenas itens do tipo produto são permitidos no PDV. Serviços vão na OS.'
    })
  }

  const catId = item.catalogoId ?? item.produtoId
  if (!catId) {
    ctx.addIssue({
      code: 'custom',
      path: ['catalogoId'],
      message: 'Selecione um produto do catálogo'
    })
  }
}).transform(item => ({
  catalogoId: (item.catalogoId ?? item.produtoId)!,
  nome: item.nome || '',
  unidade: item.unidade,
  quantidade: Number(item.quantidade),
  precoUnitario: item.precoUnitario ?? item.preco
}))

export const vendaSchema = z.object({
  clienteId: z.preprocess(
    value => (
      value === ''
      || value === null
      || value === undefined
      || value === 0
      || value === '0'
      || value === 'avulso'
        ? undefined
        : value
    ),
    z.coerce.number().int().positive('Cliente inválido').optional()
  ),
  funcionarioId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? 1 : value),
    z.coerce.number().int().positive().default(1)
  ),
  formaPagamento: z.enum(['dinheiro', 'pix', 'credito', 'debito'], {
    message: 'Selecione uma forma de pagamento válida (dinheiro, pix, credito ou debito)'
  }).optional(),
  modalidade: z.enum(['dinheiro', 'pix', 'credito', 'debito']).optional(),
  sessaoCaixaId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive('Selecione uma sessão de Caixa aberta').optional()
  ),
  caixaId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive('Selecione um Caixa aberto').optional()
  ),
  carteiraId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive('Selecione uma Carteira bancária').optional()
  ),
  destinoId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  observacao: z.string().trim().optional().default(''),
  itens: z.array(vendaItemSchema).min(1, 'Adicione pelo menos um produto à venda')
}).superRefine((dados, ctx) => {
  const forma = dados.formaPagamento ?? dados.modalidade
  if (!forma) {
    ctx.addIssue({
      code: 'custom',
      path: ['formaPagamento'],
      message: 'Selecione a forma de pagamento'
    })
  }
}).transform((dados) => {
  const formaPagamento = (dados.formaPagamento ?? dados.modalidade)!
  return {
    clienteId: dados.clienteId,
    funcionarioId: dados.funcionarioId || 1,
    formaPagamento,
    sessaoCaixaId: formaPagamento === 'dinheiro' ? (dados.sessaoCaixaId ?? dados.destinoId) : undefined,
    caixaId: formaPagamento === 'dinheiro' ? dados.caixaId : undefined,
    carteiraId: formaPagamento !== 'dinheiro' ? (dados.carteiraId ?? dados.destinoId) : undefined,
    observacao: dados.observacao || '',
    itens: dados.itens
  }
})

export const pdvSchema = vendaSchema
export const finalizarVendaSchema = vendaSchema

export type VendaItemInput = z.output<typeof vendaItemSchema>
export type VendaInput = z.output<typeof vendaSchema>

export interface VendaItem {
  id: number
  unidadeId: number
  vendaId: number
  catalogoId?: number
  nome: string
  unidade?: string
  quantidade: number
  precoUnitario: number
  [key: string]: unknown
}

export interface Venda {
  id: number
  unidadeId: number
  numero: string
  clienteId?: number
  funcionarioId: number
  itens: VendaItem[]
  formaPagamento: FormaPagamentoPDV | string
  sessaoCaixaId?: number
  caixaId?: number
  carteiraId?: number
  lancamentoId?: number
  observacao?: string
  dataCriacao: string
  [key: string]: unknown
}

export interface VendaComDetalhes extends Venda {
  clienteNome: string
  caixaNome?: string
  carteiraNome?: string
  destinoNome?: string
  total: number
}

interface ClienteRecord {
  id: number
  unidadeId: number
  usuarioId?: number
  nome?: string
  nomeFantasia?: string
  razaoSocial?: string
  deletedAt?: string
  [key: string]: unknown
}

interface UnidadeRecord {
  id: number
  unidadeId: number
  nome?: string
  nextOsNumber?: number
  nextVendaNumber?: number
  [key: string]: unknown
}

export async function calcularTotalVenda(
  itens: Array<{ quantidade: number, precoUnitario: number }>
): Promise<number> {
  return itens.reduce((acc, item) => {
    const qtd = Number(item.quantidade || 0)
    const preco = Math.round(Number(item.precoUnitario || 0))
    return acc + Math.round(qtd * preco)
  }, 0)
}

async function gerarProximoNumeroVenda(
  unidadeId: number,
  vendasExistentes: Venda[]
): Promise<string> {
  const maxExistente = vendasExistentes.reduce((max, v) => {
    const match = String(v.numero || '').match(/(\d+)/)
    const num = match ? Number(match[1]) : Number(v.id || 0)
    return Number.isFinite(num) && num > max ? num : max
  }, 0)

  const unidades = await db.list<UnidadeRecord>(unidadeId, 'unidades')
  const unidade = unidades.find(u => Number(u.id) === unidadeId) ?? unidades[0]
  const contadorUnidade = Number(unidade?.nextVendaNumber ?? 1)
  const proximo = Math.max(
    Number.isFinite(contadorUnidade) && contadorUnidade > 0 ? contadorUnidade : 1,
    maxExistente + 1
  )

  if (unidade) {
    await db.update<UnidadeRecord>(unidadeId, 'unidades', unidade.id, {
      nextVendaNumber: proximo + 1
    })
  } else {
    await db.insert<UnidadeRecord>(unidadeId, 'unidades', {
      nome: `Unidade ${unidadeId}`,
      ativo: true,
      nextOsNumber: 1,
      nextVendaNumber: proximo + 1,
      dataCriacao: new Date().toISOString()
    })
  }

  return `V-${String(proximo).padStart(4, '0')}`
}

export async function montarVendaComDetalhes(
  unidadeId: number,
  venda: Venda,
  dadosPre?: {
    vendaItens?: VendaItem[]
    clientes?: ClienteRecord[]
    caixas?: Caixa[]
    sessoes?: SessaoCaixa[]
    carteiras?: Carteira[]
    lancamentos?: LancamentoCaixa[]
  }
): Promise<VendaComDetalhes> {
  const [vendaItensAll, clientes, caixas, sessoes, carteiras, lancamentos] = await Promise.all([
    dadosPre?.vendaItens ? Promise.resolve(dadosPre.vendaItens) : db.list<VendaItem>(unidadeId, 'vendaItens'),
    dadosPre?.clientes ? Promise.resolve(dadosPre.clientes) : db.list<ClienteRecord>(unidadeId, 'clientes'),
    dadosPre?.caixas ? Promise.resolve(dadosPre.caixas) : db.list<Caixa>(unidadeId, 'caixas'),
    dadosPre?.sessoes ? Promise.resolve(dadosPre.sessoes) : db.list<SessaoCaixa>(unidadeId, 'sessoesCaixa'),
    dadosPre?.carteiras ? Promise.resolve(dadosPre.carteiras) : db.list<Carteira>(unidadeId, 'carteiras'),
    dadosPre?.lancamentos ? Promise.resolve(dadosPre.lancamentos) : db.list<LancamentoCaixa>(unidadeId, 'lancamentos')
  ])

  const itensDaColecao = vendaItensAll.filter(item => Number(item.vendaId) === venda.id)
  const itensBase = itensDaColecao.length > 0
    ? itensDaColecao
    : Array.isArray(venda.itens)
      ? venda.itens
      : []

  const itens: VendaItem[] = itensBase.map((item, idx) => ({
    id: Number(item.id || idx + 1),
    unidadeId,
    vendaId: venda.id,
    ...(item.catalogoId !== undefined ? { catalogoId: Number(item.catalogoId) } : {}),
    nome: String(item.nome || ''),
    ...(item.unidade ? { unidade: String(item.unidade) } : {}),
    quantidade: Number(item.quantidade || 0),
    precoUnitario: Math.round(Number(item.precoUnitario || 0))
  }))

  const total = await calcularTotalVenda(itens)

  const cliente = venda.clienteId
    ? clientes.find(c => c.id === Number(venda.clienteId))
    : undefined

  const clienteNome = cliente
    ? (cliente.nome || cliente.nomeFantasia || cliente.razaoSocial || `Cliente #${cliente.id}`)
    : 'Avulso'

  const lancamentoVinculado = lancamentos.find(
    l => l.documentoTipo === 'venda' && Number(l.documentoId) === venda.id
  )

  const sessaoCaixaId = venda.sessaoCaixaId ?? lancamentoVinculado?.sessaoCaixaId
  const carteiraId = venda.carteiraId ?? lancamentoVinculado?.carteiraId

  const sessao = sessaoCaixaId
    ? sessoes.find(s => s.id === Number(sessaoCaixaId))
    : undefined

  const caixaId = venda.caixaId ?? sessao?.caixaId
  const caixa = caixaId
    ? caixas.find(c => c.id === Number(caixaId))
    : undefined

  const carteira = carteiraId
    ? carteiras.find(c => c.id === Number(carteiraId))
    : undefined

  const caixaNome = caixa?.nome
  const carteiraNome = carteira?.nome
  const destinoNome = caixaNome || carteiraNome

  return {
    ...venda,
    clienteNome,
    itens,
    ...(sessaoCaixaId !== undefined ? { sessaoCaixaId: Number(sessaoCaixaId) } : {}),
    ...(caixaId !== undefined ? { caixaId: Number(caixaId) } : {}),
    ...(caixaNome ? { caixaNome } : {}),
    ...(carteiraId !== undefined ? { carteiraId: Number(carteiraId) } : {}),
    ...(carteiraNome ? { carteiraNome } : {}),
    ...(destinoNome ? { destinoNome } : {}),
    ...(lancamentoVinculado ? { lancamentoId: lancamentoVinculado.id } : {}),
    total
  }
}

export async function listarVendas(
  unidadeId: number,
  filtros?: { q?: string, formaPagamento?: string, clienteId?: number }
): Promise<VendaComDetalhes[]> {
  const [vendas, vendaItens, clientes, caixas, sessoes, carteiras, lancamentos] = await Promise.all([
    db.list<Venda>(unidadeId, 'vendas'),
    db.list<VendaItem>(unidadeId, 'vendaItens'),
    db.list<ClienteRecord>(unidadeId, 'clientes'),
    db.list<Caixa>(unidadeId, 'caixas'),
    db.list<SessaoCaixa>(unidadeId, 'sessoesCaixa'),
    db.list<Carteira>(unidadeId, 'carteiras'),
    db.list<LancamentoCaixa>(unidadeId, 'lancamentos')
  ])

  const termo = filtros?.q ? stripAccents(filtros.q.trim()).toLowerCase() : ''
  const formaFiltro = filtros?.formaPagamento && filtros.formaPagamento !== 'todos'
    ? filtros.formaPagamento
    : ''
  const clienteIdFiltro = filtros?.clienteId

  const ordenadas = [...vendas].sort((a, b) => {
    const diff = new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime()
    return diff !== 0 ? diff : b.id - a.id
  })

  const resultado: VendaComDetalhes[] = []

  for (const venda of ordenadas) {
    const montada = await montarVendaComDetalhes(unidadeId, venda, {
      vendaItens,
      clientes,
      caixas,
      sessoes,
      carteiras,
      lancamentos
    })

    const correspondeBusca
      = !termo
        || montada.numero.toLowerCase().includes(termo)
        || stripAccents(montada.clienteNome).toLowerCase().includes(termo)
        || montada.itens.some(item => stripAccents(item.nome).toLowerCase().includes(termo))

    const correspondeForma = !formaFiltro || montada.formaPagamento === formaFiltro
    const correspondeCliente = !clienteIdFiltro || Number(montada.clienteId) === Number(clienteIdFiltro)

    if (correspondeBusca && correspondeForma && correspondeCliente) {
      resultado.push(montada)
    }
  }

  return resultado
}

export async function obterVenda(
  unidadeId: number,
  vendaId: number
): Promise<VendaComDetalhes | null> {
  const venda = await db.get<Venda>(unidadeId, 'vendas', vendaId)
  if (!venda) return null
  return await montarVendaComDetalhes(unidadeId, venda)
}

export async function finalizarVenda(
  unidadeId: number,
  dados: VendaInput
): Promise<VendaComDetalhes> {
  return await db.transaction(async () => {
    if (dados.clienteId !== undefined) {
      const cliente = await db.get<ClienteRecord>(unidadeId, 'clientes', dados.clienteId)
      if (!cliente || cliente.deletedAt) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Cliente não encontrado'
        })
      }
    }

    const catalogo = await db.list<ItemCatalogo>(unidadeId, 'catalogo')
    const catalogoPorId = new Map<number, ItemCatalogo>()
    for (const item of catalogo) {
      catalogoPorId.set(item.id, item)
    }

    const itensResolvidos: Array<{
      catalogoId: number
      nome: string
      unidade: string
      quantidade: number
      precoUnitario: number
    }> = []

    for (const itemInput of dados.itens) {
      const produto = catalogoPorId.get(Number(itemInput.catalogoId))

      if (!produto) {
        throw createError({
          statusCode: 404,
          statusMessage: `Produto #${itemInput.catalogoId} não encontrado no catálogo`
        })
      }

      if (produto.tipo !== 'produto') {
        throw createError({
          statusCode: 400,
          statusMessage: 'Apenas itens do tipo produto podem ser vendidos no PDV. Serviços vão na OS.'
        })
      }

      const precoUnitario
        = itemInput.precoUnitario !== undefined
          ? Math.round(Number(itemInput.precoUnitario))
          : Math.round(Number(produto.preco))

      if (!Number.isFinite(precoUnitario) || precoUnitario < 0) {
        throw createError({
          statusCode: 400,
          statusMessage: `Preço unitário inválido para o produto "${produto.nome}"`
        })
      }

      itensResolvidos.push({
        catalogoId: produto.id,
        nome: itemInput.nome?.trim() || produto.nome,
        unidade: itemInput.unidade?.trim() || produto.unidade,
        quantidade: Number(itemInput.quantidade),
        precoUnitario
      })
    }

    let sessaoDestino: SessaoCaixa | undefined
    let caixaDestino: Caixa | undefined
    let carteiraDestino: Carteira | undefined

    if (dados.formaPagamento === 'dinheiro') {
      const [caixas, sessoesAbertas] = await Promise.all([
        db.list<Caixa>(unidadeId, 'caixas'),
        db.list<SessaoCaixa>(unidadeId, 'sessoesCaixa', s => s.status === 'aberta')
      ])

      const caixasAtivosPorId = new Map<number, Caixa>()
      for (const cx of caixas) {
        if (cx.ativo !== false) {
          caixasAtivosPorId.set(cx.id, cx)
        }
      }

      const sessoesValidas = sessoesAbertas.filter(s => caixasAtivosPorId.has(Number(s.caixaId)))

      if (sessoesValidas.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Abra um Caixa para receber em dinheiro ou escolha Pix/cartão.'
        })
      }

      if (dados.sessaoCaixaId !== undefined) {
        sessaoDestino
          = sessoesValidas.find(s => s.id === Number(dados.sessaoCaixaId))
            ?? sessoesValidas.find(s => Number(s.caixaId) === Number(dados.sessaoCaixaId))

        if (!sessaoDestino) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Sessão de Caixa inválida ou fechada. Abra um Caixa para receber em dinheiro.'
          })
        }
      } else if (dados.caixaId !== undefined) {
        sessaoDestino = sessoesValidas.find(s => Number(s.caixaId) === Number(dados.caixaId))

        if (!sessaoDestino) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Não há sessão aberta para o Caixa selecionado.'
          })
        }
      } else {
        sessaoDestino = sessoesValidas[0]!
      }

      caixaDestino = caixasAtivosPorId.get(Number(sessaoDestino.caixaId))
    } else {
      const carteiras = await db.list<Carteira>(unidadeId, 'carteiras')
      const bancosAtivos = carteiras.filter(c => c.tipo === 'banco' && c.ativa !== false)

      if (dados.carteiraId !== undefined) {
        const selecionada = carteiras.find(c => c.id === Number(dados.carteiraId))

        if (!selecionada) {
          throw createError({
            statusCode: 404,
            statusMessage: 'Carteira bancária não encontrada nesta unidade'
          })
        }

        if (selecionada.tipo !== 'banco') {
          throw createError({
            statusCode: 400,
            statusMessage: 'Pagamentos via Pix ou cartão devem ser destinados a uma Carteira do tipo Banco'
          })
        }

        if (selecionada.ativa === false) {
          throw createError({
            statusCode: 400,
            statusMessage: 'A Carteira bancária selecionada está inativa'
          })
        }

        carteiraDestino = selecionada
      } else if (bancosAtivos.length > 0) {
        carteiraDestino = bancosAtivos[0]!
      } else {
        throw createError({
          statusCode: 400,
          statusMessage: 'Cadastre uma Carteira do tipo Banco antes de receber via Pix ou cartão.'
        })
      }
    }

    const vendasExistentes = await db.list<Venda>(unidadeId, 'vendas')
    const numero = await gerarProximoNumeroVenda(unidadeId, vendasExistentes)
    const agora = new Date().toISOString()
    const funcionarioId = dados.funcionarioId || 1

    const vendaInicial = await db.insert<Venda>(unidadeId, 'vendas', {
      numero,
      ...(dados.clienteId !== undefined ? { clienteId: dados.clienteId } : {}),
      funcionarioId,
      itens: [],
      formaPagamento: dados.formaPagamento,
      ...(sessaoDestino ? { sessaoCaixaId: sessaoDestino.id } : {}),
      ...(caixaDestino ? { caixaId: caixaDestino.id } : {}),
      ...(carteiraDestino ? { carteiraId: carteiraDestino.id } : {}),
      ...(dados.observacao ? { observacao: dados.observacao } : {}),
      dataCriacao: agora
    })

    const itensCriados: VendaItem[] = []

    for (const item of itensResolvidos) {
      const vendaItem = await db.insert<VendaItem>(unidadeId, 'vendaItens', {
        vendaId: vendaInicial.id,
        catalogoId: item.catalogoId,
        nome: item.nome,
        unidade: item.unidade,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario
      })

      itensCriados.push({
        id: vendaItem.id,
        unidadeId,
        vendaId: vendaInicial.id,
        catalogoId: item.catalogoId,
        nome: item.nome,
        unidade: item.unidade,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario
      })
    }

    const totalVenda = await calcularTotalVenda(itensCriados)

    const lancamento = await db.insert<LancamentoCaixa>(unidadeId, 'lancamentos', {
      tipo: 'entrada',
      ...(sessaoDestino ? { sessaoCaixaId: sessaoDestino.id } : {}),
      ...(carteiraDestino ? { carteiraId: carteiraDestino.id } : {}),
      valor: totalVenda,
      data: agora,
      documentoId: vendaInicial.id,
      documentoTipo: 'venda',
      modalidade: dados.formaPagamento,
      categoria: 'pagamento',
      observacao: dados.observacao || `Venda ${numero}`,
      criadoPorUsuarioId: funcionarioId,
      dataCriacao: agora
    })

    const vendaAtualizada = (await db.update<Venda>(unidadeId, 'vendas', vendaInicial.id, {
      itens: itensCriados,
      lancamentoId: lancamento.id
    })) ?? {
      ...vendaInicial,
      itens: itensCriados,
      lancamentoId: lancamento.id
    }

    await baixarEstoqueVenda(unidadeId, {
      vendaId: vendaInicial.id,
      vendaNumero: numero,
      usuarioId: funcionarioId,
      data: agora,
      itens: itensCriados
    })

    return await montarVendaComDetalhes(unidadeId, vendaAtualizada)
  })
}
