import * as z from 'zod'
import { db } from '../storage'
import type { LancamentoCaixa, SessaoCaixa } from '../caixa'
import type { Carteira } from '../carteiras'
import {
  carregarItensDaOS,
  erro,
  exigirRole,
  gerarNota,
  obterOSExigente,
  sincronizarSnapshotOS
} from './helpers'
import { montarOSDetalhe } from './index'
import type { FaturamentoOS, OrdemServico, OrdemServicoDetalhe } from './types'

const vazioParaUndefined = (value: unknown) =>
  value === '' || value === null || value === undefined ? undefined : value

function formatarMoedaNota(valorCentavos: number): string {
  return `R$ ${(valorCentavos / 100).toFixed(2).replace('.', ',')}`
}

export const pagamentoOsSchema = z.object({
  valor: z.coerce.number().int().positive('Valor deve ser positivo em centavos'),
  modalidade: z.enum(['dinheiro', 'pix', 'credito', 'debito', 'boleto']),
  carteiraId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional()),
  sessaoCaixaId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional()),
  observacao: z.string().trim().optional(),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
}).refine(d => Boolean(d.carteiraId) !== Boolean(d.sessaoCaixaId), {
  message: 'Informe exatamente um destino: Carteira ou Sessão de Caixa'
})

export const estornoPagamentoOsSchema = z.object({
  lancamentoId: z.coerce.number().int().positive(),
  motivo: z.string().trim().min(1, 'Informe o motivo do estorno'),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
})

export const devolucaoOsSchema = z.object({
  valor: z.coerce.number().int().positive('Valor deve ser positivo em centavos'),
  modalidade: z.enum(['dinheiro', 'pix', 'credito', 'debito', 'boleto']),
  carteiraId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional()),
  sessaoCaixaId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional()),
  motivo: z.string().trim().min(1, 'Informe o motivo da devolução'),
  role: z.string().trim().optional(),
  usuarioId: z.preprocess(vazioParaUndefined, z.coerce.number().int().positive().optional())
}).refine(d => Boolean(d.carteiraId) !== Boolean(d.sessaoCaixaId), {
  message: 'Informe exatamente um destino: Carteira ou Sessão de Caixa'
})

export type PagamentoOSInput = z.output<typeof pagamentoOsSchema>
export type EstornoPagamentoOSInput = z.output<typeof estornoPagamentoOsSchema>
export type DevolucaoOSInput = z.output<typeof devolucaoOsSchema>

async function validarDestinoOS(
  unidadeId: number,
  modalidade: 'dinheiro' | 'pix' | 'credito' | 'debito' | 'boleto',
  carteiraId?: number,
  sessaoCaixaId?: number
): Promise<{ carteiraId?: number, sessaoCaixaId?: number }> {
  if (modalidade === 'dinheiro') {
    if (!sessaoCaixaId || carteiraId) {
      erro(400, 'Pagamentos em dinheiro exigem uma Sessão de Caixa aberta')
    }
    const sessao = await db.get<SessaoCaixa>(unidadeId, 'sessoesCaixa', sessaoCaixaId)
    if (!sessao || sessao.status !== 'aberta') {
      erro(400, 'Sessão de Caixa inválida ou fechada')
    }
    return { sessaoCaixaId: sessao.id }
  }

  if (!carteiraId || sessaoCaixaId) {
    erro(400, `Modalidade "${modalidade}" exige uma Carteira do tipo Banco`)
  }
  const carteira = await db.get<Carteira>(unidadeId, 'carteiras', carteiraId)
  if (!carteira) {
    erro(404, 'Carteira não encontrada nesta unidade')
  }
  if (carteira.tipo !== 'banco') {
    erro(400, 'Apenas Carteira do tipo Banco é permitida para esta modalidade')
  }
  if (carteira.ativa === false) {
    erro(400, 'A Carteira selecionada está inativa')
  }
  return { carteiraId: carteira.id }
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

  const todosDaOS = lancamentos.filter(
    l => Number(l.documentoId) === os.id && l.documentoTipo === 'os'
  )

  const movimentosPagamento = todosDaOS.filter(l =>
    ['pagamento', 'devolucao'].includes(String(l.categoria || ''))
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
    lancamentos: todosDaOS
  }
}

