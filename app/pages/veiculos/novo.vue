<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const route = useRoute()

const tiposVeiculo = [
  { label: 'Carro', value: 'carro' },
  { label: 'Motocicleta', value: 'motocicleta' },
  { label: 'Caminhonete', value: 'caminhonete' },
  { label: 'Caminhão', value: 'caminhao' },
  { label: 'Van', value: 'van' },
  { label: 'Ônibus', value: 'onibus' },
  { label: 'Outro', value: 'outro' }
]

const combustiveis = [
  { label: 'Flex', value: 'flex' },
  { label: 'Gasolina', value: 'gasolina' },
  { label: 'Etanol', value: 'etanol' },
  { label: 'Diesel', value: 'diesel' },
  { label: 'GNV', value: 'gnv' },
  { label: 'Elétrico', value: 'eletrico' },
  { label: 'Híbrido', value: 'hibrido' },
  { label: 'Outro', value: 'outro' }
]

const anoAtual = new Date().getFullYear()
const anos = Array.from({ length: 51 }, (_, i) => {
  const ano = anoAtual + 1 - i
  return { label: String(ano), value: String(ano) }
})

const schema = z.object({
  tipo: z.string().min(1, 'Selecione o tipo de veículo'),
  marca: z.string().trim().min(1, 'Informe a marca'),
  modelo: z.string().trim().min(1, 'Informe o modelo'),
  versao: z.string().optional(),
  placa: z.string()
    .trim()
    .regex(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/, 'Informe uma placa válida')
    .transform((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, '')),
  anoFabricacao: z.string().min(1, 'Informe o ano de fabricação'),
  anoModelo: z.string().min(1, 'Informe o ano do modelo'),
  cor: z.string().optional(),
  combustivel: z.string().optional(),
  quilometragem: z.string()
    .refine((value) => !value || /^\d+$/.test(value), 'Informe uma quilometragem válida'),
  chassi: z.string().optional()
}).superRefine((data, ctx) => {
  if (data.anoFabricacao && data.anoModelo && Number(data.anoModelo) < Number(data.anoFabricacao)) {
    ctx.addIssue({ code: 'custom', path: ['anoModelo'], message: 'O ano do modelo não pode ser anterior ao ano de fabricação' })
  }
})

type Schema = z.output<typeof schema>

const state = reactive<z.input<typeof schema>>({
  tipo: 'carro',
  marca: '',
  modelo: '',
  versao: '',
  placa: '',
  anoFabricacao: '',
  anoModelo: '',
  cor: '',
  combustivel: '',
  quilometragem: '',
  chassi: ''
})

const clienteSelecionado = ref<Cliente | undefined>()

const { data: clientes, status: statusClientes } = await useFetch<Cliente[]>('/api/clientes', {
  default: () => []
})

// Pré-seleciona cliente vindo da query (?clienteId=X)

onMounted(() => {
  const clienteId = route.query.clienteId
  if (clienteId && clientes.value?.length) {
    const encontrado = clientes.value.find(c => c.id === Number(clienteId))
    if (encontrado) clienteSelecionado.value = encontrado
  }
})

function trocarCliente() {
  clienteSelecionado.value = undefined
}

