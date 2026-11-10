import { db } from '../storage'
import type { LancamentoCaixa } from '../caixa'
import type { FaturamentoOS, OrdemServico } from './types'

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
