# 005. Extrato de Estoque Append-Only (`MovimentoEstoque`)

- **Status:** ✅ Aprovado
- **Data:** 04/11/2026
- **Versão de Origem:** 1.7
- **Onde:** PRD §4.6.1, §5.10

## Contexto
Manter apenas o saldo numérico atual em cada item impedia a realização de auditorias, inviabilizava conferências de inventário e aumentava o risco de divergências silenciosas quando ocorriam baixas, ajustes e estornos em concorrência.

## Decisão
1. **Extrato Append-Only:** Criar a entidade `MovimentoEstoque` como uma trilha estritamente append-only (somente inserções, nunca mutação ou deleção).
2. **Rastreabilidade Completa:** Todo movimento registra:
   - Identificador do item de catálogo/estoque (`catalogoId`).
   - Unidade (`unidadeId`).
   - Tipo de movimento (`entrada_manual`, `saida_manual`, `baixa_os`, `estorno_os`, `baixa_pdv`, `ajuste_inventario`).
   - Quantidade e saldo resultante.
   - Referência de origem (`osId`, `vendaId` ou `ajusteId`).
   - Usuário responsável, data/hora UTC e observação opcional.
3. **Idempotência de Baixas e Estornos:** Operações de baixa de OS e estorno são validadas contra o histórico de movimentos para impedir baixas ou devoluções duplicadas.

## Consequências
- **Positivas:** Rastreio histórico minucioso de cada peça que entrou ou saiu da oficina; resolução rápida de divergências físicas de estoque.
- **Restrições:** O saldo não pode ser alterado por simples UPDATE no registro de estoque sem a criação correspondente de um `MovimentoEstoque`.
