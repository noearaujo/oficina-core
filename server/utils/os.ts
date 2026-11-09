import { randomBytes } from 'node:crypto'
import * as z from 'zod'
import { db } from './storage'
import { stripAccents, somenteNumeros } from './clientes'
import { normalizarPlaca } from './veiculos'
import { baixarEstoqueItemOS, estornarEstoqueItemOS } from './estoque'
import type { ItemCatalogo } from './catalogo'
import type { LancamentoCaixa } from './caixa'

export const STATUS_OS = [
  'aberta',
  'em_diagnostico',
  'aguardando_aprovacao',
  'aprovada',
  'em_execucao',
  'concluida',
  'entregue',
  'cancelada'
] as const

export type StatusOS = (typeof STATUS_OS)[number]

export const STATUS_ITEM_OS = ['pendente', 'aprovado', 'recusado'] as const
export type StatusItemOS = (typeof STATUS_ITEM_OS)[number]

export const TIPOS_NOTA = [
  'item_add',
  'item_edit',
  'item_remove',
  'item_approve',
  'item_reject',
  'envio',
  'ajuste',
  'reversao',
  'cancelar',
  'pagamento',
  'transicao',
  'estoque'
] as const

export type TipoNota = (typeof TIPOS_NOTA)[number]

export const ROLES_VALIDOS = ['owner', 'admin', 'gerente', 'mecanico', 'recepcionista'] as const
export type RoleUsuario = (typeof ROLES_VALIDOS)[number]

export const ACOES_TRANSICAO = [
  'iniciar_diagnostico',
  'iniciar_execucao',
  'concluir',
  'entregar',
  'cancelar',
  'reverter_aprovacao'
] as const

export type AcaoTransicaoOS = (typeof ACOES_TRANSICAO)[number]

export interface ItemOS {
  id: number
  unidadeId: number
  osId: number
  catalogoId?: number
  nome: string
  tipo: 'servico' | 'produto'
  unidade?: string
  quantidade: number
  precoUnitario: number
  status: 'pendente' | 'aprovado' | 'recusado'
  lote: number | null
  enviado: boolean
  dataAprovacao?: string
  dataRecusa?: string
  motivoRecusa?: string
  estoqueBaixado?: boolean
  [key: string]: unknown
}

export interface Nota {
  id: number
  unidadeId: number
  osId: number
  texto: string
  tipo: TipoNota
  role: string
  data: string
  [key: string]: unknown
}

export interface EnvioOrcamento {
  id: number
  osId: number
  unidadeId: number
  canal: 'impressao' | 'imagem' | 'email' | 'link'
  status: 'pendente' | 'enviado' | 'gerado' | 'falhou'
  itensIds: number[]
  solicitadoEm: string
  concluidoEm?: string
  referencia?: string
  erro?: string
  usuarioId: number
  [key: string]: unknown
}

export interface OrdemServico {
  id: number
  unidadeId: number
  numero: string
  tipo: 'normal' | 'garantia'
  osOriginalId?: number
  veiculoId: number
  clienteId: number
  funcionarioId: number
  status: StatusOS
  queixa: string
  diagnostico?: string
  avarias?: string
  combustivel?: string
  quilometragem?: number
  dataEntrada: string
  previsaoEntrega?: string
  itens: ItemOS[]
  desconto?: number
  orcamentoEnviado: boolean
  token: string
  notas: Nota[]
  deletedAt?: string
  dataCriacao: string
  dataAtualizacao: string
  dataAprovacao?: string
  dataConclusao?: string
  dataEntrega?: string
  motivoCancelamento?: string
  [key: string]: unknown
}

export interface FaturamentoOS {
  subtotal: number
  desconto: number
  total: number
  pago: number
  saldo: number
  badge: 'pago' | 'parcial' | 'pendente' | null
  lancamentos: LancamentoCaixa[]
}

export interface OrdemServicoDetalhe extends OrdemServico {
  faturamento: FaturamentoOS
  envios: EnvioOrcamento[]
  clienteNome?: string
  clienteCpf?: string
  clienteTelefone?: string
  veiculoPlaca?: string
  veiculoMarca?: string
  veiculoModelo?: string
  veiculoCor?: string
  veiculoAno?: string | number
}

interface ClienteRecord {
  id: number
  unidadeId: number
  usuarioId?: number
  nome: string
  nomeBusca?: string
  cpf?: string
  cnpj?: string
  telefone?: string
  razaoSocial?: string
  nomeFantasia?: string
  deletedAt?: string
  [key: string]: unknown
}

interface VeiculoRecord {
  id: number
  unidadeId: number
  clienteId: number
  marca: string
  modelo: string
  versao?: string
  placa: string
  cor?: string
  combustivel?: string
  quilometragem?: number
  anoFabricacao?: string | number
  anoModelo?: string | number
  deletedAt?: string
  [key: string]: unknown
}

interface UnidadeRecord {
  id: number
  unidadeId: number
  nome?: string
  ativo?: boolean
  nextOsNumber?: number
  nextVendaNumber?: number
  dataCriacao?: string
  [key: string]: unknown
}

const vazioParaUndefined = (value: unknown) =>
  value === '' || value === null || value === undefined ? undefined : value

export const criarOsSchema = z.object({
  clienteId: z.preprocess(
    vazioParaUndefined,
    z.coerce.number({ message: 'Selecione o cliente' }).int().positive('Selecione o cliente')
  ),
  veiculoId: z.preprocess(
    vazioParaUndefined,
    z.coerce.number({ message: 'Selecione o veículo' }).int().positive('Selecione o veículo')
  ),
  funcionarioId: z.preprocess(
    vazioParaUndefined,
    z.coerce.number({ message: 'Selecione o responsável pela OS' }).int().positive('Selecione o responsável pela OS')
  ),
  queixa: z.string({ message: 'Informe a queixa do cliente' }).trim().min(1, 'Informe a queixa do cliente'),
  tipo: z.enum(['normal', 'garantia']).optional().default('normal'),
  osOriginalId: z.preprocess(
    vazioParaUndefined,
    z.coerce.number().int().positive().optional()
  ),
  diagnostico: z.string().trim().optional(),
  avarias: z.string().trim().optional(),
  combustivel: z.string().trim().optional(),
  quilometragem: z.preprocess(
    vazioParaUndefined,
    z.coerce.number().int().min(0, 'Quilometragem inválida').optional()
  ),
  km: z.preprocess(
    vazioParaUndefined,
    z.coerce.number().int().min(0, 'Quilometragem inválida').optional()
  ),
  dataEntrada: z.preprocess(
    vazioParaUndefined,
    z.string().refine(v => !Number.isNaN(new Date(v).getTime()), 'Data de entrada inválida').optional()
  ),
  previsaoEntrega: z.preprocess(
    vazioParaUndefined,
    z.string().refine(v => !Number.isNaN(new Date(v).getTime()), 'Previsão de entrega inválida').optional()
  ),
  previsao: z.preprocess(
    vazioParaUndefined,
    z.string().refine(v => !Number.isNaN(new Date(v).getTime()), 'Previsão de entrega inválida').optional()
  ),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
}).transform(d => ({
  clienteId: d.clienteId,
  veiculoId: d.veiculoId,
  funcionarioId: d.funcionarioId,
  queixa: d.queixa,
  tipo: d.tipo,
  osOriginalId: d.tipo === 'garantia' ? d.osOriginalId : undefined,
  diagnostico: d.diagnostico,
  avarias: d.avarias,
  combustivel: d.combustivel,
  quilometragem: d.quilometragem ?? d.km,
  dataEntrada: d.dataEntrada,
  previsaoEntrega: d.previsaoEntrega ?? d.previsao,
  role: d.role,
  usuarioId: d.usuarioId
}))

