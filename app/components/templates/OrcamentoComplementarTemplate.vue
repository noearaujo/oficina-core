<script setup lang="ts">
import type { Config, OSDocumento } from '~/types'

const props = defineProps<{
  os: OSDocumento
  config: Config
  lote: number
}>()

const { formatarData } = useOS()

const itensPrincipal = computed(() => props.os.itens.filter(i => i.lote === null || i.lote === undefined))
const itensLote = computed(() => props.os.itens.filter(i => i.lote === props.lote))
const recusados = computed(() => itensLote.value.filter(i => i.status === 'recusado'))
const veiculo = computed(() => [props.os.veiculoMarca, props.os.veiculoModelo].filter(Boolean).join(' '))

const dataAprovacao = computed(() => {
  if (props.os.dataAprovacao) return props.os.dataAprovacao
  const datas = itensPrincipal.value.map(i => i.dataAprovacao).filter(Boolean) as string[]
  return datas.sort()[0]
})
const referencia = computed(() => {
  const data = formatarData(dataAprovacao.value)
  return data ? `Referência: orçamento principal aprovado em ${data}` : 'Referência: orçamento principal'
})
</script>

<template>
  <TemplatesDocumentoA4
    :config="config"
    :titulo="`ORÇAMENTO COMPLEMENTAR · OS-${os.numero}`"
    :data="os.dataCriacao || os.dataEntrada"
    mostrar-validade
    :cliente-nome="os.clienteNome"
    :veiculo="veiculo"
    :placa="os.veiculoPlaca"
    :referencia="referencia"
    :itens-recusados="recusados"
  >
    <section v-if="itensPrincipal.length" class="mb-6">
      <h2 class="mb-1 text-sm font-bold">
        ITENS JÁ APROVADOS (referência)
      </h2>
      <TemplatesTabelaItens :itens="itensPrincipal" sem-totais />
    </section>

    <h2 class="mb-1 text-sm font-bold">
      ITENS DO COMPLEMENTO [lote {{ lote }}]
    </h2>
    <TemplatesTabelaItens :itens="itensLote" />
  </TemplatesDocumentoA4>
</template>
