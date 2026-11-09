<script setup lang="ts">
const props = defineProps<{
  title: string
  isOpen: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const scrollerRef = ref<HTMLElement | null>(null)
const wrapperRef = ref<HTMLElement | null>(null)
const sheetRef = ref<HTMLElement | null>(null)
const aberto = toRef(props, 'isOpen')

const { zoom, handleZoomIn, handleZoomOut } = usePrintZoom(
  { scroller: scrollerRef, wrapper: wrapperRef, sheet: sheetRef },
  aberto
)
const { isCapturing, hasCopied, handleCapture } = useImageCapture(sheetRef)

function imprimir() {
  window.print()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.isOpen) emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

watch(aberto, (v) => {
  if (import.meta.client) document.body.style.overflow = v ? 'hidden' : ''
})
onBeforeUnmount(() => {
  if (import.meta.client) document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      data-print="overlay"
      class="fixed inset-0 z-9999 flex flex-col bg-black/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
      <!-- Toolbar -->
      <div class="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2 sm:px-4">
        <h2 class="min-w-0 truncate text-sm font-semibold text-white sm:text-base">
          {{ title }}
        </h2>
        <div class="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <UButton
            :icon="hasCopied ? 'i-lucide-check' : 'i-lucide-image'"
            :label="hasCopied ? 'Copiado' : 'Copiar imagem'"
            :loading="isCapturing"
            color="neutral"
            variant="subtle"
            size="sm"
            :ui="{ label: 'hidden sm:inline' }"
            aria-label="Copiar imagem"
            @click="handleCapture"
          />
          <UButton
            icon="i-lucide-printer"
            label="Imprimir"
            color="primary"
            size="sm"
            :ui="{ label: 'hidden sm:inline' }"
            aria-label="Imprimir"
            @click="imprimir"
          />
          <UButton
            icon="i-lucide-x"
            label="Fechar"
            color="neutral"
            variant="ghost"
            size="sm"
            class="text-white"
            :ui="{ label: 'hidden sm:inline' }"
            aria-label="Fechar"
            @click="emit('close')"
          />
        </div>
      </div>

      <!-- Área de scroll -->
      <div
        ref="scrollerRef"
        data-print="scroll"
        class="min-h-0 flex-1 overflow-auto"
        style="touch-action: pan-x pan-y"
      >
        <div
          ref="wrapperRef"
          data-print="wrapper"
          class="relative mx-auto shrink-0"
          style="width: calc(210mm + 4rem); min-height: calc(297mm + 4rem)"
        >
          <div
            id="print-area"
            ref="sheetRef"
            class="absolute left-8 top-8 min-h-[297mm] w-[210mm] bg-white p-[20mm] text-black shadow-2xl"
          >
            <slot />
          </div>
        </div>
      </div>

      <!-- Barra de zoom -->
      <div class="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
        <div class="pointer-events-auto flex items-center gap-1 rounded-full bg-neutral-900/90 px-2 py-1 text-white shadow-lg ring ring-white/10">
          <UButton
            icon="i-lucide-minus"
            color="neutral"
            variant="ghost"
            size="sm"
            class="rounded-full text-white"
            aria-label="Diminuir zoom"
            @click="handleZoomOut"
          />
          <span class="w-12 text-center text-sm tabular-nums">{{ Math.round(zoom * 100) }}%</span>
          <UButton
            icon="i-lucide-plus"
            color="neutral"
            variant="ghost"
            size="sm"
            class="rounded-full text-white"
            aria-label="Aumentar zoom"
            @click="handleZoomIn"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
@media print {
  @page {
    size: A4;
    margin: 0;
  }

  html,
  body {
    height: auto !important;
    overflow: visible !important;
    background: #fff !important;
  }

  body * {
    visibility: hidden;
  }

  [data-print='overlay'],
  [data-print='scroll'],
  [data-print='wrapper'] {
    position: static !important;
    display: block !important;
    width: auto !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    background: none !important;
    backdrop-filter: none !important;
  }

  #print-area,
  #print-area * {
    visibility: visible;
  }

  #print-area {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    transform: none !important;
    box-shadow: none !important;
    margin: 0 !important;
  }
}
</style>
