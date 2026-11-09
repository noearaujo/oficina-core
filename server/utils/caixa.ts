import * as z from 'zod'
import { db } from './storage'
import { stripAccents } from './clientes'
import type { Carteira } from './carteiras'

export const caixaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do caixa'),
  nomeBusca: z.string().trim().optional(),
  ativo: z.preprocess(
    value => (value === undefined ? true : Boolean(value)),
    z.boolean()
  ),
  dataCriacao: z.string().optional(),
  dataAtualizacao: z.string().optional()
}).transform(caixa => ({
  ...caixa,
  nomeBusca: stripAccents(caixa.nome).toLowerCase()
}))

export const caixaUpdateSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do caixa').optional(),
  nomeBusca: z.string().trim().optional(),
  ativo: z.boolean().optional()
})

export const caixaUsuarioSchema = z.object({
  caixaId: z.coerce.number().int().positive('Informe o caixa'),
  usuarioUnidadeId: z.coerce.number().int().positive('Informe o usuário da unidade'),
  ativo: z.preprocess(
    value => (value === undefined ? true : Boolean(value)),
    z.boolean()
  )
})

const modalidadeCaixaGuard = z.string().optional().refine(
  val => !val || val === 'dinheiro' || val === 'transferencia',
  'O Caixa movimenta apenas dinheiro em espécie (não aceita Pix, crédito, débito ou boleto)'
)

export const abrirCaixaSchema = z.object({
  valorAbertura: z.preprocess(
    value => (value === '' || value === null || value === undefined ? 0 : value),
    z.coerce.number().int('Valor de abertura deve ser inteiro em centavos').min(0, 'Valor de abertura não pode ser negativo')
  ),
  carteiraOrigemId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive('Selecione o Cofre de origem').optional()
  ),
  carteiraCofreId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive('Selecione o Cofre de origem').optional()
  ),
  carteiraId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive('Selecione o Cofre de origem').optional()
  ),
  abertaPorUsuarioId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  usuarioId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  responsavelNome: z.string().trim().optional(),
  responsavel: z.string().trim().optional(),
  modalidade: modalidadeCaixaGuard
}).superRefine((dados, ctx) => {
  const cofreId = dados.carteiraOrigemId ?? dados.carteiraCofreId ?? dados.carteiraId
  if (dados.valorAbertura > 0 && !cofreId) {
    ctx.addIssue({
      code: 'custom',
      path: ['carteiraOrigemId'],
      message: 'Selecione uma Carteira do tipo Cofre para abertura com valor maior que zero'
    })
  }
}).transform(dados => ({
  valorAbertura: dados.valorAbertura,
  carteiraOrigemId: dados.carteiraOrigemId ?? dados.carteiraCofreId ?? dados.carteiraId,
  abertaPorUsuarioId: dados.abertaPorUsuarioId ?? dados.usuarioId ?? 1,
  responsavelNome: dados.responsavelNome || dados.responsavel || 'Operador'
}))

export const fecharCaixaSchema = z.object({
  valorContado: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number({ message: 'Informe o valor contado' }).int('Valor contado deve ser inteiro em centavos').min(0, 'Valor contado não pode ser negativo')
  ),
  carteiraDestinoId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  carteiraCofreId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  carteiraOrigemId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  carteiraId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  motivo: z.string().trim().optional(),
  motivoFechamento: z.string().trim().optional(),
  observacao: z.string().trim().optional(),
  fechadaPorUsuarioId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  usuarioId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  modalidade: modalidadeCaixaGuard
}).transform(dados => ({
  valorContado: dados.valorContado,
  carteiraCofreId: dados.carteiraDestinoId ?? dados.carteiraCofreId ?? dados.carteiraOrigemId ?? dados.carteiraId,
  motivoFechamento: dados.motivoFechamento || dados.motivo || dados.observacao || '',
  fechadaPorUsuarioId: dados.fechadaPorUsuarioId ?? dados.usuarioId ?? 1
}))

