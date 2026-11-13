# 016. Sync por Polling + 304 Not Modified

- **Status:** ✅ Aprovada
- **Data:** 13/11/2026
- **Versão de Origem:** 1.10.2
- **Onde:** ARCH §8 (coluna `last_modified`), PRD §4.2

## Contexto
O SaaS é multi-usuario (5+ pessoas na mesma oficina). Com `ssr: false`, o client precisa de frescor para ver mudanças de outros usuarios. Polling agressivo (5s) gera custo desnecessario no D1. Push real (WebSocket/SSE) adiciona complexidade desproporcional para o escopo do MVP.

## Decisao
1. **Polling 30s** em telas ativas (listas, dashboard, detalhe de OS). Pausa com `document.visibilityState !== 'visible'`.
2. **`unidades.last_modified`** — 1 campo ISO que e bumpado a cada write em qualquer tabela da unidade.
3. **304 Not Modified** — endpoints aceitam header `If-Modified-Since`. Se `last_modified <= If-Modified-Since`, responde 304 (zero rows lidas das tabelas de dados).
4. **Refetch after action** — o usuario que agiu recebe o estado atualizado na resposta da API (0s).
5. **Conflito real** — validacao na API (409/400). O client mostra toast e faz `refresh()`.
6. **Sem WebSocket, SSE ou Durable Object** no MVP. Reavaliar na Fase 2 se a UX exigir push real.

## Consequencias
- ~75% reducao de reads no D1 vs. polling sem 304 (5 usuarios: ~72K rows/dia vs. ~288K).
- Frescor: <=30s para mudancas de outros usuarios.
- Acao propria: 0s (refetch imediato).
- Custo: 1 coluna + 1 check no topo do handler + 1 header. ~10 linhas por endpoint.
- Nao altera a interface do adapter (`storage.ts`) nem os utils de negocio.

## Alternativas rejeitadas
| Abordagem | Motivo da rejeicao |
|---|---|
| KV como version counter | KV free tier (100K reads/dia) estoura com 50+ usuarios. D1 ja e mais barato por read. |
| Edge cache (Cache API) | Requests autenticados nao sao cacheados por padrao. Complexidade alta, ganho zero com 5 usuarios. |
| SSE + Durable Object | Nao reduz reads (so muda o timing). Adiciona DO, reconexao, heartbeat, auth no stream. |
| Sem polling (so visibilitychange) | Perde frescor. Pior UX para tool colaborativa de oficina. |
