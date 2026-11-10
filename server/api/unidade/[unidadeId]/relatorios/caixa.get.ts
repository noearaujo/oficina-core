import { db } from '../../../../utils/storage'
import { obterFusoUnidade, estaNoPeriodo, calcularLimitesPeriodo } from '../../../../utils/datas'
import type { Caixa, SessaoCaixa, LancamentoCaixa, Carteira } from '~/types'

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'unidadeId'))
  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const query = getQuery(event)
  const fuso = await obterFusoUnidade(unidadeId)

  // Filtros
  let dataInicio = typeof query.dataInicio === 'string' && query.dataInicio ? query.dataInicio : undefined
  let dataFim = typeof query.dataFim === 'string' && query.dataFim ? query.dataFim : undefined
  const filtroCaixaId = query.caixaId ? Number(query.caixaId) : undefined

  if (!dataInicio && !dataFim) {
    const limites = calcularLimitesPeriodo('mes', { fuso })
    dataInicio = limites.dataInicio
    dataFim = limites.dataFim
  }

  const [
    caixasRaw,
    sessoesRaw,
    lancamentosRaw,
    carteirasRaw
  ] = await Promise.all([
    db.list(unidadeId, 'caixas'),
    db.list(unidadeId, 'sessoesCaixa'),
    db.list(unidadeId, 'lancamentos'),
    db.list(unidadeId, 'carteiras')
  ])

  const caixas = caixasRaw as unknown as Caixa[]
  const sessoes = sessoesRaw as unknown as SessaoCaixa[]
  const lancamentos = lancamentosRaw as unknown as LancamentoCaixa[]
  const carteiras = carteirasRaw as unknown as Carteira[]

  const caixasMap = new Map<number, Caixa>(caixas.map(c => [c.id, c]))
  const carteirasMap = new Map<number, Carteira>(carteiras.map(c => [c.id, c]))
  const sessoesMap = new Map<number, SessaoCaixa>(sessoes.map(s => [s.id, s]))

  // 1. Histórico de fechamentos: sessões fechadas no período
  const sessoesFechadas = sessoes.filter((s) => {
    if (s.status !== 'fechada') return false
    if (filtroCaixaId && Number(s.caixaId) !== filtroCaixaId) return false
    const dataRef = s.fechadaEm || s.abertaEm
    return estaNoPeriodo(dataRef, { dataInicio, dataFim }, fuso)
  })

  const fechamentos = sessoesFechadas.map((s) => {
    const caixa = caixasMap.get(Number(s.caixaId))
    const lancsSessao = lancamentos.filter(l => Number(l.sessaoCaixaId) === s.id)

    const entradas = lancsSessao
      .filter(l => l.tipo === 'entrada')
      .reduce((acc, l) => acc + Math.round(Number(l.valor || 0)), 0)

    const saidas = lancsSessao
      .filter(l => l.tipo === 'saida')
      .reduce((acc, l) => acc + Math.round(Number(l.valor || 0)), 0)

    const saldoCalculado = entradas - saidas
    const esperado = s.saldoEsperadoFechamento !== undefined
      ? Math.round(Number(s.saldoEsperadoFechamento))
      : saldoCalculado

    const contado = s.valorContado !== undefined
      ? Math.round(Number(s.valorContado))
      : 0

    const diferenca = s.diferenca !== undefined
      ? Math.round(Number(s.diferenca))
      : contado - esperado

    const destino = s.carteiraDestinoNome
      || (s.carteiraDestinoId ? carteirasMap.get(Number(s.carteiraDestinoId))?.nome : undefined)
      || '—'

    return {
      sessaoId: s.id,
      caixaId: s.caixaId,
      caixaNome: caixa?.nome || `Caixa #${s.caixaId}`,
      responsavel: s.responsavelNome || `Usuário #${s.fechadaPorUsuarioId || s.abertaPorUsuarioId}`,
      abertaEm: s.abertaEm,
      fechadaEm: s.fechadaEm || s.abertaEm,
      valorAbertura: Math.round(Number(s.valorAbertura || 0)),
      entradas,
      saidas,
      esperado,
      contado,
      diferenca,
      destino,
      motivoFechamento: s.motivoFechamento || ''
    }
  })

  // Ordena fechamentos por data fechamento decrescente
  fechamentos.sort((a, b) => new Date(b.fechadaEm).getTime() - new Date(a.fechadaEm).getTime())

  // 2. Sobras e Quebras
  let totalSobras = 0
  let totalQuebras = 0
  const listaSobrasQuebras: Array<{
    sessaoId: number
    caixaId: number
    caixaNome: string
    responsavel: string
    data: string
    esperado: number
    contado: number
    diferenca: number
    tipo: 'sobra' | 'quebra'
    motivo: string
  }> = []

  for (const f of fechamentos) {
    if (f.diferenca > 0) {
      totalSobras += f.diferenca
      listaSobrasQuebras.push({
        sessaoId: f.sessaoId,
        caixaId: f.caixaId,
        caixaNome: f.caixaNome,
        responsavel: f.responsavel,
        data: f.fechadaEm,
        esperado: f.esperado,
        contado: f.contado,
        diferenca: f.diferenca,
        tipo: 'sobra',
        motivo: f.motivoFechamento
      })
    } else if (f.diferenca < 0) {
      totalQuebras += Math.abs(f.diferenca)
      listaSobrasQuebras.push({
        sessaoId: f.sessaoId,
        caixaId: f.caixaId,
        caixaNome: f.caixaNome,
        responsavel: f.responsavel,
        data: f.fechadaEm,
        esperado: f.esperado,
        contado: f.contado,
        diferenca: f.diferenca,
        tipo: 'quebra',
        motivo: f.motivoFechamento
      })
    }
  }

  // 3. Retiradas rápidas
  const retiradas = lancamentos
    .filter((l) => {
      if (l.categoria !== 'retirada_rapida') return false
      if (!l.sessaoCaixaId) return false
      const sessao = sessoesMap.get(Number(l.sessaoCaixaId))
      if (filtroCaixaId && sessao && Number(sessao.caixaId) !== filtroCaixaId) return false
      return estaNoPeriodo(l.data, { dataInicio, dataFim }, fuso)
    })
    .map((l) => {
      const sessao = sessoesMap.get(Number(l.sessaoCaixaId))
      const caixa = sessao ? caixasMap.get(Number(sessao.caixaId)) : undefined

      return {
        id: l.id,
        sessaoId: l.sessaoCaixaId!,
        caixaId: sessao?.caixaId ?? 0,
        caixaNome: caixa?.nome || (sessao ? `Caixa #${sessao.caixaId}` : 'Caixa'),
        data: l.data,
        valor: Math.round(Number(l.valor || 0)),
        justificativa: l.observacao || 'Retirada rápida',
        responsavel: sessao?.responsavelNome || `Usuário #${l.criadoPorUsuarioId}`
      }
    })
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

  const totalRetiradasRapidas = retiradas.reduce((s, r) => s + r.valor, 0)

  return {
    periodo: {
      dataInicio,
      dataFim,
      fuso,
      caixaId: filtroCaixaId
    },
    fechamentos: {
      total: fechamentos.length,
      itens: fechamentos
    },
    sobrasQuebras: {
      totalSobras,
      totalQuebras,
      itens: listaSobrasQuebras
    },
    retiradasRapidas: {
      total: totalRetiradasRapidas,
      itens: retiradas
    }
  }
})
