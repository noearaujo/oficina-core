# 015 — Parâmetros semânticos nas rotas

- **Status:** Aprovado
- **Data:** 10/11/2026
- **Escopo:** `app/pages`, `server/api`, composables, layouts e documentação

## Contexto

O projeto utiliza o mesmo parâmetro dinâmico `[id]` em segmentos aninhados, especialmente no contexto `/unidade/[id]/...`. Isso cria ambiguidade entre o identificador da unidade e o identificador do recurso. Como consequência, páginas e endpoints passaram a interpretar manualmente `route.path` ou `pathname` com regex e a manter fallbacks entre nomes diferentes.

## Decisão

Todos os parâmetros dinâmicos devem possuir nomes semânticos que identifiquem a entidade. Exemplos: `[unidadeId]`, `[clienteId]`, `[veiculoId]`, `[osId]`, `[vendaId]`, `[carteiraId]`, `[itemId]`, `[catalogoId]`, `[caixaId]`, `[agendamentoId]` e `[lancamentoId]`.

- Frontend obtém parâmetros com `useRoute().params.<nomeSemantico>`.
- Backend obtém parâmetros com `getRouterParam(event, '<nomeSemantico>')`.
- É proibido extrair parâmetros por regex, `split()` ou inspeção manual de `route.path`/`pathname`.
- É proibido manter fallbacks para nomes antigos ou IDs presumidos.
- IDs numéricos devem continuar sendo validados como safe integer maior que zero.
- A autorização e o isolamento multi-tenant continuam sendo verificados no servidor; a presença de `unidadeId` na URL não autoriza acesso.
- A alteração do nome interno do parâmetro não altera a URL pública.

## Consequências

As rotas ficam inequívocas, o código deixa de depender da estrutura textual da URL e futuras páginas/endpoints seguem um padrão verificável. Qualquer novo recurso deve seguir esta decisão.
