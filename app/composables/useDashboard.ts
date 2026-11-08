import { createSharedComposable } from '@vueuse/core'

const _useDashboard = () => {
  const route = useRoute()
  const router = useRouter()
  const isNotificationsSlideoverOpen = ref(false)
  const unidadeId = computed(() => route.path.match(/\/unidade\/([^/]+)/)?.[1] ?? (route.params.id ? String(route.params.id) : '1'))

  defineShortcuts({
    'g-h': () => router.push(`/unidade/${unidadeId.value}`),
    'g-c': () => router.push(`/unidade/${unidadeId.value}/clientes`),
    'g-v': () => router.push(`/unidade/${unidadeId.value}/veiculos`),
    'g-b': () => router.push(`/unidade/${unidadeId.value}/catalogo`),
    'g-s': () => router.push('/settings'),
    'n': () => isNotificationsSlideoverOpen.value = !isNotificationsSlideoverOpen.value
  })

  watch(() => route.fullPath, () => {
    isNotificationsSlideoverOpen.value = false
  })

  return {
    isNotificationsSlideoverOpen
  }
}

export const useDashboard = createSharedComposable(_useDashboard)
