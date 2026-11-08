<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const route = useRoute()
const unidadeId = computed(() => route.path.match(/\/unidade\/([^/]+)/)?.[1] ?? String(route.params.id))

const baseSchema = z.object({
  tipoPessoa: z.enum(['fisica', 'juridica']),

  nome: z.string().optional(),
  cpf: z.string().optional(),

  razaoSocial: z.string().optional(),
  nomeFantasia: z.string().optional(),
  cnpj: z.string().optional(),

  telefone: z.string().trim().min(8, 'Informe um telefone válido'),
  email: z.string().email('E-mail inválido').or(z.literal('')),

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
    if (!data.nome?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['nome'], message: 'Informe o nome completo' })
    }
    if (!data.cpf?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['cpf'], message: 'Informe o CPF' })
    }
  }

  if (data.tipoPessoa === 'juridica') {
    if (!data.razaoSocial?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['razaoSocial'], message: 'Informe a razão social' })
    }
    if (!data.cnpj?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['cnpj'], message: 'Informe o CNPJ' })
    }
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

watch(() => state.tipoPessoa, (tipo) => {
  if (tipo === 'fisica') {
    state.razaoSocial = ''
    state.nomeFantasia = ''
    state.cnpj = ''
  } else {
    state.nome = ''
    state.cpf = ''
  }
})

const toast = useToast()
const enviando = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  const d = event.data

  enviando.value = true

  try {
    const novoCliente = await $fetch<{ id: number }>(`/api/unidade/${unidadeId.value}/clientes`, {
      method: 'POST',
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
      title: 'Cliente cadastrado',
      description: 'O cliente foi cadastrado com sucesso.',
      color: 'success'
    })

    const redirect = route.query.redirect as string | undefined
    await navigateTo(redirect || `/unidade/${unidadeId.value}/clientes/${novoCliente.id}`)
  } catch (error: any) {
    toast.add({
      title: 'Não foi possível cadastrar',
      description: error?.data?.statusMessage || 'Verifique os dados e tente novamente.',
      color: 'error'
    })
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="clientes-novo">
    <template #header>
      <UDashboardNavbar title="Novo cliente">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-3xl">

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

              <!-- PF -->
              <div v-if="state.tipoPessoa === 'fisica'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <UFormField label="Nome completo" name="nome" required class="sm:col-span-2">
                  <UInput v-model="state.nome" placeholder="Nome completo do cliente" />
                </UFormField>
                <UFormField label="CPF" name="cpf" required>
                  <UInput v-model="state.cpf" placeholder="000.000.000-00" />
                </UFormField>
              </div>

              <!-- PJ -->
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
            <UButton :to="`/unidade/${unidadeId}/clientes`" color="neutral" variant="outline" label="Cancelar" />
            <UButton type="submit" icon="i-lucide-check" label="Cadastrar cliente" :loading="enviando" />
          </div>

        </UForm>

      </div>
    </template>
  </UDashboardPanel>
</template>
