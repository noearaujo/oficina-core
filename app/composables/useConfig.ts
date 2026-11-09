import type { Config } from '~/types'

/** Configuração da oficina (documentos impressos), carregada da API da unidade. */
export function useConfig() {
  const route = useRoute()
  const unidadeId = computed(() => route.path.match(/\/unidade\/([^/]+)/)?.[1] ?? String(route.params.id ?? ''))

  const config = useState<Config>('config', () => ({
    nome: 'Oficina',
    validadeDias: 15,
    fusoHorario: 'America/Sao_Paulo'
  }))

  async function refresh() {
    if (!unidadeId.value) return
    try {
      config.value = await $fetch<Config>(`/api/unidade/${unidadeId.value}/config`)
    } catch {
      // mantém o último valor conhecido
    }
  }

  useAsyncData(
    () => `config-${unidadeId.value}`,
    async () => {
      await refresh()
      return true
    },
    { watch: [unidadeId], server: false }
  )

  return { config, refresh }
}