export const editarOsSchema = z.object({
  queixa: z.string().trim().min(1, 'A queixa não pode ficar vazia').optional(),
  diagnostico: z.string().trim().optional(),
  avarias: z.string().trim().optional(),
  combustivel: z.string().trim().optional(),
  quilometragem: z.preprocess(
    value => (value === '' ? null : value),
    z.coerce.number().int().min(0, 'Quilometragem inválida').nullable().optional()
  ),
  km: z.preprocess(
    value => (value === '' ? null : value),
    z.coerce.number().int().min(0, 'Quilometragem inválida').nullable().optional()
  ),
  previsaoEntrega: z.preprocess(
    value => (value === '' ? null : value),
    z.string().refine(v => !Number.isNaN(new Date(v).getTime()), 'Previsão de entrega inválida').nullable().optional()
  ),
  previsao: z.preprocess(
    value => (value === '' ? null : value),
    z.string().refine(v => !Number.isNaN(new Date(v).getTime()), 'Previsão de entrega inválida').nullable().optional()
  ),
  funcionarioId: z.preprocess(
    vazioParaUndefined,
    z.coerce.number().int().positive().optional()
  ),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
}).transform(d => ({
  queixa: d.queixa,
  diagnostico: d.diagnostico,
  avarias: d.avarias,
  combustivel: d.combustivel,
  quilometragem: d.quilometragem !== undefined ? d.quilometragem : d.km,
  previsaoEntrega: d.previsaoEntrega !== undefined ? d.previsaoEntrega : d.previsao,
  funcionarioId: d.funcionarioId,
  role: d.role,
  usuarioId: d.usuarioId
}))

export const transicionarOsSchema = z.object({
  acao: z.enum(ACOES_TRANSICAO, {
    message: 'Ação de transição inválida. Use: iniciar_diagnostico, iniciar_execucao, concluir, entregar, cancelar ou reverter_aprovacao'
  }),
  motivo: z.string().trim().optional(),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
})

export const adicionarItemOsSchema = z.object({
  catalogoId: z.preprocess(
    vazioParaUndefined,
    z.coerce.number().int().positive().optional()
  ),
  nome: z.string().trim().optional(),
  tipo: z.enum(['servico', 'produto']).optional(),
  unidade: z.string().trim().optional(),
  quantidade: z.preprocess(
    value => (value === '' || value === null || value === undefined ? 1 : value),
    z.coerce.number({ message: 'Informe a quantidade' }).positive('A quantidade deve ser maior que zero')
  ),
  precoUnitario: z.preprocess(
    vazioParaUndefined,
    z.coerce.number({ message: 'Informe o preço unitário' })
      .int('Preço unitário deve ser inteiro em centavos')
      .min(0, 'Preço unitário não pode ser negativo')
      .optional()
  ),
  preco: z.preprocess(
    vazioParaUndefined,
    z.coerce.number()
      .int('Preço deve ser inteiro em centavos')
      .min(0, 'Preço não pode ser negativo')
      .optional()
  ),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
}).transform(d => ({
  catalogoId: d.catalogoId,
  nome: d.nome,
  tipo: d.tipo,
  unidade: d.unidade,
  quantidade: Number(d.quantidade),
  precoUnitario: d.precoUnitario ?? d.preco,
  role: d.role,
  usuarioId: d.usuarioId
}))

export const editarItemOsSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do item').optional(),
  unidade: z.string().trim().min(1, 'Informe a unidade').optional(),
  quantidade: z.preprocess(
    vazioParaUndefined,
    z.coerce.number().positive('A quantidade deve ser maior que zero').optional()
  ),
  precoUnitario: z.preprocess(
    vazioParaUndefined,
    z.coerce.number()
      .int('Preço unitário deve ser inteiro em centavos')
      .min(0, 'Preço unitário não pode ser negativo')
      .optional()
  ),
  preco: z.preprocess(
    vazioParaUndefined,
    z.coerce.number()
      .int('Preço deve ser inteiro em centavos')
      .min(0, 'Preço não pode ser negativo')
      .optional()
  ),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
}).transform(d => ({
  nome: d.nome,
  unidade: d.unidade,
  quantidade: d.quantidade,
  precoUnitario: d.precoUnitario ?? d.preco,
  role: d.role,
  usuarioId: d.usuarioId
}))

export const recusarItemOsSchema = z.object({
  motivo: z.string({ message: 'Informe o motivo da recusa' }).trim().min(1, 'Informe o motivo da recusa'),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
})

export const ajustarOsSchema = z.object({
  motivo: z.string({ message: 'Informe o motivo do ajuste' }).trim().min(1, 'Informe o motivo do ajuste'),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
})

export const enviarOrcamentoSchema = z.object({
  canal: z.enum(['impressao', 'imagem', 'email', 'link'], {
    message: 'Selecione um canal válido (impressao ou imagem)'
  }),
  itensIds: z.array(z.coerce.number().int().positive()).optional(),
  referencia: z.string().trim().optional(),
  erro: z.string().trim().optional(),
  falhou: z.boolean().optional(),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
})

export const descontoOsSchema = z.object({
  desconto: z.preprocess(
    value => (value === '' || value === null || value === undefined ? 0 : value),
    z.coerce.number({ message: 'Informe o valor do desconto' })
      .int('O desconto deve ser inteiro em centavos')
      .min(0, 'O desconto não pode ser negativo')
  ),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
})

export type CriarOSInput = z.output<typeof criarOsSchema>
export type EditarOSInput = z.output<typeof editarOsSchema>
export type TransicionarOSInput = z.output<typeof transicionarOsSchema>
export type AdicionarItemOSInput = z.output<typeof adicionarItemOsSchema>
export type EditarItemOSInput = z.output<typeof editarItemOsSchema>
export type RecusarItemOSInput = z.output<typeof recusarItemOsSchema>
export type AjustarOSInput = z.output<typeof ajustarOsSchema>
export type EnviarOrcamentoInput = z.output<typeof enviarOrcamentoSchema>
export type DescontoOSInput = z.output<typeof descontoOsSchema>

function erro(statusCode: number, statusMessage: string): never {
  throw createError({ statusCode, statusMessage })
}

function normalizarRole(role?: string): RoleUsuario {
  const r = (role || 'admin').trim().toLowerCase()
  if ((ROLES_VALIDOS as readonly string[]).includes(r)) {
    return r as RoleUsuario
  }
  return 'admin'
}