export const retiradaRapidaSchema = z.object({
  valor: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number({ message: 'Informe o valor da retirada' }).int('Valor deve ser inteiro em centavos').positive('O valor da retirada deve ser maior que zero')
  ),
  justificativa: z.string().trim().optional(),
  motivo: z.string().trim().optional(),
  observacao: z.string().trim().optional(),
  descricao: z.string().trim().optional(),
  documentoId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  usuarioId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  criadoPorUsuarioId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  modalidade: modalidadeCaixaGuard
}).superRefine((dados, ctx) => {
  const texto = (dados.justificativa || dados.motivo || dados.observacao || dados.descricao || '').trim()
  if (!texto) {
    ctx.addIssue({
      code: 'custom',
      path: ['justificativa'],
      message: 'Informe a justificativa da retirada rápida'
    })
  }
}).transform(dados => ({
  valor: dados.valor,
  justificativa: (dados.justificativa || dados.motivo || dados.observacao || dados.descricao || '').trim(),
  documentoId: dados.documentoId,
  usuarioId: dados.criadoPorUsuarioId ?? dados.usuarioId ?? 1
}))

export const reforcoCaixaSchema = z.object({
  valor: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number({ message: 'Informe o valor do reforço' }).int('Valor deve ser inteiro em centavos').positive('O valor do reforço deve ser maior que zero')
  ),
  carteiraOrigemId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  carteiraCofreId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  carteiraId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  motivo: z.string().trim().optional(),
  observacao: z.string().trim().optional(),
  justificativa: z.string().trim().optional(),
  usuarioId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  criadoPorUsuarioId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  modalidade: modalidadeCaixaGuard
}).transform(dados => ({
  valor: dados.valor,
  carteiraOrigemId: dados.carteiraOrigemId ?? dados.carteiraCofreId ?? dados.carteiraId,
  motivo: (dados.motivo || dados.observacao || dados.justificativa || '').trim(),
  usuarioId: dados.criadoPorUsuarioId ?? dados.usuarioId ?? 1
}))

export const sangriaCaixaSchema = z.object({
  valor: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number({ message: 'Informe o valor da sangria' }).int('Valor deve ser inteiro em centavos').positive('O valor da sangria deve ser maior que zero')
  ),
  carteiraDestinoId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  carteiraCofreId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  carteiraOrigemId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  carteiraId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  motivo: z.string().trim().optional(),
  observacao: z.string().trim().optional(),
  justificativa: z.string().trim().optional(),
  usuarioId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  criadoPorUsuarioId: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  modalidade: modalidadeCaixaGuard
}).transform(dados => ({
  valor: dados.valor,
  carteiraDestinoId: dados.carteiraDestinoId ?? dados.carteiraCofreId ?? dados.carteiraOrigemId ?? dados.carteiraId,
  motivo: (dados.motivo || dados.observacao || dados.justificativa || '').trim(),
  usuarioId: dados.criadoPorUsuarioId ?? dados.usuarioId ?? 1
}))

export type CaixaCadastro = z.output<typeof caixaSchema>
export type CaixaUpdateInput = z.output<typeof caixaUpdateSchema>
export type AbrirCaixaInput = z.output<typeof abrirCaixaSchema>
export type FecharCaixaInput = z.output<typeof fecharCaixaSchema>
export type RetiradaRapidaInput = z.output<typeof retiradaRapidaSchema>
export type ReforcoCaixaInput = z.output<typeof reforcoCaixaSchema>
export type SangriaCaixaInput = z.output<typeof sangriaCaixaSchema>

export interface Caixa {
  id: number
  unidadeId: number
  nome: string
  nomeBusca?: string
  ativo: boolean
  dataCriacao: string
  dataAtualizacao?: string
  [key: string]: unknown
}

export interface CaixaUsuario {
  id: number
  unidadeId: number
  caixaId: number
  usuarioUnidadeId: number
  ativo: boolean
  [key: string]: unknown
}

export interface SessaoCaixa {
  id: number
  unidadeId: number
  caixaId: number
  status: 'aberta' | 'fechada'
  abertaEm: string
  abertaPorUsuarioId: number
  responsavelNome?: string
  valorAbertura: number
  carteiraOrigemId?: number
  carteiraOrigemNome?: string
  fechadaEm?: string
  fechadaPorUsuarioId?: number
  saldoEsperadoFechamento?: number
  valorContado?: number
  diferenca?: number
  motivoFechamento?: string
  carteiraDestinoId?: number
  carteiraDestinoNome?: string
  [key: string]: unknown
}

