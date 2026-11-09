<script setup lang="ts">
defineProps<{
  label: string
  value?: string
  fallback?: string
}>()
</script>

<template>
  <div>
    <p class="text-xs font-medium text-muted uppercase tracking-wide">
      {{ label }}
    </p>
    <p class="mt-1 text-sm" :class="value ? 'font-medium text-highlighted' : 'text-muted'">
      {{ value || fallback || 'Não informado' }}
    </p>
  </div>
</template>
