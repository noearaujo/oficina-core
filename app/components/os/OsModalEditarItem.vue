<script setup lang="ts">
import type { ItemOSView } from '~/composables/useOS'

const props = defineProps<{
  open: boolean
  loading: boolean
  item?: ItemOSView
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': [payload: { nome: string, quantidade: number, precoUnitario: number }]
}>()

const { parseCentavos, centavosParaInput } = useOS()
const nome = ref('')
const quantidade = ref('1')
const preco = ref('0,00')

watch(() => props.open, (aberto) => {
  if (aberto && props.item) {
    nome.value = props.item.nome
    quantidade.value = String(props.item.quantidade)
    preco.value = centavosParaInput(props.item.precoUnitario)
  }
})

const quantidadeNumero = computed(() => Number(quantidade.value.replace(',', '.')))
const valido = computed(() => nome.value.trim().length > 0 && quantidadeNumero.value > 0)

function confirmar() {
  if (!valido.value) return
  emit('confirm', {
    nome: nome.value.trim(),
    quantidade: quantidadeNumero.value,
    precoUnitario: parseCentavos(preco.value)
  })
}
</script>

<template>
  <UModal
    :open="open"
    title="Editar item"
    :description="item?.nome"
    @update:open="v => emit('update:open', v)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="Nome" required>
          <UInput v-model="nome" placeholder="Nome do item" />
        </UFormField>
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Quantidade" required>
            <UInput v-model="quantidade" inputmode="decimal" />
          </UFormField>
          <UFormField label="Preço unitário" required>
            <UInput v-model="preco" inputmode="decimal">
              <template #leading>
                <span class="text-xs text-muted">R$</span>
              </template>
            </UInput>
          </UFormField>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="outline"
          @click="emit('update:open', false)"
        />
        <UButton
          label="Salvar"
          icon="i-lucide-check"
          :loading="loading"
          :disabled="!valido"
          @click="confirmar"
        />
      </div>
    </template>
  </UModal>
</template>
