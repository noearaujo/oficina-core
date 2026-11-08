# 013. Carteiras como Módulo Próprio e Regras de Integridade

- **Status:** ✅ Aprovado
- **Data:** 05/11/2026
- **Versão de Origem:** 1.10 (ajuste em 1.10.1)
- **Onde:** PRD §3.5, §4.11, §7.3, §15.1, §17.2, ARCH §4.1, ARCH §8

## Contexto
Originalmente, as Carteiras eram configuradas dentro de uma aba secundária de Ajustes/Configurações (`/settings`). Essa abordagem obscurecia operações financeiras diárias como transferências entre contas e despesas diretas. Além disso, a exclusão de uma carteira que continha lançamentos passados ou sessões ativas de caixa corria o risco de violar integridade relacional.

## Decisão
1. **Módulo de Primeiro Nível:** Carteiras passa a ter sua própria rota e tela dedicada (`/carteiras`), fora das configurações gerais.
2. **Onboarding Limpo:** O fluxo de onboarding inicial não cria (seed) carteiras automaticamente, permitindo que a oficina configure suas contas reais.
3. **Níveis de Permissão:**
   - Criar, renomear, transferir, registrar despesas e entradas: Perfil **Gerente ou superior (G+)**.
   - Excluir carteira: Exclusivo para **Administrador (A+)**.
4. **Proteção e Integridade na Exclusão:**
   - Se houver sessão de caixa aberta associada à carteira, a exclusão é estritamente **bloqueada**.
   - Lançamentos financeiros associados à carteira excluída têm o campo `carteiraId` atualizado para `NULL` mediante confirmação do usuário (`ON DELETE SET NULL`).
5. **Renomeação Segura:** Renomear carteira não possui guards impeditivos, pois as associações com lançamentos ocorrem por chave primária (ID imutável).
6. **Dependência para Abertura de Caixa:** A unidade que não possuir ao menos uma carteira ativa do tipo `cofre` não pode abrir sessões de caixa (exibe empty state orientador na tela).
7. **Schema Relacional:** Aplicar `ON DELETE SET NULL` nas chaves estrangeiras `lancamentos.carteira_id` e `sessoes_caixa.carteira_origem_id`.

## Consequências
- **Positivas:** Gestão financeira ágil e acessível; proteção contra quebra de integridade referencial ou perda de dados contábeis em lançamentos históricos.
- **Restrições:** Telas e relatórios que exibem lançamentos devem tratar graciosamente o caso em que `carteiraId` for `NULL`.
