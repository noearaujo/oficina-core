# 010. Regras para Casos de Borda do Fluxo da OS

- **Status:** 🟡 Proposta (endurecimento para construção)
- **Data:** 04/11/2026
- **Versão de Origem:** 1.8
- **Onde:** PRD §5.11

## Contexto
Durante o ciclo de vida da OS ocorrem casos atípicos que, se não possuírem regras explícitas, geram inconsistências graves nos saldos financeiros e no estoque, como cancelar uma OS que já recebeu pagamentos ou concluir ordens com itens pendentes.

## Decisão
1. **Cancelar ou Reverter com Pagamentos:** A OS não pode ser cancelada nem ter seu orçamento revertido se houver pagamentos ativos. É mandatório realizar o estorno financeiro prévio de todos os lançamentos recebidos.
2. **Conclusão com Itens Pendentes:** A OS não pode avançar para o estado `finalizada` se contiver itens em status pendente de aprovação (todos devem estar aprovados ou recusados).
3. **Pagamento Superior ao Saldo:** A API rejeita qualquer tentativa de lançamento de pagamento com valor superior ao saldo devedor restante da OS.
4. **Desconto Máximo:** O valor do desconto concedido não pode ultrapassar o subtotal da OS (o total líquido da OS nunca pode ser negativo).
5. **Item Aprovado com Erro:** Itens já aprovados não podem ser editados livremente; correções exigem a utilização do fluxo de reversão administrativa ou a criação de item compensatório com justificativa.

## Consequências
- **Positivas:** Prevenção total de estados contábeis e operacionais inconsistentes; regras transparentes para o operador em mensagens amigáveis na UI.
- **Restrições:** Exige passos administrativos formais para corrigir erros operacionais cometidos após aprovação ou recebimento.
