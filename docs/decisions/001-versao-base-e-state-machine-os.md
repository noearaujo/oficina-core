# 001. Versão-base, Entidades e State Machine da OS

- **Status:** ✅ Aprovado
- **Data:** 04/11/2026
- **Versão de Origem:** 1.0 / 1.2
- **Onde:** PRD §3, §4, §5, §6, §7

## Contexto
O Oficina Core necessita de uma fundação arquitetural que modele com precisão a operação de uma oficina mecânica: gestão de clientes, veículos, catálogo de serviços/peças, fluxo completo de Ordens de Serviço (OS), operações de caixa e financeiro unificado em modelo multi-tenant.

## Decisão
1. **Entidades Fundamentais:** Estabelecer as entidades mestre `Cliente`, `Veiculo`, `ItemCatalogo`, `OS`, `ItemOS`, `Lancamento`, `SessaoCaixa`, `Carteira`, `Agendamento` e `Usuario`.
2. **State Machine da OS:** Definir a máquina de estados finita da OS como motor central do sistema:
   - Estados: `orcamento`, `aprovada`, `em_andamento`, `aguardando_peca`, `finalizada`, `entregue`, `cancelada`.
3. **Financeiro Unificado:** Centralizar todas as movimentações financeiras na entidade `Lancamento`, associada à unidade, categoria, carteira e sessão de caixa.
4. **Multi-tenant e RBAC:**
   - Multi-tenant obrigatório por `unidadeId` em toda query e entidade.
   - Autenticação e matriz de papéis com 5 roles principais: `admin`, `gerente`, `recepcionista`, `mecanico` e `financeiro`.

## Consequências
- **Positivas:** Fluxo de oficina padronizado e auditável; modelo financeiro consistente sem dispersão de regras; suporte nativo a redes e franquias por isolamento por unidade.
- **Restrições:** Transições de estado da OS exigem validação rigorosa de pré-condições na API; toda consulta e escrita deve garantir isolamento de tenant.
