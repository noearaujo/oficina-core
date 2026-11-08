# 011. Separação entre `ItemCatalogo` e `ItemEstoque`

- **Status:** ✅ Aprovado
- **Data:** 05/11/2026
- **Versão de Origem:** 1.9 (revisão de consistência em 1.9.1)
- **Onde:** PRD §4.6, §4.6.3, §5.10, §5.11, ARCH §8

## Contexto
Na versão 1.7, os campos de estoque (`quantidadeAtual`, `quantidadeMinima`) estavam acoplados diretamente à entidade `ItemCatalogo`. Isso criava incoerências conceituais graves: serviços possuíam colunas de estoque vazias e o modelo impedia evoluções futuras como múltiplos depósitos ou produtos terceirizados sob encomenda.

## Decisão
1. **Catálogo Puramente Referencial:** `ItemCatalogo` volta a ser exclusivamente o cadastro mestre (código interno, nome, descrição, preço base de venda, tipo: `produto` ou `servico`).
2. **Nova Entidade `ItemEstoque`:**
   - Criada a entidade `ItemEstoque` com relação estrita de 1:1 apenas para itens de catálogo do tipo `produto`.
   - Chave estrangeira `catalogoId` com exclusão em cascata (`ON DELETE CASCADE`).
   - Mantém `quantidadeAtual` e `quantidadeMinima`.
3. **Preservação de Integridade:**
   - `MovimentoEstoque.catalogoId` é preservado (não vira `estoqueId`), garantindo estabilidade no extrato histórico.
   - `ItemOS.catalogoId` permanece como gatilho da lógica de baixa e estorno de estoque.
4. **Exceção de Performance:** O campo `ItemEstoque.quantidadeAtual` é a única exceção tolerada à regra de "valores derivados nunca são armazenados", justificada pela necessidade de leitura rápida em listagens e PDV. Qualquer mutação deve ocorrer dentro de transação atômica (`db.transaction`).
5. **Orçamento Integralmente Recusado:** Quando todos os itens do orçamento principal forem recusados, a OS permanece em `aguardando_aprovacao` e o operador utiliza as ações `[Ajustar]` ou `[Cancelar OS]`.

## Consequências
- **Positivas:** Separação limpa de domínios; catálogo leve e focado; serviços livres de campos de estoque físico; flexibilidade para modelos futuros de estoque.
- **Restrições:** Criação de novos produtos exige inserção atômica no catálogo e na tabela de estoque.
