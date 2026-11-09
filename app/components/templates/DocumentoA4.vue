<script setup lang="ts">
import type { Config, DocumentoItem } from '~/types'

const props = defineProps<{
  config: Config
  titulo: string
  data?: string
  mostrarValidade?: boolean
  clienteNome?: string
  veiculo?: string
  placa?: string
  referencia?: string
  itensRecusados?: DocumentoItem[]
}>()

const { formatarData, formatarDinheiro, totalItem } = useOS()

const validade = computed(() => {
  if (!props.mostrarValidade || !props.data) return ''
  const base = new Date(props.data)
  if (Number.isNaN(base.getTime())) return ''
  base.setDate(base.getDate() + Number(props.config.validadeDias || 0))
  return formatarData(base.toISOString())
})
</script>

<template>
  <div class="flex min-h-[257mm] flex-col text-[11pt] leading-snug text-black">
    <header class="border-b border-black pb-3">
      <p class="text-xl font-bold">
        {{ config.nome }}
      </p>
      <p v-if="config.endereco" class="text-sm">
        {{ config.endereco }}
      </p>
      <p class="text-sm">
        <span v-if="config.telefone">Tel.: {{ config.telefone }}</span>
        <span v-if="config.telefone && config.cnpj"> · </span>
        <span v-if="config.cnpj">CNPJ: {{ config.cnpj }}</span>
      </p>
    </header>

    <section class="mt-5">
      <h1 class="text-lg font-bold tracking-wide">
        {{ titulo }}
      </h1>
      <p v-if="data" class="text-sm">
        Data: {{ formatarData(data) }}
        <template v-if="validade">
          · Válido até: {{ validade }}
        </template>
      </p>
      <p v-if="referencia" class="text-sm">
        {{ referencia }}
      </p>
    </section>

    <section class="mt-4 text-sm">
      <p><strong>Cliente:</strong> {{ clienteNome || 'Não informado' }}</p>
      <p v-if="veiculo || placa">
        <strong>Veículo:</strong> {{ veiculo || 'Não informado' }}
        <template v-if="placa">
          · <strong>Placa:</strong> {{ placa }}
        </template>
      </p>
    </section>

    <div class="mt-5">
      <slot />
    </div>

    <footer class="mt-auto pt-8 text-sm">
      <p v-if="config.textoObservacoes" class="mb-2">
        <strong>Observações:</strong> {{ config.textoObservacoes }}
      </p>
      <p v-if="config.textoGarantia" class="mb-2">
        <strong>Garantia:</strong> {{ config.textoGarantia }}
      </p>

      <div v-if="itensRecusados?.length" class="mb-2">
        <p class="font-semibold">
          Itens recusados pelo cliente:
        </p>
        <ul>
          <li v-for="(item, i) in itensRecusados" :key="item.id ?? i">
            • {{ item.nome }} ({{ formatarDinheiro(totalItem(item)) }})<template v-if="item.motivoRecusa">
              — {{ item.motivoRecusa }}
            </template>
          </li>
        </ul>
      </div>

      <div class="mx-auto mt-14 w-72 border-t border-black pt-1 text-center">
        Assinatura
      </div>
    </footer>
  </div>
</template>
