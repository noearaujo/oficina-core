import { db } from '../storage'
import { stripAccents, somenteNumeros } from '../clientes'
import { normalizarPlaca } from '../veiculos'
import type { LancamentoCaixa } from '../caixa'
import { calcularFaturamento } from './faturamento'
import type {
  ClienteRecord,
  EnvioOrcamento,
  ItemOS,
  Nota,
  OrdemServico,
  OrdemServicoDetalhe,
  VeiculoRecord
} from './types'

export * from './types'
export * from './schemas'
export * from './helpers'
export * from './faturamento'
export * from './criar'
export * from './itens'
export * from './transicoes'

export async function montarOSDetalhe(
  unidadeId: number,
  os: OrdemServico,
  dadosPre?: {
    itensOS?: ItemOS[]
    notas?: Nota[]
    envios?: EnvioOrcamento[]
    lancamentos?: LancamentoCaixa[]
    clientes?: ClienteRecord[]
    veiculos?: VeiculoRecord[]
  }
): Promise<OrdemServicoDetalhe> {
  const [itensAll, notasAll, enviosAll, lancamentos, clientes, veiculos] = await Promise.all([
    dadosPre?.itensOS ? Promise.resolve(dadosPre.itensOS) : db.list<ItemOS>(unidadeId, 'itensOS'),
    dadosPre?.notas ? Promise.resolve(dadosPre.notas) : db.list<Nota>(unidadeId, 'notas'),
    dadosPre?.envios ? Promise.resolve(dadosPre.envios) : db.list<EnvioOrcamento>(unidadeId, 'enviosOrcamento'),
    dadosPre?.lancamentos ? Promise.resolve(dadosPre.lancamentos) : db.list<LancamentoCaixa>(unidadeId, 'lancamentos'),
    dadosPre?.clientes ? Promise.resolve(dadosPre.clientes) : db.list<ClienteRecord>(unidadeId, 'clientes'),
    dadosPre?.veiculos ? Promise.resolve(dadosPre.veiculos) : db.list<VeiculoRecord>(unidadeId, 'veiculos')
  ])

  const itensDaColecao = itensAll.filter(i => Number(i.osId) === os.id)
  const itens = (itensDaColecao.length > 0 ? itensDaColecao : (os.itens || []))
    .slice()
    .sort((a, b) => a.id - b.id)

  const notasDaColecao = notasAll.filter(n => Number(n.osId) === os.id)
  const notas = (notasDaColecao.length > 0 ? notasDaColecao : (os.notas || []))
    .slice()
    .sort((a, b) => {
      const diff = new Date(b.data).getTime() - new Date(a.data).getTime()
      return diff !== 0 ? diff : b.id - a.id
    })

  const envios = enviosAll
    .filter(e => Number(e.osId) === os.id)
    .sort((a, b) => {
      const diff = new Date(b.solicitadoEm).getTime() - new Date(a.solicitadoEm).getTime()
      return diff !== 0 ? diff : b.id - a.id
    })

  const faturamento = await calcularFaturamento(
    unidadeId,
    { id: os.id, itens, desconto: os.desconto },
    lancamentos
  )

  const cliente = clientes.find(c => c.id === Number(os.clienteId))
  const veiculo = veiculos.find(v => v.id === Number(os.veiculoId))

  // Garantir que campos derivados não vazem do storage caso algum registro antigo os tenha
  const osLimpa = { ...os }
  delete (osLimpa as Record<string, unknown>).total
  delete (osLimpa as Record<string, unknown>).pago
  delete (osLimpa as Record<string, unknown>).saldo
  delete (osLimpa as Record<string, unknown>).badge

  return {
    ...osLimpa,
    itens,
    notas,
    envios,
    faturamento,
    ...(cliente
      ? {
          clienteNome: cliente.nome || cliente.nomeFantasia || cliente.razaoSocial,
          clienteCpf: cliente.cpf || cliente.cnpj,
          clienteTelefone: cliente.telefone
        }
      : {}),
    ...(veiculo
      ? {
          veiculoPlaca: normalizarPlaca(veiculo.placa || ''),
          veiculoMarca: veiculo.marca,
          veiculoModelo: veiculo.modelo,
          veiculoCor: veiculo.cor,
          veiculoAno: veiculo.anoModelo || veiculo.anoFabricacao
        }
      : {})
  }
}

