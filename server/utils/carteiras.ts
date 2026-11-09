import * as z from 'zod'
import { db } from './storage'
import { stripAccents } from './clientes'

export const tiposCarteira = [
  { label: 'Banco', value: 'banco' },
  { label: 'Cofre', value: 'cofre' }
] as const

export const carteiraSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da carteira'),
  nomeBusca: z.string().trim().optional(),
  tipo: z.enum(['banco', 'cofre'], {
    message: 'Selecione o tipo da carteira'
  }),
  saldoInicial: z.preprocess(
    value => (value === '' || value === null || value === undefined ? 0 : value),
    z.coerce.number().int('Saldo inicial deve ser inteiro em centavos').min(0, 'Saldo inicial não pode ser negativo')
  ),
  ativa: z.preprocess(
    value => (value === undefined ? true : Boolean(value)),
    z.boolean()
  ),
  dataCriacao: z.string().optional(),
  dataAtualizacao: z.string().optional()
}).transform(carteira => ({
  ...carteira,
  nomeBusca: stripAccents(carteira.nome).toLowerCase()
}))

export const carteiraUpdateSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da carteira').optional(),
  nomeBusca: z.string().trim().optional(),
  tipo: z.enum(['banco', 'cofre'], {
    message: 'Selecione o tipo da carteira'
  }).optional(),
  saldoInicial: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().int('Saldo inicial deve ser inteiro em centavos').min(0, 'Saldo inicial não pode ser negativo').optional()
  ),
  ativa: z.boolean().optional()
})

export type CarteiraCadastro = z.output<typeof carteiraSchema>
export type CarteiraUpdateInput = z.output<typeof carteiraUpdateSchema>

export interface Carteira {
  id: number
  unidadeId: number
  tipo: 'banco' | 'cofre'
  nome: string
  nomeBusca?: string
  saldoInicial: number
  ativa: boolean
  dataCriacao: string
  dataAtualizacao?: string
  [key: string]: unknown
}

export interface CarteiraComSaldo extends Carteira {
  saldo: number
}

export interface MovimentoFinanceiroVinculo {
  id: number
  unidadeId: number
  carteiraId?: number | null
  origemCarteiraId?: number | null
  destinoCarteiraId?: number | null
  tipo?: 'entrada' | 'saida' | string
  valor?: number
  estornoDe?: number | null
  [key: string]: unknown
}

export interface SessaoCaixaVinculo {
  id: number
  unidadeId: number
  status?: 'aberta' | 'fechada' | string
  carteiraOrigemId?: number | null
  carteiraId?: number | null
  carteiraCofreId?: number | null
  [key: string]: unknown
}

export async function calcularSaldoCarteira(
  unidadeId: number,
  carteira: Carteira,
  lancamentosPreCarregados?: MovimentoFinanceiroVinculo[]
): Promise<number> {
  const lancamentos
    = lancamentosPreCarregados
      ?? await db.list<MovimentoFinanceiroVinculo>(unidadeId, 'lancamentos')

  const saldoInicial = Math.round(Number(carteira.saldoInicial ?? 0))

  const delta = lancamentos.reduce((acc, lancamento) => {
    if (Number(lancamento.carteiraId) !== carteira.id) return acc
    const valor = Math.round(Number(lancamento.valor ?? 0))
    if (lancamento.tipo === 'entrada') return acc + valor
    if (lancamento.tipo === 'saida') return acc - valor
    return acc
  }, 0)

  return saldoInicial + delta
}

export async function montarCarteiraComSaldo(
  unidadeId: number,
  carteira: Carteira,
  lancamentosPreCarregados?: MovimentoFinanceiroVinculo[]
): Promise<CarteiraComSaldo> {
  const saldoInicial = Math.round(Number(carteira.saldoInicial ?? 0))
  const saldo = await calcularSaldoCarteira(unidadeId, carteira, lancamentosPreCarregados)

  return {
    ...carteira,
    nomeBusca: carteira.nomeBusca || stripAccents(carteira.nome).toLowerCase(),
    saldoInicial,
    ativa: carteira.ativa !== false,
    saldo
  }
}

export async function listarCarteiras(
  unidadeId: number,
  filtros?: { q?: string, tipo?: string, ativa?: boolean }
): Promise<CarteiraComSaldo[]> {
  const [carteiras, lancamentos] = await Promise.all([
    db.list<Carteira>(unidadeId, 'carteiras'),
    db.list<MovimentoFinanceiroVinculo>(unidadeId, 'lancamentos')
  ])

  const termo = filtros?.q ? stripAccents(filtros.q.trim()).toLowerCase() : ''
  const tipo = filtros?.tipo && filtros.tipo !== 'todos' ? filtros.tipo : ''

  const resultado: CarteiraComSaldo[] = []

  for (const carteira of carteiras) {
    const item = await montarCarteiraComSaldo(unidadeId, carteira, lancamentos)

    const correspondeBusca
      = !termo
        || (item.nomeBusca || '').includes(termo)
        || item.tipo.toLowerCase().includes(termo)

    const correspondeTipo = !tipo || item.tipo === tipo
    const correspondeAtiva = filtros?.ativa === undefined || item.ativa === filtros.ativa

    if (correspondeBusca && correspondeTipo && correspondeAtiva) {
      resultado.push(item)
    }
  }

  return resultado
}

