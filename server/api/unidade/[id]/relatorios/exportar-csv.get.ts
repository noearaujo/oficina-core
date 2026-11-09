import { db } from '../../../../utils/storage'
import { obterFusoUnidade, estaNoPeriodo, formatarDataBR, calcularLimitesPeriodo } from '../../../../utils/datas'
import { calcularFaturamento } from '../../../../utils/os'
import type { ItemOS } from '../../../../utils/os'
import type { LancamentoCaixa } from '../../../../utils/caixa'
import type { OrdemServico, Cliente, Carteira, Caixa, SessaoCaixa, Venda } from '~/types'

const STATUS_OS_LABEL: Record<string, string> = {
  aberta: 'Aberta',
  em_diagnostico: 'Em diagnóstico',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovada: 'Aprovada',
  em_execucao: 'Em execução',
  concluida: 'Concluída',
  entregue: 'Entregue',
  cancelada: 'Cancelada'
}

const STATUS_PAGAMENTO_LABEL: Record<string, string> = {
  pago: 'Pago',
  parcial: 'Parcial',
  pendente: 'Pendente'
}

const CATEGORIA_LABEL: Record<string, string> = {
  pagamento: 'Pagamento',
  devolucao: 'Devolução',
  peca: 'Peça',
  material: 'Material',
  alimento: 'Alimento',
  fixo: 'Custo fixo',
  folha: 'Folha de pagamento',
  imposto: 'Imposto',
  taxa_adquirente: 'Taxa adquirente',
  retirada_rapida: 'Retirada rápida',
  aporte: 'Aporte',
  emprestimo_socio: 'Empréstimo de sócio',
  transferencia: 'Transferência',
  sobra_caixa: 'Sobra de caixa',
  quebra_caixa: 'Quebra de caixa',
  outro: 'Outro'
}

const MODALIDADE_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  boleto: 'Boleto',
  transferencia: 'Transferência bancária'
}

