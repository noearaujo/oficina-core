<script setup lang="ts">
import type { DocumentoItem } from '~/types'

const props = defineProps<{
  itens: DocumentoItem[]
  desconto?: number
  semTotais?: boolean
}>()

const { formatarDinheiro, totalItem } = useOS()

const subtotal = computed(() =>
  props.itens
    .filter(i => i.status !== 'recusado')
    .reduce((soma, i) => soma + totalItem(i), 0)
)
const desconto = computed(() => props.desconto || 0)
const total = computed(() => Math.max(0, subtotal.value - desconto.value))

const TIPO: Record<string, string> = { servico: 'Serviço', produto: 'Produto' }
</script>

<template>
  <div>
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr class="border-y border-black text-left text-xs uppercase">
          <th class="w-8 py-1.5">
            #
          </th>
          <th class="py-1.5">
            Descrição
          </th>
          <th class="py-1.5">
            Tipo
          </th>
          <th class="py-1.5 text-right">
            Qtd
          </th>
          <th class="py-1.5 text-right">
            Unit.
          </th>
          <th class="py-1.5 text-right">
            Total
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(item, i) in itens"
          :key="item.id ?? i"
          class="border-b border-neutral-300"
          :class="item.status === 'recusado' ? 'text-neutral-500 line-through' : ''"
        >
          <td class="py-1.5">
            {{ i + 1 }}
          </td>
          <td class="py-1.5">
            {{ item.nome }}
          </td>
          <td class="py-1.5">
            {{ TIPO[item.tipo || 'produto'] }}
          </td>
          <td class="py-1.5 text-right tabular-nums">
            {{ item.quantidade }}{{ item.unidade ? ` ${item.unidade}` : '' }}
          </td>
          <td class="py-1.5 text-right tabular-nums">
            {{ formatarDinheiro(item.precoUnitario) }}
          </td>
          <td class="py-1.5 text-right tabular-nums">
            {{ formatarDinheiro(totalItem(item)) }}
          </td>
        </tr>
      </tbody>
    </table>

    <dl v-if="!semTotais" class="mt-3 ml-auto w-64 space-y-1 text-sm">
      <div class="flex justify-between">
        <dt>Subtotal:</dt>
        <dd class="tabular-nums">
          {{ formatarDinheiro(subtotal) }}
        </dd>
      </div>
      <div v-if="desconto" class="flex justify-between">
        <dt>Desconto:</dt>
        <dd class="tabular-nums">
          - {{ formatarDinheiro(desconto) }}
        </dd>
      </div>
      <div class="flex justify-between border-t border-black pt-1 text-base font-bold">
        <dt>TOTAL:</dt>
        <dd class="tabular-nums">
          {{ formatarDinheiro(total) }}
        </dd>
      </div>
    </dl>
  </div>
</template>