function exigirRole(role: string | undefined, permitidos: readonly RoleUsuario[], acao: string): RoleUsuario {
  const normalizado = normalizarRole(role)
  if (!permitidos.includes(normalizado)) {
    erro(403, `Permissão negada: o papel "${normalizado}" não pode executar "${acao}"`)
  }
  return normalizado
}

async function carregarItensDaOS(unidadeId: number, os: OrdemServico): Promise<ItemOS[]> {
  const daColecao = await db.list<ItemOS>(
    unidadeId,
    'itensOS',
    item => Number(item.osId) === os.id
  )

  if (daColecao.length > 0) {
    return [...daColecao].sort((a, b) => a.id - b.id)
  }

  if (Array.isArray(os.itens) && os.itens.length > 0) {
    return [...os.itens].sort((a, b) => a.id - b.id)
  }

  return []
}

async function carregarNotasDaOS(unidadeId: number, os: OrdemServico): Promise<Nota[]> {
  const daColecao = await db.list<Nota>(
    unidadeId,
    'notas',
    nota => Number(nota.osId) === os.id
  )

  const base = daColecao.length > 0
    ? daColecao
    : Array.isArray(os.notas)
      ? os.notas
      : []

  return [...base].sort((a, b) => {
    const diff = new Date(b.data).getTime() - new Date(a.data).getTime()
    return diff !== 0 ? diff : b.id - a.id
  })
}

async function sincronizarSnapshotOS(
  unidadeId: number,
  osId: number,
  camposExtras?: Partial<OrdemServico>
): Promise<OrdemServico> {
  const os = await db.get<OrdemServico>(unidadeId, 'os', osId)
  if (!os) erro(404, 'Ordem de Serviço não encontrada')

  const [itens, notas] = await Promise.all([
    carregarItensDaOS(unidadeId, os),
    carregarNotasDaOS(unidadeId, os)
  ])

  const atualizada = await db.update<OrdemServico>(unidadeId, 'os', osId, {
    ...camposExtras,
    itens,
    notas,
    dataAtualizacao: camposExtras?.dataAtualizacao || new Date().toISOString()
  })

  return atualizada ?? {
    ...os,
    ...camposExtras,
    itens,
    notas
  }
}

export async function gerarNota(
  unidadeId: number,
  params: {
    osId: number
    tipo: TipoNota
    texto: string
    role?: string
    data?: string
  }
): Promise<Nota> {
  const data = params.data || new Date().toISOString()
  const role = normalizarRole(params.role)

  const nota = await db.insert<Nota>(unidadeId, 'notas', {
    osId: params.osId,
    tipo: params.tipo,
    texto: params.texto,
    role,
    data
  })

  return nota
}

export async function calcularFaturamento(
  unidadeId: number,
  os: Pick<OrdemServico, 'id' | 'itens' | 'desconto'>,
  lancamentosPre?: LancamentoCaixa[]
): Promise<FaturamentoOS> {
  const lancamentos
    = lancamentosPre
      ?? await db.list<LancamentoCaixa>(unidadeId, 'lancamentos')

  const itens = Array.isArray(os.itens) ? os.itens : []

  const subtotal = itens
    .filter(i => i.status === 'aprovado')
    .reduce((s, i) => s + Math.round(Number(i.quantidade || 0) * Math.round(Number(i.precoUnitario || 0))), 0)

  const desconto = Math.max(0, Math.round(Number(os.desconto || 0)))
  const total = Math.max(0, subtotal - desconto)

  const movimentosPagamento = lancamentos.filter(l =>
    Number(l.documentoId) === os.id
    && l.documentoTipo === 'os'
    && ['pagamento', 'devolucao'].includes(String(l.categoria || ''))
    && !l.estornoDe
    && !lancamentos.some(e => Number(e.estornoDe) === l.id)
  )

  const pago = movimentosPagamento.reduce(
    (s, l) => s + (l.tipo === 'entrada' ? Math.round(Number(l.valor || 0)) : -Math.round(Number(l.valor || 0))),
    0
  )

  const saldo = total - pago

  const badge: 'pago' | 'parcial' | 'pendente' | null
    = total === 0
      ? null
      : saldo <= 0
        ? 'pago'
        : pago > 0
          ? 'parcial'
          : 'pendente'

  return {
    subtotal,
    desconto,
    total,
    pago,
    saldo,
    badge,
    lancamentos: movimentosPagamento
  }
}

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

async function gerarProximoNumeroOS(
  unidadeId: number,
  osExistentes: OrdemServico[]
): Promise<string> {
  const maxExistente = osExistentes.reduce((max, item) => {
    const num = Number.parseInt(String(item.numero || '').replace(/\D/g, ''), 10)
    return Number.isFinite(num) && num > max ? num : max
  }, 0)

  const unidades = await db.list<UnidadeRecord>(unidadeId, 'unidades')
  const unidade = unidades.find(u => Number(u.id) === unidadeId) ?? unidades[0]
  const contadorUnidade = Number(unidade?.nextOsNumber ?? 1)
  const proximo = Math.max(
    Number.isFinite(contadorUnidade) && contadorUnidade > 0 ? contadorUnidade : 1,
    maxExistente + 1
  )

  if (unidade) {
    await db.update<UnidadeRecord>(unidadeId, 'unidades', unidade.id, {
      nextOsNumber: proximo + 1
    })
  } else {
    await db.insert<UnidadeRecord>(unidadeId, 'unidades', {
      nome: `Unidade ${unidadeId}`,
      ativo: true,
      nextOsNumber: proximo + 1,
      nextVendaNumber: 1,
      dataCriacao: new Date().toISOString()
    })
  }

  return String(proximo).padStart(4, '0')
}

