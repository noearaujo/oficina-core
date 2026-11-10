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

export async function adicionarItem(
  unidadeId: number,
  osId: number,
  dadosInput: AdicionarItemOSInput
): Promise<OrdemServicoDetalhe> {
  const dados = adicionarItemOsSchema.parse(dadosInput)
  const role = exigirRole(dados.role, ROLES_VALIDOS, 'adicionar item')

  return await db.transaction(async () => {
    const os = await obterOSExigente(unidadeId, osId)

    if (os.status !== 'em_diagnostico' && os.status !== 'em_execucao') {
      erro(
        400,
        os.status === 'aguardando_aprovacao'
          ? 'Use "Ajustar" para voltar ao diagnóstico antes de adicionar itens ao orçamento principal'
          : `Não é possível adicionar itens quando a OS está com status "${os.status}"`
      )
    }

    let catalogoItem: ItemCatalogo | null = null
    if (dados.catalogoId !== undefined) {
      catalogoItem = await db.get<ItemCatalogo>(unidadeId, 'catalogo', dados.catalogoId)
    }

    const nome = (dados.nome?.trim() || catalogoItem?.nome || '').trim()
    if (!nome) {
      erro(400, 'Informe o nome do item ou selecione um item válido do catálogo')
    }

    const tipo: 'servico' | 'produto' = catalogoItem?.tipo ?? dados.tipo ?? 'servico'
    const unidade = (dados.unidade?.trim() || catalogoItem?.unidade || 'un').trim()
    const precoUnitario = dados.precoUnitario !== undefined
      ? Math.round(Number(dados.precoUnitario))
      : catalogoItem
        ? Math.round(Number(catalogoItem.preco))
        : undefined

    if (precoUnitario === undefined || !Number.isFinite(precoUnitario) || precoUnitario < 0) {
      erro(400, 'Informe um preço unitário válido em centavos')
    }

    const quantidade = Number(dados.quantidade)
    const itensAtuais = await carregarItensDaOS(unidadeId, os)
    const lote: number | null = os.status === 'em_execucao'
      ? calcularProximoLote(itensAtuais)
      : null

    const agora = new Date().toISOString()

    // Mesmo item no mesmo lote e ainda pendente → soma a quantidade (não duplica linha)
    const itemMesmoLotePendente = itensAtuais.find((item) => {
      if (item.status !== 'pendente') return false
      if ((item.lote ?? null) !== lote) return false

      if (dados.catalogoId !== undefined) {
        return item.catalogoId !== undefined && Number(item.catalogoId) === Number(dados.catalogoId)
      }

      return (
        !item.catalogoId
        && item.nome.trim().toLowerCase() === nome.toLowerCase()
        && Math.round(Number(item.precoUnitario)) === precoUnitario
      )
    })

    if (itemMesmoLotePendente) {
      const novaQuantidade = Number((Number(itemMesmoLotePendente.quantidade) + quantidade).toFixed(3))
      await db.update<ItemOS>(unidadeId, 'itensOS', itemMesmoLotePendente.id, {
        quantidade: novaQuantidade
      })
    } else {
      await db.insert<ItemOS>(unidadeId, 'itensOS', {
        osId: os.id,
        ...(dados.catalogoId !== undefined ? { catalogoId: dados.catalogoId } : {}),
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
    }

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

    const novoNome = dados.nome !== undefined ? dados.nome.trim() : item.nome
    const novaUnidade = dados.unidade !== undefined ? dados.unidade.trim() : item.unidade
    const novaQuantidade = dados.quantidade !== undefined ? Number(dados.quantidade) : Number(item.quantidade)
    const novoPreco = dados.precoUnitario !== undefined
      ? Math.round(Number(dados.precoUnitario))
      : Math.round(Number(item.precoUnitario))

    await db.update<ItemOS>(unidadeId, 'itensOS', item.id, {
      nome: novoNome,
      ...(novaUnidade ? { unidade: novaUnidade } : {}),
      quantidade: novaQuantidade,
      precoUnitario: novoPreco
    })

    const agora = new Date().toISOString()

    // Editar item em em_diagnostico NÃO gera nota (§4.9)
    if (os.status !== 'em_diagnostico') {
      await gerarNota(unidadeId, {
        osId: os.id,
        tipo: 'item_edit',
        texto: `Item editado: ${novoNome}`,
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
