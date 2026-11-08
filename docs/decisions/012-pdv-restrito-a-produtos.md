# 012. PDV Restrito a Produtos do Catálogo

- **Status:** ✅ Aprovado
- **Data:** 05/11/2026
- **Versão de Origem:** 1.9
- **Onde:** PRD §4.12, §8.1

## Contexto
O Ponto de Venda (PDV / Venda Balcão) foi concebido para agilizar vendas rápidas de itens de conveniência ou balcão (óleo, aditivos, lâmpadas, palhetas). Permitir venda de serviços pelo PDV gerava conflito com a rotina da oficina, na qual serviços dependem de placa do veículo, responsabilidade técnica do mecânico, checklist e histórico de garantia.

## Decisão
1. **Apenas Produtos:** A tela e o endpoint de PDV aceitam **somente produtos** cadastrados no catálogo (itens com controle físico de estoque).
2. **Serviços Exclusivos na OS:** Toda e qualquer mão de obra ou prestação de serviço deve ser processada obrigatoriamente através da abertura de uma Ordem de Serviço (OS).

## Consequências
- **Positivas:** Simplificação extrema da interface do PDV (busca rápida por código de barras ou nome de peça, cálculo de troco e fechamento); garantia de que serviços mantenham rastreabilidade de mecânico e veículo.
- **Restrições:** Clientes que desejarem realizar serviços rápidos no balcão devem ter uma OS aberta pelo atendente.
