<script setup lang="ts">
const props = defineProps<{
  titulo: string
  valor?: string
  placeholder?: string
  editavel?: boolean
  salvando?: boolean
  obrigatorio?: boolean
}>()

const emit = defineEmits<{ salvar: [valor: string] }>()

const editando = ref(false)
const rascunho = ref('')

function iniciar() {
  rascunho.value = props.valor || ''
  editando.value = true
}

function cancelar() {
  editando.value = false
}

function salvar() {
  if (props.obrigatorio && !rascunho.value.trim()) return
  emit('salvar', rascunho.value.trim())
}

defineExpose({ fechar: cancelar })
</script>

<template>
  <UPageCard :title="titulo" variant="subtle">
    <template v-if="editavel && !editando" #links>
      <UButton
        icon="i-lucide-pencil"
        label="Editar"
        color="neutral"
        variant="ghost"
        size="sm"
        @click="iniciar"
      />
    </template>

    <div v-if="editando" class="space-y-3">
      <UTextarea v-model="rascunho" :rows="3" :placeholder="placeholder" />
      <div class="flex justify-end gap-2">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="outline"
          size="sm"
          @click="cancelar"
        />
        <UButton
          label="Salvar"
          size="sm"
          :loading="salvando"
          @click="salvar"
        />
      </div>
    </div>
    <p v-else class="text-sm whitespace-pre-line" :class="valor ? 'text-highlighted' : 'text-muted'">
      {{ valor || 'Não informado' }}
    </p>
  </UPageCard>
</template>
