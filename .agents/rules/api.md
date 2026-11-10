---
paths:
  - "server/**"
---

# Convenções de API — Oficina Core

> Extraído de `docs/CONVENTIONS.md`.

## NUNCA

| Regra | Por quê |
|---|---|
| `z.number()` puro em preço/custo | Usar `z.coerce.number()` |
| Permitir "Dinheiro" sem sessão de Caixa aberta | Trava de Caixa fechado (UI + API) |
| Travar aprovação, conclusão ou venda por falta de saldo de estoque | Operação sem trava: só avisar (`Estoque Negativo`) |
| Float para dinheiro | Sempre inteiro em centavos |
| Calcular "hoje"/período com `new Date()` direto | Usar `datas.ts` (fuso da unidade) |
| Armazenar total/saldo/badge | Sempre derivado |
| Rota de recurso de unidade na raiz (`/api/<recurso>`) | Padrão novo exige escopo: `/api/unidade/[unidadeId]/<recurso>` |

## SEMPRE

| Regra | Por quê |
|---|---|
| `PUT` retorna o objeto atualizado | Consistência |
| `unidadeId` em toda query de unidade | Isolamento multi-tenant |
| Rotas de unidade em `server/api/unidade/[unidadeId]/...` | Padrão de rotas multi-tenant |
| Validar `unidadeId` como safe integer > 0 | Segurança e integridade de dados |
| Placa: **sempre** UPPERCASE | Busca canônica |
| Datas: ISO string | Migração D1 |
| IDs: numéricos, auto-increment | Simplicidade + D1 |
| Funções em `server/utils/`: **async** | Pronto pra D1 |

## Padrão de Rotas

Todas as rotas de domínio operacional pertencem a uma unidade:
- **Estrutura de arquivos**: `server/api/unidade/[unidadeId]/<dominio>/...`
- **Prefixos de URL**: `/api/unidade/:unidadeId/<dominio>` (ex.: `clientes`, `veiculos`, `catalogo`, `estoque`, `os`, `caixa`, `carteiras`)
- **Parâmetros de recurso**: usar nomes semânticos, como `[clienteId]`, `[veiculoId]`, `[itemId]`, `[catalogoId]`, `[carteiraId]`, `[osId]`, `[vendaId]`, `[caixaId]`, `[agendamentoId]` e `[lancamentoId]`.
- **Extração**: usar exclusivamente `getRouterParam(event, '<nomeSemantico>')`; nunca usar regex, `pathname.match()`, `split()` ou fallback para descobrir parâmetros na URL.
- **Validação de IDs**: validar como safe integer maior que zero antes de consultar dados.
- **Rotas globais (fora de unidade)**: apenas `/api/auth/...` e `/api/admin/...`

## Checklist Backend & API

Ao criar ou atualizar endpoints e regras de servidor:

- [ ] Rota segue o padrão `server/api/unidade/[unidadeId]/<dominio>/...` (exceto auth/admin)
- [ ] Todo parâmetro dinâmico tem nome semântico; não existe `[id]` genérico
- [ ] Parâmetros são obtidos por `getRouterParam()` com o nome exato; sem regex ou fallback legado
- [ ] `unidadeId` validado e presente em toda query (multi-tenant)
- [ ] `PUT` retorna objeto atualizado (backend)
- [ ] Papel verificado no middleware e na API (PRD §3.5)
- [ ] Ação que recebe em dinheiro → API recusa sem sessão de Caixa aberta
- [ ] Mutação de estoque → via `estoque.ts`, com `MovimentoEstoque`
- [ ] Mutação que toca mais de uma entidade → dentro de `db.transaction`
- [ ] Valores em centavos e datas via `dinheiro.ts` / `datas.ts`
- [ ] Ação nova → linha correspondente na matriz PRD §3.5 e validação na API
