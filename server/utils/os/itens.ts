import type * as z from 'zod'
import { db } from '../storage'
import { baixarEstoqueItemOS } from '../estoque'
import type { ItemCatalogo } from '../catalogo'
import {
  calcularProximoLote,
  carregarItensDaOS,
  erro,
  estornarEstoqueComNota,
  exigirRole,
  gerarNota,
  obterOSExigente,
  sincronizarSnapshotOS,
  verificarAutoTransicaoAprovada
} from './helpers'
import { montarOSDetalhe } from './index'
import {
  adicionarItemOsSchema,
  adicionarItensOsSchema,
  editarItemOsSchema,
  recusarItemOsSchema,
  type AdicionarItemOSInput,
  type EditarItemOSInput,
  type RecusarItemOSInput
} from './schemas'
import {
  ROLES_VALIDOS,
  type ItemOS,
  type OrdemServico,
  type OrdemServicoDetalhe,
  type RoleUsuario
} from './types'

async function aprovarItemIndividual(
  unidadeId: number,
  os: OrdemServico,
  item: ItemOS,
  usuarioId: number,
  role: RoleUsuario,
  agora: string
): Promise<void> {
  let estoqueBaixado = Boolean(item.estoqueBaixado)

  if (item.tipo === 'produto' && !estoqueBaixado) {
    const resultadoBaixa = await baixarEstoqueItemOS(unidadeId, {
      osId: os.id,
      osNumero: os.numero,
      itemOsId: item.id,
      catalogoId: item.catalogoId,
      nome: item.nome,
      tipo: item.tipo,
      quantidade: Number(item.quantidade),
      estoqueBaixado: false,
      usuarioId,
      data: agora
    })

    estoqueBaixado = resultadoBaixa.aplicado

    if (resultadoBaixa.fallbackNota) {
      await gerarNota(unidadeId, {
        osId: os.id,
        tipo: 'estoque',
        texto: resultadoBaixa.fallbackNota,
        role,
        data: agora
      })
    }
  }

  await db.update<ItemOS>(unidadeId, 'itensOS', item.id, {
    status: 'aprovado',
    dataAprovacao: agora,
    estoqueBaixado
  })
}

function exigirStatusParaAdicionarItem(os: OrdemServico): void {
  if (os.status !== 'aberta' && os.status !== 'em_diagnostico' && os.status !== 'em_execucao') {
    erro(
      400,
      os.status === 'aguardando_aprovacao'
        ? 'Use "Ajustar" para voltar ao diagnóstico antes de adicionar itens ao orçamento principal'
        : `Não é possível adicionar itens quando a OS está com status "${os.status}"`
    )
  }
}

async function inserirOuSomarItemCatalogo(
  unidadeId: number,
  os: OrdemServico,
  itensAtuais: ItemOS[],
  itemInput: AdicionarItemOSInput
): Promise<string> {
  const catalogoItem = await db.get<ItemCatalogo>(unidadeId, 'catalogo', itemInput.catalogoId)
  if (!catalogoItem || catalogoItem.deletedAt) {
    erro(404, 'Item do catálogo não encontrado')
  }

  const nome = catalogoItem.nome
  const tipo = catalogoItem.tipo
  const unidade = catalogoItem.unidade
  const precoUnitario = tipo === 'servico' && itemInput.precoUnitario !== undefined
    ? Math.round(Number(itemInput.precoUnitario))
    : Math.round(Number(catalogoItem.preco))

  const quantidade = Number(itemInput.quantidade)
  const lote: number | null = os.status === 'em_execucao'
    ? calcularProximoLote(itensAtuais)
    : null

  // Mesmo item no mesmo lote e ainda pendente → soma a quantidade (não duplica linha)
  const itemMesmoLotePendente = itensAtuais.find(
    item =>
      item.status === 'pendente'
      && (item.lote ?? null) === lote
      && item.catalogoId !== undefined
      && Number(item.catalogoId) === Number(itemInput.catalogoId)
  )

  if (itemMesmoLotePendente) {
    const novaQuantidade = Number((Number(itemMesmoLotePendente.quantidade) + quantidade).toFixed(3))
    await db.update<ItemOS>(unidadeId, 'itensOS', itemMesmoLotePendente.id, {
      quantidade: novaQuantidade
    })
    itemMesmoLotePendente.quantidade = novaQuantidade
  } else {
    const inserido = await db.insert<ItemOS>(unidadeId, 'itensOS', {
      osId: os.id,
      catalogoId: itemInput.catalogoId,
      nome,
      tipo,
      unidade,
      quantidade,
      precoUnitario,
      status: 'pendente',
      lote,
      enviado: false,
      estoqueBaixado: false
    })
    itensAtuais.push(inserido)
  }

  return nome
}

