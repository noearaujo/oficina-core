<script setup lang="ts">
import type { Caixa } from '~/types'

interface ConfigForm {
  nome: string
  endereco: string
  telefone: string
  cnpj: string
  email: string
  validadeDias: number
  fusoHorario: string
  textoGarantia: string
  textoObservacoes: string
  textoRodape: string
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const unidadeId = computed(() => String(route.params.unidadeId ?? ''))
const { refresh: refreshConfigGlobal } = useConfig()

const abas = [
  { label: 'Oficina', value: 'oficina', icon: 'i-lucide-building-2' },
  { label: 'Caixas', value: 'caixas', icon: 'i-lucide-wallet' },
  { label: 'Funcionários', value: 'funcionarios', icon: 'i-lucide-users' },
  { label: 'Backup', value: 'backup', icon: 'i-lucide-database-backup' }
]

const tab = computed({
  get: () => {
    const valor = String(route.query.tab ?? 'oficina')
    return abas.some(a => a.value === valor) ? valor : 'oficina'
  },
  set: (valor: string) => {
    router.replace({ query: { ...route.query, tab: valor } })
  }
})

// ═══ Oficina ═══
const { data: configData, status: statusConfig, error: errorConfig, refresh: refreshConfig } = await useFetch<ConfigForm>(
  () => `/api/unidade/${unidadeId.value}/config`,
  { watch: [unidadeId] }
)

const form = reactive<ConfigForm>({
  nome: '',
  endereco: '',
  telefone: '',
  cnpj: '',
  email: '',
  validadeDias: 15,
  fusoHorario: 'America/Sao_Paulo',
  textoGarantia: '',
  textoObservacoes: '',
  textoRodape: ''
})

watch(configData, (c) => {
  if (!c) return
  form.nome = c.nome ?? ''
  form.endereco = c.endereco ?? ''
  form.telefone = c.telefone ?? ''
  form.cnpj = c.cnpj ?? ''
  form.email = c.email ?? ''
  form.validadeDias = c.validadeDias ?? 15
  form.fusoHorario = c.fusoHorario ?? 'America/Sao_Paulo'
  form.textoGarantia = c.textoGarantia ?? ''
  form.textoObservacoes = c.textoObservacoes ?? ''
  form.textoRodape = c.textoRodape ?? ''
}, { immediate: true })

const fusos = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Fortaleza',
  'America/Bahia',
  'America/Cuiaba',
  'America/Rio_Branco',
  'America/Noronha'
]

const salvando = ref(false)

function mensagemErro(e: unknown, padrao: string) {
  const err = e as { data?: { statusMessage?: string }, statusMessage?: string }
  return err?.data?.statusMessage || err?.statusMessage || padrao
}

async function salvarConfig() {
  salvando.value = true
  try {
    await $fetch(`/api/unidade/${unidadeId.value}/config`, { method: 'PUT', body: { ...form } })
    toast.add({ title: 'Configurações salvas', color: 'success' })
    await refreshConfig()
    await refreshConfigGlobal()
  } catch (e) {
    toast.add({ title: 'Erro ao salvar', description: mensagemErro(e, 'Tente novamente'), color: 'error' })
  } finally {
    salvando.value = false
  }
}

// ═══ Caixas ═══
const { data: caixas, status: statusCaixas, error: errorCaixas, refresh: refreshCaixas } = await useFetch<Caixa[]>(
  () => `/api/unidade/${unidadeId.value}/caixa`,
  { default: () => [], watch: [unidadeId] }
)

const alternandoId = ref<number | null>(null)

async function alternarCaixa(caixa: Caixa) {
  alternandoId.value = caixa.id
  try {
    await $fetch(`/api/unidade/${unidadeId.value}/caixa/${caixa.id}`, {
      method: 'PUT',
      body: { ativo: !caixa.ativo }
    })
    toast.add({ title: caixa.ativo ? 'Caixa desativado' : 'Caixa ativado', color: 'success' })
    await refreshCaixas()
  } catch (e) {
    toast.add({ title: 'Erro ao atualizar Caixa', description: mensagemErro(e, 'Tente novamente'), color: 'error' })
  } finally {
    alternandoId.value = null
  }
}

