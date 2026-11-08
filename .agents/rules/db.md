---
paths:
  - "server/utils/**"
  - ".data/**"
---

# Convenções de Banco de Dados e Storage — Oficina Core

> Extraído de `docs/CONVENTIONS.md`.

## NUNCA

| Regra | Por quê |
|---|---|
| Hard delete em `lancamento` | Estorno no lugar |
| Armazenar total/saldo/badge | Sempre derivado |
| Alterar `ItemEstoque.quantidadeAtual` fora de `server/utils/estoque.ts` | Todo saldo muda junto com um `MovimentoEstoque` |
| Hard delete em `MovimentoEstoque` | Correção por novo movimento |
| Acessar storage fora de `server/utils/storage.ts` | Trocar o driver (D1) sem tocar nas regras |
| Float para dinheiro | Sempre inteiro em centavos |
| Calcular "hoje"/período com `new Date()` direto | Usar `datas.ts` (fuso da unidade) |

## SEMPRE

| Regra | Por quê |
|---|---|
| Datas: ISO string | Migração D1 |
| IDs: numéricos, auto-increment | Simplicidade + D1 |
| Funções em `server/utils/`: **async** | Pronto pra D1 |
| `unidadeId` em toda query de unidade | Isolamento multi-tenant |
| Baixa/estorno via `estoque.ts`, com `estoqueBaixado` como idempotência | Sem baixa ou estorno em duplicidade |
| Safe fallback no estorno (produto inexistente não derruba a operação) | OS antiga nunca quebra |

## Checklist Dados & Storage

- [ ] `unidadeId` presente em toda query (multi-tenant)
- [ ] Mutação de estoque → via `estoque.ts`, com `MovimentoEstoque`
- [ ] Mutação que toca mais de uma entidade → dentro de `db.transaction`
- [ ] Valores em centavos e datas via `dinheiro.ts` / `datas.ts`
- [ ] Acesso ao storage exclusivamente via `server/utils/storage.ts`
- [ ] Funções em `server/utils/`: **async**
