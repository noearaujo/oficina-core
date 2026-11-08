<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const unidadeId = computed(() => route.path.match(/\/unidade\/([^/]+)/)?.[1] ?? String(route.params.id))
const id = computed(() => String(route.params.id))

const { data: cliente, status, error, refresh } = await useFetch<Cliente>(
  () => `/api/unidade/${unidadeId.value}/clientes/${id.value}`,
  { watch: [unidadeId, id] }
)

const baseSchema = z.object({
  tipoPessoa: z.enum(['fisica', 'juridica']),
  nome: z.string().optional(),
  cpf: z.string().optional(),
  razaoSocial: z.string().optional(),
  nomeFantasia: z.string().optional(),
  cnpj: z.string().optional(),
  telefone: z.string().trim().min(8, 'Informe um telefone válido'),
  email: z.string().trim().email('E-mail inválido').or(z.literal('')),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional()
})

const schema = baseSchema.superRefine((data, ctx) => {
  if (data.tipoPessoa === 'fisica') {
    if (!data.nome?.trim()) ctx.addIssue({ code: 'custom', path: ['nome'], message: 'Informe o nome completo' })
    if (!data.cpf?.trim()) ctx.addIssue({ code: 'custom', path: ['cpf'], message: 'Informe o CPF' })
  }
  if (data.tipoPessoa === 'juridica') {
    if (!data.razaoSocial?.trim()) ctx.addIssue({ code: 'custom', path: ['razaoSocial'], message: 'Informe a razão social' })
    if (!data.cnpj?.trim()) ctx.addIssue({ code: 'custom', path: ['cnpj'], message: 'Informe o CNPJ' })
  }
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  tipoPessoa: 'fisica',
  nome: '',
  cpf: '',
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  telefone: '',
  email: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: ''
})

// Pré-preenche o form quando os dados chegam
watch(cliente, (c) => {
  if (!c) return
  state.tipoPessoa = c.tipoPessoa
  state.nome = c.nome || ''
  state.cpf = c.cpf || ''
  state.razaoSocial = c.razaoSocial || ''
  state.nomeFantasia = c.nomeFantasia || ''
  state.cnpj = c.cnpj || ''
  state.telefone = c.telefone || ''
  state.email = c.email || ''
  state.cep = c.endereco?.cep || ''
  state.logradouro = c.endereco?.logradouro || ''
  state.numero = c.endereco?.numero || ''
  state.complemento = c.endereco?.complemento || ''
  state.bairro = c.endereco?.bairro || ''
  state.cidade = c.endereco?.cidade || ''
  state.estado = c.endereco?.estado || ''
}, { immediate: true })

const tiposPessoa = [
  { label: 'Pessoa Física', value: 'fisica' },
  { label: 'Pessoa Jurídica', value: 'juridica' }
]

const estados = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF',
  'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS',
  'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

// Confirma a mudança de tipo
watch(() => state.tipoPessoa, (novoTipo) => {
  const tipoOriginal = cliente.value?.tipoPessoa

  if (tipoOriginal && novoTipo !== tipoOriginal) {
    const confirmado = window.confirm(
      `Mudar de ${tipoOriginal === 'fisica' ? 'Pessoa Física' : 'Pessoa Jurídica'} para ${novoTipo === 'fisica' ? 'Pessoa Física' : 'Pessoa Jurídica'}? Os campos atuais serão limpos.`
    )
    if (!confirmado) {
      state.tipoPessoa = tipoOriginal
      return
    }
  }

  if (novoTipo === 'fisica') {
    state.razaoSocial = ''
    state.nomeFantasia = ''
    state.cnpj = ''
  } else {
    state.nome = ''
    state.cpf = ''
  }
})

