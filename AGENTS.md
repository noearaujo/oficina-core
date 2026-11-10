# Stack
- Frontend: Nuxt 4 (`ssr: false`), Nuxt UI v4 (Reka UI + Tailwind CSS), Lucide (`i-lucide-*`), `useFetch`
- Backend: Nitro (`server/api`, `server/utils` async), validação com Zod (`z.coerce.number()`)
- Dados: Storage adapter (`server/utils/storage.ts`), dinheiro em centavos (int), datas em ISO UTC

# Comandos
- `pnpm dev` — Inicia servidor de desenvolvimento
- `pnpm typecheck` — Verifica tipos TypeScript (`vue-tsc`)
- `pnpm lint` — Executa linter (ESLint)

## Git
- Commit a cada passo
- Mensagem `[área] descrição`
- Nunca `git add .`
- Se quebrar, parar

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

# Rotas e parâmetros

Todas as rotas operacionais são aninhadas sob o escopo de unidade (`/unidade/[unidadeId]/`). Os nomes dos parâmetros dinâmicos devem identificar semanticamente a entidade: `[unidadeId]`, `[clienteId]`, `[veiculoId]`, `[osId]`, `[vendaId]`, `[carteiraId]`, `[itemId]`, `[catalogoId]`, `[caixaId]`, `[agendamentoId]` e `[lancamentoId]`, conforme o recurso.

- É proibido criar parâmetros genéricos `[id]` em rotas novas ou manter `[id]` em rotas operacionais existentes.
- Parâmetros aninhados devem ter nomes distintos: por exemplo, `/unidade/:unidadeId/clientes/:clienteId`.
- Frontend: acessar parâmetros com `useRoute().params.<nomeSemantico>`; não interpretar `route.path`/`fullPath` com regex ou `split()` para recuperar IDs.
- Backend: acessar parâmetros com `getRouterParam(event, '<nomeSemantico>')`; não extrair IDs de `getRequestURL(event).pathname`.
- Não manter fallback para nomes antigos (`id`, `estoqueId` etc.). O nome acessado deve corresponder exatamente ao arquivo dinâmico.
- Validar IDs numéricos como safe integer maior que zero antes de consultar dados.
- A renomeação de parâmetros não altera os caminhos públicos da URL.
- Toda operação continua obrigada a validar autorização e associação do usuário à `unidadeId`; conhecer o parâmetro não concede acesso.

Exemplos de URLs (os segmentos continuam iguais): `/unidade/5/clientes/23`, `/api/unidade/5/veiculos/42` e `/api/unidade/5/os/100/itens/3`.

# Estado
| Feature | Status |
|---|---|
| Storage Adapter (`server/utils/storage.ts`) | Concluído (Fase 1) |
| Clientes, Veículos, Catálogo (API + Frontend) | Concluído em `/unidade/[unidadeId]/` (Fase 1) |
| Dashboard (Frontend) | Concluído em `/unidade/[unidadeId]/` (Fase 1) |
| Estoque, OS, PDV, Agenda, Caixa, Carteiras, Relatórios, Lixeira | Pendente (MVP Fase 1) |
| Base / Template Nuxt UI (`settings/`, `index.vue`) | Fase 2 (congelado) |
| Migração Storage File → Cloudflare D1 | Fase 2 |

# Mapa
- `app/types/index.d.ts` — Tipos globais compartilhados
- `app/components/` — Componentes visuais e modais por domínio (`dashboard/`, `os/`, `caixa/`, `shared/`, etc.)
- Impressão: PrintPreview.vue (shell) + app/components/templates/ (templates A4)
- `app/composables/` — Estado e lógica reutilizável de UI (`useAuth`, `useUnidade`, `useConfig`, `useOS`, `useSearch`)
- `app/middleware/` — Guards de navegação client-side (`auth.global`, `unidade`, `role`)
- `app/pages/` — Rotas da aplicação (`login`, `onboarding`, `unidades/`, `usuarios/`, `unidade/[unidadeId]/...`)
- `server/middleware/` — Autenticação e resolução de contexto/tenant na API (`auth`, `unidade`)
- `server/api/` — Endpoints REST (`auth/`, `admin/`, `unidade/[unidadeId]/...`)
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
