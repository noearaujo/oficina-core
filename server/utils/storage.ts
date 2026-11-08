import { mkdir, readFile, writeFile } from 'node:fs/promises'

declare module 'node:fs/promises' {
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<string | undefined>
  export function readFile(path: string, encoding: 'utf-8'): Promise<string>
  export function writeFile(path: string, data: string, encoding: 'utf-8'): Promise<void>
}

export const COLLECTIONS = [
  'clientes',
  'veiculos',
  'catalogo',
  'estoque',
  'movimentos'
] as const

export type StorageCollection = (typeof COLLECTIONS)[number] | (string & {})

export interface StorageRecord {
  id: number
  unidadeId: number
  [key: string]: unknown
}

const DATA_DIR = '.data'

let transactionLock: Promise<unknown> = Promise.resolve()

function getFilePath(collection: StorageCollection): string {
  const safeName = String(collection).replace(/[^a-zA-Z0-9_-]/g, '')
  return `${DATA_DIR}/${safeName}.json`
}

async function readCollection<T extends StorageRecord>(collection: StorageCollection): Promise<T[]> {
  const filePath = getFilePath(collection)
  try {
    const content = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === 'ENOENT') {
      return []
    }
    throw err
  }
}

async function writeCollection<T extends StorageRecord>(collection: StorageCollection, items: T[]): Promise<void> {
  const filePath = getFilePath(collection)
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(filePath, JSON.stringify(items, null, 2), 'utf-8')
}

export async function list<T extends StorageRecord = StorageRecord>(
  unidadeId: number,
  collection: StorageCollection,
  predicate?: (item: T) => boolean
): Promise<T[]> {
  const items = await readCollection<T>(collection)
  return items.filter((item) => {
    const matchesTenant = item.unidadeId === undefined || item.unidadeId === unidadeId
    if (!matchesTenant) return false
    return predicate ? predicate(item) : true
  })
}

export async function get<T extends StorageRecord = StorageRecord>(
  unidadeId: number,
  collection: StorageCollection,
  id: number
): Promise<T | null> {
  const items = await readCollection<T>(collection)
  const found = items.find(
    item => item.id === id && (item.unidadeId === undefined || item.unidadeId === unidadeId)
  )
  return found ?? null
}

export async function insert<
  T extends StorageRecord = StorageRecord,
  TInput extends Record<string, unknown> = Omit<T, 'id' | 'unidadeId'>
>(
  unidadeId: number,
  collection: StorageCollection,
  data: TInput
): Promise<T> {
  const items = await readCollection<T>(collection)
  const nextId = items.reduce((max, item) => (item.id > max ? item.id : max), 0) + 1

  const inputData = { ...data } as Record<string, unknown>
  const saldoInicialRaw = inputData.saldoInicial ?? inputData.quantidadeAtual
  const quantidadeMinimaRaw = inputData.quantidadeMinima

  if (collection === 'catalogo') {
    delete inputData.saldoInicial
    delete inputData.quantidadeAtual
    delete inputData.quantidadeMinima
  }

  const record = {
    ...inputData,
    id: nextId,
    unidadeId
  } as unknown as T

  items.push(record)
  await writeCollection(collection, items)

  // Regra PRD: ItemEstoque é 1:1 com ItemCatalogo (só tipo='produto'), criado automaticamente ao cadastrar produto
  if (collection === 'catalogo' && inputData.tipo === 'produto') {
    const estoqueItems = await readCollection<StorageRecord>('estoque')
    const jaExiste = estoqueItems.some(
      item => item.unidadeId === unidadeId && Number(item.catalogoId) === nextId
    )

    if (!jaExiste) {
      const agora = typeof inputData.dataCriacao === 'string' ? inputData.dataCriacao : new Date().toISOString()
      const saldoInicial = saldoInicialRaw !== undefined && saldoInicialRaw !== null && String(saldoInicialRaw) !== ''
        ? Number(saldoInicialRaw)
        : 0
      const quantidadeMinima = quantidadeMinimaRaw !== undefined && quantidadeMinimaRaw !== null && String(quantidadeMinimaRaw) !== ''
        ? Number(quantidadeMinimaRaw)
        : undefined

      const nextEstoqueId = estoqueItems.reduce((max, item) => (item.id > max ? item.id : max), 0) + 1
      const novoEstoque: StorageRecord = {
        id: nextEstoqueId,
        unidadeId,
        catalogoId: nextId,
        quantidadeAtual: Number.isFinite(saldoInicial) ? saldoInicial : 0,
        ...(quantidadeMinima !== undefined && Number.isFinite(quantidadeMinima) ? { quantidadeMinima } : {}),
        dataCriacao: agora,
        dataAtualizacao: agora
      }
      estoqueItems.push(novoEstoque)
      await writeCollection('estoque', estoqueItems)

      if (Number.isFinite(saldoInicial) && saldoInicial !== 0) {
        const movimentos = await readCollection<StorageRecord>('movimentos')
        const nextMovId = movimentos.reduce((max, item) => (item.id > max ? item.id : max), 0) + 1
        movimentos.push({
          id: nextMovId,
          unidadeId,
          catalogoId: nextId,
          nome: String(inputData.nome || ''),
          tipo: saldoInicial > 0 ? 'entrada' : 'saida',
          quantidade: Math.abs(saldoInicial),
          origem: 'manual',
          saldoApos: saldoInicial,
          observacao: 'Saldo inicial',
          usuarioId: 1,
          data: agora
        })
        await writeCollection('movimentos', movimentos)
      }
    }
  }

  return record
}