export async function adicionarItem(
  unidadeId: number,
  osId: number,
  dadosInput: AdicionarItemOSInput
): Promise<OrdemServicoDetalhe> {
  const dados = adicionarItemOsSchema.parse(dadosInput)
  const role = exigirRole(dados.role, ROLES_VALIDOS, 'adicionar item')

  return await db.transaction(async () => {
    const os = await obterOSExigente(unidadeId, osId)
    exigirStatusParaAdicionarItem(os)

    const itensAtuais = await carregarItensDaOS(unidadeId, os)
    const agora = new Date().toISOString()
    const nome = await inserirOuSomarItemCatalogo(unidadeId, os, itensAtuais, dados)

    // Adicionar complemento em em_execucao gera Nota; em em_diagnostico NÃO gera nota (§4.9)
    if (os.status === 'em_execucao') {
      await gerarNota(unidadeId, {
        osId: os.id,
        tipo: 'item_add',
        texto: `Complemento adicionado: ${nome}`,
        role,
        data: agora
      })
    }

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, { dataAtualizacao: agora })
    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function adicionarItens(
  unidadeId: number,
  osId: number,
  dadosInput: z.input<typeof adicionarItensOsSchema>
): Promise<OrdemServicoDetalhe> {
  const dados = adicionarItensOsSchema.parse(dadosInput)
  const role = exigirRole(dados.role, ROLES_VALIDOS, 'adicionar item')

  return await db.transaction(async () => {
    const os = await obterOSExigente(unidadeId, osId)
    exigirStatusParaAdicionarItem(os)

    const itensAtuais = await carregarItensDaOS(unidadeId, os)
    const agora = new Date().toISOString()
    const nomes: string[] = []

    for (const itemInput of dados.itens) {
      const nome = await inserirOuSomarItemCatalogo(unidadeId, os, itensAtuais, itemInput)
      if (!nomes.includes(nome)) {
        nomes.push(nome)
      }
    }

    // Adicionar complemento em em_execucao gera Nota; em em_diagnostico NÃO gera nota (§4.9)
    if (os.status === 'em_execucao') {
      await gerarNota(unidadeId, {
        osId: os.id,
        tipo: 'item_add',
        texto: `Complementos adicionados: ${nomes.join(', ')}`,
        role,
        data: agora
      })
    }

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, { dataAtualizacao: agora })
    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function editarItem(
  unidadeId: number,
  osId: number,
  itemId: number,
  dadosInput: EditarItemOSInput
): Promise<OrdemServicoDetalhe> {
  const dados = editarItemOsSchema.parse(dadosInput)
  const role = exigirRole(dados.role, ROLES_VALIDOS, 'editar item')

  return await db.transaction(async () => {
    const os = await obterOSExigente(unidadeId, osId)

    if (['concluida', 'entregue', 'cancelada'].includes(os.status)) {
      erro(400, `Não é possível editar itens de uma OS com status "${os.status}"`)
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    const item = itens.find(i => i.id === itemId)
    if (!item) {
      erro(404, 'Item da OS não encontrado')
    }

    if (item.status !== 'pendente') {
      erro(400, `Item com status "${item.status}" é terminal e não pode ser editado individualmente`)
    }

    if (item.enviado && os.status === 'aguardando_aprovacao') {
      erro(400, 'Item já enviado não pode ser editado em aguardando aprovação. Use "Ajustar" para reabrir o diagnóstico.')
    }

    if (os.status !== 'em_diagnostico' && item.enviado && os.status !== 'em_execucao') {
      erro(400, 'Este item não pode ser editado no status atual da OS')
    }

    if (dados.precoUnitario !== undefined && item.tipo !== 'servico') {
      erro(400, 'Preço de produto não pode ser editado na OS')
    }

    const novaQuantidade = dados.quantidade !== undefined ? Number(dados.quantidade) : Number(item.quantidade)

    await db.update<ItemOS>(unidadeId, 'itensOS', item.id, {
      quantidade: novaQuantidade,
      ...(dados.precoUnitario !== undefined ? { precoUnitario: Math.round(Number(dados.precoUnitario)) } : {})
    })

    const agora = new Date().toISOString()

    // Editar item em em_diagnostico NÃO gera nota (§4.9)
    if (os.status !== 'em_diagnostico') {
      await gerarNota(unidadeId, {
        osId: os.id,
        tipo: 'item_edit',
        texto: `Item editado: ${item.nome}`,
        role,
        data: agora
      })
    }

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, { dataAtualizacao: agora })
    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function removerItem(
  unidadeId: number,
  osId: number,
  itemId: number,
  opts?: { role?: string, usuarioId?: number }
): Promise<OrdemServicoDetalhe> {
  const role = exigirRole(opts?.role, ROLES_VALIDOS, 'remover item')
  const usuarioId = opts?.usuarioId || 1

  return await db.transaction(async () => {
    const os = await obterOSExigente(unidadeId, osId)

    if (['concluida', 'entregue', 'cancelada'].includes(os.status)) {
      erro(400, `Não é possível remover itens de uma OS com status "${os.status}"`)
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    const item = itens.find(i => i.id === itemId)
    if (!item) {
      erro(404, 'Item da OS não encontrado')
    }

    if (item.status === 'pendente' && item.enviado && os.status === 'aguardando_aprovacao') {
      erro(400, 'Item enviado em aguardando aprovação exige "Ajustar" antes de ser removido.')
    }

    const agora = new Date().toISOString()

    if (item.estoqueBaixado) {
      await estornarEstoqueComNota(unidadeId, os, item, usuarioId, role, agora)
    }

    await db.delete(unidadeId, 'itensOS', item.id)

    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'item_remove',
      texto: `Item removido: ${item.nome}`,
      role,
      data: agora
    })

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, { dataAtualizacao: agora })
    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function aprovarItem(
  unidadeId: number,
  osId: number,
  itemId: number,
  opts?: { role?: string, usuarioId?: number }
): Promise<OrdemServicoDetalhe> {
  const role = exigirRole(opts?.role, ['owner', 'admin', 'gerente', 'recepcionista'], 'aprovar item')
  const usuarioId = opts?.usuarioId || 1

  return await db.transaction(async () => {
    const os = await obterOSExigente(unidadeId, osId)

    if (os.status !== 'aguardando_aprovacao' && os.status !== 'em_execucao') {
      erro(400, `Não é possível aprovar itens quando a OS está com status "${os.status}"`)
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    const item = itens.find(i => i.id === itemId)
    if (!item) {
      erro(404, 'Item da OS não encontrado')
    }

    if (item.status !== 'pendente') {
      erro(400, `Item já está "${item.status}" (estado terminal)`)
    }

    const agora = new Date().toISOString()
    await aprovarItemIndividual(unidadeId, os, item, usuarioId, role, agora)

    const itensAtualizados = await carregarItensDaOS(unidadeId, os)
    const camposAuto = await verificarAutoTransicaoAprovada(unidadeId, os, itensAtualizados, role, agora)

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      ...camposAuto,
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function recusarItem(
  unidadeId: number,
  osId: number,
  itemId: number,
  dadosInput: RecusarItemOSInput
): Promise<OrdemServicoDetalhe> {
  const dados = recusarItemOsSchema.parse(dadosInput)
  const role = exigirRole(dados.role, ['owner', 'admin', 'gerente', 'recepcionista'], 'recusar item')

  return await db.transaction(async () => {
    const os = await obterOSExigente(unidadeId, osId)

    if (os.status !== 'aguardando_aprovacao' && os.status !== 'em_execucao') {
      erro(400, `Não é possível recusar itens quando a OS está com status "${os.status}"`)
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    const item = itens.find(i => i.id === itemId)
    if (!item) {
      erro(404, 'Item da OS não encontrado')
    }

    if (item.status !== 'pendente') {
      erro(400, `Item já está "${item.status}" (estado terminal)`)
    }

    const agora = new Date().toISOString()

    await db.update<ItemOS>(unidadeId, 'itensOS', item.id, {
      status: 'recusado',
      dataRecusa: agora,
      motivoRecusa: dados.motivo
    })

    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'item_reject',
      texto: `${item.nome} recusado — ${dados.motivo}`,
      role,
      data: agora
    })

    const itensAtualizados = await carregarItensDaOS(unidadeId, os)
    const camposAuto = await verificarAutoTransicaoAprovada(unidadeId, os, itensAtualizados, role, agora)

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      ...camposAuto,
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function aprovarTodos(
  unidadeId: number,
  osId: number,
  opts?: { role?: string, usuarioId?: number }
): Promise<OrdemServicoDetalhe> {
  const role = exigirRole(opts?.role, ['owner', 'admin', 'gerente', 'recepcionista'], 'aprovar todos os itens')
  const usuarioId = opts?.usuarioId || 1

  return await db.transaction(async () => {
    const os = await obterOSExigente(unidadeId, osId)

    if (os.status !== 'aguardando_aprovacao') {
      erro(400, 'A ação "Aprovar todos" só está disponível quando a OS está aguardando aprovação')
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    const pendentesPrincipal = itens.filter(i => (i.lote ?? null) === null && i.status === 'pendente')

    if (pendentesPrincipal.length === 0) {
      erro(400, 'Não há itens pendentes no orçamento principal para aprovar')
    }

    const agora = new Date().toISOString()

    for (const item of pendentesPrincipal) {
      await aprovarItemIndividual(unidadeId, os, item, usuarioId, role, agora)
    }

    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'item_approve',
      texto: 'Orçamento aprovado',
      role,
      data: agora
    })

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      status: 'aprovada',
      dataAprovacao: agora,
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}
