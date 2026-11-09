import * as z from 'zod'
import { db, COLLECTIONS } from './storage'
import type { StorageRecord } from './storage'

export const FUSO_PADRAO = 'America/Sao_Paulo'
export const VALIDADE_DIAS_PADRAO = 15

export interface Config extends StorageRecord {
  nome: string
  endereco?: string
  telefone?: string
  cnpj?: string
  email?: string
  logo?: string
  validadeDias: number
  fusoHorario: string
  textoGarantia?: string
  textoObservacoes?: string
  textoRodape?: string
  dataAtualizacao?: string
}

function fusoValido(valor: string) {
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: valor })
    return true
  } catch {
    return false
  }
}

const textoOpcional = (max: number) => z.string().trim().max(max).optional()

export const configSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da oficina').max(120).optional(),
  endereco: textoOpcional(255),
  telefone: textoOpcional(30),
  cnpj: textoOpcional(30),
  email: z.union([z.literal(''), z.string().trim().email('E-mail inválido')]).optional(),
  logo: z.string().optional(),
  validadeDias: z.coerce.number().int('Validade deve ser inteira').min(1, 'Mínimo 1 dia').max(365, 'Máximo 365 dias').optional(),
  fusoHorario: z.string().trim().refine(fusoValido, 'Fuso horário inválido').optional(),
  textoGarantia: textoOpcional(1000),
  textoObservacoes: textoOpcional(1000),
  textoRodape: textoOpcional(500)
})

export type ConfigInput = z.output<typeof configSchema>

export async function obterConfig(unidadeId: number): Promise<Omit<Config, 'id'> & { id?: number }> {
  const [salva] = await db.list<Config>(unidadeId, 'configs')
  if (salva) return salva

  const unidade = await db.get(unidadeId, 'unidades', unidadeId)
  return {
    unidadeId,
    nome: typeof unidade?.nome === 'string' && unidade.nome ? unidade.nome : 'Oficina',
    validadeDias: VALIDADE_DIAS_PADRAO,
    fusoHorario: FUSO_PADRAO
  }
}

export async function atualizarConfig(unidadeId: number, dados: ConfigInput) {
  return await db.transaction(async () => {
    const [existente] = await db.list<Config>(unidadeId, 'configs')
    const agora = new Date().toISOString()

    if (existente) {
      return await db.update<Config>(unidadeId, 'configs', existente.id, {
        ...dados,
        dataAtualizacao: agora
      })
    }

    const base = await obterConfig(unidadeId)
    const { id: _id, unidadeId: _u, ...padrao } = base
    return await db.insert<Config>(unidadeId, 'configs', {
      ...padrao,
      ...dados,
      dataAtualizacao: agora
    } as Omit<Config, 'id' | 'unidadeId'>)
  })
}

// ═══ Backup ═══

export interface BackupJson {
  versao: number
  geradoEm: string
  unidadeId: number
  colecoes: Record<string, StorageRecord[]>
}

export async function exportarBackup(unidadeId: number): Promise<BackupJson> {
  const colecoes: Record<string, StorageRecord[]> = {}
  for (const nome of COLLECTIONS) {
    colecoes[nome] = await db.list(unidadeId, nome)
  }
  return { versao: 1, geradoEm: new Date().toISOString(), unidadeId, colecoes }
}

export async function importarBackup(unidadeId: number, payload: unknown) {
  const backup = payload as Partial<BackupJson> | null
  if (!backup || typeof backup !== 'object' || !backup.colecoes || typeof backup.colecoes !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Arquivo de backup inválido' })
  }

  const colecoes = backup.colecoes as Record<string, unknown>
  for (const nome of COLLECTIONS) {
    const itens = colecoes[nome]
    if (itens !== undefined && !(Array.isArray(itens) && itens.every(i => i && typeof i === 'object'))) {
      throw createError({ statusCode: 400, statusMessage: `Coleção inválida no backup: ${nome}` })
    }
  }

  return await db.transaction(async () => {
    const resumo: Record<string, number> = {}
    for (const nome of COLLECTIONS) {
      const itens = (colecoes[nome] as StorageRecord[] | undefined) ?? []
      resumo[nome] = await db.replaceAll(unidadeId, nome, itens)
    }
    return { ok: true, importados: resumo }
  })
}

// ═══ CSV ═══

export const ENTIDADES_CSV: Record<string, string> = {
  clientes: 'clientes',
  veiculos: 'veiculos',
  os: 'os',
  lancamentos: 'lancamentos',
  catalogo: 'catalogo',
  vendas: 'vendas',
  estoque: 'estoque'
}

const CAMPOS_DINHEIRO = new Set([
  'valor', 'preco', 'custo', 'precoUnitario', 'valorAbertura', 'valorContado', 'saldoInicial', 'total', 'desconto'
])

const CAMPOS_DATA = /^(data|criadoEm|abertaEm|fechadaEm)|Em$|Data$/
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

function achatar(obj: Record<string, unknown>, prefixo = ''): Record<string, unknown> {
  const saida: Record<string, unknown> = {}
  for (const [chave, valor] of Object.entries(obj)) {
    const nome = prefixo ? `${prefixo}.${chave}` : chave
    if (Array.isArray(valor)) continue
    if (valor && typeof valor === 'object') {
      Object.assign(saida, achatar(valor as Record<string, unknown>, nome))
    } else {
      saida[nome] = valor
    }
  }
  return saida
}

function formatarCelula(chave: string, valor: unknown, fuso: string): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'number') {
    const ultimo = chave.split('.').pop() as string
    const n = CAMPOS_DINHEIRO.has(ultimo) ? valor / 100 : valor
    return (CAMPOS_DINHEIRO.has(ultimo) ? n.toFixed(2) : String(n)).replace('.', ',')
  }
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não'
  let texto = String(valor)
  if (ISO.test(texto) && CAMPOS_DATA.test(chave.split('.').pop() as string)) {
    texto = new Intl.DateTimeFormat('pt-BR', {
      timeZone: fuso,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(texto))
  }
  if (/[;"\r\n]/.test(texto)) texto = `"${texto.replace(/"/g, '""')}"`
  return texto
}

export async function gerarCsv(unidadeId: number, entidade: string): Promise<string> {
  const colecao = ENTIDADES_CSV[entidade]
  if (!colecao) {
    throw createError({ statusCode: 404, statusMessage: 'Entidade de exportação desconhecida' })
  }

  const config = await obterConfig(unidadeId)
  const linhas = (await db.list(unidadeId, colecao)).map(item => achatar(item))
  const colunas: string[] = []
  for (const linha of linhas) {
    for (const chave of Object.keys(linha)) {
      if (!colunas.includes(chave)) colunas.push(chave)
    }
  }

  const cabecalho = colunas.join(';')
  const corpo = linhas.map(linha =>
    colunas.map(c => formatarCelula(c, linha[c], String(config.fusoHorario || FUSO_PADRAO))).join(';')
  )
  return '\uFEFF' + [cabecalho, ...corpo].join('\r\n') + '\r\n'
}
