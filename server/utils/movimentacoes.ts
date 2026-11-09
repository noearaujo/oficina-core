import * as z from 'zod'
import { db } from './storage'
import type { Carteira } from './carteiras'
import { calcularSaldoCarteira } from './carteiras'
import type { LancamentoCaixa, Modalidade } from './caixa'

const vazioParaUndefined = (value: unknown) =>
  value === '' || value === null || value === undefined ? undefined : value

const valorSchema = z.preprocess(
  vazioParaUndefined,
  z.coerce.number({ message: 'Informe o valor' })
    .int('Valor deve ser inteiro em centavos')
    .positive('O valor deve ser maior que zero')
)

const idSchema = (mensagem: string) => z.preprocess(
  vazioParaUndefined,
  z.coerce.number({ message: mensagem }).int(mensagem).positive(mensagem)
)

const idOpcional = z.preprocess(
  vazioParaUndefined,
  z.coerce.number().int().positive().optional()
)

const dataSchema = z.preprocess(
  vazioParaUndefined,
  z.string().refine(v => !Number.isNaN(new Date(v).getTime()), 'Data inválida').optional()
)

const textoOpcional = z.string().trim().optional()

export const categoriasDespesa = [
  'peca', 'material', 'alimento', 'fixo', 'folha', 'imposto', 'taxa_adquirente', 'outro'
] as const

export const categoriasEntradaExterna = ['aporte', 'emprestimo_socio'] as const

export const transferirSchema = z.object({
  origemCarteiraId: idSchema('Informe a Carteira de origem'),
  destinoCarteiraId: idSchema('Informe a Carteira de destino'),
  valor: valorSchema,
  data: dataSchema,
  observacao: textoOpcional,
  usuarioId: idOpcional
}).refine(d => d.origemCarteiraId !== d.destinoCarteiraId, {
  path: ['destinoCarteiraId'],
  message: 'Origem e destino devem ser Carteiras diferentes'
})

export const despesaCarteiraSchema = z.object({
  carteiraId: idSchema('Informe a Carteira'),
  valor: valorSchema,
  categoria: z.enum(categoriasDespesa, { message: 'Selecione a categoria da despesa' }),
  data: dataSchema,
  observacao: textoOpcional,
  usuarioId: idOpcional
})

export const entradaExternaSchema = z.object({
  carteiraId: idSchema('Informe a Carteira de destino'),
  valor: valorSchema,
  categoria: z.enum(categoriasEntradaExterna, { message: 'Selecione aporte ou empréstimo de sócio' }),
  usuarioContraparteId: idOpcional,
  contraparteNome: textoOpcional,
  data: dataSchema,
  observacao: z.string().trim().min(1, 'Informe a observação/motivo'),
  usuarioId: idOpcional
}).refine(d => d.usuarioContraparteId !== undefined || !!d.contraparteNome, {
  path: ['contraparteNome'],
  message: 'Informe a contraparte (usuário ou nome)'
})

export const estornoSchema = z.object({
  observacao: textoOpcional,
  usuarioId: idOpcional
})

export type TransferirInput = z.output<typeof transferirSchema>
export type DespesaCarteiraInput = z.output<typeof despesaCarteiraSchema>
export type EntradaExternaInput = z.output<typeof entradaExternaSchema>
export type EstornoInput = z.output<typeof estornoSchema>

function erro(statusCode: number, statusMessage: string): never {
  throw createError({ statusCode, statusMessage })
}

function modalidadePorCarteira(carteira: Carteira): Modalidade {
  return carteira.tipo === 'cofre' ? 'dinheiro' : 'transferencia'
}

function normalizarData(data: string | undefined, agora: string): string {
  return data ? new Date(data).toISOString() : agora
}

async function obterCarteiraAtiva(unidadeId: number, carteiraId: number): Promise<Carteira> {
  const carteira = await db.get<Carteira>(unidadeId, 'carteiras', carteiraId)
  if (!carteira) erro(404, 'Carteira não encontrada nesta unidade')
  if (carteira.ativa === false) erro(400, `A Carteira "${carteira.nome}" está inativa`)
  return carteira
}

async function exigirSaldo(unidadeId: number, carteira: Carteira, valor: number): Promise<void> {
  const saldo = await calcularSaldoCarteira(unidadeId, carteira)
  if (valor > saldo) {
    erro(400, `Saldo insuficiente na Carteira "${carteira.nome}" (a Carteira não pode ficar negativa)`)
  }
}

export async function transferirEntreCarteiras(
  unidadeId: number,
  dados: TransferirInput
): Promise<{ saida: LancamentoCaixa, entrada: LancamentoCaixa, parId: number }> {
  return await db.transaction(async () => {
    const origem = await obterCarteiraAtiva(unidadeId, dados.origemCarteiraId)
    const destino = await obterCarteiraAtiva(unidadeId, dados.destinoCarteiraId)
    const valor = Math.round(dados.valor)

    await exigirSaldo(unidadeId, origem, valor)

    const agora = new Date().toISOString()
    const data = normalizarData(dados.data, agora)
    const observacao = dados.observacao || `Transferência ${origem.nome} → ${destino.nome}`
    const usuarioId = dados.usuarioId ?? 1

    const saidaInicial = await db.insert<LancamentoCaixa>(unidadeId, 'lancamentos', {
      tipo: 'saida',
      carteiraId: origem.id,
      valor,
      data,
      modalidade: 'transferencia',
      categoria: 'transferencia',
      observacao,
      criadoPorUsuarioId: usuarioId,
      dataCriacao: agora
    })

    const parId = saidaInicial.id
    const saida = (await db.update<LancamentoCaixa>(unidadeId, 'lancamentos', saidaInicial.id, { parId }))
      ?? { ...saidaInicial, parId }

    const entrada = await db.insert<LancamentoCaixa>(unidadeId, 'lancamentos', {
      tipo: 'entrada',
      carteiraId: destino.id,
      valor,
      data,
      modalidade: 'transferencia',
      categoria: 'transferencia',
      parId,
      observacao,
      criadoPorUsuarioId: usuarioId,
      dataCriacao: agora
    })

    return { saida, entrada, parId }
  })
}

