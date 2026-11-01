<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const props = defineProps<{
  open: boolean
  item: ItemCatalogo | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
  deleted: []
}>()

const toast = useToast()
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
  descricao: z.string().optional(),
  preco: z.coerce.number().min(0, 'Preço inválido'),
  custo: z.coerce.number().min(0).optional(),
  unidade: z.string().min(1, 'Selecione a unidade')
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  nome: '',
  tipo: 'servico',
  descricao: '',
  preco: 0,
  custo: undefined,
  unidade: ''
})

watch(() => props.open, (open) => {
  if (open) {
    if (props.item) {
      state.nome = props.item.nome
      state.tipo = props.item.tipo
      state.descricao = props.item.descricao || ''
      state.preco = props.item.preco
      state.custo = props.item.custo
      state.unidade = props.item.unidade
    } else {
      state.nome = ''
      state.tipo = 'servico'
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

  try {
    if (props.item) {
      await $fetch(`/api/catalogo/${props.item.id}`, { method: 'PUT', body: d })
      toast.add({ title: 'Item atualizado', description: 'Os dados foram salvos com sucesso.', color: 'success' })
    } else {
      await $fetch('/api/catalogo', { method: 'POST', body: d })
      toast.add({ title: 'Item cadastrado', description: 'O item foi adicionado ao catálogo.', color: 'success' })
    }

    emit('saved')
    emit('update:open', false)
  } catch (error: any) {
    toast.add({
      title: 'Não foi possível salvar',
      description: error?.data?.statusMessage || 'Verifique os dados e tente novamente.',
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
    await $fetch(`/api/catalogo/${props.item.id}`, { method: 'DELETE' })
    toast.add({ title: 'Item excluído', description: `"${props.item.nome}" foi removido do catálogo.`, color: 'success' })
    emit('deleted')
    emit('update:open', false)
  } catch (error: any) {
    toast.add({
      title: 'Erro ao excluir',
      description: error?.data?.statusMessage || 'Não foi possível excluir o item.',
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
        :schema="schema"
        :state="state"
        :loading="enviando"
        class="space-y-4"
        :ui="{ form: 'id:catalogo-item-form' }"
        @submit="onSubmit"
      >
        <UFormField label="Nome" name="nome" required>
          <UInput v-model="state.nome" placeholder="Ex.: Troca de óleo" />
        </UFormField>

        <!-- Tipo: fixo na edição -->
        <div v-if="item">
          <p class="text-xs font-medium text-muted uppercase tracking-wide">Tipo</p>
          <UBadge
            class="mt-1"
            :color="item.tipo === 'servico' ? 'info' : 'success'"
            variant="subtle"
          >
            {{ item.tipo === 'servico' ? 'Serviço' : 'Produto' }}
          </UBadge>
        </div>
        <UFormField v-else label="Tipo" name="tipo" required>
          <URadioGroup
            v-model="state.tipo"
            :items="tipos"
            orientation="horizontal"
          />
        </UFormField>

        <UFormField label="Descrição" name="descricao">
          <UInput v-model="state.descricao" placeholder="Opcional" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Preço (R$)" name="preco" required>
            <UInput v-model="state.preco" type="number" min="0" step="0.01" placeholder="0,00" />
          </UFormField>
          <UFormField label="Custo (R$)" name="custo">
            <UInput v-model="state.custo" type="number" min="0" step="0.01" placeholder="Opcional" />
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
      <UButton label="Cancelar" color="neutral" variant="outline" @click="close" />
      <UButton type="submit" label="Salvar" icon="i-lucide-check" :loading="enviando" form="catalogo-item-form" />
    </template>
  </UModal>
</template>   