export interface LancamentoCaixa {
  id: number
  unidadeId: number
  tipo: 'entrada' | 'saida'
  carteiraId?: number
  sessaoCaixaId?: number
  valor: number
  data: string
  documentoId?: number
  documentoTipo?: 'os' | 'venda'
  modalidade: 'dinheiro' | 'pix' | 'credito' | 'debito' | 'boleto' | 'transferencia'
  categoria: string
  parId?: number
  estornoDe?: number
  observacao?: string
  criadoPorUsuarioId: number
  dataCriacao: string
  [key: string]: unknown
}

export interface SessaoCaixaComDetalhes extends SessaoCaixa {
  saldoEsperado: number
  lancamentos: LancamentoCaixa[]
}

export interface CaixaComEstado extends Caixa {
  status: 'aberto' | 'fechado'
  statusSessao: 'aberta' | 'fechada'
  aberta: boolean
  sessaoAberta: SessaoCaixaComDetalhes | null
  sessaoCaixaId: number | null
  responsavelId: number | null
  responsavel: string | null
  responsavelNome: string | null
  saldoEsperado: number
  valorAbertura: number
  lancamentosSessao: LancamentoCaixa[]
}

export async function calcularSaldoSessao(
  sessaoId: number,
  lancamentos: LancamentoCaixa[]
): Promise<number> {
  return lancamentos.reduce((acc, lanc) => {
    if (Number(lanc.sessaoCaixaId) !== sessaoId) return acc
    const valor = Math.round(Number(lanc.valor ?? 0))
    if (lanc.tipo === 'entrada') return acc + valor
    if (lanc.tipo === 'saida') return acc - valor
    return acc
  }, 0)
}

async function criarTransferenciaPareada(
  unidadeId: number,
  params: {
    origem: { carteiraId?: number, sessaoCaixaId?: number }
    destino: { carteiraId?: number, sessaoCaixaId?: number }
    valor: number
    observacao: string
    usuarioId: number
    agora: string
  }
): Promise<{ saida: LancamentoCaixa, entrada: LancamentoCaixa, parId: number }> {
  const saidaInicial = await db.insert<LancamentoCaixa>(unidadeId, 'lancamentos', {
    tipo: 'saida',
    ...(params.origem.carteiraId ? { carteiraId: params.origem.carteiraId } : {}),
    ...(params.origem.sessaoCaixaId ? { sessaoCaixaId: params.origem.sessaoCaixaId } : {}),
    valor: params.valor,
    data: params.agora,
    modalidade: 'dinheiro',
    categoria: 'transferencia',
    observacao: params.observacao,
    criadoPorUsuarioId: params.usuarioId,
    dataCriacao: params.agora
  })

  const parId = saidaInicial.id
  const saida = (await db.update<LancamentoCaixa>(unidadeId, 'lancamentos', saidaInicial.id, {
    parId
  })) ?? { ...saidaInicial, parId }

  const entrada = await db.insert<LancamentoCaixa>(unidadeId, 'lancamentos', {
    tipo: 'entrada',
    ...(params.destino.carteiraId ? { carteiraId: params.destino.carteiraId } : {}),
    ...(params.destino.sessaoCaixaId ? { sessaoCaixaId: params.destino.sessaoCaixaId } : {}),
    valor: params.valor,
    data: params.agora,
    modalidade: 'dinheiro',
    categoria: 'transferencia',
    parId,
    observacao: params.observacao,
    criadoPorUsuarioId: params.usuarioId,
    dataCriacao: params.agora
  })

  return { saida, entrada, parId }
}

