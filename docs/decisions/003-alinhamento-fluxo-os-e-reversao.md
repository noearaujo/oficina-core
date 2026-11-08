# 003. Alinhamento do Fluxo de OS, Complementos e Reversão

- **Status:** ✅ Aprovado
- **Data:** 04/11/2026
- **Versão de Origem:** 1.2
- **Onde:** PRD §5.7, §5.8, §5.11, §7.4

## Contexto
Na rotina de oficina mecânica, após a desmontagem do veículo é comum identificar novos problemas que demandam peças ou serviços adicionais (orçamento complementar). Além disso, clientes ou gerentes por vezes precisam reverter aprovações ou reabrir itens sem destruir a trilha de auditoria já percorrida.

## Decisão
1. **Separação de Complementos:** Itens adicionados após a aprovação inicial são marcados como complementares (`complementar: true`) e possuem ciclo próprio de validação sem alterar o status global da OS que já se encontra em execução.
2. **Inclusão Direta na Execução:** Permitir que itens sejam adicionados diretamente durante a fase de execução sem exigir que a OS retroceda para o estado de `orcamento`.
3. **Reversão Administrativa:** A ação de reverter aprovação reabre todos os itens do orçamento principal (aprovados e recusados), registrando histórico de quem realizou a reversão e o motivo.
4. **Envio de Orçamento Formal:** Registrar explicitamente o momento em que o orçamento foi enviado ao cliente (`orcamentoEnviadoEm`), limitando alterações informais após o envio.

## Consequências
- **Positivas:** Reflete com exatidão a dinâmica operacional real de oficinas; preserva integridade histórica de itens aprovados e recusados.
- **Restrições:** Cálculos de valores totais e saldos a faturar devem distinguir claramente entre itens aprovados e pendentes (tanto do orçamento base quanto dos complementos).
