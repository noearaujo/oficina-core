<script setup lang="ts">
import type { NotaView } from '~/composables/useOS'

const props = defineProps<{
  notas: NotaView[]
}>()

const { TIPO_NOTA, formatarDataHora } = useOS()

const historico = computed(() =>
  [...props.notas].sort((a, b) => {
    const diff = new Date(b.data).getTime() - new Date(a.data).getTime()
    return diff !== 0 ? diff : b.id - a.id
  })
)
</script>

<template>
  <UPageCard title="Histórico" variant="subtle" class="mt-4 sm:mt-6">
    <div class="max-h-[120px] overflow-y-auto">
      <p v-if="!historico.length" class="text-sm text-muted">
        Sem registros.
      </p>
      <ul v-else class="space-y-1.5">
        <li
          v-for="nota in historico"
          :key="nota.id"
          class="flex items-start gap-2 text-xs"
        >
          <span
            class="mt-1 size-2 shrink-0 rounded-full"
            :class="TIPO_NOTA[nota.tipo]?.dot || 'bg-muted'"
          />
          <span class="font-medium text-highlighted">{{ TIPO_NOTA[nota.tipo]?.label || nota.tipo }}</span>
          <span class="text-muted">{{ formatarDataHora(nota.data) }}</span>
          <span class="text-muted">{{ nota.role }}</span>
          <span class="min-w-0 flex-1">{{ nota.texto }}</span>
        </li>
      </ul>
    </div>
  </UPageCard>
</template>