async function resolverCofreAtivo(
  unidadeId: number,
  carteiraIdInformado?: number,
  fallbackId?: number
): Promise<Carteira> {
  const carteiras = await db.list<Carteira>(unidadeId, 'carteiras')
  const cofresAtivos = carteiras.filter(c => c.tipo === 'cofre' && c.ativa !== false)

  if (carteiraIdInformado !== undefined) {
    const selecionada = carteiras.find(c => c.id === carteiraIdInformado)
    if (!selecionada) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Carteira de Cofre não encontrada nesta unidade'
      })
    }
    if (selecionada.tipo !== 'cofre') {
      throw createError({
        statusCode: 400,
        statusMessage: 'O Caixa opera somente com Carteira do tipo Cofre (espécie). Carteira Banco não é permitida.'
      })
    }
    if (selecionada.ativa === false) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A Carteira Cofre selecionada está inativa'
      })
    }
    return selecionada
  }

  if (fallbackId !== undefined) {
    const fallback = cofresAtivos.find(c => c.id === fallbackId)
    if (fallback) return fallback
  }

  if (cofresAtivos.length > 0) {
    return cofresAtivos[0]!
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Crie um Cofre antes de operar o Caixa.'
  })
}

export async function montarCaixaComEstado(
  unidadeId: number,
  caixa: Caixa,
  sessoesPre?: SessaoCaixa[],
  lancamentosPre?: LancamentoCaixa[],
  carteirasPre?: Carteira[]
): Promise<CaixaComEstado> {
  const [sessoes, lancamentos, carteiras] = await Promise.all([
    sessoesPre ? Promise.resolve(sessoesPre) : db.list<SessaoCaixa>(unidadeId, 'sessoesCaixa'),
    lancamentosPre ? Promise.resolve(lancamentosPre) : db.list<LancamentoCaixa>(unidadeId, 'lancamentos'),
    carteirasPre ? Promise.resolve(carteirasPre) : db.list<Carteira>(unidadeId, 'carteiras')
  ])

  const carteirasPorId = new Map<number, Carteira>()
  for (const c of carteiras) {
    carteirasPorId.set(c.id, c)
  }

  const sessaoAbertaRaw = sessoes.find(
    s => Number(s.caixaId) === caixa.id && s.status === 'aberta'
  ) ?? null

  if (!sessaoAbertaRaw) {
    return {
      ...caixa,
      nomeBusca: caixa.nomeBusca || stripAccents(caixa.nome).toLowerCase(),
      ativo: caixa.ativo !== false,
      status: 'fechado',
      statusSessao: 'fechada',
      aberta: false,
      sessaoAberta: null,
      sessaoCaixaId: null,
      responsavelId: null,
      responsavel: null,
      responsavelNome: null,
      saldoEsperado: 0,
      valorAbertura: 0,
      lancamentosSessao: []
    }
  }

  const lancamentosSessao = lancamentos
    .filter(l => Number(l.sessaoCaixaId) === sessaoAbertaRaw.id)
    .sort((a, b) => {
      const diff = new Date(b.data).getTime() - new Date(a.data).getTime()
      return diff !== 0 ? diff : b.id - a.id
    })

  const saldoEsperado = await calcularSaldoSessao(sessaoAbertaRaw.id, lancamentosSessao)
  const cofreOrigem = sessaoAbertaRaw.carteiraOrigemId
    ? carteirasPorId.get(Number(sessaoAbertaRaw.carteiraOrigemId))
    : undefined

  const responsavelNome = sessaoAbertaRaw.responsavelNome || `Usuário #${sessaoAbertaRaw.abertaPorUsuarioId}`

  const sessaoAberta: SessaoCaixaComDetalhes = {
    ...sessaoAbertaRaw,
    responsavelNome,
    ...(cofreOrigem ? { carteiraOrigemNome: cofreOrigem.nome } : {}),
    saldoEsperado,
    lancamentos: lancamentosSessao
  }

  return {
    ...caixa,
    nomeBusca: caixa.nomeBusca || stripAccents(caixa.nome).toLowerCase(),
    ativo: caixa.ativo !== false,
    status: 'aberto',
    statusSessao: 'aberta',
    aberta: true,
    sessaoAberta,
    sessaoCaixaId: sessaoAberta.id,
    responsavelId: sessaoAberta.abertaPorUsuarioId,
    responsavel: responsavelNome,
    responsavelNome,
    saldoEsperado,
    valorAbertura: Math.round(Number(sessaoAberta.valorAbertura ?? 0)),
    lancamentosSessao
  }
}

