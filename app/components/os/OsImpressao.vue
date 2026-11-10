<script setup lang="ts">
import type { Config } from '~/types'
import type { OSView } from '~/composables/useOS'
import type { DocumentoImpressao } from '~/utils/os-constants'

const props = defineProps<{
  os: OSView
  config: Config
  documentos: DocumentoImpressao[]
}>()

const emit = defineEmits<{
  selecionarDocumento: [key: string]
}>()

const modalImprimir = ref(false)
const previewAberto = ref(false)
const documentoAtual = ref('principal')

const documentoSelecionado = computed(() =>
  props.documentos.find(d => d.key === documentoAtual.value)
)

function abrirPreview(key: string) {
  documentoAtual.value = key
  modalImprimir.value = false
  previewAberto.value = true
  emit('selecionarDocumento', key)
}

function imprimir() {
  if (props.documentos.length === 1) abrirPreview(props.documentos[0]!.key)
  else modalImprimir.value = true
}

defineExpose({ imprimir, abrirPreview })
</script>

<template>
  <UModal
    v-model:open="modalImprimir"
    title="Imprimir"
    description="Escolha o documento para visualizar."
  >
    <template #body>
      <div class="flex flex-col gap-2">
        <UButton
          v-for="doc in documentos"
          :key="doc.key"
          :label="doc.label"
          icon="i-lucide-file-text"
          color="neutral"
          variant="outline"
          block
          class="justify-start"
          @click="abrirPreview(doc.key)"
        />
      </div>
    </template>
  </UModal>
  <PrintPreview
    :title="documentoSelecionado?.titulo || 'Documento'"
    :is-open="previewAberto"
    @close="previewAberto = false"
  >
    <TemplatesNotaServicoTemplate v-if="documentoAtual === 'nota'" :os="os" :config="config" />
    <TemplatesOrcamentoComplementarTemplate
      v-else-if="documentoAtual.startsWith('lote-')"
      :os="os"
      :config="config"
      :lote="Number(documentoAtual.slice(5))"
    />
    <TemplatesOrcamentoTemplate v-else :os="os" :config="config" />
  </PrintPreview>
</template>
