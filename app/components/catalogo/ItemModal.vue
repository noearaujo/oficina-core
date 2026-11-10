<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const props = defineProps<{
  open: boolean
  item: ItemCatalogo | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
  'deleted': []
}>()

const route = useRoute()
const toast = useToast()
const unidadeId = computed(() => String(route.params.unidadeId ?? ''))
const enviando = ref(false)

const unidades = [
  { label: 'Unidade', value: 'un' },
  { label: 'Jogo', value: 'jogo' },
  { label: 'Par', value: 'par' },
  { label: 'Hora', value: 'h' },
  { label: 'Litro', value: 'litro' },
  { label: 'Metro', value: 'm' },
  { label: 'Quilo', value: 'kg' },
  { label: 'Peça', value: 'pca' }
]

const tipos = [
  { label: 'Serviço', value: 'servico' },
  { label: 'Produto', value: 'produto' }
]

const schema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do item'),
  tipo: z.enum(['servico', 'produto']),
  sku: z.string().trim().optional().default(''),
  descricao: z.string().trim().optional().default(''),
  preco: z.coerce.number().min(0, 'Preço inválido'),
  custo: z.preprocess(
    value => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(0, 'Custo inválido').optional()
  ),
  unidade: z.string().trim().min(1, 'Selecione a unidade')
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  nome: '',
  tipo: 'servico',
  sku: '',
  descricao: '',
  preco: 0,
  custo: undefined,
  unidade: ''
})

const tipoExibicao = computed(() => props.item ? props.item.tipo : state.tipo)

watch(() => props.open, (open) => {
  if (open) {
    if (props.item) {
      state.nome = props.item.nome
      state.tipo = props.item.tipo
      state.sku = props.item.sku || ''
      state.descricao = props.item.descricao || ''
      state.preco = Number((props.item.preco / 100).toFixed(2))
      state.custo = props.item.custo !== undefined && props.item.custo !== null
        ? Number((props.item.custo / 100).toFixed(2))
        : undefined
      state.unidade = props.item.unidade
    } else {
      state.nome = ''
      state.tipo = 'servico'
      state.sku = ''
      state.descricao = ''
      state.preco = 0
      state.custo = undefined
      state.unidade = ''
    }
  }
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
  const d = event.data
  enviando.value = true

  const payload = {
    ...d,
    sku: tipoExibicao.value === 'produto' ? (d.sku || '') : '',
    preco: Math.round(Number(d.preco) * 100),
    custo: d.custo !== undefined && d.custo !== null
      ? Math.round(Number(d.custo) * 100)
      : undefined
  }

  try {
    if (props.item) {
      await $fetch(`/api/unidade/${unidadeId.value}/catalogo/${props.item.id}`, { method: 'PUT', body: payload })
      toast.add({ title: 'Item atualizado', description: 'Os dados foram salvos com sucesso.', color: 'success' })
    } else {
      await $fetch(`/api/unidade/${unidadeId.value}/catalogo`, { method: 'POST', body: payload })
      toast.add({ title: 'Item cadastrado', description: 'O item foi adicionado ao catálogo.', color: 'success' })
    }

    emit('saved')
    emit('update:open', false)
  } catch (error: unknown) {
    const statusMessage = (error as { data?: { statusMessage?: string } })?.data?.statusMessage
    toast.add({
      title: 'Não foi possível salvar',
      description: statusMessage || 'Verifique os dados e tente novamente.',
      color: 'error'
    })
  } finally {
    enviando.value = false
  }
}

async function excluir() {
  if (!props.item) return
  const confirmado = window.confirm(`Deseja realmente excluir "${props.item.nome}"?`)
  if (!confirmado) return

  try {
    await $fetch(`/api/unidade/${unidadeId.value}/catalogo/${props.item.id}`, { method: 'DELETE' })
    toast.add({ title: 'Item excluído', description: `"${props.item.nome}" foi removido do catálogo.`, color: 'success' })
    emit('deleted')
    emit('update:open', false)
  } catch (error: unknown) {
    const statusMessage = (error as { data?: { statusMessage?: string } })?.data?.statusMessage
    toast.add({
      title: 'Erro ao excluir',
      description: statusMessage || 'Não foi possível excluir o item.',
      color: 'error'
    })
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="item ? 'Editar item' : 'Novo item'"
    :description="item ? 'Altere os dados e salve.' : 'Preencha os dados do item.'"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <UForm
        id="catalogo-item-form"
        :schema="schema"
        :state="state"
        :loading="enviando"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Nome" name="nome" required>
          <UInput v-model="state.nome" placeholder="Ex.: Troca de óleo" />
        </UFormField>

        <!-- Tipo: fixo na edição -->
        <div v-if="item">
          <p class="text-xs font-medium text-muted uppercase tracking-wide">
            Tipo
          </p>
          <UBadge
            class="mt-1"
            :color="item.tipo === 'servico' ? 'info' : 'success'"
            variant="subtle"
          >
            {{ item.tipo === 'servico' ? 'Serviço' : 'Produto' }}
          </UBadge>
        </div>
        <UFormField
          v-else
          label="Tipo"
          name="tipo"
          required
        >
          <URadioGroup
            v-model="state.tipo"
            :items="tipos"
            orientation="horizontal"
          />
        </UFormField>

        <UFormField v-if="tipoExibicao === 'produto'" label="SKU" name="sku">
          <UInput v-model="state.sku" placeholder="Opcional" />
        </UFormField>

        <UFormField label="Descrição" name="descricao">
          <UInput v-model="state.descricao" placeholder="Opcional" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Preço (R$)" name="preco" required>
            <UInput
              v-model="state.preco"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
            />
          </UFormField>
          <UFormField label="Custo (R$)" name="custo">
            <UInput
              v-model="state.custo"
              type="number"
              min="0"
              step="0.01"
              placeholder="Opcional"
            />
          </UFormField>
        </div>

        <UFormField label="Unidade" name="unidade" required>
          <USelect v-model="state.unidade" :items="unidades" placeholder="Selecione" />
        </UFormField>
      </UForm>
    </template>

    <template #footer="{ close }">
      <UButton
        v-if="item"
        icon="i-lucide-trash-2"
        label="Excluir"
        color="error"
        variant="ghost"
        size="sm"
        @click="excluir"
      />
      <div class="flex-1" />
      <UButton
        label="Cancelar"
        color="neutral"
        variant="outline"
        @click="close"
      />
      <UButton
        type="submit"
        :label="item ? 'Salvar alterações' : 'Salvar'"
        icon="i-lucide-check"
        :loading="enviando"
        form="catalogo-item-form"
      />
    </template>
  </UModal>
</template>