// ═══ Backup ═══
const entidadesCsv = [
  { label: 'Clientes', value: 'clientes' },
  { label: 'Veículos', value: 'veiculos' },
  { label: 'OS', value: 'os' },
  { label: 'Lançamentos', value: 'lancamentos' },
  { label: 'Catálogo', value: 'catalogo' },
  { label: 'Vendas', value: 'vendas' },
  { label: 'Estoque', value: 'estoque' }
]

const exportando = ref<string | null>(null)
const importando = ref(false)
const arquivoImport = ref<File | null>(null)
const inputArquivo = ref<HTMLInputElement | null>(null)

function baixar(conteudo: string, tipo: string, nome: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

async function exportarJson() {
  exportando.value = 'json'
  try {
    const dados = await $fetch(`/api/unidade/${unidadeId.value}/config/backup`)
    baixar(JSON.stringify(dados, null, 2), 'application/json;charset=utf-8', `backup-unidade-${unidadeId.value}-${hoje()}.json`)
  } catch (e) {
    toast.add({ title: 'Erro ao exportar', description: mensagemErro(e, 'Tente novamente'), color: 'error' })
  } finally {
    exportando.value = null
  }
}

async function exportarCsv(entidade: string) {
  exportando.value = entidade
  try {
    const csv = await $fetch<string>(`/api/unidade/${unidadeId.value}/config/csv/${entidade}`, { responseType: 'text' })
    baixar(csv, 'text/csv;charset=utf-8', `${entidade}-${hoje()}.csv`)
  } catch (e) {
    toast.add({ title: 'Erro ao exportar CSV', description: mensagemErro(e, 'Tente novamente'), color: 'error' })
  } finally {
    exportando.value = null
  }
}

function selecionarArquivo(event: Event) {
  arquivoImport.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

async function importarJson() {
  const arquivo = arquivoImport.value
  if (!arquivo) return

  if (!window.confirm('Importar substitui TODOS os dados atuais da unidade. Deseja continuar?')) return
  if (!window.confirm('Tem certeza? Esta ação não pode ser desfeita.')) return

  importando.value = true
  try {
    const payload = JSON.parse(await arquivo.text())
    await $fetch(`/api/unidade/${unidadeId.value}/config/backup`, { method: 'POST', body: payload })
    toast.add({ title: 'Backup importado', color: 'success' })
    arquivoImport.value = null
    if (inputArquivo.value) inputArquivo.value.value = ''
    await Promise.all([refreshConfig(), refreshCaixas(), refreshConfigGlobal()])
  } catch (e) {
    toast.add({
      title: 'Erro ao importar',
      description: e instanceof SyntaxError ? 'Arquivo JSON inválido' : mensagemErro(e, 'Tente novamente'),
      color: 'error'
    })
  } finally {
    importando.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="configuracoes">
    <template #header>
      <UDashboardNavbar title="Configurações">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-3xl space-y-4 sm:space-y-6">
        <UTabs
          v-model="tab"
          :items="abas"
          :content="false"
          variant="link"
        />

        <!-- Oficina -->
        <template v-if="tab === 'oficina'">
          <UAlert
            v-if="errorConfig"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            title="Não foi possível carregar as configurações"
          />
          <div v-else-if="statusConfig === 'pending' && !configData" class="flex justify-center py-8">
            <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
          </div>
          <UForm
            v-else
            :state="form"
            class="space-y-4"
            @submit="salvarConfig"
          >
            <UFormField label="Nome da oficina" name="nome" required>
              <UInput v-model="form.nome" />
            </UFormField>
            <UFormField label="Endereço" name="endereco">
              <UInput v-model="form.endereco" />
            </UFormField>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Telefone" name="telefone">
                <UInput v-model="form.telefone" />
              </UFormField>
              <UFormField label="CNPJ" name="cnpj">
                <UInput v-model="form.cnpj" />
              </UFormField>
            </div>
            <UFormField label="E-mail" name="email">
              <UInput v-model="form.email" type="email" />
            </UFormField>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Validade do orçamento (dias)" name="validadeDias">
                <UInput
                  v-model.number="form.validadeDias"
                  type="number"
                  :min="1"
                  :max="365"
                />
              </UFormField>
              <UFormField label="Fuso horário" name="fusoHorario">
                <USelect v-model="form.fusoHorario" :items="fusos" />
              </UFormField>
            </div>
            <UFormField label="Texto de garantia" name="textoGarantia">
              <UTextarea v-model="form.textoGarantia" :rows="3" />
            </UFormField>
            <UFormField label="Texto de observações" name="textoObservacoes">
              <UTextarea v-model="form.textoObservacoes" :rows="3" />
            </UFormField>
            <UFormField label="Texto de rodapé" name="textoRodape">
              <UInput v-model="form.textoRodape" />
            </UFormField>
            <div class="flex justify-end">
              <UButton
                type="submit"
                label="Salvar"
                icon="i-lucide-save"
                :loading="salvando"
              />
            </div>
          </UForm>
        </template>

        <!-- Caixas -->
        <template v-else-if="tab === 'caixas'">
          <UAlert
            v-if="errorCaixas"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            title="Não foi possível carregar os Caixas"
          />
          <div v-else-if="statusCaixas === 'pending' && !caixas.length" class="flex justify-center py-8">
            <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
          </div>
          <p v-else-if="!caixas.length" class="py-8 text-center text-sm text-muted">
            Nenhum Caixa cadastrado.
          </p>
          <ul v-else class="divide-y divide-default rounded-lg border border-default">
            <li
              v-for="caixa in caixas"
              :key="caixa.id"
              class="flex items-center justify-between gap-3 p-3 sm:p-4"
            >
              <div class="flex min-w-0 items-center gap-3">
                <UIcon name="i-lucide-wallet" class="size-5 shrink-0 text-muted" />
                <span class="truncate font-medium">{{ caixa.nome }}</span>
                <UBadge
                  :label="caixa.ativo ? 'Ativo' : 'Inativo'"
                  :color="caixa.ativo ? 'success' : 'neutral'"
                  variant="subtle"
                />
              </div>
              <UButton
                :label="caixa.ativo ? 'Desativar' : 'Ativar'"
                :icon="caixa.ativo ? 'i-lucide-power-off' : 'i-lucide-power'"
                color="neutral"
                variant="outline"
                size="sm"
                :loading="alternandoId === caixa.id"
                @click="alternarCaixa(caixa)"
              />
            </li>
          </ul>
        </template>

        <!-- Funcionários -->
        <template v-else-if="tab === 'funcionarios'">
          <div class="flex flex-col items-center gap-2 py-12 text-center">
            <UIcon name="i-lucide-users" class="size-8 text-muted" />
            <p class="font-medium">
              Em breve
            </p>
            <p class="text-sm text-muted">
              Gestão de funcionários estará disponível na Fase 2.
            </p>
          </div>
        </template>

        <!-- Backup -->
        <template v-else>
          <section class="space-y-2">
            <h3 class="font-medium">
              Exportar todos os dados (JSON)
            </h3>
            <UButton
              label="Exportar"
              icon="i-lucide-download"
              :loading="exportando === 'json'"
              @click="exportarJson"
            />
          </section>

          <USeparator />

          <section class="space-y-2">
            <h3 class="font-medium">
              Importar backup (JSON)
            </h3>
            <div class="flex flex-wrap items-center gap-2">
              <input
                ref="inputArquivo"
                type="file"
                accept="application/json,.json"
                class="text-sm"
                @change="selecionarArquivo"
              >
              <UButton
                label="Importar"
                icon="i-lucide-upload"
                color="error"
                :disabled="!arquivoImport"
                :loading="importando"
                @click="importarJson"
              />
            </div>
            <p class="flex items-center gap-1 text-sm text-warning">
              <UIcon name="i-lucide-triangle-alert" class="size-4" />
              Importar substitui todos os dados atuais.
            </p>
          </section>

          <USeparator />

          <section class="space-y-2">
            <h3 class="font-medium">
              Exportar CSV (por entidade)
            </h3>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="ent in entidadesCsv"
                :key="ent.value"
                :label="`${ent.label} CSV`"
                icon="i-lucide-file-spreadsheet"
                color="neutral"
                variant="outline"
                size="sm"
                :loading="exportando === ent.value"
                @click="exportarCsv(ent.value)"
              />
            </div>
          </section>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
