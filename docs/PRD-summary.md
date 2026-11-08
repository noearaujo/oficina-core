# PRD Summary — Oficina Core

## Visão

SaaS de gestão para oficinas mecânicas de pequeno e médio porte que cobre o ciclo operacional e financeiro completo: agendamento, OS, orçamento, execução, entrega, PDV, estoque, caixa, carteiras e relatórios.
Opera sob o princípio de "operação sem trava" (estoque negativo alerta mas não bloqueia) com integridade financeira, rastreabilidade contábil e totais sempre derivados.
O tenant é o `Usuario` dono; unidades são filiais operacionais dentro do tenant. Funcionários acessam via `UsuarioUnidade` (vínculo + role).

## Features por Status

| Feature | Status |
|---|---|
| Onboarding, Auth simulada, Multi-tenant (`Usuario` = tenant, `unidadeId` = unidade operacional), 5 Roles (`owner`, `admin`, `gerente`, `mecanico`, `recepcionista`) | MVP |
| Cadastros (Clientes cross-unit, Veículos, Catálogo de produtos/serviços) e Busca unificada | MVP |
| Estoque simples (`ItemEstoque` + `MovimentoEstoque`, baixa/estorno automáticos, ajuste manual) | MVP |
| Ordem de Serviço (workflow 8 status, lotes/complementos, garantia, impressão/PNG) e PDV (venda rápida, só `tipo = 'produto'`) | MVP |
| Financeiro (`Lancamento` único, Carteiras `cofre`/`banco`, múltiplos Caixas e sessões em espécie) | MVP |
| Agenda (Dia/Semana/Mês, conversão em OS), Dashboard, Relatórios (CSV), Lixeira (soft delete) e Backup JSON/CSV | MVP |
| Auth real (argon2id/D1), Fornecedor, Recebíveis/Conciliação, Link público (`/p/[token]`), E-mail, Multi-unidade UI (schema já é multi-unidade; MVP opera com 1 unidade default), Audit log | Fase 2 |
| Nota fiscal, Lembretes (WhatsApp/SMS), Capacidade produtiva, Recorrência (revisão), MFA/SSO | Fase 3 |

## 10 Regras Críticas de Negócio

1. **Valores derivados:** Totais de OS/PDV, saldos de Carteiras/Caixas e status de pagamento são sempre calculados na leitura, nunca armazenados (única exceção: `ItemEstoque.quantidadeAtual`).
2. **Imutabilidade contábil e de estoque:** `Lancamento`, `MovimentoEstoque` e `Nota` são append-only (hard delete proibido); correções ocorrem exclusivamente via estorno ou novo movimento.
3. **Operação sem trava no estoque:** Saldo insuficiente nunca bloqueia aprovação de item na OS nem venda no PDV — gera apenas alerta visual (`Estoque Negativo`).
4. **Snapshot nos itens:** `ItemOS` congela nome, tipo, unidade e preço unitário no momento da adição; alterações ou exclusões posteriores no Catálogo não afetam OS ou vendas antigas.
5. **Baixa de estoque na aprovação:** Na OS, o estoque de produtos (`catalogoId`) só é baixado quando o item passa para `aprovado` (idempotente via `estoqueBaixado`), com estorno automático ao remover item, reverter aprovação ou cancelar OS.
6. **Separação Caixa vs. Carteiras:** `Caixa` é gaveta operacional exclusiva para espécie durante `SessaoCaixa` aberta (origem/destino sempre `Carteira` tipo `cofre`); meios digitais (`pix`, `credito`, `debito`, `boleto`) entram direto na `Carteira` tipo `banco`.
7. **Trava de espécie:** Qualquer recebimento ou pagamento em `dinheiro` exige sessão de Caixa aberta e acessível ao usuário; sem sessão aberta, UI e API recusam a operação.
8. **Workflow e travas financeiras da OS:** `aguardando_aprovacao` auto-aprova quando não restam itens pendentes no lote principal e há ≥ 1 aprovado; cancelar OS ou reverter aprovação exige pago líquido igual a zero; concluir exige zero itens pendentes (inclusive complementos).
9. **Transferências e entradas externas neutras:** Transferências internas usam 2 lançamentos pareados (`parId`) e, junto com aportes, empréstimos de sócio e sobras/quebras de caixa, não compõem receita ou despesa operacional.
10. **Segurança e escopo:** Clientes são cross-unit (escopo `usuarioId` do tenant); Veículos e demais entidades são per-unidade (escopo `unidadeId`). Toda mutação na API valida role (matriz §3.5), unidade e associação ao Caixa. `ItemCatalogo.tipo` é imutável (produto não vira serviço e vice-versa). Onboarding não seeda Carteiras — o usuário cria na tela `/carteiras`; sem Cofre ativo, Caixa não abre.

## Fora de Escopo (MVP)

- Escrituração contábil de partidas dobradas, apuração fiscal e emissão de Nota Fiscal (NF-e/NFS-e).
- Estoque fiscal/avançado (entrada por XML, custo médio, múltiplos depósitos, reserva antes da aprovação).
- Controle de recebíveis de cartão/boleto (prazos D+X, taxas automáticas de adquirente, conciliação bancária).
- Aprovação online por link público (`/p/[token]`) e envio automático por e-mail, WhatsApp ou SMS.