export async function obterCarteira(
  unidadeId: number,
  carteiraId: number
): Promise<CarteiraComSaldo | null> {
  const carteira = await db.get<Carteira>(unidadeId, 'carteiras', carteiraId)
  if (!carteira) return null
  return await montarCarteiraComSaldo(unidadeId, carteira)
}

export async function criarCarteira(
  unidadeId: number,
  dados: CarteiraCadastro
): Promise<CarteiraComSaldo> {
  return await db.transaction(async () => {
    const existentes = await db.list<Carteira>(unidadeId, 'carteiras')
    const nomeNormalizado = stripAccents(dados.nome).toLowerCase()

    const duplicada = existentes.some(
      item => (item.nomeBusca || stripAccents(item.nome).toLowerCase()) === nomeNormalizado
    )

    if (duplicada) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Já existe uma carteira com este nome nesta unidade'
      })
    }

    const agora = new Date().toISOString()

    const nova = await db.insert<Carteira>(unidadeId, 'carteiras', {
      nome: dados.nome,
      nomeBusca: nomeNormalizado,
      tipo: dados.tipo,
      saldoInicial: Math.round(Number(dados.saldoInicial ?? 0)),
      ativa: dados.ativa !== false,
      dataCriacao: agora,
      dataAtualizacao: agora
    })

    return await montarCarteiraComSaldo(unidadeId, nova, [])
  })
}

export async function atualizarCarteira(
  unidadeId: number,
  carteiraId: number,
  dados: CarteiraUpdateInput
): Promise<CarteiraComSaldo | null> {
  return await db.transaction(async () => {
    const atual = await db.get<Carteira>(unidadeId, 'carteiras', carteiraId)
    if (!atual) return null

    const novoNome = dados.nome !== undefined ? dados.nome : atual.nome
    const nomeNormalizado = stripAccents(novoNome).toLowerCase()

    if (dados.nome !== undefined) {
      const existentes = await db.list<Carteira>(unidadeId, 'carteiras')
      const duplicada = existentes.some(
        item =>
          item.id !== carteiraId
          && (item.nomeBusca || stripAccents(item.nome).toLowerCase()) === nomeNormalizado
      )

      if (duplicada) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Já existe uma carteira com este nome nesta unidade'
        })
      }
    }

    const agora = new Date().toISOString()

    const atualizada = await db.update<Carteira>(unidadeId, 'carteiras', carteiraId, {
      nome: novoNome,
      nomeBusca: nomeNormalizado,
      tipo: dados.tipo !== undefined ? dados.tipo : atual.tipo,
      saldoInicial: dados.saldoInicial !== undefined
        ? Math.round(Number(dados.saldoInicial))
        : Math.round(Number(atual.saldoInicial ?? 0)),
      ativa: dados.ativa !== undefined ? dados.ativa : (atual.ativa !== false),
      dataCriacao: atual.dataCriacao || agora,
      dataAtualizacao: agora
    })

    if (!atualizada) return null

    return await montarCarteiraComSaldo(unidadeId, atualizada)
  })
}

export async function verificarMovimentacoesVinculadas(
  unidadeId: number,
  carteiraId: number
): Promise<boolean> {
  const [lancamentos, movimentacoes, movimentos, sessoesCaixa, sessoesSnake] = await Promise.all([
    db.list<MovimentoFinanceiroVinculo>(unidadeId, 'lancamentos'),
    db.list<MovimentoFinanceiroVinculo>(unidadeId, 'movimentacoes'),
    db.list<MovimentoFinanceiroVinculo>(unidadeId, 'movimentos'),
    db.list<SessaoCaixaVinculo>(unidadeId, 'sessoesCaixa'),
    db.list<SessaoCaixaVinculo>(unidadeId, 'sessoes_caixa')
  ])

  const temMovimento = [...lancamentos, ...movimentacoes, ...movimentos].some(
    mov =>
      Number(mov.carteiraId) === carteiraId
      || Number(mov.origemCarteiraId) === carteiraId
      || Number(mov.destinoCarteiraId) === carteiraId
  )

  if (temMovimento) return true

  const temSessao = [...sessoesCaixa, ...sessoesSnake].some(
    sessao =>
      Number(sessao.carteiraOrigemId) === carteiraId
      || Number(sessao.carteiraId) === carteiraId
      || Number(sessao.carteiraCofreId) === carteiraId
  )

  return temSessao
}

export async function excluirCarteira(
  unidadeId: number,
  carteiraId: number
): Promise<boolean> {
  return await db.transaction(async () => {
    const carteira = await db.get<Carteira>(unidadeId, 'carteiras', carteiraId)
    if (!carteira) {
      throw createError({ statusCode: 404, statusMessage: 'Carteira não encontrada' })
    }

    const possuiVinculos = await verificarMovimentacoesVinculadas(unidadeId, carteiraId)
    if (possuiVinculos) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Não é possível excluir uma carteira que possui movimentações vinculadas'
      })
    }

    return await db.delete(unidadeId, 'carteiras', carteiraId)
  })
}