export async function listarCaixas(
  unidadeId: number,
  filtros?: { q?: string, status?: string }
): Promise<CaixaComEstado[]> {
  const [caixas, sessoes, lancamentos, carteiras] = await Promise.all([
    db.list<Caixa>(unidadeId, 'caixas'),
    db.list<SessaoCaixa>(unidadeId, 'sessoesCaixa'),
    db.list<LancamentoCaixa>(unidadeId, 'lancamentos'),
    db.list<Carteira>(unidadeId, 'carteiras')
  ])

  const termo = filtros?.q ? stripAccents(filtros.q.trim()).toLowerCase() : ''
  const statusFiltro = filtros?.status && filtros.status !== 'todos' ? filtros.status : ''

  const resultado: CaixaComEstado[] = []

  for (const caixa of caixas) {
    const item = await montarCaixaComEstado(unidadeId, caixa, sessoes, lancamentos, carteiras)

    const correspondeBusca
      = !termo
        || (item.nomeBusca || '').includes(termo)
        || (item.responsavelNome ? stripAccents(item.responsavelNome).toLowerCase().includes(termo) : false)

    const correspondeStatus
      = !statusFiltro
        || item.status === statusFiltro
        || item.statusSessao === statusFiltro

    if (correspondeBusca && correspondeStatus) {
      resultado.push(item)
    }
  }

  return resultado
}

export async function criarCaixa(
  unidadeId: number,
  dados: CaixaCadastro
): Promise<CaixaComEstado> {
  return await db.transaction(async () => {
    const existentes = await db.list<Caixa>(unidadeId, 'caixas')
    const nomeNormalizado = stripAccents(dados.nome).toLowerCase()

    const duplicado = existentes.some(
      item => (item.nomeBusca || stripAccents(item.nome).toLowerCase()) === nomeNormalizado
    )

    if (duplicado) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Já existe um Caixa com este nome nesta unidade'
      })
    }

    const agora = new Date().toISOString()

    const novo = await db.insert<Caixa>(unidadeId, 'caixas', {
      nome: dados.nome,
      nomeBusca: nomeNormalizado,
      ativo: dados.ativo !== false,
      dataCriacao: agora,
      dataAtualizacao: agora
    })

    return await montarCaixaComEstado(unidadeId, novo, [], [], [])
  })
}

export async function abrirCaixa(
  unidadeId: number,
  caixaId: number,
  dados: AbrirCaixaInput
): Promise<CaixaComEstado> {
  return await db.transaction(async () => {
    const caixa = await db.get<Caixa>(unidadeId, 'caixas', caixaId)
    if (!caixa) {
      throw createError({ statusCode: 404, statusMessage: 'Caixa não encontrado' })
    }

    if (caixa.ativo === false) {
      throw createError({ statusCode: 400, statusMessage: 'Não é possível abrir um Caixa inativo' })
    }

    const sessoesAbertas = await db.list<SessaoCaixa>(
      unidadeId,
      'sessoesCaixa',
      s => Number(s.caixaId) === caixaId && s.status === 'aberta'
    )

    if (sessoesAbertas.length > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Já existe uma sessão aberta para este Caixa'
      })
    }

    const carteiras = await db.list<Carteira>(unidadeId, 'carteiras')
    const cofresAtivos = carteiras.filter(c => c.tipo === 'cofre' && c.ativa !== false)

    if (cofresAtivos.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Crie um Cofre antes de abrir o Caixa.'
      })
    }

    const valorAbertura = Math.round(Number(dados.valorAbertura ?? 0))
    let cofreOrigem: Carteira | undefined

    if (dados.carteiraOrigemId !== undefined) {
      cofreOrigem = await resolverCofreAtivo(unidadeId, dados.carteiraOrigemId)
    } else if (valorAbertura > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Selecione uma Carteira do tipo Cofre para abertura com valor maior que zero'
      })
    }

    const agora = new Date().toISOString()

    const novaSessao = await db.insert<SessaoCaixa>(unidadeId, 'sessoesCaixa', {
      caixaId,
      status: 'aberta',
      abertaEm: agora,
      abertaPorUsuarioId: dados.abertaPorUsuarioId || 1,
      responsavelNome: dados.responsavelNome || 'Operador',
      valorAbertura,
      ...(valorAbertura > 0 && cofreOrigem
        ? {
            carteiraOrigemId: cofreOrigem.id,
            carteiraOrigemNome: cofreOrigem.nome
          }
        : {})
    })

    if (valorAbertura > 0 && cofreOrigem) {
      await criarTransferenciaPareada(unidadeId, {
        origem: { carteiraId: cofreOrigem.id },
        destino: { sessaoCaixaId: novaSessao.id },
        valor: valorAbertura,
        observacao: `Abertura de caixa - ${caixa.nome}`,
        usuarioId: dados.abertaPorUsuarioId || 1,
        agora
      })
    }

    return await montarCaixaComEstado(unidadeId, caixa)
  })
}

