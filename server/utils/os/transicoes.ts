import { db } from '../storage'
import { calcularFaturamento } from './faturamento'
import {
  carregarItensDaOS,
  erro,
  estornarEstoqueComNota,
  exigirRole,
  gerarNota,
  obterOSExigente,
  sincronizarSnapshotOS
} from './helpers'
import { montarOSDetalhe } from './index'
import {
  ajustarOsSchema,
  descontoOsSchema,
  enviarOrcamentoSchema,
  transicionarOsSchema,
  type AjustarOSInput,
  type DescontoOSInput,
  type EnviarOrcamentoInput,
  type TransicionarOSInput
} from './schemas'
import type { EnvioOrcamento, ItemOS, OrdemServicoDetalhe } from './types'

export async function ajustar(
  unidadeId: number,
  osId: number,
  dadosInput: AjustarOSInput
): Promise<OrdemServicoDetalhe> {
  const dados = ajustarOsSchema.parse(dadosInput)
  const role = exigirRole(dados.role, ['owner', 'admin', 'gerente', 'recepcionista'], 'ajustar orçamento')

  return await db.transaction(async () => {
    const os = await obterOSExigente(unidadeId, osId)

    if (os.status !== 'aguardando_aprovacao') {
      erro(400, 'A ação "Ajustar" só é permitida quando a OS está aguardando aprovação')
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    for (const item of itens) {
      if ((item.lote ?? null) === null && item.status === 'pendente' && item.enviado) {
        await db.update<ItemOS>(unidadeId, 'itensOS', item.id, {
          enviado: false
        })
      }
    }

    const agora = new Date().toISOString()

    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'ajuste',
      texto: `Orçamento ajustado — ${dados.motivo}`,
      role,
      data: agora
    })

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      status: 'em_diagnostico',
      orcamentoEnviado: false,
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function reverterAprovacao(
  unidadeId: number,
  osId: number,
  opts?: { motivo?: string, role?: string, usuarioId?: number }
): Promise<OrdemServicoDetalhe> {
  const role = exigirRole(opts?.role, ['owner', 'admin'], 'reverter aprovação')
  const motivo = (opts?.motivo || '').trim()
  if (!motivo) {
    erro(400, 'Informe o motivo para reverter a aprovação')
  }
  const usuarioId = opts?.usuarioId || 1

  return await db.transaction(async () => {
    const os = await obterOSExigente(unidadeId, osId)

    if (os.status !== 'aprovada') {
      erro(400, 'A reversão de aprovação só é permitida quando a OS está com status "aprovada"')
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    const faturamento = await calcularFaturamento(unidadeId, {
      id: os.id,
      itens,
      desconto: os.desconto
    })

    if (faturamento.pago > 0) {
      erro(400, 'Não é possível reverter aprovação de OS com pagamento líquido maior que zero. Devolva ou estorne o pagamento antes.')
    }

    const agora = new Date().toISOString()

    for (const item of itens) {
      if ((item.lote ?? null) !== null) continue

      if (item.status === 'aprovado' && item.estoqueBaixado) {
        await estornarEstoqueComNota(unidadeId, os, item, usuarioId, role, agora)
      }

      await db.update<ItemOS>(unidadeId, 'itensOS', item.id, {
        status: 'pendente',
        enviado: false,
        estoqueBaixado: false,
        dataAprovacao: undefined,
        dataRecusa: undefined,
        motivoRecusa: undefined
      })
    }

    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'reversao',
      texto: `Reversão de aprovação — ${motivo}`,
      role,
      data: agora
    })

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      status: 'em_diagnostico',
      orcamentoEnviado: false,
      dataAprovacao: undefined,
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function cancelar(
  unidadeId: number,
  osId: number,
  opts?: { motivo?: string, role?: string, usuarioId?: number }
): Promise<OrdemServicoDetalhe> {
  const role = exigirRole(opts?.role, ['owner', 'admin', 'gerente'], 'cancelar OS')
  const motivo = (opts?.motivo || '').trim()
  const usuarioId = opts?.usuarioId || 1

  return await db.transaction(async () => {
    const os = await obterOSExigente(unidadeId, osId)

    if (['concluida', 'entregue', 'cancelada'].includes(os.status)) {
      erro(400, `Não é possível cancelar uma OS com status "${os.status}"`)
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    const faturamento = await calcularFaturamento(unidadeId, {
      id: os.id,
      itens,
      desconto: os.desconto
    })

    if (faturamento.pago > 0) {
      erro(400, 'Não é possível cancelar OS com pagamento líquido maior que zero. Devolva ou estorne o pagamento antes.')
    }

    const agora = new Date().toISOString()

    for (const item of itens) {
      if (item.estoqueBaixado) {
        await estornarEstoqueComNota(unidadeId, os, item, usuarioId, role, agora)

        await db.update<ItemOS>(unidadeId, 'itensOS', item.id, {
          estoqueBaixado: false
        })
      }
    }

    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'cancelar',
      texto: motivo ? `OS cancelada — ${motivo}` : 'OS cancelada',
      role,
      data: agora
    })

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      status: 'cancelada',
      ...(motivo ? { motivoCancelamento: motivo } : {}),
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function entregar(
  unidadeId: number,
  osId: number,
  opts?: { role?: string }
): Promise<OrdemServicoDetalhe> {
  const role = exigirRole(opts?.role, ['owner', 'admin', 'gerente', 'recepcionista'], 'entregar veículo')

  return await db.transaction(async () => {
    const os = await obterOSExigente(unidadeId, osId)

    if (os.status !== 'concluida') {
      erro(400, 'Apenas OS com status "concluida" pode ser entregue')
    }

    const agora = new Date().toISOString()

    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'transicao',
      texto: 'Veículo entregue',
      role,
      data: agora
    })

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      status: 'entregue',
      dataEntrega: agora,
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function transicionar(
  unidadeId: number,
  osId: number,
  dadosInput: TransicionarOSInput
): Promise<OrdemServicoDetalhe> {
  const dados = transicionarOsSchema.parse(dadosInput)

  if (dados.acao === 'entregar') {
    return await entregar(unidadeId, osId, { role: dados.role })
  }

  if (dados.acao === 'cancelar') {
    return await cancelar(unidadeId, osId, {
      motivo: dados.motivo,
      role: dados.role,
      usuarioId: dados.usuarioId
    })
  }

  if (dados.acao === 'reverter_aprovacao') {
    return await reverterAprovacao(unidadeId, osId, {
      motivo: dados.motivo,
      role: dados.role,
      usuarioId: dados.usuarioId
    })
  }

  const role = exigirRole(
    dados.role,
    ['owner', 'admin', 'gerente', 'mecanico'],
    dados.acao
  )

  return await db.transaction(async () => {
    const os = await obterOSExigente(unidadeId, osId)
    const agora = new Date().toISOString()

    if (dados.acao === 'iniciar_diagnostico') {
      if (os.status !== 'aberta') {
        erro(400, `Transição inválida: não é possível iniciar diagnóstico a partir de "${os.status}"`)
      }

      await gerarNota(unidadeId, {
        osId: os.id,
        tipo: 'transicao',
        texto: 'Iniciando diagnóstico',
        role,
        data: agora
      })

      const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
        status: 'em_diagnostico',
        dataAtualizacao: agora
      })

      return await montarOSDetalhe(unidadeId, atualizada)
    }

    if (dados.acao === 'iniciar_execucao') {
      if (os.status !== 'aprovada') {
        erro(400, `Transição inválida: não é possível iniciar execução a partir de "${os.status}"`)
      }

      await gerarNota(unidadeId, {
        osId: os.id,
        tipo: 'transicao',
        texto: 'Início da execução',
        role,
        data: agora
      })

      const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
        status: 'em_execucao',
        dataAtualizacao: agora
      })

      return await montarOSDetalhe(unidadeId, atualizada)
    }

    if (dados.acao === 'concluir') {
      if (os.status !== 'em_execucao') {
        erro(400, `Transição inválida: não é possível concluir a OS a partir de "${os.status}"`)
      }

      const itens = await carregarItensDaOS(unidadeId, os)
      const temPendente = itens.some(i => i.status === 'pendente')
      if (temPendente) {
        erro(400, 'Não é possível concluir a OS com itens pendentes. Aprove ou recuse todos os itens antes de concluir.')
      }

      const temAprovado = itens.some(i => i.status === 'aprovado')
      if (!temAprovado) {
        erro(400, 'Não é possível concluir uma OS sem ao menos um item aprovado.')
      }

      await gerarNota(unidadeId, {
        osId: os.id,
        tipo: 'transicao',
        texto: 'OS concluída',
        role,
        data: agora
      })

      const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
        status: 'concluida',
        dataConclusao: agora,
        dataAtualizacao: agora
      })

      return await montarOSDetalhe(unidadeId, atualizada)
    }

    erro(400, 'Ação de transição inválida')
  })
}

export async function aplicarDesconto(
  unidadeId: number,
  osId: number,
  dadosInput: DescontoOSInput
): Promise<OrdemServicoDetalhe> {
  const dados = descontoOsSchema.parse(dadosInput)
  exigirRole(dados.role, ['owner', 'admin', 'gerente'], 'aplicar desconto')

  return await db.transaction(async () => {
    const os = await obterOSExigente(unidadeId, osId)

    if (os.status !== 'em_diagnostico' && os.status !== 'aguardando_aprovacao') {
      erro(400, 'O desconto só pode ser aplicado em diagnóstico ou aguardando aprovação')
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    const somaNaoRecusados = itens
      .filter(i => i.status !== 'recusado')
      .reduce((s, i) => s + Math.round(Number(i.quantidade || 0) * Math.round(Number(i.precoUnitario || 0))), 0)

    const desconto = Math.round(Number(dados.desconto))

    if (desconto < 0 || desconto > somaNaoRecusados) {
      erro(400, 'O desconto deve estar entre R$ 0,00 e a soma dos itens não recusados')
    }

    const agora = new Date().toISOString()
    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      desconto,
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function enviarOrcamento(
  unidadeId: number,
  osId: number,
  dadosInput: EnviarOrcamentoInput
): Promise<OrdemServicoDetalhe> {
  const dados = enviarOrcamentoSchema.parse(dadosInput)
  const role = exigirRole(dados.role, ['owner', 'admin', 'gerente', 'recepcionista'], 'enviar orçamento')
  const usuarioId = dados.usuarioId || 1

  return await db.transaction(async () => {
    const os = await obterOSExigente(unidadeId, osId)

    if (!['em_diagnostico', 'aguardando_aprovacao', 'em_execucao'].includes(os.status)) {
      erro(400, `Não é possível enviar orçamento quando a OS está com status "${os.status}"`)
    }

    const itens = await carregarItensDaOS(unidadeId, os)
    if (itens.length === 0) {
      erro(400, 'Adicione ao menos um item ao orçamento antes de enviar')
    }

    if (os.status === 'em_diagnostico' || os.status === 'aguardando_aprovacao') {
      if (!os.diagnostico || !os.diagnostico.trim()) {
        erro(400, 'Preencha o diagnóstico antes de enviar o orçamento')
      }
    }

    let itensAlvo: ItemOS[]
    if (dados.itensIds && dados.itensIds.length > 0) {
      const idsSet = new Set(dados.itensIds.map(id => Number(id)))
      itensAlvo = itens.filter(i => idsSet.has(i.id))
      if (itensAlvo.length === 0) {
        erro(400, 'Nenhum item válido da OS foi selecionado para o envio')
      }
    } else if (os.status === 'em_execucao') {
      const complementos = itens.filter(i => (i.lote ?? null) !== null)
      const naoEnviados = complementos.filter(i => !i.enviado)
      itensAlvo = naoEnviados.length > 0 ? naoEnviados : complementos
      if (itensAlvo.length === 0) {
        erro(400, 'Não há itens complementares para enviar')
      }
    } else {
      itensAlvo = itens.filter(i => (i.lote ?? null) === null)
    }

    const agora = new Date().toISOString()
    const itensIds = itensAlvo.map(i => i.id)

    if (dados.falhou || dados.erro) {
      await db.insert<EnvioOrcamento>(unidadeId, 'enviosOrcamento', {
        osId: os.id,
        canal: dados.canal,
        status: 'falhou',
        itensIds,
        solicitadoEm: agora,
        ...(dados.referencia ? { referencia: dados.referencia } : {}),
        erro: dados.erro || 'Falha ao gerar orçamento',
        usuarioId
      })

      return await montarOSDetalhe(unidadeId, os)
    }

    const statusEnvio: EnvioOrcamento['status']
      = dados.canal === 'impressao' || dados.canal === 'imagem'
        ? 'gerado'
        : 'enviado'

    await db.insert<EnvioOrcamento>(unidadeId, 'enviosOrcamento', {
      osId: os.id,
      canal: dados.canal,
      status: statusEnvio,
      itensIds,
      solicitadoEm: agora,
      concluidoEm: agora,
      ...(dados.referencia ? { referencia: dados.referencia } : {}),
      usuarioId
    })

    for (const item of itensAlvo) {
      if (!item.enviado) {
        await db.update<ItemOS>(unidadeId, 'itensOS', item.id, {
          enviado: true
        })
      }
    }

    if (os.status === 'em_execucao') {
      const loteRef = itensAlvo.find(i => i.lote !== null)?.lote ?? 1
      await gerarNota(unidadeId, {
        osId: os.id,
        tipo: 'envio',
        texto: `Orçamento complementar enviado [lote ${loteRef}]`,
        role,
        data: agora
      })

      const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
        dataAtualizacao: agora
      })

      return await montarOSDetalhe(unidadeId, atualizada)
    }

    await gerarNota(unidadeId, {
      osId: os.id,
      tipo: 'envio',
      texto: `Orçamento enviado (${dados.canal})`,
      role,
      data: agora
    })

    const atualizada = await sincronizarSnapshotOS(unidadeId, os.id, {
      status: 'aguardando_aprovacao',
      orcamentoEnviado: true,
      dataAtualizacao: agora
    })

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}