## Entidades, Schemas e Tipos Implementados (Código)

### 1. Cliente (`app/types/index.d.ts` e `server/utils/clientes.ts`)
- **Tipo e Campos:** `Cliente` (`id`, `usuarioId`, `nome`, `nomeBusca`, `tipoPessoa`, `cpf`, `razaoSocial`, `nomeFantasia`, `cnpj`, `telefone`, `email`, `endereco`, `deletedAt`, `dataCriacao`, `dataAtualizacao`).
- **Endereço Estruturado (`Endereco` / `enderecoSchema`):** `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `estado` (strings com trim e defaults vazios).
- **Validações Zod (`clienteSchema`):**
  - `usuarioId`: inteiro positivo (default 1), escopo tenant cross-unit.
  - `tipoPessoa`: enum `fisica` ou `juridica`.
  - Validação condicional: PF exige `cpf`; PJ exige `razaoSocial` e `cnpj`.
  - `telefone`: obrigatório, mínimo de 8 caracteres.
  - `email`: formato válido de e-mail ou string vazia.
  - `nomeBusca`: gerado automaticamente via transform com `stripAccents(nome).toLowerCase()`.
- **Helpers e Vínculos:**
  - `stripAccents`: normalização NFD para busca sem diacríticos.
  - `somenteNumeros`: extração de dígitos numéricos.
  - `VeiculoVinculo`: interface de vínculo com `deletedAt` para integridade referencial.

### 2. Veículo (`app/types/index.d.ts` e `server/utils/veiculos.ts`)
- **Tipo e Campos:** `Veiculo` (`id`, `unidadeId`, `clienteId`, `tipo`, `marca`, `modelo`, `versao`, `placa`, `anoFabricacao`, `anoModelo`, `cor`, `combustivel`, `quilometragem`, `chassi`, `deletedAt`, `dataCriacao`, `dataAtualizacao`).
- **Validações Zod (`veiculoSchema`):**
  - `clienteId`: inteiro positivo obrigatório (vínculo com cliente).
  - `placa`: normalizada via `normalizarPlaca` (maiúsculas e alfanumérico) e validada por regex (formato tradicional ou Mercosul: `^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$`).
  - Validação cruzada: `anoModelo` não pode ser anterior a `anoFabricacao`.
  - `quilometragem`: preprocessado para undefined se vazio/nulo; inteiro `>= 0`.
  - `tipo`, `marca`, `modelo`: obrigatórios.
  - `versao`, `cor`, `combustivel`, `chassi`: opcionais com default vazio.
  - Soft delete via `deletedAt`.

### 3. Catálogo (`app/types/index.d.ts` e `server/utils/catalogo.ts`)
- **Tipo e Campos:** `ItemCatalogo` (`id`, `unidadeId`, `nome`, `nomeBusca`, `tipo`, `sku`, `descricao`, `preco`, `custo`, `unidade`, `dataCriacao`, `dataAtualizacao`).
- **Validações Zod (`catalogoSchema`):**
  - `tipo`: enum `servico` ou `produto` (imutável).
  - `preco`: inteiro em centavos (`min(0)`).
  - `custo`: opcional, preprocessado e validado como inteiro em centavos (`min(0)`).
  - `sku`: obrigatório/opcional para produto e limpo automaticamente para string vazia quando `tipo === 'servico'`.
  - `nomeBusca`: gerado automaticamente via `stripAccents(nome).toLowerCase()`.
- **Unidades de Medida Padronizadas (`unidades`):**
  - `un` (Unidade), `jogo` (Jogo), `par` (Par), `h` (Hora), `litro` (Litro), `m` (Metro), `kg` (Quilo), `pca` (Peça).

### 4. Storage Adapter (`server/utils/storage.ts`)
- **Persistência:** Arquivos JSON locais no diretório `.data/` (`.data/[collection].json`).
- **Interface Base:** `StorageRecord` (`id: number`, `unidadeId: number`).
- **Operações:** `list`, `get`, `insert`, `update`, `delete` / `remove` sob o objeto `db`.
- **Isolamento Multi-tenant:** Filtro automático por `unidadeId` (registros com `unidadeId === undefined` ou correspondente à unidade).
- **Auto-incremento:** IDs sequenciais baseados em `max(id) + 1`.
- **Controle de Concorrência:** `transaction<T>` com serialização por lock em memória (`transactionLock`).

### 5. Tipos de UI e Template (`app/types/index.d.ts`)
- `User` (`id`, `name`, `email`, `avatar`, `status`, `location`) e `UserStatus` (`subscribed` | `unsubscribed` | `bounced`).
- `Member` (`name`, `username`, `role: 'member' | 'owner'`, `avatar`).
- `Stat` (`title`, `icon`, `value`, `variation`, `formatter`).
- `Sale` (`id`, `date`, `status`, `email`, `amount`) e `SaleStatus` (`paid` | `failed` | `refunded`).
- `Notification` (`id`, `unread`, `sender`, `body`, `date`).
- `Period` (`daily` | `weekly` | `monthly`) e `Range` (`start: Date`, `end: Date`).