export async function fecharCaixa(
  unidadeId: number,
  caixaId: number,
  dados: FecharCaixaInput
): Promise<CaixaComEstado & { sessaoFechada: SessaoCaixa }> {
  return await db.transaction(async () => {
    const caixa = await db.get<Caixa>(unidadeId, 'caixas', caixaId)
    if (!caixa) {
      throw createError({ statusCode: 404, statusMessage: 'Caixa não encontrado' })
    }

    const sessoesAbertas = await db.list<SessaoCaixa>(
      unidadeId,
      'sessoesCaixa',
      s => Number(s.caixaId) === caixaId && s.status === 'aberta'
    )

    const sessao = sessoesAbertas[0]
    if (!sessao) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Não há sessão aberta para este Caixa'
      })
    }

    const lancamentosSessao = await db.list<LancamentoCaixa>(
      unidadeId,
      'lancamentos',
      l => Number(l.sessaoCaixaId) === sessao.id
    )

    const saldoEsperadoFechamento = await calcularSaldoSessao(sessao.id, lancamentosSessao)
    const valorContado = Math.round(Number(dados.valorContado))
    const diferenca = valorContado - saldoEsperadoFechamento
    const agora = new Date().toISOString()
    const usuarioId = dados.fechadaPorUsuarioId || 1

    let cofreDestino: Carteira | undefined
    if (valorContado > 0 || dados.carteiraCofreId !== undefined) {
      cofreDestino = await resolverCofreAtivo(
        unidadeId,
        dados.carteiraCofreId,
        sessao.carteiraOrigemId ? Number(sessao.carteiraOrigemId) : undefined
      )
    }

    if (diferenca > 0) {
      await db.insert<LancamentoCaixa>(unidadeId, 'lancamentos', {
        tipo: 'entrada',
        sessaoCaixaId: sessao.id,
        valor: diferenca,
        data: agora,
        modalidade: 'dinheiro',
        categoria: 'sobra_caixa',
        observacao: dados.motivoFechamento || 'Ajuste de sobra no fechamento de caixa',
        criadoPorUsuarioId: usuarioId,
        dataCriacao: agora
      })
    } else if (diferenca < 0) {
      await db.insert<LancamentoCaixa>(unidadeId, 'lancamentos', {
        tipo: 'saida',
        sessaoCaixaId: sessao.id,
        valor: Math.abs(diferenca),
        data: agora,
        modalidade: 'dinheiro',
        categoria: 'quebra_caixa',
        observacao: dados.motivoFechamento || 'Ajuste de quebra no fechamento de caixa',
        criadoPorUsuarioId: usuarioId,
        dataCriacao: agora
      })
    }

    if (valorContado > 0 && cofreDestino) {
      await criarTransferenciaPareada(unidadeId, {
        origem: { sessaoCaixaId: sessao.id },
        destino: { carteiraId: cofreDestino.id },
        valor: valorContado,
        observacao: dados.motivoFechamento
          ? `Fechamento de caixa - ${caixa.nome} (${dados.motivoFechamento})`
          : `Fechamento de caixa - ${caixa.nome}`,
        usuarioId,
        agora
      })
    }

    const sessaoFechada = (await db.update<SessaoCaixa>(unidadeId, 'sessoesCaixa', sessao.id, {
      status: 'fechada',
      fechadaEm: agora,
      fechadaPorUsuarioId: usuarioId,
      saldoEsperadoFechamento,
      valorContado,
      diferenca,
      ...(dados.motivoFechamento ? { motivoFechamento: dados.motivoFechamento } : {}),
      ...(cofreDestino
        ? {
            carteiraDestinoId: cofreDestino.id,
            carteiraDestinoNome: cofreDestino.nome
          }
        : {})
    }))!

    const estadoCaixa = await montarCaixaComEstado(unidadeId, caixa)

    return {
      ...estadoCaixa,
      sessaoFechada
    }
  })
}

