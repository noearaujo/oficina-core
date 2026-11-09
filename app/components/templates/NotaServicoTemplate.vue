<script setup lang="ts">
import type { Config, OSDocumento } from '~/types'

const props = defineProps<{
  os: OSDocumento
  config: Config
}>()

const { formatarData } = useOS()

const FORMA: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  credito: 'Cartão de Crédito',
  debito: 'Cartão de Débito',
  boleto: 'Boleto',
  transferencia: 'Transferência'
}

const itensAprovados = computed(() => props.os.itens.filter(i => i.status === 'aprovado'))
const veiculo = computed(() => [props.os.veiculoMarca, props.os.veiculoModelo].filter(Boolean).join(' '))
const formaPagamento = computed(() => {
  const formas = [...new Set(
    (props.os.faturamento?.lancamentos ?? [])
      .filter(l => l.tipo === 'entrada')
      .map(l => FORMA[l.modalidade] || l.modalidade)
  )]
  return formas.length ? formas.join(', ') : 'Não informado'
})
const dataEntrega = computed(() => formatarData(props.os.dataEntrega) || 'Não informado')
</script>

<template>
  <TemplatesDocumentoA4
    :config="config"
    :titulo="`NOTA DE SERVIÇO · OS-${os.numero}`"
    :data="os.dataCriacao || os.dataEntrada"
    :cliente-nome="os.clienteNome"
    :veiculo="veiculo"
    :placa="os.veiculoPlaca"
  >
    <TemplatesTabelaItens :itens="itensAprovados" :desconto="os.desconto" />

    <div class="mt-5 text-sm">
      <p><strong>Forma de pagamento:</strong> {{ formaPagamento }}</p>
      <p><strong>Data de entrega:</strong> {{ dataEntrega }}</p>
    </div>
  </TemplatesDocumentoA4>
</template>
