<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { OSView } from '~/composables/useOS'

const route = useRoute()
const toast = useToast()
const unidadeId = computed(() => String(route.params.unidadeId ?? ''))
const { RESPONSAVEIS, erroMensagem } = useOS()

const base = computed(() => `/unidade/${unidadeId.value}/os/novo`)

const { data: clientes, status: statusClientes, refresh: refreshClientes } = await useFetch<Cliente[]>(
  () => `/api/unidade/${unidadeId.value}/clientes`,
  { default: () => [], watch: [unidadeId] }
)

const { data: veiculos, status: statusVeiculos, refresh: refreshVeiculos } = await useFetch<Veiculo[]>(
  () => `/api/unidade/${unidadeId.value}/veiculos`,
  { default: () => [], watch: [unidadeId] }
)

const clienteSelecionado = ref<Cliente | undefined>()
const veiculoId = ref<number | undefined>()

const veiculosDoCliente = computed(() =>
  (veiculos.value ?? []).filter(v => v.clienteId === clienteSelecionado.value?.id)
)
const veiculoItens = computed(() =>
  veiculosDoCliente.value.map(v => ({
    label: `${v.placa} — ${[v.marca, v.modelo].filter(Boolean).join(' ')}`,
    value: v.id
  }))
)
const veiculoSelecionado = computed(() => veiculosDoCliente.value.find(v => v.id === veiculoId.value))

const combustiveis = ['E', '1/4', '2/4', '3/4', 'Cheio'].map(v => ({ label: v, value: v }))
const tipos = [
  { label: 'Normal', value: 'normal' },
  { label: 'Garantia', value: 'garantia' }
]

function hojeISO() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  const hora = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}T${hora}:${min}`
}

const schema = z.object({
  queixa: z.string().trim().min(1, 'Informe a queixa do cliente'),
  funcionarioId: z.number({ message: 'Selecione o mecânico responsável' }),
  tipo: z.enum(['normal', 'garantia']),
  osOriginalId: z.number().optional(),
  quilometragem: z.string().refine(v => !v || /^\d+$/.test(v), 'Informe uma quilometragem válida'),
  dataEntrada: z.string().min(1, 'Informe a data de entrada'),
  previsaoEntrega: z.string().optional(),
  combustivel: z.string().optional(),
  avarias: z.string().optional()
}).refine(d => d.tipo !== 'garantia' || d.osOriginalId, {
  path: ['osOriginalId'],
  message: 'Selecione a OS original'
})

type Schema = z.output<typeof schema>

const state = reactive<{
  queixa: string
  funcionarioId: number | undefined
  tipo: 'normal' | 'garantia'
  osOriginalId: number | undefined
  quilometragem: string
  dataEntrada: string
  previsaoEntrega: string
  combustivel: string | undefined
  avarias: string
}>({
  queixa: '',
  funcionarioId: undefined,
  tipo: 'normal',
  osOriginalId: undefined,
  quilometragem: '',
  dataEntrada: hojeISO(),
  previsaoEntrega: '',
  combustivel: undefined,
  avarias: ''
})

watch(clienteSelecionado, () => {
  veiculoId.value = undefined
})

watch(veiculoSelecionado, (v) => {
  if (v && !state.quilometragem && v.quilometragem !== undefined) {
    state.quilometragem = String(v.quilometragem)
  }
})

// OS original (garantia)
const { data: listaOS, execute: carregarOS } = await useFetch<OSView[]>(
  () => `/api/unidade/${unidadeId.value}/os`,
  { default: () => [], immediate: false, watch: false }
)

watch(() => state.tipo, (tipo) => {
  if (tipo === 'garantia') carregarOS()
  else state.osOriginalId = undefined
})

const osOriginalItens = computed(() =>
  (listaOS.value ?? []).map(o => ({
    label: `#${o.numero} — ${o.veiculoPlaca || 'sem placa'} — ${o.clienteNome || 'Não informado'}`,
    value: o.id
  }))
)

// Retorno de cadastro (cliente/veículo) via redirect
onMounted(async () => {
  const retorno = route.query.retorno
  if (retorno === 'cliente') {
    await refreshClientes()
    const novo = [...(clientes.value ?? [])].sort((a, b) => b.id - a.id)[0]
    if (novo) clienteSelecionado.value = novo
  } else if (retorno === 'veiculo') {
    await Promise.all([refreshClientes(), refreshVeiculos()])
    const cid = Number(route.query.clienteId)
    const cliente = (clientes.value ?? []).find(c => c.id === cid)
    if (cliente) {
      clienteSelecionado.value = cliente
      await nextTick()
      const novo = [...veiculosDoCliente.value].sort((a, b) => b.id - a.id)[0]
      if (novo) veiculoId.value = novo.id
    }
  }
})

function irParaCadastro(destino: string) {
  return navigateTo(destino)
}

const urlNovoCliente = computed(() =>
  `/unidade/${unidadeId.value}/clientes/novo?redirect=${encodeURIComponent(`${base.value}?retorno=cliente`)}`
)
const urlNovoVeiculo = computed(() => {
  const cid = clienteSelecionado.value?.id
  const retorno = `${base.value}?retorno=veiculo&clienteId=${cid}`
  return `/unidade/${unidadeId.value}/veiculos/novo?clienteId=${cid}&redirect=${encodeURIComponent(retorno)}`
})

const enviando = ref(false)

