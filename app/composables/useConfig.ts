import type { Config } from '~/types'

/** Configuração da oficina usada nos documentos impressos (em memória). */
export function useConfig() {
  const config = useState<Config>('config', () => ({
    nome: 'Oficina',
    validadeDias: 15
  }))

  return { config }
}
