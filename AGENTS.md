# Stack
- Frontend: Nuxt 4 (`ssr: false`), Nuxt UI v4 (Reka UI + Tailwind CSS), Lucide (`i-lucide-*`), `useFetch`
- Backend: Nitro (`server/api`, `server/utils` async), validação com Zod (`z.coerce.number()`)
- Dados: Storage adapter (`server/utils/storage.ts`), dinheiro em centavos (int), datas em ISO UTC

# Comandos
- `pnpm dev` — Inicia servidor de desenvolvimento
- `pnpm typecheck` — Verifica tipos TypeScript (`vue-tsc`)
- `pnpm lint` — Executa linter (ESLint)

# Regras
- Dinheiro: inteiro em centavos (`8500` = R$ 85,00); formatação apenas na UI via `dinheiro.ts`.
- Datas: ISO UTC no storage; fuso da unidade e períodos exclusivamente via `server/utils/datas.ts`.
- Storage: acesso somente via `server/utils/storage.ts` (`db.list`, `db.get`, `db.insert`, `db.update`, `db.transaction`).
- Estoque: mutação somente via `server/utils/estoque.ts` gerando `MovimentoEstoque`; saldo negativo avisa, nunca bloqueia.
- Valores derivados: totais, saldos financeiros e badges são sempre calculados, nunca armazenados (exceto `ItemEstoque.quantidadeAtual`).
- Multi-tenant e Auth: `unidadeId` obrigatório em toda query; API valida role + unidade + associação (`docs/PRD.md` §3.5).
- Transações: toda mutação que toca mais de uma entidade deve rodar dentro de `db.transaction`.
- Imutabilidade contábil: nunca deletar `lancamento` ou `MovimentoEstoque`; corrigir via estorno ou novo movimento.
- Espécie: pagamento em `dinheiro` exige sessão de Caixa aberta (UI desabilita + API recusa).
- Carteiras: acesso via `server/utils/carteiras.ts`; exclusão exige A+ e bloqueia se houver sessão aberta.

# Estado
| Feature | Status |
|---|---|
| Base / Template Nuxt UI (`settings/`, `index.vue`) | Fase 2 (congelado) |
| Clientes, Veículos, Catálogo, Estoque | MVP (Fase 1) |
| OS, PDV, Agenda, Caixa, Carteiras, Relatórios, Lixeira | MVP (Fase 1) |
| Migração Storage File → Cloudflare D1 | Fase 2 |

# Mapa
- `app/types/index.d.ts` — Tipos globais compartilhados
- `app/components/` — Componentes visuais e modais por domínio (`dashboard/`, `os/`, `caixa/`, `shared/`, etc.)
- `app/composables/` — Estado e lógica reutilizável de UI (`useAuth`, `useUnidade`, `useConfig`, `useOS`, `useSearch`)
- `app/middleware/` — Guards de navegação client-side (`auth.global`, `unidade`, `role`)
- `app/pages/` — Rotas da aplicação (`login`, `onboarding`, `unidades/`, `usuarios/`, `unidade/[id]/...`)
- `server/middleware/` — Autenticação e resolução de contexto/tenant na API (`auth`, `unidade`)
- `server/api/` — Endpoints REST (`auth/`, `admin/`, `unidade/[id]/...`)
- `server/utils/` — Regras de negócio, schemas Zod e acesso a dados (`storage`, `datas`, `dinheiro`, `estoque`, `os`, `caixas`, `carteiras`)
- `docs/PRD.md` — Regras de negócio, entidades, fluxos e matriz de permissões (fonte de verdade)
- `docs/ARCHITECTURE.md` — Stack, arquitetura de storage, árvore de arquivos, endpoints e schema D1
- `docs/CONVENTIONS.md` — Padrões de layout, modais, tabelas, estados de UI, textos PT-BR e checklists
- `docs/ROADMAP.md` — Fases de implementação e evolução do produto
- `docs/DECISIONS.md` — Histórico de versões e decisões arquiteturais

# NÃO fazer
- Não mexer em `app/components/UserMenu`, `TeamsMenu`, `NotificationsSlideover`, `settings/`, `index.vue` (template Fase 2).
- Não usar `UPagination` separado, `ref="table"` + `tableApi`, `max-w-5xl`, `resolveComponent` ou `w-full` manual em `UInput`/`USelect`.
- Não usar `UTable` ou página de detalhe em `/catalogo` e `/estoque` (usar lista members-style + modal).
- Não colocar botões na `UDashboardNavbar` em páginas de detalhe (exceto OS) nem `UPageCard variant="naked"` / `<h1>` no topo de forms.
- Não usar float para dinheiro, `new Date()` direto para regras de período, nem acessar storage fora de `server/utils/storage.ts`.