const enviando = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  const d = event.data
  enviando.value = true

  try {
    await $fetch(`/api/unidade/${unidadeId.value}/clientes/${id.value}`, {
      method: 'PUT',
      body: {
        tipoPessoa: d.tipoPessoa,
        nome: d.tipoPessoa === 'fisica'
          ? d.nome?.trim()
          : d.nomeFantasia?.trim() || d.razaoSocial?.trim(),
        cpf: d.cpf?.trim() || '',
        razaoSocial: d.razaoSocial?.trim() || '',
        nomeFantasia: d.nomeFantasia?.trim() || '',
        cnpj: d.cnpj?.trim() || '',
        telefone: d.telefone,
        email: d.email || '',
        endereco: {
          cep: d.cep || '',
          logradouro: d.logradouro || '',
          numero: d.numero || '',
          complemento: d.complemento || '',
          bairro: d.bairro || '',
          cidade: d.cidade || '',
          estado: d.estado || ''
        }
      }
    })

    toast.add({
      title: 'Cliente atualizado',
      description: 'Os dados foram salvos com sucesso.',
      color: 'success'
    })

    await navigateTo(`/unidade/${unidadeId.value}/clientes/${id.value}`)
  } catch (err: unknown) {
    const statusMessage = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
    toast.add({
      title: 'Não foi possível salvar',
      description: statusMessage || 'Verifique os dados e tente novamente.',
      color: 'error'
    })
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="cliente-editar">
    <template #header>
      <UDashboardNavbar title="Editar cliente">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Loading -->
      <div v-if="status === 'pending'" class="mx-auto w-full max-w-3xl space-y-4">
        <USkeleton class="h-64 w-full rounded-xl" />
        <USkeleton class="h-40 w-full rounded-xl" />
      </div>

      <!-- Erro -->
      <UEmpty
        v-else-if="error || !cliente"
        icon="i-lucide-user-round-x"
        title="Cliente não encontrado"
        description="Não foi possível carregar os dados deste cliente."
        :actions="[
          { label: 'Voltar', icon: 'i-lucide-arrow-left', color: 'neutral', variant: 'outline', onClick: () => router.push(`/unidade/${unidadeId}/clientes/${id}`) },
          { label: 'Tentar novamente', icon: 'i-lucide-refresh-cw', onClick: () => refresh() }
        ]"
      />

      <!-- Form -->
      <div v-else class="mx-auto w-full max-w-3xl">
        <UForm
          :schema="schema"
          :state="state"
          :loading="enviando"
          class="space-y-4 sm:space-y-6"
          @submit="onSubmit"
        >
          <!-- Identificação -->
          <UPageCard
            title="Identificação"
            description="Dados pessoais ou empresariais do cliente."
            variant="subtle"
          >
            <div class="space-y-4">
              <UFormField label="Tipo de pessoa">
                <URadioGroup
                  v-model="state.tipoPessoa"
                  :items="tiposPessoa"
                  orientation="horizontal"
                />
              </UFormField>

              <div v-if="state.tipoPessoa === 'fisica'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <UFormField
                  label="Nome completo"
                  name="nome"
                  required
                  class="sm:col-span-2"
                >
                  <UInput v-model="state.nome" placeholder="Nome completo do cliente" />
                </UFormField>
                <UFormField label="CPF" name="cpf" required>
                  <UInput v-model="state.cpf" placeholder="000.000.000-00" />
                </UFormField>
              </div>

              <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <UFormField label="Razão social" name="razaoSocial" required>
                  <UInput v-model="state.razaoSocial" placeholder="Razão social da empresa" />
                </UFormField>
                <UFormField label="Nome fantasia" name="nomeFantasia">
                  <UInput v-model="state.nomeFantasia" placeholder="Nome fantasia" />
                </UFormField>
                <UFormField label="CNPJ" name="cnpj" required>
                  <UInput v-model="state.cnpj" placeholder="00.000.000/0000-00" />
                </UFormField>
              </div>
            </div>
          </UPageCard>

          <!-- Contato -->
          <UPageCard
            title="Contato"
            description="Informações para comunicação com o cliente."
            variant="subtle"
          >
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="Telefone / WhatsApp" name="telefone" required>
                <UInput v-model="state.telefone" icon="i-lucide-phone" placeholder="(00) 00000-0000" />
              </UFormField>
              <UFormField label="E-mail" name="email">
                <UInput v-model="state.email" icon="i-lucide-mail" placeholder="email@exemplo.com" />
              </UFormField>
            </div>
          </UPageCard>

          <!-- Endereço -->
          <UPageCard
            title="Endereço"
            description="Informações de localização. Preenchimento opcional."
            variant="subtle"
          >
            <div class="grid grid-cols-1 sm:grid-cols-6 gap-4">
              <UFormField label="CEP" name="cep" class="sm:col-span-2">
                <UInput v-model="state.cep" placeholder="00000-000" />
              </UFormField>
              <UFormField label="Logradouro" name="logradouro" class="sm:col-span-4">
                <UInput v-model="state.logradouro" placeholder="Rua, avenida..." />
              </UFormField>
              <UFormField label="Número" name="numero" class="sm:col-span-2">
                <UInput v-model="state.numero" placeholder="Número" />
              </UFormField>
              <UFormField label="Complemento" name="complemento" class="sm:col-span-2">
                <UInput v-model="state.complemento" placeholder="Apartamento, bloco..." />
              </UFormField>
              <UFormField label="Bairro" name="bairro" class="sm:col-span-2">
                <UInput v-model="state.bairro" placeholder="Bairro" />
              </UFormField>
              <UFormField label="Cidade" name="cidade" class="sm:col-span-4">
                <UInput v-model="state.cidade" placeholder="Cidade" />
              </UFormField>
              <UFormField label="Estado" name="estado" class="sm:col-span-2">
                <USelect v-model="state.estado" :items="estados" placeholder="UF" />
              </UFormField>
            </div>
          </UPageCard>

          <!-- Ações -->
          <div class="flex justify-end gap-2">
            <UButton
              :to="`/unidade/${unidadeId}/clientes/${id}`"
              color="neutral"
              variant="outline"
              label="Cancelar"
            />
            <UButton
              type="submit"
              icon="i-lucide-check"
              label="Salvar alterações"
              :loading="enviando"
            />
          </div>
        </UForm>
      </div>
    </template>
  </UDashboardPanel>
</template>
