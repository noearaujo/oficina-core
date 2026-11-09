<script setup lang="ts">
const props = defineProps<{
  title: string
  description?: string
  label?: string
  confirmLabel: string
  color?: 'primary' | 'error' | 'neutral'
  confirmacao?: string
  loading?: boolean
}>()

const emit = defineEmits<{ confirm: [motivo: string] }>()
const open = defineModel<boolean>('open', { default: false })

const motivo = ref('')
const confirmado = ref(false)
const tocado = ref(false)

watch(open, (aberto) => {
  if (aberto) {
    motivo.value = ''
    confirmado.value = false
    tocado.value = false
  }
})

const erro = computed(() => tocado.value && !motivo.value.trim() ? 'Informe o motivo' : undefined)

function confirmar() {
  tocado.value = true
  if (!motivo.value.trim()) return
  if (props.confirmacao && !confirmado.value) return
  emit('confirm', motivo.value.trim())
}
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="description">
    <template #body>
      <div class="space-y-4">
        <UFormField :label="label || 'Motivo'" :error="erro" required>
          <UTextarea v-model="motivo" :rows="3" placeholder="Descreva o motivo" />
        </UFormField>
        <UCheckbox
          v-if="confirmacao"
          v-model="confirmado"
          :label="confirmacao"
        />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Voltar"
          color="neutral"
          variant="outline"
          @click="open = false"
        />
        <UButton
          :label="confirmLabel"
          :color="color || 'primary'"
          :loading="loading"
          :disabled="Boolean(confirmacao) && !confirmado"
          @click="confirmar"
        />
      </div>
    </template>
  </UModal>
</template>
