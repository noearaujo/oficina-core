<script setup lang="ts">
import type { ItemOSView } from '~/composables/useOS'

const props = defineProps<{
  open: boolean
  loading: boolean
  item?: ItemOSView
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': [payload: { quantidade: number, precoUnitario?: number }]
}>()

const quantidade = ref('1')
const preco = ref('0,00')
const { parseCentavos, centavosParaInput } = useOS()

const podeEditarPreco = computed(() => props.item?.tipo === 'servico')

watch(() => props.open, (aberto) => {
  if (aberto && props.item) {
    quantidade.value = String(props.item.quantidade)
    preco.value = centavosParaInput(props.item.precoUnitario)
  }
})

const quantidadeNumero = computed(() => Number(quantidade.value.replace(',', '.')))
const valido = computed(() => quantidadeNumero.value > 0)

function confirmar() {
  if (!valido.value) return
  emit('confirm', {
    quantidade: quantidadeNumero.value,
    ...(podeEditarPreco.value ? { precoUnitario: parseCentavos(preco.value) } : {})
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
        <div v-if="item" class="text-sm text-muted">
          {{ item.tipo === 'servico' ? 'Serviço' : 'Produto' }} · {{ item.unidade || 'un' }}
        </div>
        <UFormField label="Quantidade" required>
          <UInput v-model="quantidade" inputmode="decimal">
            <template #trailing>
              <span class="text-xs text-muted">{{ item?.unidade || 'un' }}</span>
            </template>
          </UInput>
        </UFormField>
        <UFormField v-if="podeEditarPreco" label="Preço unitário" required>
          <UInput v-model="preco" inputmode="decimal">
            <template #leading>
              <span class="text-xs text-muted">R$</span>
            </template>
          </UInput>
        </UFormField>
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
