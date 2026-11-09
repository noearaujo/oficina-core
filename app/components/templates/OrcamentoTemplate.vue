<script setup lang="ts">
import type { Config, OSDocumento } from '~/types'

const props = defineProps<{
  os: OSDocumento
  config: Config
}>()

const itensPrincipal = computed(() => props.os.itens.filter(i => i.lote === null || i.lote === undefined))
const recusados = computed(() => itensPrincipal.value.filter(i => i.status === 'recusado'))
const veiculo = computed(() => [props.os.veiculoMarca, props.os.veiculoModelo].filter(Boolean).join(' '))
const referencia = computed(() =>
  props.os.tipo === 'garantia' && props.os.osOriginalId ? `Referência: garantia da OS #${props.os.osOriginalId}` : ''
)
</script>

<template>
  <TemplatesDocumentoA4
    :config="config"
    :titulo="`ORÇAMENTO · OS-${os.numero}`"
    :data="os.dataCriacao || os.dataEntrada"
    mostrar-validade
    :cliente-nome="os.clienteNome"
    :veiculo="veiculo"
    :placa="os.veiculoPlaca"
    :referencia="referencia"
    :itens-recusados="recusados"
  >
    <TemplatesTabelaItens :itens="itensPrincipal" :desconto="os.desconto" />
  </TemplatesDocumentoA4>
</template>
