<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const unidadeId = computed(() => route.path.match(/\/unidade\/([^/]+)/)?.[1] ?? String(route.params.id))
const id = computed(() => String(route.params.id))

const { data: veiculo, status, error, refresh } = await useFetch<Veiculo>(
  () => `/api/unidade/${unidadeId.value}/veiculos/${id.value}`,
  { watch: [unidadeId, id] }
)

const { data: clientes, status: statusClientes } = await useFetch<Cliente[]>(
  () => `/api/unidade/${unidadeId.value}/clientes`,
  {
    default: () => [],
    watch: [unidadeId]
  }
)

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
    .transform(value => value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .refine(value => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(value), 'Informe uma placa válida'),
  anoFabricacao: z.string().min(1, 'Informe o ano de fabricação'),
  anoModelo: z.string().min(1, 'Informe o ano do modelo'),
  cor: z.string().optional(),
  combustivel: z.string().optional(),
  quilometragem: z.string().refine(value => !value || /^\d+$/.test(value), 'Informe uma quilometragem válida'),
  chassi: z.string().optional()
}).superRefine((data, ctx) => {
  if (data.anoFabricacao && data.anoModelo && Number(data.anoModelo) < Number(data.anoFabricacao)) {
    ctx.addIssue({ code: 'custom', path: ['anoModelo'], message: 'O ano do modelo não pode ser anterior ao ano de fabricação' })
  }
})

type Schema = z.output<typeof schema>

const state = reactive<z.input<typeof schema>>({
  tipo: '',
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
const tipoOriginal = ref('')
const clienteAtualId = ref(0)

// Pré-preenche quando os dados chegam
watch([veiculo, clientes], ([v, listaClientes]) => {
  if (!v) return
  state.tipo = v.tipo
  state.marca = v.marca
  state.modelo = v.modelo
  state.versao = v.versao || ''
  state.placa = v.placa
  state.anoFabricacao = String(v.anoFabricacao)
  state.anoModelo = String(v.anoModelo)
  state.cor = v.cor || ''
  state.combustivel = v.combustivel || ''
  state.quilometragem = v.quilometragem !== undefined && v.quilometragem !== null ? String(v.quilometragem) : ''
  state.chassi = v.chassi || ''
  tipoOriginal.value = v.tipo

  clienteAtualId.value = v.clienteId
  const cliente = listaClientes?.find(c => c.id === v.clienteId)
  if (cliente) clienteSelecionado.value = cliente
}, { immediate: true })

// Confirm ao trocar tipo
watch(() => state.tipo, (novoTipo) => {
  if (tipoOriginal.value && novoTipo !== tipoOriginal.value) {
    const labelAntigo = tiposVeiculo.find(t => t.value === tipoOriginal.value)?.label ?? tipoOriginal.value
    const labelNovo = tiposVeiculo.find(t => t.value === novoTipo)?.label ?? novoTipo
    const confirmado = window.confirm(`Mudar de ${labelAntigo} para ${labelNovo}?`)
    if (!confirmado) {
      state.tipo = tipoOriginal.value
      return
    }
  }
})

// Confirm ao trocar cliente
watch(clienteSelecionado, (novoCliente) => {
  if (!novoCliente || novoCliente.id === clienteAtualId.value) return
  const clienteAntigo = clientes.value?.find(c => c.id === clienteAtualId.value)
  const confirmado = window.confirm(
    `Mudar proprietário de ${clienteAntigo?.nome ?? 'desconhecido'} para ${novoCliente.nome}?`
  )
  if (!confirmado) {
    clienteSelecionado.value = clienteAntigo
  } else {
    clienteAtualId.value = novoCliente.id
  }
})

const enviando = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!clienteSelecionado.value) return
  enviando.value = true

  try {
    await $fetch(`/api/unidade/${unidadeId.value}/veiculos/${id.value}`, {
      method: 'PUT',
      body: {
        clienteId: clienteSelecionado.value.id,
        ...event.data,
        quilometragem: event.data.quilometragem ? Number(event.data.quilometragem) : undefined
      }
    })

    toast.add({
      title: 'Veículo atualizado',
      description: 'Os dados foram salvos com sucesso.',
      color: 'success'
    })

    await navigateTo(`/unidade/${unidadeId.value}/veiculos/${id.value}`)
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
  <UDashboardPanel id="veiculo-editar">
    <template #header>
      <UDashboardNavbar title="Editar veículo">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Loading -->
      <div v-if="status === 'pending'" class="mx-auto w-full max-w-3xl space-y-4">
        <USkeleton class="h-40 w-full rounded-xl" />
        <USkeleton class="h-64 w-full rounded-xl" />
      </div>

      <!-- Erro -->
      <UEmpty
        v-else-if="error || !veiculo"
        icon="i-lucide-car-front"
        title="Veículo não encontrado"
        description="Não foi possível carregar os dados deste veículo."
        :actions="[
          { label: 'Voltar', icon: 'i-lucide-arrow-left', color: 'neutral', variant: 'outline', onClick: () => router.push(`/unidade/${unidadeId}/veiculos/${id}`) },
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
          <!-- Cliente -->
          <UPageCard
            title="Proprietário"
            description="Cliente vinculado a este veículo."
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
            </div>
          </UPageCard>

          <!-- Dados do veículo -->
          <UPageCard
            title="Dados do veículo"
            description="Informações de identificação e características."
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
            <UButton
              :to="`/unidade/${unidadeId}/veiculos/${id}`"
              color="neutral"
              variant="outline"
              label="Cancelar"
            />
            <UButton
              type="submit"
              icon="i-lucide-check"
              label="Salvar alterações"
              :loading="enviando"
              :disabled="!clienteSelecionado"
            />
          </div>
        </UForm>
      </div>
    </template>
  </UDashboardPanel>
</template>
