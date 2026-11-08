# 006. Storage em Camada Única e Transações Atômicas

- **Status:** 🟡 Proposta (endurecimento para construção)
- **Data:** 04/11/2026
- **Versão de Origem:** 1.8
- **Onde:** ARCH §2, PRD §3.5

## Contexto
O MVP necessita rodar com extrema agilidade em ambiente local de desenvolvimento utilizando armazenamento em arquivo JSON, ao mesmo tempo em que a arquitetura deve suportar migração direta para Cloudflare D1 em produção sem alteração nas regras de negócio e nos contratos de endpoints.

## Decisão
1. **Camada Única de Acesso:** Centralizar todo o acesso a dados no adapter `server/utils/storage.ts` (`db.list`, `db.get`, `db.insert`, `db.update`, `db.transaction`). É expressamente proibido acessar arquivos ou banco fora desta camada.
2. **Espelhamento Relacional:** A estrutura de coleções no adapter espelha diretamente as tabelas do Cloudflare D1, dispensando transformações ou mapeamentos complexos na virada de ambiente.
3. **Transações com Lock:** Fornecer suporte a `db.transaction` com trava de concorrência para garantir que qualquer mutação envolvendo mais de uma entidade ocorra atomicamente (ex: baixa de OS com lançamento e movimento de estoque).
4. **Versionamento e Migrações:** Suporte a `schemaVersion` com execução ordenada de migrations para evolução contínua dos dados.

## Consequências
- **Positivas:** Desacoplamento do motor de persistência; garantia de consistência relacional e transacional; transição suave para Cloudflare D1.
- **Restrições:** Nenhuma regra de negócio ou endpoint pode manipular persistência diretamente sem passar pelo adapter.
