# 002. Carteiras Financeiras (Cofre/Banco) e Abas da OS

- **Status:** ✅ Aprovado
- **Data:** 04/11/2026
- **Versão de Origem:** 1.1
- **Onde:** PRD §4.10, §4.11, §17.2

## Contexto
O controle financeiro de uma oficina envolve dinheiro físico em gaveta/cofre e recebimentos eletrônicos em contas bancárias. Adicionalmente, a tela de detalhe da Ordem de Serviço reunia muitas informações sem segregação clara de responsabilidades, prejudicando a usabilidade da recepção e mecânicos.

## Decisão
1. **Consolidação de Carteiras:** Formalizar a entidade `Carteira` com categorização obrigatória por tipo:
   - `cofre`: Representa dinheiro físico (gaveta/cofre da unidade).
   - `banco`: Representa contas correntes, contas digitais ou carteiras bancárias.
2. **Estrutura de Detalhe da OS:** Organizar a visualização e operação da OS em abas dedicadas:
   - **Resumo:** Visão geral, dados do veículo e cliente, status e datas.
   - **Orçamento:** Gestão de itens, serviços, peças, valores e aprovações.
   - **Faturamento:** Gestão de pagamentos, parcelas, carteiras e recibos.

## Consequências
- **Positivas:** Rastreabilidade clara de onde o recurso financeiro entra e sai; interface da OS segmentada por etapas operacionais e financeiras.
- **Restrições:** Pagamentos exigem associação inequívoca com a carteira de destino de acordo com o método de pagamento.
