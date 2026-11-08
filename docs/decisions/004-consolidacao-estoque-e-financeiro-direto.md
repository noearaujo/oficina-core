# 004. Consolidação de Estoque Simples, Financeiro Direto e Trava de Caixa

- **Status:** ✅ Aprovado
- **Data:** 04/11/2026
- **Versão de Origem:** 1.7 (consolidação de 1.3–1.6)
- **Onde:** PRD §4.6, §4.8, §4.10, §5.10, §6, §7.4, §13.5

## Contexto
As versões 1.3 a 1.6 continham proposições parciais divergentes a respeito de baixa de estoque, compensação bancária e segurança de operações com dinheiro. Era necessário unificar o modelo e sanar contradições antes do início do desenvolvimento.

## Decisão
1. **Estoque Simples:** Controle físico de estoque para produtos com saldo mantido na unidade; duas visões no front: `/catalogo` (gestão cadastral) e `/estoque` (gestão de saldos).
2. **Ciclo de Baixa e Estorno:**
   - `ItemOS.catalogoId` opcional com flag `estoqueBaixado`.
   - Baixa do estoque acionada no momento do aceite/aprovação do item.
   - Suporte a estorno e safe fallback (itens sem saldo não quebram o fluxo, alertando o operador).
   - Suporte a baixa de peça em garantia com valor monetário de R$ 0,00.
3. **Financeiro Direto:** Recebimentos via Pix, cartão de débito, cartão de crédito e boleto creditam imediatamente na carteira de destino (sem controle de compensação D+X ou adquirente no MVP).
4. **Trava de Dinheiro:** Qualquer recebimento ou sangria/despesa em espécie (`dinheiro`) exige obrigatoriamente uma sessão de Caixa aberta na unidade. A UI desabilita a opção e a API recusa a transação.
5. **Retirada Rápida:** Criar a operação simplificada de `retirada_rapida` no Caixa para saídas emergenciais ou pequenas compras locais.
6. **Exportação CSV Contábil:** Exportação de OS e lançamentos em formato CSV estruturado com separador `;` e codificação UTF-8 BOM para consumo direto por contabilidade e Excel pt-BR.

## Consequências
- **Positivas:** Modelo financeiro simples e assertivo para o MVP sem a sobrecarga de conciliação bancária; eliminação do risco de desvios operacionais com dinheiro em espécie sem caixa aberto.
- **Restrições:** Taxas de operadora de cartão de crédito não são deduzidas automaticamente (devem ser lançadas manualmente na categoria `taxa_adquirente`).