export async function listarOS(
  unidadeId: number,
  filtros?: { status?: string, q?: string, clienteId?: number, veiculoId?: number, tipo?: string }
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

export async function criarOS(
  unidadeId: number,
  dadosInput: CriarOSInput
): Promise<OrdemServicoDetalhe> {
  const dados = criarOsSchema.parse(dadosInput)
  const role = exigirRole(dados.role, ['owner', 'admin', 'gerente', 'recepcionista'], 'criar OS')

  return await db.transaction(async () => {
    const cliente = await db.get<ClienteRecord>(unidadeId, 'clientes', dados.clienteId)
    if (!cliente || cliente.deletedAt) {
      erro(404, 'Cliente não encontrado')
    }

    const veiculo = await db.get<VeiculoRecord>(unidadeId, 'veiculos', dados.veiculoId)
    if (!veiculo || veiculo.deletedAt) {
      erro(404, 'Veículo não encontrado')
    }

    if (dados.tipo === 'garantia' && dados.osOriginalId !== undefined) {
      const original = await db.get<OrdemServico>(unidadeId, 'os', dados.osOriginalId)
      if (!original || original.deletedAt) {
        erro(404, 'OS original de garantia não encontrada')
      }
    }

    // Nunca reutilizar números (considera inclusive OS soft-deleted)
    const todasOS = await db.list<OrdemServico>(unidadeId, 'os')
    const numero = await gerarProximoNumeroOS(unidadeId, todasOS)
    const token = randomBytes(32).toString('hex')
    const agora = new Date().toISOString()
    const dataEntrada = dados.dataEntrada ? new Date(dados.dataEntrada).toISOString() : agora
    const previsaoEntrega = dados.previsaoEntrega ? new Date(dados.previsaoEntrega).toISOString() : undefined

    const novaOS = await db.insert<OrdemServico>(unidadeId, 'os', {
      numero,
      tipo: dados.tipo || 'normal',
      ...(dados.tipo === 'garantia' && dados.osOriginalId ? { osOriginalId: dados.osOriginalId } : {}),
      veiculoId: dados.veiculoId,
      clienteId: dados.clienteId,
      funcionarioId: dados.funcionarioId,
      status: 'aberta',
      queixa: dados.queixa,
      ...(dados.diagnostico ? { diagnostico: dados.diagnostico } : {}),
      ...(dados.avarias ? { avarias: dados.avarias } : {}),
      ...(dados.combustivel ? { combustivel: dados.combustivel } : {}),
      ...(dados.quilometragem !== undefined ? { quilometragem: dados.quilometragem } : {}),
      dataEntrada,
      ...(previsaoEntrega ? { previsaoEntrega } : {}),
      itens: [],
      orcamentoEnviado: false,
      token,
      notas: [],
      dataCriacao: agora,
      dataAtualizacao: agora
    })

    await gerarNota(unidadeId, {
      osId: novaOS.id,
      tipo: 'transicao',
      texto: 'OS criada',
      role,
      data: agora
    })

    const sincronizada = await sincronizarSnapshotOS(unidadeId, novaOS.id, { dataAtualizacao: agora })
    return await montarOSDetalhe(unidadeId, sincronizada)
  })
}

export async function editarOS(
  unidadeId: number,
  osId: number,
  dadosInput: EditarOSInput
): Promise<OrdemServicoDetalhe> {
  const dados = editarOsSchema.parse(dadosInput)
  const role = exigirRole(dados.role, ROLES_VALIDOS, 'editar OS')

  return await db.transaction(async () => {
    const os = await db.get<OrdemServico>(unidadeId, 'os', osId)
    if (!os || os.deletedAt) {
      erro(404, 'Ordem de Serviço não encontrada')
    }

    if (os.status === 'cancelada' || os.status === 'entregue') {
      erro(400, `Não é possível editar uma OS com status "${os.status}"`)
    }

    if (role === 'mecanico') {
      const tentouOutroCampo
        = (dados.queixa !== undefined && dados.queixa !== os.queixa)
          || (dados.avarias !== undefined && dados.avarias !== os.avarias)
          || (dados.combustivel !== undefined && dados.combustivel !== os.combustivel)
          || (dados.quilometragem !== undefined && dados.quilometragem !== os.quilometragem)
          || (dados.previsaoEntrega !== undefined && dados.previsaoEntrega !== os.previsaoEntrega)
          || (dados.funcionarioId !== undefined && dados.funcionarioId !== os.funcionarioId)

      if (tentouOutroCampo) {
        erro(403, 'Mecânico pode editar apenas o diagnóstico da OS')
      }
    }

    const agora = new Date().toISOString()
    const camposAtualizados: Record<string, unknown> = {
      dataAtualizacao: agora
    }

    if (dados.queixa !== undefined) camposAtualizados.queixa = dados.queixa
    if (dados.diagnostico !== undefined) camposAtualizados.diagnostico = dados.diagnostico
    if (dados.avarias !== undefined) camposAtualizados.avarias = dados.avarias
    if (dados.combustivel !== undefined) camposAtualizados.combustivel = dados.combustivel
    if (dados.funcionarioId !== undefined) camposAtualizados.funcionarioId = dados.funcionarioId

    if (dados.quilometragem !== undefined) {
      camposAtualizados.quilometragem = dados.quilometragem === null ? undefined : dados.quilometragem
    }

    if (dados.previsaoEntrega !== undefined) {
      camposAtualizados.previsaoEntrega = dados.previsaoEntrega === null
        ? undefined
        : new Date(dados.previsaoEntrega).toISOString()
    }

    const atualizada = await sincronizarSnapshotOS(
      unidadeId,
      osId,
      camposAtualizados as Partial<OrdemServico>
    )

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function excluirOS(
  unidadeId: number,
  osId: number,
  opts?: { role?: string }
): Promise<{ success: true }> {
  exigirRole(opts?.role, ['owner', 'admin', 'gerente'], 'excluir OS')

  return await db.transaction(async () => {
    const os = await db.get<OrdemServico>(unidadeId, 'os', osId)
    if (!os || os.deletedAt) {
      erro(404, 'Ordem de Serviço não encontrada')
    }

    if (os.status !== 'aberta') {
      erro(400, 'Apenas OS com status "aberta" pode ser excluída. Use cancelar para OS em andamento.')
    }

    const agora = new Date().toISOString()
    await db.update<OrdemServico>(unidadeId, 'os', osId, {
      deletedAt: agora,
      dataAtualizacao: agora
    })

    return { success: true }
  })
}

function calcularProximoLote(itens: ItemOS[]): number {
  const complementos = itens.filter(i => i.lote !== null && i.lote !== undefined)
  if (complementos.length === 0) return 1

  const maiorLote = Math.max(...complementos.map(i => Number(i.lote)))
  const loteAtualTemPendente = complementos.some(
    i => Number(i.lote) === maiorLote && i.status === 'pendente'
  )

  return loteAtualTemPendente ? maiorLote : maiorLote + 1
}

export async function adicionarItem(
  unidadeId: number,
  osId: number,
  dadosInput: AdicionarItemOSInput
): Promise<OrdemServicoDetalhe> {
  const dados = adicionarItemOsSchema.parse(dadosInput)
  const role = exigirRole(dados.role, ROLES_VALIDOS, 'adicionar item')

  return await db.transaction(async () => {
    const os = await db.get<OrdemServico>(unidadeId, 'os', osId)
    if (!os || os.deletedAt) {
      erro(404, 'Ordem de Serviço não encontrada')
    }

    if (os.status !== 'em_diagnostico' && os.status !== 'em_execucao') {
      erro(
        400,
        os.status === 'aguardando_aprovacao'
          ? 'Use "Ajustar" para voltar ao diagnóstico antes de adicionar itens ao orçamento principal'
          : `Não é possível adicionar itens quando a OS está com status "${os.status}"`
      )
    }

    let catalogoItem: ItemCatalogo | null = null
    if (dados.catalogoId !== undefined) {
      catalogoItem = await db.get<ItemCatalogo>(unidadeId, 'catalogo', dados.catalogoId)
    }

    const nome = (dados.nome?.trim() || catalogoItem?.nome || '').trim()
    if (!nome) {
      erro(400, 'Informe o nome do item ou selecione um item válido do catálogo')
    }

    const tipo: 'servico' | 'produto' = catalogoItem?.tipo ?? dados.tipo ?? 'servico'
    const unidade = (dados.unidade?.trim() || catalogoItem?.unidade || 'un').trim()
    const precoUnitario = dados.precoUnitario !== undefined
      ? Math.round(Number(dados.precoUnitario))
      : catalogoItem
        ? Math.round(Number(catalogoItem.preco))
        : undefined

    if (precoUnitario === undefined || !Number.isFinite(precoUnitario) || precoUnitario < 0) {
      erro(400, 'Informe um preço unitário válido em centavos')
    }

    const quantidade = Number(dados.quantidade)
    const itensAtuais = await carregarItensDaOS(unidadeId, os)
    const lote: number | null = os.status === 'em_execucao'
      ? calcularProximoLote(itensAtuais)
      : null

    const agora = new Date().toISOString()

    // Mesmo item no mesmo lote e ainda pendente → soma a quantidade (não duplica linha)
    const itemMesmoLotePendente = itensAtuais.find((item) => {
      if (item.status !== 'pendente') return false
      if ((item.lote ?? null) !== lote) return false

      if (dados.catalogoId !== undefined) {
        return item.catalogoId !== undefined && Number(item.catalogoId) === Number(dados.catalogoId)
      }

      return (
        !item.catalogoId
        && item.nome.trim().toLowerCase() === nome.toLowerCase()
        && Math.round(Number(item.precoUnitario)) === precoUnitario
      )
    })

    if (itemMesmoLotePendente) {
      const novaQuantidade = Number((Number(itemMesmoLotePendente.quantidade) + quantidade).toFixed(3))
      await db.update<ItemOS>(unidadeId, 'itensOS', itemMesmoLotePendente.id, {
        quantidade: novaQuantidade
      })
    } else {
      await db.insert<ItemOS>(unidadeId, 'itensOS', {
        osId: os.id,
        ...(dados.catalogoId !== undefined ? { catalogoId: dados.catalogoId } : {}),
        nome,
        tipo,
        unidade,
        quantidade,
        precoUnitario,
        status: 'pendente',
        lote,
        enviado: false,
        estoqueBaixado: false
      })
    }

    // Adicionar complemento em em_execucao gera Nota; em em_diagnostico NÃO gera nota (§4.9)
    if (os.status === 'em_execucao') {
      await gerarNota(unidadeId, {
        osId: os.id,
        tipo: 'item_add',
        texto: `Complemento adicionado: ${nome}`,
        role,
        data: agora
      })
    }

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, { dataAtualizacao: agora })
    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function editarItem(
  unidadeId: number,
  osId: number,
  itemId: number,
  dadosInput: EditarItemOSInput
): Promise<OrdemServicoDetalhe> {
  const dados = editarItemOsSchema.parse(dadosInput)
  const role = exigirRole(dados.role, ROLES_VALIDOS, 'editar item')

  return await db.transaction(async () => {
    const os = await db.get<OrdemServico>(unidadeId, 'os', osId)
    if (!os || os.deletedAt) {
      erro(404, 'Ordem de Serviço não encontrada')
    }

    if (['concluida', 'entregue', 'cancelada'].includes(os.status)) {
      erro(400, `Não é possível editar itens de uma OS com status "${os.status}"`)
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    const item = itens.find(i => i.id === itemId)
    if (!item) {
      erro(404, 'Item da OS não encontrado')
    }

    if (item.status !== 'pendente') {
      erro(400, `Item com status "${item.status}" é terminal e não pode ser editado individualmente`)
    }

    if (item.enviado && os.status === 'aguardando_aprovacao') {
      erro(400, 'Item já enviado não pode ser editado em aguardando aprovação. Use "Ajustar" para reabrir o diagnóstico.')
    }

    if (os.status !== 'em_diagnostico' && item.enviado && os.status !== 'em_execucao') {
      erro(400, 'Este item não pode ser editado no status atual da OS')
    }

    const novoNome = dados.nome !== undefined ? dados.nome.trim() : item.nome
    const novaUnidade = dados.unidade !== undefined ? dados.unidade.trim() : item.unidade
    const novaQuantidade = dados.quantidade !== undefined ? Number(dados.quantidade) : Number(item.quantidade)
    const novoPreco = dados.precoUnitario !== undefined
      ? Math.round(Number(dados.precoUnitario))
      : Math.round(Number(item.precoUnitario))

    await db.update<ItemOS>(unidadeId, 'itensOS', item.id, {
      nome: novoNome,
      ...(novaUnidade ? { unidade: novaUnidade } : {}),
      quantidade: novaQuantidade,
      precoUnitario: novoPreco
    })

    const agora = new Date().toISOString()

    // Editar item em em_diagnostico NÃO gera nota (§4.9)
    if (os.status !== 'em_diagnostico') {
      await gerarNota(unidadeId, {
        osId: os.id,
        tipo: 'item_edit',
        texto: `Item editado: ${novoNome}`,
        role,
        data: agora
      })
    }

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, { dataAtualizacao: agora })
    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function removerItem(
  unidadeId: number,
  osId: number,
  itemId: number,
  opts?: { role?: string, usuarioId?: number }
): Promise<OrdemServicoDetalhe> {
  const role = exigirRole(opts?.role, ROLES_VALIDOS, 'remover item')
  const usuarioId = opts?.usuarioId || 1

  return await db.transaction(async () => {
    const os = await db.get<OrdemServico>(unidadeId, 'os', osId)
    if (!os || os.deletedAt) {
      erro(404, 'Ordem de Serviço não encontrada')
    }

    if (['concluida', 'entregue', 'cancelada'].includes(os.status)) {
      erro(400, `Não é possível remover itens de uma OS com status "${os.status}"`)
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    const item = itens.find(i => i.id === itemId)
    if (!item) {
      erro(404, 'Item da OS não encontrado')
    }

    if (item.status === 'pendente' && item.enviado && os.status === 'aguardando_aprovacao') {
      erro(400, 'Item enviado em aguardando aprovação exige "Ajustar" antes de ser removido.')
    }

    const agora = new Date().toISOString()

    if (item.estoqueBaixado) {
      const resultadoEstorno = await estornarEstoqueItemOS(unidadeId, {
        osId: os.id,
        osNumero: os.numero,
        itemOsId: item.id,
        catalogoId: item.catalogoId,
        nome: item.nome,
        tipo: item.tipo,
        quantidade: Number(item.quantidade),
        estoqueBaixado: true,
        usuarioId,
        data: agora
      })

      if (resultadoEstorno.fallbackNota) {
        await gerarNota(unidadeId, {
          osId: os.id,
          tipo: 'estoque',
          texto: resultadoEstorno.fallbackNota,
          role,
          data: agora
        })
      }
    }

    await db.delete(unidadeId, 'itensOS', item.id)

    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'item_remove',
      texto: `Item removido: ${item.nome}`,
      role,
      data: agora
    })

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, { dataAtualizacao: agora })
    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

async function verificarAutoTransicaoAprovada(
  unidadeId: number,
  os: OrdemServico,
  itens: ItemOS[],
  role: RoleUsuario,
  agora: string
): Promise<Partial<OrdemServico>> {
  if (os.status !== 'aguardando_aprovacao') {
    return {}
  }

  const itensPrincipal = itens.filter(i => (i.lote ?? null) === null)
  if (itensPrincipal.length === 0) {
    return {}
  }

  const temPendenteNoPrincipal = itensPrincipal.some(i => i.status === 'pendente')
  const temAprovadoNoPrincipal = itensPrincipal.some(i => i.status === 'aprovado')

  if (!temPendenteNoPrincipal && temAprovadoNoPrincipal) {
    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'item_approve',
      texto: 'Orçamento aprovado',
      role,
      data: agora
    })

    return {
      status: 'aprovada',
      dataAprovacao: agora
    }
  }

  return {}
}

export async function aprovarItem(
  unidadeId: number,
  osId: number,
  itemId: number,
  opts?: { role?: string, usuarioId?: number }
): Promise<OrdemServicoDetalhe> {
  const role = exigirRole(opts?.role, ['owner', 'admin', 'gerente', 'recepcionista'], 'aprovar item')
  const usuarioId = opts?.usuarioId || 1

  return await db.transaction(async () => {
    const os = await db.get<OrdemServico>(unidadeId, 'os', osId)
    if (!os || os.deletedAt) {
      erro(404, 'Ordem de Serviço não encontrada')
    }

    if (os.status !== 'aguardando_aprovacao' && os.status !== 'em_execucao') {
      erro(400, `Não é possível aprovar itens quando a OS está com status "${os.status}"`)
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    const item = itens.find(i => i.id === itemId)
    if (!item) {
      erro(404, 'Item da OS não encontrado')
    }

    if (item.status !== 'pendente') {
      erro(400, `Item já está "${item.status}" (estado terminal)`)
    }

    const agora = new Date().toISOString()
    let estoqueBaixado = Boolean(item.estoqueBaixado)

    if (item.tipo === 'produto' && !estoqueBaixado) {
      const resultadoBaixa = await baixarEstoqueItemOS(unidadeId, {
        osId: os.id,
        osNumero: os.numero,
        itemOsId: item.id,
        catalogoId: item.catalogoId,
        nome: item.nome,
        tipo: item.tipo,
        quantidade: Number(item.quantidade),
        estoqueBaixado: false,
        usuarioId,
        data: agora
      })

      estoqueBaixado = resultadoBaixa.aplicado

      if (resultadoBaixa.fallbackNota) {
        await gerarNota(unidadeId, {
          osId: os.id,
          tipo: 'estoque',
          texto: resultadoBaixa.fallbackNota,
          role,
          data: agora
        })
      }
    }

    await db.update<ItemOS>(unidadeId, 'itensOS', item.id, {
      status: 'aprovado',
      dataAprovacao: agora,
      estoqueBaixado
    })

    const itensAtualizados = await carregarItensDaOS(unidadeId, os)
    const camposAuto = await verificarAutoTransicaoAprovada(unidadeId, os, itensAtualizados, role, agora)

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      ...camposAuto,
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function recusarItem(
  unidadeId: number,
  osId: number,
  itemId: number,
  dadosInput: RecusarItemOSInput
): Promise<OrdemServicoDetalhe> {
  const dados = recusarItemOsSchema.parse(dadosInput)
  const role = exigirRole(dados.role, ['owner', 'admin', 'gerente', 'recepcionista'], 'recusar item')

  return await db.transaction(async () => {
    const os = await db.get<OrdemServico>(unidadeId, 'os', osId)
    if (!os || os.deletedAt) {
      erro(404, 'Ordem de Serviço não encontrada')
    }

    if (os.status !== 'aguardando_aprovacao' && os.status !== 'em_execucao') {
      erro(400, `Não é possível recusar itens quando a OS está com status "${os.status}"`)
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    const item = itens.find(i => i.id === itemId)
    if (!item) {
      erro(404, 'Item da OS não encontrado')
    }

    if (item.status !== 'pendente') {
      erro(400, `Item já está "${item.status}" (estado terminal)`)
    }

    const agora = new Date().toISOString()

    await db.update<ItemOS>(unidadeId, 'itensOS', item.id, {
      status: 'recusado',
      dataRecusa: agora,
      motivoRecusa: dados.motivo
    })

    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'item_reject',
      texto: `${item.nome} recusado — ${dados.motivo}`,
      role,
      data: agora
    })

    const itensAtualizados = await carregarItensDaOS(unidadeId, os)
    const camposAuto = await verificarAutoTransicaoAprovada(unidadeId, os, itensAtualizados, role, agora)

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      ...camposAuto,
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function aprovarTodos(
  unidadeId: number,
  osId: number,
  opts?: { role?: string, usuarioId?: number }
): Promise<OrdemServicoDetalhe> {
  const role = exigirRole(opts?.role, ['owner', 'admin', 'gerente', 'recepcionista'], 'aprovar todos os itens')
  const usuarioId = opts?.usuarioId || 1

  return await db.transaction(async () => {
    const os = await db.get<OrdemServico>(unidadeId, 'os', osId)
    if (!os || os.deletedAt) {
      erro(404, 'Ordem de Serviço não encontrada')
    }

    if (os.status !== 'aguardando_aprovacao') {
      erro(400, 'A ação "Aprovar todos" só está disponível quando a OS está aguardando aprovação')
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    const pendentesPrincipal = itens.filter(i => (i.lote ?? null) === null && i.status === 'pendente')

    if (pendentesPrincipal.length === 0) {
      erro(400, 'Não há itens pendentes no orçamento principal para aprovar')
    }

    const agora = new Date().toISOString()

    for (const item of pendentesPrincipal) {
      let estoqueBaixado = Boolean(item.estoqueBaixado)

      if (item.tipo === 'produto' && !estoqueBaixado) {
        const resultadoBaixa = await baixarEstoqueItemOS(unidadeId, {
          osId: os.id,
          osNumero: os.numero,
          itemOsId: item.id,
          catalogoId: item.catalogoId,
          nome: item.nome,
          tipo: item.tipo,
          quantidade: Number(item.quantidade),
          estoqueBaixado: false,
          usuarioId,
          data: agora
        })

        estoqueBaixado = resultadoBaixa.aplicado

        if (resultadoBaixa.fallbackNota) {
          await gerarNota(unidadeId, {
            osId: os.id,
            tipo: 'estoque',
            texto: resultadoBaixa.fallbackNota,
            role,
            data: agora
          })
        }
      }

      await db.update<ItemOS>(unidadeId, 'itensOS', item.id, {
        status: 'aprovado',
        dataAprovacao: agora,
        estoqueBaixado
      })
    }

    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'item_approve',
      texto: 'Orçamento aprovado',
      role,
      data: agora
    })

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      status: 'aprovada',
      dataAprovacao: agora,
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function ajustar(
  unidadeId: number,
  osId: number,
  dadosInput: AjustarOSInput
): Promise<OrdemServicoDetalhe> {
  const dados = ajustarOsSchema.parse(dadosInput)
  const role = exigirRole(dados.role, ['owner', 'admin', 'gerente', 'recepcionista'], 'ajustar orçamento')

  return await db.transaction(async () => {
    const os = await db.get<OrdemServico>(unidadeId, 'os', osId)
    if (!os || os.deletedAt) {
      erro(404, 'Ordem de Serviço não encontrada')
    }

    if (os.status !== 'aguardando_aprovacao') {
      erro(400, 'A ação "Ajustar" só é permitida quando a OS está aguardando aprovação')
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    for (const item of itens) {
      if ((item.lote ?? null) === null && item.status === 'pendente' && item.enviado) {
        await db.update<ItemOS>(unidadeId, 'itensOS', item.id, {
          enviado: false
        })
      }
    }

    const agora = new Date().toISOString()

    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'ajuste',
      texto: `Orçamento ajustado — ${dados.motivo}`,
      role,
      data: agora
    })

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      status: 'em_diagnostico',
      orcamentoEnviado: false,
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function reverterAprovacao(
  unidadeId: number,
  osId: number,
  opts?: { motivo?: string, role?: string, usuarioId?: number }
): Promise<OrdemServicoDetalhe> {
  const role = exigirRole(opts?.role, ['owner', 'admin'], 'reverter aprovação')
  const motivo = (opts?.motivo || '').trim()
  if (!motivo) {
    erro(400, 'Informe o motivo para reverter a aprovação')
  }
  const usuarioId = opts?.usuarioId || 1

  return await db.transaction(async () => {
    const os = await db.get<OrdemServico>(unidadeId, 'os', osId)
    if (!os || os.deletedAt) {
      erro(404, 'Ordem de Serviço não encontrada')
    }

    if (os.status !== 'aprovada') {
      erro(400, 'A reversão de aprovação só é permitida quando a OS está com status "aprovada"')
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    const faturamento = await calcularFaturamento(unidadeId, {
      id: os.id,
      itens,
      desconto: os.desconto
    })

    if (faturamento.pago > 0) {
      erro(400, 'Não é possível reverter aprovação de OS com pagamento líquido maior que zero. Devolva ou estorne o pagamento antes.')
    }

    const agora = new Date().toISOString()

    for (const item of itens) {
      if ((item.lote ?? null) !== null) continue

      if (item.status === 'aprovado' && item.estoqueBaixado) {
        const resultadoEstorno = await estornarEstoqueItemOS(unidadeId, {
          osId: os.id,
          osNumero: os.numero,
          itemOsId: item.id,
          catalogoId: item.catalogoId,
          nome: item.nome,
          tipo: item.tipo,
          quantidade: Number(item.quantidade),
          estoqueBaixado: true,
          usuarioId,
          data: agora
        })

        if (resultadoEstorno.fallbackNota) {
          await gerarNota(unidadeId, {
            osId: os.id,
            tipo: 'estoque',
            texto: resultadoEstorno.fallbackNota,
            role,
            data: agora
          })
        }
      }

      await db.update<ItemOS>(unidadeId, 'itensOS', item.id, {
        status: 'pendente',
        enviado: false,
        estoqueBaixado: false,
        dataAprovacao: undefined,
        dataRecusa: undefined,
        motivoRecusa: undefined
      })
    }

    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'reversao',
      texto: `Reversão de aprovação — ${motivo}`,
      role,
      data: agora
    })

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      status: 'em_diagnostico',
      orcamentoEnviado: false,
      dataAprovacao: undefined,
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function cancelar(
  unidadeId: number,
  osId: number,
  opts?: { motivo?: string, role?: string, usuarioId?: number }
): Promise<OrdemServicoDetalhe> {
  const role = exigirRole(opts?.role, ['owner', 'admin', 'gerente'], 'cancelar OS')
  const motivo = (opts?.motivo || '').trim()
  const usuarioId = opts?.usuarioId || 1

  return await db.transaction(async () => {
    const os = await db.get<OrdemServico>(unidadeId, 'os', osId)
    if (!os || os.deletedAt) {
      erro(404, 'Ordem de Serviço não encontrada')
    }

    if (['concluida', 'entregue', 'cancelada'].includes(os.status)) {
      erro(400, `Não é possível cancelar uma OS com status "${os.status}"`)
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    const faturamento = await calcularFaturamento(unidadeId, {
      id: os.id,
      itens,
      desconto: os.desconto
    })

    if (faturamento.pago > 0) {
      erro(400, 'Não é possível cancelar OS com pagamento líquido maior que zero. Devolva ou estorne o pagamento antes.')
    }

    const agora = new Date().toISOString()

    for (const item of itens) {
      if (item.estoqueBaixado) {
        const resultadoEstorno = await estornarEstoqueItemOS(unidadeId, {
          osId: os.id,
          osNumero: os.numero,
          itemOsId: item.id,
          catalogoId: item.catalogoId,
          nome: item.nome,
          tipo: item.tipo,
          quantidade: Number(item.quantidade),
          estoqueBaixado: true,
          usuarioId,
          data: agora
        })

        if (resultadoEstorno.fallbackNota) {
          await gerarNota(unidadeId, {
            osId: os.id,
            tipo: 'estoque',
            texto: resultadoEstorno.fallbackNota,
            role,
            data: agora
          })
        }

        await db.update<ItemOS>(unidadeId, 'itensOS', item.id, {
          estoqueBaixado: false
        })
      }
    }

    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'cancelar',
      texto: motivo ? `OS cancelada — ${motivo}` : 'OS cancelada',
      role,
      data: agora
    })

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      status: 'cancelada',
      ...(motivo ? { motivoCancelamento: motivo } : {}),
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function entregar(
  unidadeId: number,
  osId: number,
  opts?: { role?: string }
): Promise<OrdemServicoDetalhe> {
  const role = exigirRole(opts?.role, ['owner', 'admin', 'gerente', 'recepcionista'], 'entregar veículo')

  return await db.transaction(async () => {
    const os = await db.get<OrdemServico>(unidadeId, 'os', osId)
    if (!os || os.deletedAt) {
      erro(404, 'Ordem de Serviço não encontrada')
    }

    if (os.status !== 'concluida') {
      erro(400, 'Apenas OS com status "concluida" pode ser entregue')
    }

    const agora = new Date().toISOString()

    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'transicao',
      texto: 'Veículo entregue',
      role,
      data: agora
    })

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      status: 'entregue',
      dataEntrega: agora,
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function transicionar(
  unidadeId: number,
  osId: number,
  dadosInput: TransicionarOSInput
): Promise<OrdemServicoDetalhe> {
  const dados = transicionarOsSchema.parse(dadosInput)

  if (dados.acao === 'entregar') {
    return await entregar(unidadeId, osId, { role: dados.role })
  }

  if (dados.acao === 'cancelar') {
    return await cancelar(unidadeId, osId, {
      motivo: dados.motivo,
      role: dados.role,
      usuarioId: dados.usuarioId
    })
  }

  if (dados.acao === 'reverter_aprovacao') {
    return await reverterAprovacao(unidadeId, osId, {
      motivo: dados.motivo,
      role: dados.role,
      usuarioId: dados.usuarioId
    })
  }

  const role = exigirRole(
    dados.role,
    ['owner', 'admin', 'gerente', 'mecanico'],
    dados.acao
  )

  return await db.transaction(async () => {
    const os = await db.get<OrdemServico>(unidadeId, 'os', osId)
    if (!os || os.deletedAt) {
      erro(404, 'Ordem de Serviço não encontrada')
    }

    const agora = new Date().toISOString()

    if (dados.acao === 'iniciar_diagnostico') {
      if (os.status !== 'aberta') {
        erro(400, `Transição inválida: não é possível iniciar diagnóstico a partir de "${os.status}"`)
      }

      await gerarNota(unidadeId, {
        osId: os.id,
        tipo: 'transicao',
        texto: 'Iniciando diagnóstico',
        role,
        data: agora
      })

      const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
        status: 'em_diagnostico',
        dataAtualizacao: agora
      })

      return await montarOSDetalhe(unidadeId, atualizada)
    }

    if (dados.acao === 'iniciar_execucao') {
      if (os.status !== 'aprovada') {
        erro(400, `Transição inválida: não é possível iniciar execução a partir de "${os.status}"`)
      }

      await gerarNota(unidadeId, {
        osId: os.id,
        tipo: 'transicao',
        texto: 'Início da execução',
        role,
        data: agora
      })

      const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
        status: 'em_execucao',
        dataAtualizacao: agora
      })

      return await montarOSDetalhe(unidadeId, atualizada)
    }

    if (dados.acao === 'concluir') {
      if (os.status !== 'em_execucao') {
        erro(400, `Transição inválida: não é possível concluir a OS a partir de "${os.status}"`)
      }

      const itens = await carregarItensDaOS(unidadeId, os)
      const temPendente = itens.some(i => i.status === 'pendente')
      if (temPendente) {
        erro(400, 'Não é possível concluir a OS com itens pendentes. Aprove ou recuse todos os itens antes de concluir.')
      }

      const temAprovado = itens.some(i => i.status === 'aprovado')
      if (!temAprovado) {
        erro(400, 'Não é possível concluir uma OS sem ao menos um item aprovado.')
      }

      await gerarNota(unidadeId, {
        osId: os.id,
        tipo: 'transicao',
        texto: 'OS concluída',
        role,
        data: agora
      })

      const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
        status: 'concluida',
        dataConclusao: agora,
        dataAtualizacao: agora
      })

      return await montarOSDetalhe(unidadeId, atualizada)
    }

    erro(400, 'Ação de transição inválida')
  })
}

export async function aplicarDesconto(
  unidadeId: number,
  osId: number,
  dadosInput: DescontoOSInput
): Promise<OrdemServicoDetalhe> {
  const dados = descontoOsSchema.parse(dadosInput)
  exigirRole(dados.role, ['owner', 'admin', 'gerente'], 'aplicar desconto')

  return await db.transaction(async () => {
    const os = await db.get<OrdemServico>(unidadeId, 'os', osId)
    if (!os || os.deletedAt) {
      erro(404, 'Ordem de Serviço não encontrada')
    }

    if (os.status !== 'em_diagnostico' && os.status !== 'aguardando_aprovacao') {
      erro(400, 'O desconto só pode ser aplicado em diagnóstico ou aguardando aprovação')
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    const somaNaoRecusados = itens
      .filter(i => i.status !== 'recusado')
      .reduce((s, i) => s + Math.round(Number(i.quantidade || 0) * Math.round(Number(i.precoUnitario || 0))), 0)

    const desconto = Math.round(Number(dados.desconto))

    if (desconto < 0 || desconto > somaNaoRecusados) {
      erro(400, 'O desconto deve estar entre R$ 0,00 e a soma dos itens não recusados')
    }

    const agora = new Date().toISOString()
    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      desconto,
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function enviarOrcamento(
  unidadeId: number,
  osId: number,
  dadosInput: EnviarOrcamentoInput
): Promise<OrdemServicoDetalhe> {
  const dados = enviarOrcamentoSchema.parse(dadosInput)
  const role = exigirRole(dados.role, ['owner', 'admin', 'gerente', 'recepcionista'], 'enviar orçamento')
  const usuarioId = dados.usuarioId || 1

  return await db.transaction(async () => {
    const os = await db.get<OrdemServico>(unidadeId, 'os', osId)
    if (!os || os.deletedAt) {
      erro(404, 'Ordem de Serviço não encontrada')
    }

    if (!['em_diagnostico', 'aguardando_aprovacao', 'em_execucao'].includes(os.status)) {
      erro(400, `Não é possível enviar orçamento quando a OS está com status "${os.status}"`)
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    if (itens.length === 0) {
      erro(400, 'Adicione ao menos um item ao orçamento antes de enviar')
    }

    if (os.status === 'em_diagnostico' || os.status === 'aguardando_aprovacao') {
      if (!os.diagnostico || !os.diagnostico.trim()) {
        erro(400, 'Preencha o diagnóstico antes de enviar o orçamento')
      }
    }

    let itensAlvo: ItemOS[]
    if (dados.itensIds && dados.itensIds.length > 0) {
      const idsSet = new Set(dados.itensIds.map(id => Number(id)))
      itensAlvo = itens.filter(i => idsSet.has(i.id))
      if (itensAlvo.length === 0) {
        erro(400, 'Nenhum item válido da OS foi selecionado para o envio')
      }
    } else if (os.status === 'em_execucao') {
      const complementos = itens.filter(i => (i.lote ?? null) !== null)
      const naoEnviados = complementos.filter(i => !i.enviado)
      itensAlvo = naoEnviados.length > 0 ? naoEnviados : complementos
      if (itensAlvo.length === 0) {
        erro(400, 'Não há itens complementares para enviar')
      }
    } else {
      itensAlvo = itens.filter(i => (i.lote ?? null) === null)
    }

    const agora = new Date().toISOString()
    const itensIds = itensAlvo.map(i => i.id)

    if (dados.falhou || dados.erro) {
      await db.insert<EnvioOrcamento>(unidadeId, 'enviosOrcamento', {
        osId: os.id,
        canal: dados.canal,
        status: 'falhou',
        itensIds,
        solicitadoEm: agora,
        ...(dados.referencia ? { referencia: dados.referencia } : {}),
        erro: dados.erro || 'Falha ao gerar orçamento',
        usuarioId
      })

      return await montarOSDetalhe(unidadeId, os)
    }

    const statusEnvio: EnvioOrcamento['status']
      = dados.canal === 'impressao' || dados.canal === 'imagem'
        ? 'gerado'
        : 'enviado'

    await db.insert<EnvioOrcamento>(unidadeId, 'enviosOrcamento', {
      osId: os.id,
      canal: dados.canal,
      status: statusEnvio,
      itensIds,
      solicitadoEm: agora,
      concluidoEm: agora,
      ...(dados.referencia ? { referencia: dados.referencia } : {}),
      usuarioId
    })

    for (const item of itensAlvo) {
      if (!item.enviado) {
        await db.update<ItemOS>(unidadeId, 'itensOS', item.id, {
          enviado: true
        })
      }
    }

    if (os.status === 'em_execucao') {
      const loteRef = itensAlvo.find(i => i.lote !== null)?.lote ?? 1
      await gerarNota(unidadeId, {
        osId: os.id,
        tipo: 'envio',
        texto: `Orçamento complementar enviado [lote ${loteRef}]`,
        role,
        data: agora
      })

      const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
        dataAtualizacao: agora
      })

      return await montarOSDetalhe(unidadeId, atualizada)
    }

    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'envio',
      texto: `Orçamento enviado (${dados.canal})`,
      role,
      data: agora
    })

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      status: 'aguardando_aprovacao',
      orcamentoEnviado: true,
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}
