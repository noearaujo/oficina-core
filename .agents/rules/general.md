---
paths:
  - "**/*"
---

# Regras Gerais — Oficina Core

> Extraído de `docs/CONVENTIONS.md`.

## NUNCA

| Regra | Por quê |
|---|---|
| Float para dinheiro | Sempre inteiro em centavos |
| Calcular "hoje"/período com `new Date()` direto | Usar `datas.ts` (fuso da unidade) |
| Armazenar total/saldo/badge | Sempre derivado |
| Mudar `tipo` do item de catálogo na edição | Tipo é imutável |
| Travar aprovação, conclusão ou venda por falta de saldo de estoque | Operação sem trava: só avisar (`Estoque Negativo`) |
| Permitir "Dinheiro" sem sessão de Caixa aberta | Trava de Caixa fechado (UI + API) |
| Hard delete em `lancamento` | Estorno no lugar |
| Hard delete em `MovimentoEstoque` | Correção por novo movimento |
| Acessar storage fora de `server/utils/storage.ts` | Trocar o driver (D1) sem tocar nas regras |

## SEMPRE

| Regra | Por quê |
|---|---|
| Placa: **sempre** UPPERCASE | Busca canônica |
| Datas: ISO string | Migração D1 |
| IDs: numéricos, auto-increment | Simplicidade + D1 |
| `unidadeId` em toda query de unidade | Isolamento multi-tenant |

## Regra Modal vs. Página

| Campos | Formato |
|---|---|
| ≤ 6 campos, 1 seção | **Modal** |
| ≥ 7 campos ou múltiplas seções | **Página** (`/novo` e `/[entidadeId]/editar`) |


## Identificadores e rotas

- IDs em rotas devem ter nomes semânticos e específicos da entidade (`unidadeId`, `clienteId`, `veiculoId` etc.); `[id]` genérico é proibido.
- A URL pública não muda ao renomear o identificador interno do parâmetro.
- Não interpretar caminhos manualmente para extrair IDs: frontend usa `useRoute().params`; backend usa `getRouterParam()`.
- Não manter compatibilidade artificial com nomes antigos por meio de fallbacks.
