<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const toast = useToast()

const open = ref(false)
const unidadeId = computed(() => route.path.match(/\/unidade\/([^/]+)/)?.[1] ?? (route.params.id ? String(route.params.id) : '1'))

const links = computed<NavigationMenuItem[][]>(() => [[{
  label: 'Dashboard',
  icon: 'i-lucide-house',
  to: `/unidade/${unidadeId.value}`,
  exact: true,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Ordens de serviço',
  icon: 'i-lucide-clipboard-list',
  to: `/unidade/${unidadeId.value}/os`,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Clientes',
  icon: 'i-lucide-users',
  to: `/unidade/${unidadeId.value}/clientes`,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Veículos',
  icon: 'i-lucide-car',
  to: `/unidade/${unidadeId.value}/veiculos`,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Catálogo',
  icon: 'i-lucide-book-open',
  to: `/unidade/${unidadeId.value}/catalogo`,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Agenda',
  icon: 'i-lucide-calendar',
  to: `/unidade/${unidadeId.value}/agenda`,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Estoque',
  icon: 'i-lucide-package',
  to: `/unidade/${unidadeId.value}/estoque`,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Carteiras',
  icon: 'i-lucide-wallet',
  to: `/unidade/${unidadeId.value}/carteiras`,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Caixa',
  icon: 'i-lucide-banknote',
  to: `/unidade/${unidadeId.value}/caixa`,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'PDV',
  icon: 'i-lucide-credit-card-reader',
  to: `/unidade/${unidadeId.value}/pdv`,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Settings',
  to: '/settings',
  icon: 'i-lucide-settings',
  defaultOpen: true,
  type: 'trigger',
  children: [{
    label: 'General',
    to: '/settings',
    exact: true,
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Members',
    to: '/settings/members',
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Notifications',
    to: '/settings/notifications',
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Security',
    to: '/settings/security',
    onSelect: () => {
      open.value = false
    }
  }]
}], [{
  label: 'Feedback',
  icon: 'i-lucide-message-circle',
  to: 'https://github.com/nuxt-ui-templates/dashboard',
  target: '_blank'
}, {
  label: 'Help & Support',
  icon: 'i-lucide-info',
  to: 'https://github.com/nuxt-ui-templates/dashboard',
  target: '_blank'
}]])

const groups = computed(() => [{
  id: 'links',
  label: 'Go to',
  items: links.value.flat()
}, {
  id: 'code',
  label: 'Code',
  items: [{
    id: 'source',
    label: 'View page source',
    icon: 'i-simple-icons-github',
    to: `https://github.com/nuxt-ui-templates/dashboard/blob/main/app/pages${route.path === '/' ? '/index' : route.path}.vue`,
    target: '_blank'
  }]
}])

onMounted(async () => {
  const cookie = useCookie('cookie-consent')
  if (cookie.value === 'accepted') {
    return
  }

  toast.add({
    title: 'We use first-party cookies to enhance your experience on our website.',
    duration: 0,
    close: false,
    actions: [{
      label: 'Accept',
      color: 'neutral',
      variant: 'outline',
      onClick: () => {
        cookie.value = 'accepted'
      }
    }, {
      label: 'Opt out',
      color: 'neutral',
      variant: 'ghost'
    }]
  })
})
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <TeamsMenu :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
          popover
        />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[1]"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups as any" />

    <slot />

    <NotificationsSlideover />
  </UDashboardGroup>
</template>
