import { randomBytes } from 'node:crypto'
import { db } from '../storage'
import {
  erro,
  exigirRole,
  gerarNota,
  gerarProximoNumeroOS,
  obterOSExigente,
  sincronizarSnapshotOS
} from './helpers'
import { montarOSDetalhe } from './index'
import { criarOsSchema, editarOsSchema, type CriarOSInput, type EditarOSInput } from './schemas'
import {
  ROLES_VALIDOS,
  type ClienteRecord,
  type OrdemServico,
  type OrdemServicoDetalhe,
  type VeiculoRecord
} from './types'

export async function criarOS(
  unidadeId: number,
  dadosInput: CriarOSInput
): Promise<OrdemServicoDetalhe> {
  const dados = criarOsSchema.parse(dadosInput)
  const role = exigirRole(dados.role, ['owner', 'admin', 'gerente', 'recepcionista'], 'criar OS')

  return await db.transaction(async () => {
    const cliente = await db.get<ClienteRecord>(unidadeId, 'clientes', dados.clienteId)
    if (!cliente || cliente.deletedAt) {
      erro(404, 'Cliente não encontrado')
    }

    const veiculo = await db.get<VeiculoRecord>(unidadeId, 'veiculos', dados.veiculoId)
    if (!veiculo || veiculo.deletedAt) {
      erro(404, 'Veículo não encontrado')
    }

    if (dados.tipo === 'garantia' && dados.osOriginalId !== undefined) {
      const original = await db.get<OrdemServico>(unidadeId, 'os', dados.osOriginalId)
      if (!original || original.deletedAt) {
        erro(404, 'OS original de garantia não encontrada')
      }
    }

    // Nunca reutilizar números (considera inclusive OS soft-deleted)
    const todasOS = await db.list<OrdemServico>(unidadeId, 'os')
    const numero = await gerarProximoNumeroOS(unidadeId, todasOS)
    const token = randomBytes(32).toString('hex')
    const agora = new Date().toISOString()
    const dataEntrada = dados.dataEntrada ? new Date(dados.dataEntrada).toISOString() : agora
    const previsaoEntrega = dados.previsaoEntrega ? new Date(dados.previsaoEntrega).toISOString() : undefined

    const novaOS = await db.insert<OrdemServico>(unidadeId, 'os', {
      numero,
      tipo: dados.tipo || 'normal',
      ...(dados.tipo === 'garantia' && dados.osOriginalId ? { osOriginalId: dados.osOriginalId } : {}),
      veiculoId: dados.veiculoId,
      clienteId: dados.clienteId,
      funcionarioId: dados.funcionarioId,
      status: 'aberta',
      queixa: dados.queixa,
      ...(dados.diagnostico ? { diagnostico: dados.diagnostico } : {}),
      ...(dados.avarias ? { avarias: dados.avarias } : {}),
      ...(dados.combustivel ? { combustivel: dados.combustivel } : {}),
      ...(dados.quilometragem !== undefined ? { quilometragem: dados.quilometragem } : {}),
      dataEntrada,
      ...(previsaoEntrega ? { previsaoEntrega } : {}),
      itens: [],
      orcamentoEnviado: false,
      token,
      notas: [],
      dataCriacao: agora,
      dataAtualizacao: agora
    })

    await gerarNota(unidadeId, {
      osId: novaOS.id,
      tipo: 'transicao',
      texto: 'OS criada',
      role,
      data: agora
    })

    const sincronizada = await sincronizarSnapshotOS(unidadeId, novaOS.id, { dataAtualizacao: agora })
    return await montarOSDetalhe(unidadeId, sincronizada)
  })
}

export async function editarOS(
  unidadeId: number,
  osId: number,
  dadosInput: EditarOSInput
): Promise<OrdemServicoDetalhe> {
  const dados = editarOsSchema.parse(dadosInput)
  const role = exigirRole(dados.role, ROLES_VALIDOS, 'editar OS')

  return await db.transaction(async () => {
    const os = await obterOSExigente(unidadeId, osId)

    if (os.status === 'cancelada' || os.status === 'entregue') {
      erro(400, `Não é possível editar uma OS com status "${os.status}"`)
    }

    if (role === 'mecanico') {
      const tentouOutroCampo
        = (dados.queixa !== undefined && dados.queixa !== os.queixa)
          || (dados.avarias !== undefined && dados.avarias !== os.avarias)
          || (dados.combustivel !== undefined && dados.combustivel !== os.combustivel)
          || (dados.quilometragem !== undefined && dados.quilometragem !== os.quilometragem)
          || (dados.previsaoEntrega !== undefined && dados.previsaoEntrega !== os.previsaoEntrega)
          || (dados.funcionarioId !== undefined && dados.funcionarioId !== os.funcionarioId)

      if (tentouOutroCampo) {
        erro(403, 'Mecânico pode editar apenas o diagnóstico da OS')
      }
    }

    const agora = new Date().toISOString()
    const camposAtualizados: Record<string, unknown> = {
      dataAtualizacao: agora
    }

    if (dados.queixa !== undefined) camposAtualizados.queixa = dados.queixa
    if (dados.diagnostico !== undefined) camposAtualizados.diagnostico = dados.diagnostico
    if (dados.avarias !== undefined) camposAtualizados.avarias = dados.avarias
    if (dados.combustivel !== undefined) camposAtualizados.combustivel = dados.combustivel
    if (dados.funcionarioId !== undefined) camposAtualizados.funcionarioId = dados.funcionarioId

    if (dados.quilometragem !== undefined) {
      camposAtualizados.quilometragem = dados.quilometragem === null ? undefined : dados.quilometragem
    }

    if (dados.previsaoEntrega !== undefined) {
      camposAtualizados.previsaoEntrega = dados.previsaoEntrega === null
        ? undefined
        : new Date(dados.previsaoEntrega).toISOString()
    }

    const atualizada = await sincronizarSnapshotOS(
      unidadeId,
      osId,
      camposAtualizados as Partial<OrdemServico>
    )

    return await montarOSDetalhe(unidadeId, atualizada)
  })
}

export async function excluirOS(
  unidadeId: number,
  osId: number,
  opts?: { role?: string }
): Promise<{ success: true }> {
  exigirRole(opts?.role, ['owner', 'admin', 'gerente'], 'excluir OS')

  return await db.transaction(async () => {
    const os = await obterOSExigente(unidadeId, osId)

    if (os.status !== 'aberta') {
      erro(400, 'Apenas OS com status "aberta" pode ser excluída. Use cancelar para OS em andamento.')
    }

    const agora = new Date().toISOString()
    await db.update<OrdemServico>(unidadeId, 'os', osId, {
      deletedAt: agora,
      dataAtualizacao: agora
    })

    return { success: true }
  })
}
