# 014. Redesenho da Tela de Detalhe da OS (Tabs, Resumo, Histórico e Edição)

- **Status:** ✅ Aprovado
- **Data:** 07/11/2026
- **Versão de Origem:** 1.10.2
- **Onde:** PRD §5.11, §17.3, CONVENTIONS.md

## Contexto
A experiência de uso da tela de detalhe da OS acumulou complexidade: botões de ação estavam descentralizados, as abas verticais ou concorrentes ocupavam espaço excessivo, o histórico de notas manuais era propenso a inconsistências e faltavam regras estritas quanto ao que podia ser editado em itens já adicionados.

## Decisão
1. **Tabs Horizontais Estilo Pill:** A navegação interna do detalhe da OS passa a utilizar tabs horizontais com estilo `pill` (`Resumo`, `Orçamento`, `Execução`, `Faturamento`).
2. **Ações de Transição Padronizadas:** Todos os botões primários de mudança de status da OS (ex: [Enviar Orçamento], [Aprovar], [Iniciar Execução], [Finalizar], [Entregar]) residem exclusivamente no slot `#right` da `UDashboardNavbar`.
3. **Tab Resumo em 4 Cards:** A aba de resumo passa a consolidar a visão da OS em exatamente 4 cards temáticos (Dados do Cliente/Veículo, Situação Operacional, Resumo Financeiro, Prazos/Responsáveis).
4. **Histórico Compacto:** Substituição da área livre de anotações ("Notas") por um Histórico compacto automatizado de auditoria:
   - Registra transições de status, envios, aprovações e reversões.
   - Sem campo aberto para inserção manual solta.
   - Exibe o papel (`role`) do usuário responsável pelo evento.
5. **Regras de Edição de Itens:**
   - A edição de um item existente é estritamente restrita a **Quantidade** e **Preço Unitário**.
   - Alteração de descrição ou produto requer exclusão e nova adição.
   - Edição bloqueada conforme a combinação de `orcamentoEnviado` e o `status` atual da OS/item.

## Consequências
- **Positivas:** Interface moderna, limpa e padronizada; ações de transição em local previsível; redução radical de erros operacionais e fraudes em itens orçados.
- **Restrições:** Menor flexibilidade para anotações livres não estruturadas; pequenas correções de descrição exigem reinserção do item.
