# Changelog

> Mudanças de código (não inclui alterações apenas em docs). Formato: data, [área], descrição.

## 2026-11-08 (Sessões 3-8)

### Sessão 8 — [frontend] Catálogo e Dashboard
- [frontend] Migra dashboard para rota aninhada `/unidade/[id]/`
- [frontend] Migra catálogo para rota aninhada `/unidade/[id]/catalogo`
- [frontend] Atualiza links de navegação no layout (`default.vue`) e composable (`useDashboard.ts`)
- [frontend] Ajusta `ItemModal.vue` para chamar endpoints escopados por unidade

### Sessão 7 — [frontend] Clientes e Veículos
- [frontend] Migra páginas de clientes para `/unidade/[id]/clientes` (listagem, novo, detalhe, editar)
- [frontend] Migra páginas de veículos para `/unidade/[id]/veiculos` (listagem, novo, detalhe, editar)
- [frontend] Atualiza chamadas de `useFetch` e formulários para consumir APIs escopadas por unidade
- [frontend] Ajusta links de navegação e redirecionamentos

### Sessão 6 — [api] Catálogo
- [api] Migra endpoints de catálogo para `server/api/unidade/[id]/catalogo/` (GET, POST, PUT, DELETE)
- [api] Implementa resolução de conflito de rotas com parâmetro duplo `[id]` via pathname regex
- [api] Integração com `db` adapter e garantia de imutabilidade do tipo de item
- [api] Remove rotas antigas `/api/catalogo/*`

### Sessão 5 — [api] Veículos
- [api] Migra endpoints de veículos para `server/api/unidade/[id]/veiculos/` (GET, POST, PUT, DELETE)
- [api] Validação e coerção de `unidadeId` e integração com `db` adapter
- [api] Normalização de placas em UPPERCASE
- [api] Remove rotas antigas `/api/veiculos/*`

### Sessão 4 — [api] Clientes
- [api] Migra endpoints de clientes para `server/api/unidade/[id]/clientes/` (GET, POST, PUT, DELETE)
- [api] Validação de `unidadeId` e integração completa com `db` adapter
- [api] Remove rotas antigas `/api/clientes/*`

### Sessão 3 — [storage] Adapter
- [storage] Cria adapter de persistência `server/utils/storage.ts` com isolamento por unidade
- [storage] Suporte a armazenamento in-memory e arquivo local `.data/storage.json`
- [storage] Métodos assíncronos: `db.list`, `db.get`, `db.insert`, `db.update`, `db.delete`, `db.transaction`

## 2026-11-01 (Sessão 2)

- [catalogo] CRUD completo do catálogo: listagem members-style, modal de criação/edição/exclusão
- [catalogo] Componente `ItemModal.vue` com campos condicionais por tipo (serviço vs produto)
- [catalogo] API routes: GET, POST, PUT, DELETE para `/api/catalogo`
- [catalogo] Server utils: `server/utils/catalogo.ts` (armazenamento in-memory inicial)

## 2026-10-31 (Sessão 1)

- [clientes] CRUD completo: listagem, detalhe, criação, edição, exclusão (soft delete)
- [clientes] API routes: GET, POST, PUT, DELETE para `/api/clientes`
- [veiculos] CRUD completo: listagem, detalhe, criação, edição, exclusão (soft delete)
- [veiculos] API routes: GET, POST, PUT, DELETE para `/api/veiculos`
- [shared] Componentes dashboard: `SectionHeader.vue`, `DataField.vue`, `ListItem.vue`
- [layout] Layout `default.vue` com sidebar e navegação
- [types] Definições de tipos TypeScript em `app/types/index.d.ts`
- [config] Configuração base do projeto: Nuxt 4 (`ssr: false`), Nuxt UI v4, Tailwind CSS, Zod, ESLint
- [os] Páginas stub de Ordem de Serviço (preparação de rotas `/os`)
