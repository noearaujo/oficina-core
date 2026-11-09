<script setup lang="ts">
defineProps<{ loading?: boolean, titulo?: string }>()
const emit = defineEmits<{ confirm: [canal: 'impressao' | 'imagem'] }>()
const open = defineModel<boolean>('open', { default: false })

const canal = ref<'impressao' | 'imagem'>('impressao')

const canais = [
  { label: 'Impressão/PDF', value: 'impressao' },
  { label: 'Imagem', value: 'imagem' },
  { label: 'E-mail (Em breve)', value: 'email', disabled: true },
  { label: 'Link (Em breve)', value: 'link', disabled: true }
]
</script>

<template>
  <UModal
    v-model:open="open"
    :title="titulo || 'Enviar orçamento'"
    description="Escolha o canal de envio ao cliente."
  >
    <template #body>
      <UFormField label="Canal" required>
        <URadioGroup v-model="canal" :items="canais" />
      </UFormField>
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
          label="Confirmar envio"
          :loading="loading"
          @click="emit('confirm', canal)"
        />
      </div>
    </template>
  </UModal>
</template>
