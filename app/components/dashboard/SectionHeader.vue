<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <UPageCard
    :title="title"
    :description="description"
    variant="naked"
    orientation="horizontal"
    class="mb-4 sm:mb-6"
  >
    <slot />
  </UPageCard>
</template>