export async function registrarRetiradaRapida(
  unidadeId: number,
  caixaId: number,
  dados: RetiradaRapidaInput
): Promise<CaixaComEstado & { lancamento: LancamentoCaixa }> {
  return await db.transaction(async () => {
    const caixa = await db.get<Caixa>(unidadeId, 'caixas', caixaId)
    if (!caixa) {
      throw createError({ statusCode: 404, statusMessage: 'Caixa não encontrado' })
    }

    const sessoesAbertas = await db.list<SessaoCaixa>(
      unidadeId,
      'sessoesCaixa',
      s => Number(s.caixaId) === caixaId && s.status === 'aberta'
    )

    const sessao = sessoesAbertas[0]
    if (!sessao) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Não há sessão aberta para este Caixa'
      })
    }

    const lancamentosSessao = await db.list<LancamentoCaixa>(
      unidadeId,
      'lancamentos',
      l => Number(l.sessaoCaixaId) === sessao.id
    )

    const saldoAtual = await calcularSaldoSessao(sessao.id, lancamentosSessao)
    const valor = Math.round(Number(dados.valor))

    if (valor > saldoAtual) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Saldo insuficiente na sessão de Caixa para realizar a retirada rápida'
      })
    }

    const agora = new Date().toISOString()

    const lancamento = await db.insert<LancamentoCaixa>(unidadeId, 'lancamentos', {
      tipo: 'saida',
      sessaoCaixaId: sessao.id,
      valor,
      data: agora,
      ...(dados.documentoId ? { documentoId: dados.documentoId, documentoTipo: 'os' as const } : {}),
      modalidade: 'dinheiro',
      categoria: 'retirada_rapida',
      observacao: dados.justificativa,
      criadoPorUsuarioId: dados.usuarioId || 1,
      dataCriacao: agora
    })

    const estadoCaixa = await montarCaixaComEstado(unidadeId, caixa)

    return {
      ...estadoCaixa,
      lancamento
    }
  })
}

export async function registrarReforcoCaixa(
  unidadeId: number,
  caixaId: number,
  dados: ReforcoCaixaInput
): Promise<CaixaComEstado & { parId: number }> {
  return await db.transaction(async () => {
    const caixa = await db.get<Caixa>(unidadeId, 'caixas', caixaId)
    if (!caixa) {
      throw createError({ statusCode: 404, statusMessage: 'Caixa não encontrado' })
    }

    const sessoesAbertas = await db.list<SessaoCaixa>(
      unidadeId,
      'sessoesCaixa',
      s => Number(s.caixaId) === caixaId && s.status === 'aberta'
    )

    const sessao = sessoesAbertas[0]
    if (!sessao) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Não há sessão aberta para este Caixa'
      })
    }

    const cofreOrigem = await resolverCofreAtivo(
      unidadeId,
      dados.carteiraOrigemId,
      sessao.carteiraOrigemId ? Number(sessao.carteiraOrigemId) : undefined
    )

    const valor = Math.round(Number(dados.valor))
    const agora = new Date().toISOString()
    const observacao = dados.motivo || `Reforço de caixa - ${caixa.nome}`

    const { parId } = await criarTransferenciaPareada(unidadeId, {
      origem: { carteiraId: cofreOrigem.id },
      destino: { sessaoCaixaId: sessao.id },
      valor,
      observacao,
      usuarioId: dados.usuarioId || 1,
      agora
    })

    const estadoCaixa = await montarCaixaComEstado(unidadeId, caixa)

    return {
      ...estadoCaixa,
      parId
    }
  })
}

