import { db } from '../storage'
import { estornarEstoqueItemOS } from '../estoque'
import {
  ROLES_VALIDOS,
  type ItemOS,
  type Nota,
  type OrdemServico,
  type RoleUsuario,
  type TipoNota,
  type UnidadeRecord
} from './types'

export function erro(statusCode: number, statusMessage: string): never {
  throw createError({ statusCode, statusMessage })
}

export function normalizarRole(role?: string): RoleUsuario {
  const r = (role || 'admin').trim().toLowerCase()
  if ((ROLES_VALIDOS as readonly string[]).includes(r)) {
    return r as RoleUsuario
  }
  return 'admin'
}

export function exigirRole(role: string | undefined, permitidos: readonly RoleUsuario[], acao: string): RoleUsuario {
  const normalizado = normalizarRole(role)
  if (!permitidos.includes(normalizado)) {
    erro(403, `Permissão negada: o papel "${normalizado}" não pode executar "${acao}"`)
  }
  return normalizado
}

export async function obterOSExigente(unidadeId: number, osId: number): Promise<OrdemServico> {
  const os = await db.get<OrdemServico>(unidadeId, 'os', osId)
  if (!os || os.deletedAt) {
    erro(404, 'Ordem de Serviço não encontrada')
  }
  return os
}

export async function carregarItensDaOS(unidadeId: number, os: OrdemServico): Promise<ItemOS[]> {
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

export async function carregarNotasDaOS(unidadeId: number, os: OrdemServico): Promise<Nota[]> {
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

export async function sincronizarSnapshotOS(
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

export async function gerarProximoNumeroOS(
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

export function calcularProximoLote(itens: ItemOS[]): number {
  const complementos = itens.filter(i => i.lote !== null && i.lote !== undefined)
  if (complementos.length === 0) return 1

  const maiorLote = Math.max(...complementos.map(i => Number(i.lote)))
  const loteAtualTemPendente = complementos.some(
    i => Number(i.lote) === maiorLote && i.status === 'pendente'
  )

  return loteAtualTemPendente ? maiorLote : maiorLote + 1
}

export async function verificarAutoTransicaoAprovada(
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

export async function estornarEstoqueComNota(
  unidadeId: number,
  os: Pick<OrdemServico, 'id' | 'numero'>,
  item: ItemOS,
  usuarioId: number,
  role: RoleUsuario,
  data: string
): Promise<void> {
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
    data
  })

  if (resultadoEstorno.fallbackNota) {
    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'estoque',
      texto: resultadoEstorno.fallbackNota,
      role,
      data
    })
  }
}