function escaparCSV(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  const str = String(valor)
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function centavosParaCSV(centavos: number | undefined | null): string {
  const val = Number.isFinite(centavos) ? Number(centavos) : 0
  return (val / 100).toFixed(2).replace('.', ',')
}

export default defineEventHandler(async (event) => {
  const unidadeId = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(unidadeId) || unidadeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID de unidade inválido' })
  }

  const query = getQuery(event)
  const tipo = String(query.tipo || 'os').toLowerCase()
  if (tipo !== 'os' && tipo !== 'lancamentos') {
    throw createError({ statusCode: 400, statusMessage: 'Tipo de exportação inválido (deve ser "os" ou "lancamentos")' })
  }

  const fuso = await obterFusoUnidade(unidadeId)

  let dataInicio = typeof query.dataInicio === 'string' && query.dataInicio ? query.dataInicio : undefined
  let dataFim = typeof query.dataFim === 'string' && query.dataFim ? query.dataFim : undefined

  if (!dataInicio && !dataFim) {
    const limites = calcularLimitesPeriodo('mes', { fuso })
    dataInicio = limites.dataInicio
    dataFim = limites.dataFim
  }

  const dataInicioFormatada = dataInicio ? dataInicio.slice(0, 10) : 'inicio'
  const dataFimFormatada = dataFim ? dataFim.slice(0, 10) : 'fim'

  let csvContent = '\uFEFF' // UTF-8 BOM para abrir direto no Excel pt-BR
  const filename = `relatorio-${tipo}-${dataInicioFormatada}-${dataFimFormatada}.csv`

  if (tipo === 'os') {
    // OS com status >= aprovada e não canceladas, com dataEntrada no período
    const [ordensServicoRaw, itensOSRaw, clientesRaw, lancamentosRaw] = await Promise.all([
      db.list(unidadeId, 'os'),
      db.list(unidadeId, 'itensOS'),
      db.list(unidadeId, 'clientes'),
      db.list(unidadeId, 'lancamentos')
    ])

    const ordensServico = ordensServicoRaw as unknown as OrdemServico[]
    const itensOS = itensOSRaw as unknown as ItemOS[]
    const clientes = clientesRaw as unknown as Cliente[]
    const lancamentos = lancamentosRaw as unknown as LancamentoCaixa[]

    const clientesMap = new Map<number, Cliente>(clientes.map(c => [c.id, c]))
    const statusPermitidos = ['aprovada', 'em_execucao', 'concluida', 'entregue']

    const itensPorOS = new Map<number, ItemOS[]>()
    for (const item of itensOS) {
      const osId = Number(item.osId)
      if (!itensPorOS.has(osId)) itensPorOS.set(osId, [])
      itensPorOS.get(osId)!.push(item)
    }

    const colunas = [
      'N°',
      'Cliente',
      'CPF/CNPJ',
      'Data entrada',
      'Status',
      'Valor total',
      'Desconto',
      'Status pagamento'
    ]
    csvContent += colunas.join(';') + '\r\n'

    // Filtra OS válidas
    const osFiltradas = ordensServico.filter((os) => {
      if (os.deletedAt) return false
      if (!statusPermitidos.includes(os.status)) return false
      return estaNoPeriodo(os.dataEntrada, { dataInicio, dataFim }, fuso)
    })

    // Ordena por dataEntrada
    osFiltradas.sort((a, b) => new Date(a.dataEntrada).getTime() - new Date(b.dataEntrada).getTime())

    for (const os of osFiltradas) {
      const cliente = clientesMap.get(os.clienteId)
      const itens = itensPorOS.get(os.id) || (os.itens as unknown as ItemOS[]) || []
      const faturamento = await calcularFaturamento(unidadeId, { id: os.id, itens, desconto: os.desconto }, lancamentos)

      const docFiscal = cliente?.cpf || cliente?.cnpj || 'Não informado'

      const linha = [
        escaparCSV(`#${os.numero}`),
        escaparCSV(cliente?.nome || 'Não informado'),
        escaparCSV(docFiscal),
        escaparCSV(formatarDataBR(os.dataEntrada, fuso)),
        escaparCSV(STATUS_OS_LABEL[os.status] || os.status),
        escaparCSV(centavosParaCSV(faturamento.total)),
        escaparCSV(centavosParaCSV(faturamento.desconto)),
        escaparCSV(faturamento.badge ? (STATUS_PAGAMENTO_LABEL[faturamento.badge] || faturamento.badge) : 'Pendente')
      ]

      csvContent += linha.join(';') + '\r\n'
    }
  } else {
    // tipo === 'lancamentos'
    const [lancamentosRaw, carteirasRaw, caixasRaw, sessoesRaw, ordensServicoRaw, vendasRaw] = await Promise.all([
      db.list(unidadeId, 'lancamentos'),
      db.list(unidadeId, 'carteiras'),
      db.list(unidadeId, 'caixas'),
      db.list(unidadeId, 'sessoesCaixa'),
      db.list(unidadeId, 'os'),
      db.list(unidadeId, 'vendas')
    ])

    const lancamentos = lancamentosRaw as unknown as LancamentoCaixa[]
    const carteiras = carteirasRaw as unknown as Carteira[]
    const caixas = caixasRaw as unknown as Caixa[]
    const sessoes = sessoesRaw as unknown as SessaoCaixa[]
    const ordensServico = ordensServicoRaw as unknown as OrdemServico[]
    const vendas = vendasRaw as unknown as Venda[]

    const carteirasMap = new Map<number, Carteira>(carteiras.map(c => [c.id, c]))
    const caixasMap = new Map<number, Caixa>(caixas.map(c => [c.id, c]))
    const sessoesMap = new Map<number, SessaoCaixa>(sessoes.map(s => [s.id, s]))
    const osMap = new Map<number, OrdemServico>(ordensServico.map(o => [o.id, o]))
    const vendasMap = new Map<number, Venda>(vendas.map(v => [v.id, v]))

    const colunas = [
      'Data',
      'Tipo',
      'Categoria',
      'Modalidade',
      'Valor',
      'Descrição',
      'Local',
      'Documento',
      'Estorno de'
    ]
    csvContent += colunas.join(';') + '\r\n'

    const lancamentosFiltrados = lancamentos.filter(l =>
      estaNoPeriodo(l.data, { dataInicio, dataFim }, fuso)
    )

    lancamentosFiltrados.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())

    for (const l of lancamentosFiltrados) {
      let local = '—'
      if (l.sessaoCaixaId) {
        const sessao = sessoesMap.get(Number(l.sessaoCaixaId))
        const caixa = sessao ? caixasMap.get(Number(sessao.caixaId)) : undefined
        local = caixa ? `Caixa - ${caixa.nome}` : `Caixa #${l.sessaoCaixaId}`
      } else if (l.carteiraId) {
        const carteira = carteirasMap.get(Number(l.carteiraId))
        local = carteira ? `Carteira - ${carteira.nome}` : `Carteira #${l.carteiraId}`
      }

      let documento = '—'
      if (l.documentoTipo === 'os' && l.documentoId) {
        const os = osMap.get(Number(l.documentoId))
        documento = os ? `OS #${os.numero}` : `OS #${l.documentoId}`
      } else if (l.documentoTipo === 'venda' && l.documentoId) {
        const v = vendasMap.get(Number(l.documentoId))
        documento = v ? `Venda #${v.numero}` : `Venda #${l.documentoId}`
      }

      const estornoDe = l.estornoDe ? `Lançamento #${l.estornoDe}` : '—'

      const linha = [
        escaparCSV(formatarDataBR(l.data, fuso)),
        escaparCSV(l.tipo === 'entrada' ? 'Entrada' : 'Saída'),
        escaparCSV(CATEGORIA_LABEL[l.categoria] || l.categoria),
        escaparCSV(MODALIDADE_LABEL[l.modalidade] || l.modalidade),
        escaparCSV(centavosParaCSV(l.valor)),
        escaparCSV(l.observacao || ''),
        escaparCSV(local),
        escaparCSV(documento),
        escaparCSV(estornoDe)
      ]

      csvContent += linha.join(';') + '\r\n'
    }
  }

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)

  return csvContent
})