const toast = useToast()
const enviando = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!clienteSelecionado.value) return

  enviando.value = true

  try {
    const novoVeiculo = await $fetch<{ id: number }>('/api/veiculos', {
      method: 'POST',
      body: {
        clienteId: clienteSelecionado.value.id,
        ...event.data
      }
    })

    toast.add({
      title: 'Veículo cadastrado',
      description: 'O veículo foi cadastrado com sucesso.',
      color: 'success'
    })

    const redirect = route.query.redirect as string | undefined
    await navigateTo(redirect || `/veiculos/${novoVeiculo.id}`)
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
  <UDashboardPanel id="veiculos-novo">
    <template #header>
      <UDashboardNavbar title="Novo veículo">
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

          <!-- Cliente -->
          <UPageCard
            title="Cliente"
            description="Selecione o cliente ao qual este veículo pertence."
            variant="subtle"
          >
            <div class="space-y-4">
              <UFormField label="Buscar cliente" required>
                <USelectMenu
                  v-model="clienteSelecionado"
                  :items="clientes ?? []"
                  :loading="statusClientes === 'pending'"
                  label-key="nome"
                  placeholder="Digite o nome do cliente..."
                  icon="i-lucide-search"
                />
              </UFormField>

              <!-- Preview do cliente selecionado -->
              <div
                v-if="clienteSelecionado"
                class="flex items-center justify-between gap-3 rounded-lg border border-default p-3"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <div class="rounded-full bg-primary/10 p-2">
                    <UIcon name="i-lucide-user-round" class="size-5 text-primary" />
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-medium truncate">{{ clienteSelecionado.nome }}</p>
                    <p class="text-xs text-muted">Cliente selecionado</p>
                  </div>
                </div>
                <UButton
                  label="Trocar"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="trocarCliente"
                />
              </div>

              <!-- CTA: cadastrar novo cliente -->
              <div v-else class="flex flex-wrap items-center justify-between gap-3">
                <p class="text-sm text-muted">Não encontrou o cliente?</p>
                <UButton
                  to="/clientes/novo?redirect=/veiculos/novo"
                  label="Cadastrar novo cliente"
                  icon="i-lucide-user-plus"
                  color="neutral"
                  variant="outline"
                  size="sm"
                />
              </div>
            </div>
          </UPageCard>

          <!-- Dados do veículo (só aparece com cliente selecionado) -->
          <UPageCard
            v-if="clienteSelecionado"
            title="Dados do veículo"
            description="Preencha as informações de identificação do veículo."
            variant="subtle"
          >
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="Tipo de veículo" name="tipo" required>
                <USelect v-model="state.tipo" :items="tiposVeiculo" />
              </UFormField>
              <UFormField label="Marca" name="marca" required>
                <UInput v-model="state.marca" placeholder="Ex.: Volkswagen" />
              </UFormField>
              <UFormField label="Modelo" name="modelo" required>
                <UInput v-model="state.modelo" placeholder="Ex.: Gol" />
              </UFormField>
              <UFormField label="Versão" name="versao">
                <UInput v-model="state.versao" placeholder="Ex.: 1.6 MSI" />
              </UFormField>
            </div>

            <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <UFormField label="Placa" name="placa" required>
                <UInput v-model="state.placa" placeholder="ABC1D23" />
              </UFormField>
              <UFormField label="Ano de fabricação" name="anoFabricacao" required>
                <USelect v-model="state.anoFabricacao" :items="anos" placeholder="Selecione" />
              </UFormField>
              <UFormField label="Ano do modelo" name="anoModelo" required>
                <USelect v-model="state.anoModelo" :items="anos" placeholder="Selecione" />
              </UFormField>
              <UFormField label="Cor" name="cor">
                <UInput v-model="state.cor" placeholder="Ex.: Prata" />
              </UFormField>
              <UFormField label="Combustível" name="combustivel">
                <USelect v-model="state.combustivel" :items="combustiveis" placeholder="Selecione" />
              </UFormField>
              <UFormField label="Quilometragem atual" name="quilometragem">
                <UInput v-model="state.quilometragem" placeholder="Ex.: 85000">
                  <template #trailing>
                    <span class="text-xs text-muted">km</span>
                  </template>
                </UInput>
              </UFormField>
              <UFormField label="Chassi" name="chassi" class="sm:col-span-2 lg:col-span-3">
                <UInput v-model="state.chassi" placeholder="Número do chassi (opcional)" />
              </UFormField>
            </div>
          </UPageCard>

          <!-- Ações -->
          <div class="flex justify-end gap-2">
            <UButton to="/veiculos" color="neutral" variant="outline" label="Cancelar" />
            <UButton type="submit" icon="i-lucide-check" label="Cadastrar veículo" :loading="enviando" :disabled="!clienteSelecionado" />
          </div>

        </UForm>

      </div>
    </template>
  </UDashboardPanel>
</template>   