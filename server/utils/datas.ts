import { obterConfig, FUSO_PADRAO } from './config'

/**
 * Obtém o fuso horário configurado para a unidade (padrão: America/Sao_Paulo).
 */
export async function obterFusoUnidade(unidadeId: number): Promise<string> {
  try {
    const config = await obterConfig(unidadeId)
    return String(config?.fusoHorario || FUSO_PADRAO)
  } catch {
    return FUSO_PADRAO
  }
}

/**
 * Retorna a data em string ISO UTC atual.
 */
export function agoraUtc(): string {
  return new Date().toISOString()
}

/**
 * Formata uma data ISO/Date para string 'YYYY-MM-DD' de acordo com o fuso horário da unidade.
 */
export function obterDataLocal(dataIso: string | Date, fuso: string = FUSO_PADRAO): string {
  const d = typeof dataIso === 'string' ? new Date(dataIso) : dataIso
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d)
}

/**
 * Formata uma data ISO para o padrão brasileiro dd/mm/aaaa.
 */
export function formatarDataBR(dataIso: string | Date | undefined | null, fuso: string = FUSO_PADRAO): string {
  if (!dataIso) return ''
  const d = typeof dataIso === 'string' ? new Date(dataIso) : dataIso
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(d)
}

/**
 * Formata uma data ISO para o padrão brasileiro com horário dd/mm/aaaa hh:mm:ss.
 */
export function formatarDataHoraBR(dataIso: string | Date | undefined | null, fuso: string = FUSO_PADRAO): string {
  if (!dataIso) return ''
  const d = typeof dataIso === 'string' ? new Date(dataIso) : dataIso
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(d)
}

/**
 * Retorna os limites YYYY-MM-DD para os períodos padrões ('hoje', 'semana', 'mes', 'personalizado').
 */
export function calcularLimitesPeriodo(
  periodo: 'hoje' | 'semana' | 'mes' | 'personalizado',
  opts?: {
    fuso?: string
    dataInicio?: string
    dataFim?: string
  }
): { dataInicio: string, dataFim: string } {
  const fuso = opts?.fuso || FUSO_PADRAO
  const hojeStr = obterDataLocal(new Date(), fuso)
  const partes = hojeStr.split('-')
  const ano = Number(partes[0]) || new Date().getFullYear()
  const mes = Number(partes[1]) || (new Date().getMonth() + 1) // 1 a 12
  const dia = Number(partes[2]) || new Date().getDate()

  if (periodo === 'hoje') {
    return { dataInicio: hojeStr, dataFim: hojeStr }
  }

  if (periodo === 'semana') {
    const d = new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0))
    const dayOfWeek = d.getUTCDay()
    const diffParaSegunda = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const segunda = new Date(Date.UTC(ano, mes - 1, dia + diffParaSegunda, 12, 0, 0))
    const domingo = new Date(Date.UTC(ano, mes - 1, dia + diffParaSegunda + 6, 12, 0, 0))
    const dataInicio = segunda.toISOString().slice(0, 10)
    const dataFim = domingo.toISOString().slice(0, 10)
    return { dataInicio, dataFim }
  }

  if (periodo === 'mes') {
    const mesFormatado = String(mes).padStart(2, '0')
    const dataInicio = `${ano}-${mesFormatado}-01`
    const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
    const dataFim = `${ano}-${mesFormatado}-${String(ultimoDia).padStart(2, '0')}`
    return { dataInicio, dataFim }
  }

  // personalizado
  return {
    dataInicio: opts?.dataInicio ? opts.dataInicio.slice(0, 10) : hojeStr,
    dataFim: opts?.dataFim ? opts.dataFim.slice(0, 10) : hojeStr
  }
}

/**
 * Verifica se uma data ISO está dentro do intervalo [dataInicio, dataFim].
 */
export function estaNoPeriodo(
  dataIso: string | Date | undefined | null,
  limites: { dataInicio?: string, dataFim?: string },
  fuso: string = FUSO_PADRAO
): boolean {
  if (!dataIso) return false
  const { dataInicio, dataFim } = limites
  if (!dataInicio && !dataFim) return true

  const dataLocal = obterDataLocal(dataIso, fuso)
  if (!dataLocal) return false

  if (dataInicio) {
    const inicioStr = dataInicio.slice(0, 10)
    if (dataLocal < inicioStr) return false
  }

  if (dataFim) {
    const fimStr = dataFim.slice(0, 10)
    if (dataLocal > fimStr) return false
  }

  return true
}