export async function lancarPagamentoOS(
  unidadeId: number,
  osId: number,
  dadosInput: PagamentoOSInput
): Promise<OrdemServicoDetalhe> {
  const dados = pagamentoOsSchema.parse(dadosInput)
  const role = exigirRole(dados.role, ['owner', 'admin', 'gerente', 'recepcionista'], 'lançar pagamento')
  const usuarioId = dados.usuarioId || 1

  return await db.transaction(async () => {
    const os = await obterOSExigente(unidadeId, osId)

    if (!['aprovada', 'em_execucao', 'concluida', 'entregue'].includes(os.status)) {
      erro(400, `Não é possível lançar pagamento em OS com status "${os.status}"`)
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    const faturamento = await calcularFaturamento(unidadeId, {
      id: os.id,
      itens,
      desconto: os.desconto
    })

    if (dados.valor > faturamento.saldo) {
      erro(400, 'Valor excede o saldo devedor')
    }

    const destino = await validarDestinoOS(
      unidadeId,
      dados.modalidade,
      dados.carteiraId,
      dados.sessaoCaixaId
    )

    const agora = new Date().toISOString()

    await db.insert<LancamentoCaixa>(unidadeId, 'lancamentos', {
      tipo: 'entrada',
      documentoTipo: 'os',
      documentoId: os.id,
      categoria: 'pagamento',
      modalidade: dados.modalidade,
      valor: dados.valor,
      data: agora,
      criadoPorUsuarioId: usuarioId,
      dataCriacao: agora,
      ...destino,
      ...(dados.observacao ? { observacao: dados.observacao } : {})
    })

    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'pagamento',
      texto: `Pagamento ${formatarMoedaNota(dados.valor)} (${dados.modalidade})`,
      role,
      data: agora
    })

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function estornarPagamentoOS(
  unidadeId: number,
  osId: number,
  dadosInput: EstornoPagamentoOSInput
): Promise<OrdemServicoDetalhe> {
  const dados = estornoPagamentoOsSchema.parse(dadosInput)
  const role = exigirRole(dados.role, ['owner', 'admin', 'gerente'], 'estornar pagamento')
  const usuarioId = dados.usuarioId || 1

  return await db.transaction(async () => {
    const os = await obterOSExigente(unidadeId, osId)
    const lancamentos = await db.list<LancamentoCaixa>(unidadeId, 'lancamentos')
    const original = lancamentos.find(l => l.id === dados.lancamentoId)

    if (!original) {
      erro(404, 'Lançamento não encontrado')
    }

    if (Number(original.documentoId) !== os.id || original.documentoTipo !== 'os') {
      erro(400, 'Lançamento não pertence a esta OS')
    }

    if (original.categoria !== 'pagamento' || original.tipo !== 'entrada') {
      erro(400, 'Apenas lançamentos de pagamento podem ser estornados')
    }

    if (original.estornoDe || lancamentos.some(e => Number(e.estornoDe) === original.id)) {
      erro(400, 'Lançamento já estornado')
    }

    const agora = new Date().toISOString()
    const valor = Math.round(Number(original.valor))

    await db.insert<LancamentoCaixa>(unidadeId, 'lancamentos', {
      tipo: 'saida',
      documentoTipo: 'os',
      documentoId: os.id,
      estornoDe: original.id,
      modalidade: original.modalidade,
      ...(original.carteiraId ? { carteiraId: original.carteiraId } : {}),
      ...(original.sessaoCaixaId ? { sessaoCaixaId: original.sessaoCaixaId } : {}),
      categoria: 'pagamento',
      valor,
      data: agora,
      observacao: dados.motivo,
      criadoPorUsuarioId: usuarioId,
      dataCriacao: agora
    })

    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'pagamento',
      texto: `Estorno ${formatarMoedaNota(valor)}`,
      role,
      data: agora
    })

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function devolucaoOS(
  unidadeId: number,
  osId: number,
  dadosInput: DevolucaoOSInput
): Promise<OrdemServicoDetalhe> {
  const dados = devolucaoOsSchema.parse(dadosInput)
  const role = exigirRole(dados.role, ['owner', 'admin', 'gerente'], 'registrar devolução')
  const usuarioId = dados.usuarioId || 1

  return await db.transaction(async () => {
    const os = await obterOSExigente(unidadeId, osId)
    const itens = await carregarItensDaOS(unidadeId, os)
    const faturamento = await calcularFaturamento(unidadeId, {
      id: os.id,
      itens,
      desconto: os.desconto
    })

    if (dados.valor > faturamento.pago) {
      erro(400, 'Valor excede o total pago')
    }

    const destino = await validarDestinoOS(
      unidadeId,
      dados.modalidade,
      dados.carteiraId,
      dados.sessaoCaixaId
    )

    const agora = new Date().toISOString()

    await db.insert<LancamentoCaixa>(unidadeId, 'lancamentos', {
      tipo: 'saida',
      documentoTipo: 'os',
      documentoId: os.id,
      categoria: 'devolucao',
      modalidade: dados.modalidade,
      valor: dados.valor,
      data: agora,
      observacao: dados.motivo,
      criadoPorUsuarioId: usuarioId,
      dataCriacao: agora,
      ...destino
    })

    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'pagamento',
      texto: `Devolução ${formatarMoedaNota(dados.valor)} — ${dados.motivo}`,
      role,
      data: agora
    })

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}
