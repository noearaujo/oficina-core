# 008. Matriz de Permissões Ação × Role como Fonte de Verdade

- **Status:** 🟡 Proposta (endurecimento para construção)
- **Data:** 04/11/2026
- **Versão de Origem:** 1.8
- **Onde:** PRD §3.5

## Contexto
Sistemas com múltiplos perfis de usuário frequentemente sofrem com verificações de autorização descentralizadas e ad-hoc em rotas ou componentes, gerando vulnerabilidades de elevação de privilégio ou inconsistências onde a UI permite uma ação que o backend rejeita (ou vice-versa).

## Decisão
1. **Matriz Formal de Permissões:** Estabelecer a tabela ação × role do PRD §3.5 como única fonte de verdade da autorização do sistema.
2. **Definição de Papéis:**
   - `admin`: Controle global, configurações do sistema, exclusões sensíveis e gerência multi-unidade.
   - `gerente`: Gestão operacional completa da unidade, aprovações, estornos e transferências entre carteiras.
   - `recepcionista`: Abertura e acompanhamento de OS, agendamentos, atendimento a clientes e vendas PDV.
   - `mecanico`: Visualização de OS atribuída, checklist técnico e apontamento de execução.
   - `financeiro`: Operação de caixas, conciliação e relatórios financeiros.
3. **Validação na Borda da API:** Todo endpoint valida o role, a unidade ativa e a associação do usuário antes de executar a lógica de negócio.

## Consequências
- **Positivas:** Modelo de segurança transparente, fácil de auditar e testar; clareza absoluta sobre quem pode executar cada operação.
- **Restrições:** Qualquer novo endpoint ou ação na UI deve ser formalmente classificado de acordo com a matriz.