export async function registrarDespesaCarteira(
  unidadeId: number,
  dados: DespesaCarteiraInput
): Promise<LancamentoCaixa> {
  return await db.transaction(async () => {
    const carteira = await obterCarteiraAtiva(unidadeId, dados.carteiraId)
    const valor = Math.round(dados.valor)

    await exigirSaldo(unidadeId, carteira, valor)

    const agora = new Date().toISOString()

    return await db.insert<LancamentoCaixa>(unidadeId, 'lancamentos', {
      tipo: 'saida',
      carteiraId: carteira.id,
      valor,
      data: normalizarData(dados.data, agora),
      modalidade: modalidadePorCarteira(carteira),
      categoria: dados.categoria,
      ...(dados.observacao ? { observacao: dados.observacao } : {}),
      criadoPorUsuarioId: dados.usuarioId ?? 1,
      dataCriacao: agora
    })
  })
}

export async function registrarEntradaExterna(
  unidadeId: number,
  dados: EntradaExternaInput
): Promise<LancamentoCaixa> {
  return await db.transaction(async () => {
    const carteira = await obterCarteiraAtiva(unidadeId, dados.carteiraId)
    const agora = new Date().toISOString()

    return await db.insert<LancamentoCaixa>(unidadeId, 'lancamentos', {
      tipo: 'entrada',
      carteiraId: carteira.id,
      valor: Math.round(dados.valor),
      data: normalizarData(dados.data, agora),
      modalidade: modalidadePorCarteira(carteira),
      categoria: dados.categoria,
      ...(dados.usuarioContraparteId !== undefined ? { usuarioContraparteId: dados.usuarioContraparteId } : {}),
      ...(dados.contraparteNome ? { contraparteNome: dados.contraparteNome } : {}),
      observacao: dados.observacao,
      criadoPorUsuarioId: dados.usuarioId ?? 1,
      dataCriacao: agora
    })
  })
}

export async function estornarLancamento(
  unidadeId: number,
  lancamentoId: number,
  dados: EstornoInput
): Promise<{ estornos: LancamentoCaixa[], parId?: number }> {
  return await db.transaction(async () => {
    const original = await db.get<LancamentoCaixa>(unidadeId, 'lancamentos', lancamentoId)
    if (!original) erro(404, 'Lançamento não encontrado')

    if (original.estornoDe) {
      erro(400, 'Um estorno não pode ser estornado')
    }

    const todos = await db.list<LancamentoCaixa>(unidadeId, 'lancamentos')

    // Transferência: estorna o par inteiro para manter as duas pontas coerentes
    const alvos = original.categoria === 'transferencia' && original.parId
      ? todos.filter(l => l.parId === original.parId && !l.estornoDe)
      : [original]

    for (const alvo of alvos) {
      if (todos.some(l => Number(l.estornoDe) === alvo.id)) {
        erro(409, 'Este lançamento já foi estornado')
      }
    }

    // Carteira não pode ficar negativa ao reverter uma entrada
    for (const alvo of alvos) {
      if (alvo.tipo !== 'entrada' || !alvo.carteiraId) continue
      const carteira = await db.get<Carteira>(unidadeId, 'carteiras', Number(alvo.carteiraId))
      if (carteira) await exigirSaldo(unidadeId, carteira, Math.round(Number(alvo.valor)))
    }

    const agora = new Date().toISOString()
    const usuarioId = dados.usuarioId ?? 1
    const ehPar = alvos.length === 2
    const estornos: LancamentoCaixa[] = []
    let parId: number | undefined

    for (const alvo of alvos) {
      const criado = await db.insert<LancamentoCaixa>(unidadeId, 'lancamentos', {
        tipo: alvo.tipo === 'entrada' ? 'saida' : 'entrada',
        ...(alvo.carteiraId ? { carteiraId: alvo.carteiraId } : {}),
        ...(alvo.sessaoCaixaId ? { sessaoCaixaId: alvo.sessaoCaixaId } : {}),
        valor: Math.round(Number(alvo.valor)),
        data: agora,
        ...(alvo.documentoId ? { documentoId: alvo.documentoId } : {}),
        ...(alvo.documentoTipo ? { documentoTipo: alvo.documentoTipo } : {}),
        ...(alvo.fornecedorId ? { fornecedorId: alvo.fornecedorId } : {}),
        ...(alvo.usuarioContraparteId ? { usuarioContraparteId: alvo.usuarioContraparteId } : {}),
        ...(alvo.contraparteNome ? { contraparteNome: alvo.contraparteNome } : {}),
        modalidade: alvo.modalidade,
        categoria: alvo.categoria,
        ...(parId !== undefined ? { parId } : {}),
        estornoDe: alvo.id,
        observacao: dados.observacao || `Estorno do lançamento #${alvo.id}`,
        criadoPorUsuarioId: usuarioId,
        dataCriacao: agora
      })

      let registro = criado
      if (ehPar && parId === undefined) {
        parId = criado.id
        registro = (await db.update<LancamentoCaixa>(unidadeId, 'lancamentos', criado.id, { parId }))
          ?? { ...criado, parId }
      }
      estornos.push(registro)
    }

    return { estornos, ...(parId !== undefined ? { parId } : {}) }
  })
}