export async function update<
  T extends StorageRecord = StorageRecord,
  TInput extends Record<string, unknown> = Partial<Omit<T, 'id' | 'unidadeId'>>
>(
  unidadeId: number,
  collection: StorageCollection,
  id: number,
  data: TInput
): Promise<T | null> {
  const items = await readCollection<T>(collection)
  const index = items.findIndex(
    item => item.id === id && (item.unidadeId === undefined || item.unidadeId === unidadeId)
  )

  if (index === -1) {
    return null
  }

  const current = items[index]!
  const updated = {
    ...current,
    ...data,
    id: current.id,
    unidadeId
  } as T

  items[index] = updated
  await writeCollection(collection, items)
  return updated
}

async function remove(
  unidadeId: number,
  collection: StorageCollection,
  id: number
): Promise<boolean> {
  const items = await readCollection<StorageRecord>(collection)
  const index = items.findIndex(
    item => item.id === id && (item.unidadeId === undefined || item.unidadeId === unidadeId)
  )

  if (index === -1) {
    return false
  }

  items.splice(index, 1)
  await writeCollection(collection, items)

  // Regra PRD: Excluir item do catálogo remove o ItemEstoque por cascade; Movimentos permanecem com catalogoId ausente
  if (collection === 'catalogo') {
    const estoqueItems = await readCollection<StorageRecord>('estoque')
    const filtrados = estoqueItems.filter(
      item => !(item.unidadeId === unidadeId && Number(item.catalogoId) === id)
    )
    if (filtrados.length !== estoqueItems.length) {
      await writeCollection('estoque', filtrados)
    }

    const movimentos = await readCollection<StorageRecord>('movimentos')
    let alterouMovimento = false
    const movimentosAtualizados = movimentos.map((mov) => {
      if (mov.unidadeId === unidadeId && Number(mov.catalogoId) === id) {
        alterouMovimento = true
        const copia = { ...mov }
        delete copia.catalogoId
        return copia
      }
      return mov
    })
    if (alterouMovimento) {
      await writeCollection('movimentos', movimentosAtualizados)
    }
  }

  return true
}

export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  const previous = transactionLock
  let release!: () => void
  transactionLock = new Promise<void>((resolve) => {
    release = resolve
  })

  await previous
  try {
    return await fn()
  } finally {
    release()
  }
}

export { remove }

export const db = {
  collections: COLLECTIONS,
  list,
  get,
  insert,
  update,
  delete: remove,
  remove,
  transaction
}