export async function listarOS(
  unidadeId: number,
  filtros?: {
    status?: string
    q?: string
    clienteId?: number
    veiculoId?: number
    tipo?: string
    dataInicio?: string
    dataFim?: string
    incluirPrevisao?: boolean
  }
): Promise<OrdemServicoDetalhe[]> {
  const [listaOS, itensOS, notas, envios, lancamentos, clientes, veiculos] = await Promise.all([
    db.list<OrdemServico>(unidadeId, 'os', item => !item.deletedAt),
    db.list<ItemOS>(unidadeId, 'itensOS'),
    db.list<Nota>(unidadeId, 'notas'),
    db.list<EnvioOrcamento>(unidadeId, 'enviosOrcamento'),
    db.list<LancamentoCaixa>(unidadeId, 'lancamentos'),
    db.list<ClienteRecord>(unidadeId, 'clientes'),
    db.list<VeiculoRecord>(unidadeId, 'veiculos')
  ])

  const statusFiltro
    = filtros?.status && filtros.status !== 'todos' && filtros.status !== 'all'
      ? filtros.status.trim()
      : ''

  const qRaw = (filtros?.q || '').trim()
  const qNorm = qRaw ? stripAccents(qRaw).toLowerCase() : ''
  const qDigits = qRaw ? somenteNumeros(qRaw) : ''

  const ordenadas = [...listaOS].sort((a, b) => {
    const diff = new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime()
    return diff !== 0 ? diff : b.id - a.id
  })

  const resultado: OrdemServicoDetalhe[] = []

  for (const os of ordenadas) {
    if (statusFiltro && os.status !== statusFiltro) continue
    if (filtros?.clienteId && Number(os.clienteId) !== Number(filtros.clienteId)) continue
    if (filtros?.veiculoId && Number(os.veiculoId) !== Number(filtros.veiculoId)) continue
    if (filtros?.tipo && os.tipo !== filtros.tipo) continue
    if (filtros?.dataInicio || filtros?.dataFim) {
      const noPeriodo = (data?: string) => {
        if (!data) return false
        if (filtros.dataInicio && data < filtros.dataInicio) return false
        if (filtros.dataFim && data > filtros.dataFim) return false
        return true
      }

      // Por padrão filtra apenas pela entrada (usado em relatórios).
      // Se incluirPrevisao for true (Agenda), aceita também OSs com entrega prevista no período.
      const bateEntrada = noPeriodo(os.dataEntrada)
      const batePrevisao = filtros.incluirPrevisao ? noPeriodo(os.previsaoEntrega) : false

      if (!bateEntrada && !batePrevisao) continue
    }

    const detalhe = await montarOSDetalhe(unidadeId, os, {
      itensOS,
      notas,
      envios,
      lancamentos,
      clientes,
      veiculos
    })

    if (qNorm) {
      const bateNumero = String(detalhe.numero || '').toLowerCase().includes(qNorm)
      const bateCliente = stripAccents(String(detalhe.clienteNome || '')).toLowerCase().includes(qNorm)
      const batePlaca = stripAccents(String(detalhe.veiculoPlaca || '')).toLowerCase().includes(qNorm)
      const cpfLimpo = somenteNumeros(String(detalhe.clienteCpf || ''))
      const bateCpf = qDigits.length > 0 && cpfLimpo.includes(qDigits)

      if (!bateNumero && !bateCliente && !batePlaca && !bateCpf) {
        continue
      }
    }

    resultado.push(detalhe)
  }

  return resultado
}

export async function obterOS(
  unidadeId: number,
  osId: number
): Promise<OrdemServicoDetalhe | null> {
  const os = await db.get<OrdemServico>(unidadeId, 'os', osId)
  if (!os || os.deletedAt) return null
  return await montarOSDetalhe(unidadeId, os)
}