function paraISO(data: string) {
  if (!data) return undefined
  return new Date(data).toISOString()
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!clienteSelecionado.value || !veiculoId.value) return
  enviando.value = true
  const d = event.data
  try {
    const os = await $fetch<OSView>(`/api/unidade/${unidadeId.value}/os`, {
      method: 'POST',
      body: {
        clienteId: clienteSelecionado.value.id,
        veiculoId: veiculoId.value,
        funcionarioId: d.funcionarioId,
        queixa: d.queixa,
        tipo: d.tipo,
        osOriginalId: d.tipo === 'garantia' ? d.osOriginalId : undefined,
        quilometragem: d.quilometragem || undefined,
        dataEntrada: paraISO(d.dataEntrada),
        previsaoEntrega: paraISO(d.previsaoEntrega || ''),
        combustivel: d.combustivel || undefined,
        avarias: d.avarias || undefined
      }
    })
    toast.add({ title: 'OS criada', color: 'success' })
    const redirect = route.query.redirect as string | undefined
    await navigateTo(redirect || `/unidade/${unidadeId.value}/os/${os.id}`)
  } catch (err) {
    toast.add({
      title: 'Não foi possível salvar',
      description: erroMensagem(err),
      color: 'error'
    })
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="os-novo">
    <template #header>
      <UDashboardNavbar title="Nova OS">
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
          <!-- Step 1: Cliente -->
          <UPageCard
            title="1. Cliente"
            description="Selecione o cliente da OS."
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
              <div class="flex flex-wrap items-center justify-between gap-3">
                <p class="text-sm text-muted">
                  Não encontrou o cliente?
                </p>
                <UButton
                  label="Cadastrar novo cliente"
                  icon="i-lucide-user-plus"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  @click="irParaCadastro(urlNovoCliente)"
                />
              </div>
            </div>
          </UPageCard>

          <!-- Step 2: Veículo -->
          <UPageCard
            v-if="clienteSelecionado"
            title="2. Veículo"
            description="Selecione um veículo do cliente."
            variant="subtle"
          >
            <div class="space-y-4">
              <UFormField label="Veículo" required>
                <USelect
                  v-model="veiculoId"
                  :items="veiculoItens"
                  :loading="statusVeiculos === 'pending'"
                  placeholder="Selecione o veículo"
                />
              </UFormField>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <p class="text-sm text-muted">
                  {{ veiculoItens.length ? 'Veículo não está na lista?' : 'Este cliente ainda não tem veículos.' }}
                </p>
                <UButton
                  label="Cadastrar novo veículo"
                  icon="i-lucide-car"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  @click="irParaCadastro(urlNovoVeiculo)"
                />
              </div>
            </div>
          </UPageCard>

          <!-- Step 3: Dados da OS -->
          <UPageCard
            v-if="clienteSelecionado && veiculoId"
            title="3. Dados da OS"
            description="Informações de entrada do veículo."
            variant="subtle"
          >
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="Tipo" name="tipo" required>
                <USelect v-model="state.tipo" :items="tipos" />
              </UFormField>
              <UFormField label="Mecânico responsável" name="funcionarioId" required>
                <USelect
                  v-model="state.funcionarioId"
                  :items="RESPONSAVEIS"
                  placeholder="Selecione o responsável"
                />
              </UFormField>

              <UFormField
                v-if="state.tipo === 'garantia'"
                label="OS original"
                name="osOriginalId"
                required
                class="sm:col-span-2"
              >
                <USelectMenu
                  v-model="state.osOriginalId"
                  :items="osOriginalItens"
                  value-key="value"
                  placeholder="Buscar por número ou placa..."
                  icon="i-lucide-search"
                />
              </UFormField>

              <UFormField
                label="Queixa do cliente"
                name="queixa"
                required
                class="sm:col-span-2"
              >
                <UTextarea v-model="state.queixa" placeholder="Ex.: Barulho na suspensão dianteira" :rows="3" />
              </UFormField>

              <UFormField label="Quilometragem" name="quilometragem">
                <UInput v-model="state.quilometragem" placeholder="Ex.: 85000">
                  <template #trailing>
                    <span class="text-xs text-muted">km</span>
                  </template>
                </UInput>
              </UFormField>
              <UFormField label="Combustível" name="combustivel">
                <USelect v-model="state.combustivel" :items="combustiveis" placeholder="Nível do tanque" />
              </UFormField>

              <UFormField label="Data de entrada" name="dataEntrada" required>
                <UInput v-model="state.dataEntrada" type="datetime-local" />
              </UFormField>
              <UFormField label="Previsão de entrega" name="previsaoEntrega">
                <UInput v-model="state.previsaoEntrega" type="datetime-local" />
              </UFormField>

              <UFormField label="Avarias" name="avarias" class="sm:col-span-2">
                <UTextarea v-model="state.avarias" placeholder="Ex.: Arranhão no para-choque traseiro" :rows="2" />
              </UFormField>
            </div>
          </UPageCard>

          <div class="flex justify-end gap-2">
            <UButton
              :to="`/unidade/${unidadeId}/os`"
              color="neutral"
              variant="outline"
              label="Cancelar"
            />
            <UButton
              type="submit"
              icon="i-lucide-check"
              label="Criar OS"
              :loading="enviando"
              :disabled="!clienteSelecionado || !veiculoId"
            />
          </div>
        </UForm>
      </div>
    </template>
  </UDashboardPanel>
</template>
