/**
 * Formata um valor em centavos inteiros para o formato de moeda brasileiro (R$ X,XX).
 */
export function formatarDinheiro(centavos: number | undefined | null): string {
  const valor = Number.isFinite(centavos) ? Number(centavos) : 0
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor / 100)
}

/**
 * Converte valor em centavos inteiros para número em reais (ex: 8500 -> 85.00).
 */
export function centavosParaReais(centavos: number | undefined | null): number {
  if (!Number.isFinite(centavos)) return 0
  return Number(centavos) / 100
}

/**
 * Converte número em reais para centavos inteiros (ex: 85.5 -> 8550).
 */
export function reaisParaCentavos(reais: number | string | undefined | null): number {
  if (reais === undefined || reais === null || reais === '') return 0
  const normalizado = typeof reais === 'string' ? reais.replace(/\./g, '').replace(',', '.') : reais
  const num = Number(normalizado)
  if (!Number.isFinite(num)) return 0
  return Math.round(num * 100)
}
