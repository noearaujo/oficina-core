import { db } from '../../../../utils/storage'
import { obterFusoUnidade, estaNoPeriodo, calcularLimitesPeriodo } from '../../../../utils/datas'
import { calcularFaturamento } from '../../../../utils/os'
import type { ItemOS } from '../../../../utils/os'
import type { LancamentoCaixa } from '../../../../utils/caixa'
import type { Carteira, Caixa, SessaoCaixa, OrdemServico, Cliente } from '~/types'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))
  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const query = getQuery(event)
  const fuso = await obterFusoUnidade(unidadeId)

  // Determina limites do período
  let dataInicio = typeof query.dataInicio === 'string' && query.dataInicio ? query.dataInicio : undefined
  let dataFim = typeof query.dataFim === 'string' && query.dataFim ? query.dataFim : undefined

  if (!dataInicio && !dataFim) {
    const limites = calcularLimitesPeriodo('mes', { fuso })
    dataInicio = limites.dataInicio
    dataFim = limites.dataFim
  }

  // Carrega coleções necessárias
  const [
    lancamentosRaw,
    carteirasRaw,
    caixasRaw,
    sessoesRaw,
    ordensServicoRaw,
    itensOSRaw,
    clientesRaw
  ] = await Promise.all([
    db.list(unidadeId, 'lancamentos'),
    db.list(unidadeId, 'carteiras'),
    db.list(unidadeId, 'caixas'),
    db.list(unidadeId, 'sessoesCaixa'),
    db.list(unidadeId, 'os'),
    db.list(unidadeId, 'itensOS'),
    db.list(unidadeId, 'clientes')
  ])

  const lancamentosTodos = lancamentosRaw as unknown as LancamentoCaixa[]
  const carteiras = carteirasRaw as unknown as Carteira[]
  const caixas = caixasRaw as unknown as Caixa[]
  const sessoes = sessoesRaw as unknown as SessaoCaixa[]
  const ordensServico = ordensServicoRaw as unknown as OrdemServico[]
  const itensOS = itensOSRaw as unknown as ItemOS[]
  const clientes = clientesRaw as unknown as Cliente[]

  const caixasMap = new Map<number, Caixa>(caixas.map(c => [c.id, c]))
  const carteirasMap = new Map<number, Carteira>(carteiras.map(c => [c.id, c]))
  const sessoesMap = new Map<number, SessaoCaixa>(sessoes.map(s => [s.id, s]))
  const clientesMap = new Map<number, Cliente>(clientes.map(c => [c.id, c]))

  // 1. Filtrar lançamentos no período
  const idsEstornados = new Set<number>()
  for (const l of lancamentosTodos) {
    if (l.estornoDe) {
      idsEstornados.add(Number(l.estornoDe))
      idsEstornados.add(l.id)
    }
  }

  const lancamentosPeriodo = lancamentosTodos.filter(l =>
    estaNoPeriodo(l.data, { dataInicio, dataFim }, fuso)
  )

  // Resultado do período
  // Receitas: entradas categoria pagamento, aporte, emprestimo_socio, sobra_caixa
  // Despesas operacionais: saídas categoria peca, material, alimento, fixo, folha, imposto, taxa_adquirente, retirada_rapida
  // EXCLUIR do resultado operacional: transferencia, devolucao, aporte, emprestimo_socio
  const categoriasReceitaOperacional = ['pagamento']
  const categoriasReceitaNaoOperacional = ['aporte', 'emprestimo_socio', 'sobra_caixa']
  const categoriasDespesaOperacional = [
    'peca', 'material', 'alimento', 'fixo', 'folha',
    'imposto', 'taxa_adquirente', 'retirada_rapida'
  ]

  let totalReceitasOperacionais = 0
  let totalReceitasNaoOperacionais = 0
  let totalDespesasOperacionais = 0
  let totalDevolucoes = 0
  let totalTransferencias = 0

  const porCategoria: Record<string, { tipo: 'entrada' | 'saida', total: number, count: number }> = {}

  for (const l of lancamentosPeriodo) {
    const valor = Math.round(Number(l.valor || 0))
    const cat = String(l.categoria || 'outro')
    const estornado = idsEstornados.has(l.id)

    if (!porCategoria[cat]) {
      porCategoria[cat] = { tipo: l.tipo, total: 0, count: 0 }
    }
    porCategoria[cat].count += 1
    if (!estornado) {
      porCategoria[cat].total += valor
    }

    if (estornado) continue

    if (l.tipo === 'entrada') {
      if (categoriasReceitaOperacional.includes(cat)) {
        totalReceitasOperacionais += valor
      } else if (categoriasReceitaNaoOperacional.includes(cat)) {
        totalReceitasNaoOperacionais += valor
      }
    } else if (l.tipo === 'saida') {
      if (categoriasDespesaOperacional.includes(cat)) {
        totalDespesasOperacionais += valor
      } else if (cat === 'devolucao') {
        totalDevolucoes += valor
      }
    }

    if (cat === 'transferencia') {
      totalTransferencias += valor
    }
  }

  const totalReceitas = totalReceitasOperacionais + totalReceitasNaoOperacionais
  const resultadoOperacional = totalReceitasOperacionais - totalDespesasOperacionais
  const resultadoLiquido = totalReceitas - totalDespesasOperacionais - totalDevolucoes

  // 2. A Receber: OS com status >= aprovada e saldo > 0
  const statusPermitidos = ['aprovada', 'em_execucao', 'concluida', 'entregue']
  const itensPorOS = new Map<number, ItemOS[]>()
  for (const item of itensOS) {
    const osId = Number(item.osId)
    if (!itensPorOS.has(osId)) itensPorOS.set(osId, [])
    itensPorOS.get(osId)!.push(item)
  }

  const aReceberLista = []
  let totalAReceber = 0

  for (const os of ordensServico) {
    if (os.deletedAt) continue
    if (!statusPermitidos.includes(os.status)) continue

    const itens = itensPorOS.get(os.id) || (os.itens as unknown as ItemOS[]) || []
    const faturamento = await calcularFaturamento(unidadeId, { id: os.id, itens, desconto: os.desconto }, lancamentosTodos)

    if (faturamento.saldo > 0) {
      totalAReceber += faturamento.saldo
      const cliente = clientesMap.get(os.clienteId)
      aReceberLista.push({
        id: os.id,
        numero: os.numero,
        clienteNome: cliente?.nome || 'Não informado',
        status: os.status,
        dataEntrada: os.dataEntrada,
        previsaoEntrega: os.previsaoEntrega,
        total: faturamento.total,
        pago: faturamento.pago,
        saldo: faturamento.saldo,
        badge: faturamento.badge
      })
    }
  }

  // Ordena a receber por saldo decrescente
  aReceberLista.sort((a, b) => b.saldo - a.saldo)

  // 3. Saldo por Carteira: saldoInicial + entradas - saídas
  const saldoPorCarteira = carteiras.map((c) => {
    const saldoInicial = Math.round(Number(c.saldoInicial || 0))
    const delta = lancamentosTodos.reduce((acc, l) => {
      if (Number(l.carteiraId) !== c.id) return acc
      const val = Math.round(Number(l.valor || 0))
      return l.tipo === 'entrada' ? acc + val : acc - val
    }, 0)
    const saldo = saldoInicial + delta
    return {
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      saldoInicial,
      saldo,
      ativa: c.ativa !== false
    }
  })

  const totalSaldoCarteiras = saldoPorCarteira.reduce((s, c) => s + c.saldo, 0)

  // 4. Saldo por Caixa: sessões abertas com saldo esperado
  const sessoesAbertas = sessoes.filter(s => s.status === 'aberta')
  const saldoPorCaixa = sessoesAbertas.map((s) => {
    const caixa = caixasMap.get(Number(s.caixaId))
    const lancamentosSessao = lancamentosTodos.filter(l => Number(l.sessaoCaixaId) === s.id)
    const saldoEsperado = lancamentosSessao.reduce((acc, l) => {
      const val = Math.round(Number(l.valor || 0))
      return l.tipo === 'entrada' ? acc + val : acc - val
    }, 0)

    return {
      sessaoId: s.id,
      caixaId: s.caixaId,
      caixaNome: caixa?.nome || `Caixa #${s.caixaId}`,
      responsavelNome: s.responsavelNome || `Usuário #${s.abertaPorUsuarioId}`,
      abertaEm: s.abertaEm,
      valorAbertura: Math.round(Number(s.valorAbertura || 0)),
      saldoEsperado
    }
  })

  const totalSaldoCaixas = saldoPorCaixa.reduce((s, c) => s + c.saldoEsperado, 0)

  // 5. Últimos lançamentos: extrato (data, tipo, categoria, valor, modalidade, local)
  const ultimosLancamentos = lancamentosPeriodo
    .map((l) => {
      let local = '—'
      if (l.sessaoCaixaId) {
        const sessao = sessoesMap.get(Number(l.sessaoCaixaId))
        const caixa = sessao ? caixasMap.get(Number(sessao.caixaId)) : undefined
        local = caixa ? `Caixa: ${caixa.nome}` : `Caixa #${l.sessaoCaixaId}`
      } else if (l.carteiraId) {
        const carteira = carteirasMap.get(Number(l.carteiraId))
        local = carteira ? `Carteira: ${carteira.nome}` : `Carteira #${l.carteiraId}`
      }

      return {
        id: l.id,
        data: l.data,
        tipo: l.tipo,
        categoria: l.categoria,
        valor: Math.round(Number(l.valor || 0)),
        modalidade: l.modalidade,
        local,
        observacao: l.observacao || '',
        documentoId: l.documentoId,
        documentoTipo: l.documentoTipo,
        estornoDe: l.estornoDe
      }
    })
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

  return {
    periodo: {
      dataInicio,
      dataFim,
      fuso
    },
    resultado: {
      receitas: totalReceitas,
      receitasOperacionais: totalReceitasOperacionais,
      receitasNaoOperacionais: totalReceitasNaoOperacionais,
      despesasOperacionais: totalDespesasOperacionais,
      resultadoOperacional,
      devolucoes: totalDevolucoes,
      transferencias: totalTransferencias,
      resultadoLiquido,
      porCategoria
    },
    aReceber: {
      total: totalAReceber,
      itens: aReceberLista
    },
    carteiras: {
      total: totalSaldoCarteiras,
      itens: saldoPorCarteira
    },
    caixas: {
      total: totalSaldoCaixas,
      itens: saldoPorCaixa
    },
    saldoGeral: totalSaldoCarteiras + totalSaldoCaixas,
    lancamentos: ultimosLancamentos
  }
})
