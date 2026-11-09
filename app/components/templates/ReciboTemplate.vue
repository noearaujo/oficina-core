<script setup lang="ts">
import type { Config, Venda } from '~/types'

const props = defineProps<{
  venda: Venda
  config: Config
}>()

const { formatarData } = useOS()

const FORMA: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  credito: 'Cartão de Crédito',
  debito: 'Cartão de Débito'
}

const formaPagamento = computed(() => FORMA[props.venda.formaPagamento] || props.venda.formaPagamento)
</script>

<template>
  <TemplatesDocumentoA4
    :config="config"
    :titulo="`RECIBO · ${venda.numero}`"
    :data="venda.dataCriacao"
    :cliente-nome="venda.clienteNome || 'Avulso'"
  >
    <TemplatesTabelaItens :itens="venda.itens" />

    <div class="mt-5 text-sm">
      <p><strong>Forma de pagamento:</strong> {{ formaPagamento }}</p>
      <p><strong>Data:</strong> {{ formatarData(venda.dataCriacao) }}</p>
    </div>
  </TemplatesDocumentoA4>
</template>