export async function registrarSangriaCaixa(
  unidadeId: number,
  caixaId: number,
  dados: SangriaCaixaInput
): Promise<CaixaComEstado & { parId: number }> {
  return await db.transaction(async () => {
    const caixa = await db.get<Caixa>(unidadeId, 'caixas', caixaId)
    if (!caixa) {
      throw createError({ statusCode: 404, statusMessage: 'Caixa não encontrado' })
    }

    const sessoesAbertas = await db.list<SessaoCaixa>(
      unidadeId,
      'sessoesCaixa',
      s => Number(s.caixaId) === caixaId && s.status === 'aberta'
    )

    const sessao = sessoesAbertas[0]
    if (!sessao) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Não há sessão aberta para este Caixa'
      })
    }

    const lancamentosSessao = await db.list<LancamentoCaixa>(
      unidadeId,
      'lancamentos',
      l => Number(l.sessaoCaixaId) === sessao.id
    )

    const saldoAtual = await calcularSaldoSessao(sessao.id, lancamentosSessao)
    const valor = Math.round(Number(dados.valor))

    if (valor > saldoAtual) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Saldo insuficiente na sessão de Caixa para realizar a sangria'
      })
    }

    const cofreDestino = await resolverCofreAtivo(
      unidadeId,
      dados.carteiraDestinoId,
      sessao.carteiraOrigemId ? Number(sessao.carteiraOrigemId) : undefined
    )

    const agora = new Date().toISOString()
    const observacao = dados.motivo || `Sangria de caixa - ${caixa.nome}`

    const { parId } = await criarTransferenciaPareada(unidadeId, {
      origem: { sessaoCaixaId: sessao.id },
      destino: { carteiraId: cofreDestino.id },
      valor,
      observacao,
      usuarioId: dados.usuarioId || 1,
      agora
    })

    const estadoCaixa = await montarCaixaComEstado(unidadeId, caixa)

    return {
      ...estadoCaixa,
      parId
    }
  })
}

export async function listarSessoesCaixa(
  unidadeId: number,
  caixaId: number,
  filtros?: { status?: string }
): Promise<SessaoCaixaComDetalhes[]> {
  const caixa = await db.get<Caixa>(unidadeId, 'caixas', caixaId)
  if (!caixa) {
    throw createError({ statusCode: 404, statusMessage: 'Caixa não encontrado' })
  }

  const [sessoes, lancamentos, carteiras] = await Promise.all([
    db.list<SessaoCaixa>(unidadeId, 'sessoesCaixa', s => Number(s.caixaId) === caixaId),
    db.list<LancamentoCaixa>(unidadeId, 'lancamentos'),
    db.list<Carteira>(unidadeId, 'carteiras')
  ])

  const carteirasPorId = new Map<number, Carteira>()
  for (const c of carteiras) {
    carteirasPorId.set(c.id, c)
  }

  const statusFiltro = filtros?.status && filtros.status !== 'todos' ? filtros.status : ''

  const filtradas = sessoes
    .filter(s => !statusFiltro || s.status === statusFiltro)
    .sort((a, b) => {
      const diff = new Date(b.abertaEm).getTime() - new Date(a.abertaEm).getTime()
      return diff !== 0 ? diff : b.id - a.id
    })

  const resultado: SessaoCaixaComDetalhes[] = []

  for (const sessao of filtradas) {
    const lancs = lancamentos
      .filter(l => Number(l.sessaoCaixaId) === sessao.id)
      .sort((a, b) => {
        const diff = new Date(b.data).getTime() - new Date(a.data).getTime()
        return diff !== 0 ? diff : b.id - a.id
      })

    const saldoCalculado = await calcularSaldoSessao(sessao.id, lancs)
    const saldoEsperado
      = sessao.status === 'fechada' && sessao.saldoEsperadoFechamento !== undefined
        ? Math.round(Number(sessao.saldoEsperadoFechamento))
        : saldoCalculado

    const cofreOrigem = sessao.carteiraOrigemId
      ? carteirasPorId.get(Number(sessao.carteiraOrigemId))
      : undefined

    const cofreDestino = sessao.carteiraDestinoId
      ? carteirasPorId.get(Number(sessao.carteiraDestinoId))
      : undefined

    resultado.push({
      ...sessao,
      responsavelNome: sessao.responsavelNome || `Usuário #${sessao.abertaPorUsuarioId}`,
      ...(cofreOrigem ? { carteiraOrigemNome: cofreOrigem.nome } : {}),
      ...(cofreDestino ? { carteiraDestinoNome: cofreDestino.nome } : {}),
      saldoEsperado,
      lancamentos: lancs
    })
  }

  return resultado
}
