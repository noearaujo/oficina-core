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

## SEMPRE

| Regra | Por quê |
|---|---|
| `PUT` retorna o objeto atualizado | Consistência |
| `unidadeId` em toda query de unidade | Isolamento multi-tenant |
| Placa: **sempre** UPPERCASE | Busca canônica |
| Datas: ISO string | Migração D1 |
| IDs: numéricos, auto-increment | Simplicidade + D1 |
| Funções em `server/utils/`: **async** | Pronto pra D1 |

## Checklist Backend & API

Ao criar ou atualizar endpoints e regras de servidor:

- [ ] `PUT` retorna objeto atualizado (backend)
- [ ] `unidadeId` presente em toda query (multi-tenant)
- [ ] Papel verificado no middleware e na API (PRD §3.5)
- [ ] Ação que recebe em dinheiro → API recusa sem sessão de Caixa aberta
- [ ] Mutação de estoque → via `estoque.ts`, com `MovimentoEstoque`
- [ ] Mutação que toca mais de uma entidade → dentro de `db.transaction`
- [ ] Valores em centavos e datas via `dinheiro.ts` / `datas.ts`
- [ ] Ação nova → linha correspondente na matriz PRD §3.5 e validação na API
