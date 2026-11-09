<script setup lang="ts">
defineProps<{
  to: string
  icon?: string
  avatar?: string
  title: string
  subtitle?: string
}>()
</script>

<template>
  <NuxtLink
    :to="to"
    class="group flex items-center gap-3 p-4 hover:bg-elevated/50 transition-colors"
  >
    <UAvatar
      v-if="avatar"
      :alt="avatar"
      size="lg"
      class="size-10"
    />
    <UAvatar
      v-else
      :alt="title"
      :icon="icon ?? 'i-lucide-circle'"
      class="size-10"
    />
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-highlighted truncate">{{ title }}</p>
      <p v-if="subtitle" class="text-sm text-muted">{{ subtitle }}</p>
    </div>
    <UIcon name="i-lucide-chevron-right" class="size-4 text-muted shrink-0 group-hover:translate-x-0.5 transition-transform" />
  </NuxtLink>
</template>
