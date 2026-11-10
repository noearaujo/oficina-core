# PRD — Oficina Core

> **Produto:** SaaS de gestão para oficinas mecânicas
> **Versão:** 1.10.2 · 07/11/2026
> **Status:** Consolidado
> **Histórico e notas de consolidação:** ver `DECISIONS.md`

---

## 1. Visão Geral

### 1.1 Propósito

Sistema de gestão para oficinas mecânicas de pequeno e médio porte. Cobre o ciclo completo: agendamento → OS → orçamento → execução → entrega → faturamento → caixa → relatórios.

### 1.2 Princípios

| Princípio | Implicação |
|---|---|
| **Base sólida** | MVP não é "corte". É o mínimo para tocar uma oficina sem criar nada às pressas. Features futuras incrementam, não reescrevem |
| **Operação sem trava** | O sistema apoia e registra, nunca bloqueia a oficina por causa de estoque: peça sem saldo avisa (`Estoque Negativo`), mas a OS/venda segue. Vale para estoque e fluxo da OS; a integridade financeira (saldo negativo, sessão fechada) continua validada |
| **1 writer** | O servidor é a única fonte de verdade. Zero geração de ID no client |
| **Derivado > Armazenado** | Total, saldo financeiro, badge, faturamento: sempre calculados na leitura. Zero dado obsoleto. **Única exceção:** `ItemEstoque.quantidadeAtual`, gravado junto com cada `MovimentoEstoque` |
| **Movimentação rastreável** | Todo movimento financeiro é registrado uma única vez em `lancamento`, vinculado a uma Carteira ou a uma sessão de Caixa. Transferências têm origem e destino explícitos |
| **Snapshot + rastreio** | Item da OS copia nome, unidade e preço do catálogo e guarda `catalogoId` opcional (só para baixa de estoque). Catálogo muda ou é apagado, a OS antiga não quebra |
| **Estoque rastreável** | Saldo físico (ItemEstoque) muda só por função de estoque, sempre acompanhado de um MovimentoEstoque. Baixa no aceite do item; estorno em remoção, reversão e cancelamento |
| **Financeiro direto** | Pix, crédito, débito e boleto creditam direto na Carteira banco, sem prazos nem compensação no MVP. Dinheiro exige sessão de Caixa aberta |
| **Migração sem perda** | Storage do MVP → D1 sem backfill nem transformação: coleções espelham as tabelas, dinheiro em centavos, datas ISO UTC, IDs numéricos, `schemaVersion` |

### 1.3 O que é MVP

Tudo que uma oficina precisa para **operar diariamente** sem depender de papel, planilha ou sistema externo.

### 1.4 O que NÃO é MVP

| Item | Quando | Por quê |
|---|---|---|
| Estoque avançado / fiscal (entrada por NF-e/XML, custo médio, multi-depósito, inventário, reserva na aprovação) | Fase 2 | Depende de Fornecedor e Nota Fiscal. O **estoque simples** (saldo por produto, baixa/estorno automáticos, ajuste manual) é MVP |
| Fornecedor | Fase 2 | Sem compra fiscal, compra de peça é lançamento com categoria e a entrada de estoque é manual |
| Recebíveis de cartão/boleto (D+X, taxa, compensação, conciliação) | Fase 2 | No MVP creditam direto no Banco. O saldo do Banco no sistema pode divergir do extrato real até existir conciliação |
| Link público (`/p/[token]`) | Fase 2 | Precisa de D1 + SSR |
| Envio do orçamento por e-mail | Fase 2 | Precisa de provedor de e-mail. No MVP: impressão/PDF e imagem (WhatsApp manual) |
| Multi-unidade (UI) | Fase 2 | Schema pronto, UI é 1 seletor |
| MFA / SSO / Google | Fase 3 | Hardening |
| Audit log | Fase 2 | 1 tabela + INSERT em mutation |
| Nota fiscal | Fase 3 | Integração externa |
| Lembretes (WhatsApp/SMS) | Fase 3 | Integração externa |
| Capacidade de produção | Fase 3 | Multi-mecânico + slots |
| Recorrência (revisão 10k) | Fase 3 | Depende de histórico de km |

---

## 2. Multi-tenant

### 2.1 Modelo

```
Usuario (tenant/dono)
├── Unidade 1 (Oficina A)
│   ├── Veículos, OS, Lançamentos, Carteiras, Caixas, Catálogo/Estoque, Funcionários
├── Unidade 2 (Oficina B)
│   ├── Veículos, OS, Lançamentos, Carteiras, Caixas, Catálogo/Estoque, Funcionários
└── Clientes (cross-unit — compartilhados entre unidades)
```

### 2.2 Escopo por entidade

| Entidade | Escopo | Campo |
|---|---|---|
| `Usuario` | Tenant | `id` |
| `Unidade` | Tenant | `usuarioId` (FK → dono) |
| `UsuarioUnidade` | Tenant | `usuarioId` + `unidadeId` + `role` |
| `Cliente` | **Tenant** (cross-unit) | `usuarioId` |
| `Veiculo` | Unidade | `unidadeId` |
| `ItemCatalogo` (catálogo) | Unidade | `unidadeId` |
| `ItemEstoque` (Estoque) | Unidade | `unidadeId` |
| `MovimentoEstoque` | Unidade | `unidadeId` |
| `OrdemServico` | Unidade | `unidadeId` |
| `ItemOS` | Unidade | via `osId` |
| `Nota` | Unidade | via `osId` |
| `EnvioOrcamento` | Unidade | `unidadeId` + `osId` |
| `Lancamento` | Unidade | `unidadeId` |
| `Carteira` | Unidade | `unidadeId` |
| `Caixa` | Unidade | `unidadeId` |
| `SessaoCaixa` | Unidade | via `caixaId` |
| `CaixaUsuario` | Unidade | via `caixaId` + `usuarioUnidadeId` |
| `Venda` | Unidade | `unidadeId` |
| `Agendamento` | Unidade | `unidadeId` |
| `Config` | Unidade | `unidadeId` |
| `Fornecedor` | Unidade (futuro) | `unidadeId` |

### 2.3 Rotas

```
/                          → Painel admin (dono do tenant)
/unidade/[unidadeId]/             → Painel da oficina
```

### 2.4 MVP (single unidade)

`unidadeId` existe no schema, default `1`. UI não mostra seletor de unidade. Quando o tenant criar a 2ª unidade, o campo já está lá.

---

## 3. Autenticação e Autorização

### 3.1 MVP (simulada)

| Aspecto | Implementação |
|---|---|
| Login | Tela com email + senha. Aceita qualquer senha (ou "123456") |
| Cookie | `__Host-session` (HttpOnly, Secure, SameSite=Lax), 30 min |
| Claims | `{ userId, unidadeId, papel }` |
| Middleware | Checa cookie em toda rota. Sem cookie → `/login` |
| Route guard | `/lixeira`, `/configuracoes`, `/admin/*` → checa papel |
| Refresh | Silencioso a cada 25 min (SPA chama `POST /api/auth/refresh`) |
| Troca de unidade | `POST /api/auth/switch-unidade` → re-emite cookie |
| Logout | `POST /api/auth/logout` → apaga cookie |

### 3.2 Fase 2 (real)

| Aspecto | Implementação |
|---|---|
| Senha | argon2id (`@node-rs/argon2`). Coluna `Usuario.senhaHash` já existe |
| Login | Turnstile + rate limit KV (5/IP/15min) |
| Sessão | D1.sessions (revogação instantânea) |
| Ações sensíveis | Checam D1.sessions → revogação imediata |

### 3.3 Roles

A autorização é sempre feita pelos **5 roles** abaixo (a state machine da OS depende deles).

| Role | Permissões |
|---|---|
| `owner` | Tudo (inclui billing, gerenciar unidades, gerenciar usuários) |
| `admin` | Tudo dentro da unidade (CRUD em tudo, relatórios, config) |
| `gerente` | OS (todas), Caixa (consultar/abrir/movimentar/fechar todos), Relatórios (ver e exportar CSV), Clientes (CRUD), Veículos (CRUD), Catálogo (CRUD), Estoque (ver e ajustar), Lixeira; não gerencia cadastro/associações de Caixas, Carteiras nem backup |
| `mecanico` | OS (ver, iniciar diagnóstico, adicionar itens, concluir), Clientes (ver), Veículos (ver), Catálogo e Estoque (ver), Agenda (ver). Sem operação financeira |
| `recepcionista` | OS (criar, ver, imprimir), PDV, Clientes (CRUD), Veículos (CRUD), Catálogo e Estoque (ver), Caixa (consultar/abrir/movimentar/fechar, inclusive Retirada Rápida, somente Caixas associados), Agenda (criar) |

**Perfis de acesso (agrupamento de menus/navegação, MVP):**

| Perfil | Roles | O que a UI mostra |
|---|---|---|
| **Administração / Dono** | `owner`, `admin`, `gerente` | Todos os menus operacionais + Relatórios, Lixeira, ajuste de Estoque. Configurações (Carteiras, Caixas, funcionários, backup): somente `owner`/`admin` |
| **Operacional / Balcão** | `mecanico`, `recepcionista` | OS, Clientes, Veículos, Agenda, Catálogo/Estoque (consulta); `recepcionista` também PDV e Caixa associado. Sem Relatórios financeiros, Lixeira nem Configurações |

**Regra:** perfil define só o que aparece no menu. Toda mutação é validada na API pelo role, pela unidade e (no Caixa) pela associação; esconder botão não é controle de segurança. A matriz da **3.5** é a fonte de verdade; em caso de conflito com a tabela acima, vale a 3.5.

### 3.4 Gestão de usuários

| Onde | O que pode fazer |
|---|---|
| Painel admin (`/usuarios`) | CRUD completo (criar, editar role, desativar) |
| Painel unidade (`/configuracoes?tab=funcionarios`) | Ver lista, desativar (remover da unidade) |

### 3.5 Matriz de permissões por ação

`G+` = gerente, admin, owner · `A+` = admin, owner. `mecanico` e `recepcionista` **não** formam hierarquia entre si.

| Ação | owner | admin | gerente | mecanico | recepcionista |
|---|---|---|---|---|---|
| **OS** — ver / imprimir | ✅ | ✅ | ✅ | ✅ | ✅ |
| Criar OS | ✅ | ✅ | ✅ | — | ✅ |
| Editar campos da OS | ✅ | ✅ | ✅ | só diagnóstico | ✅ |
| Iniciar diagnóstico | ✅ | ✅ | ✅ | ✅ | — |
| Adicionar / editar / remover item | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aplicar desconto | ✅ | ✅ | ✅ | — | — |
| Enviar orçamento · Ajustar | ✅ | ✅ | ✅ | — | ✅ |
| Aprovar / recusar item · Aprovar todos | ✅ | ✅ | ✅ | — | ✅ |
| Iniciar execução · Concluir | ✅ | ✅ | ✅ | ✅ | — |
| Entregar | ✅ | ✅ | ✅ | — | ✅ |
| Cancelar OS · Excluir OS (soft) | ✅ | ✅ | ✅ | — | — |
| Reverter aprovação | ✅ | ✅ | — | — | — |
| **Cadastros** — ver Clientes, Veículos, Catálogo, Estoque, Agenda | ✅ | ✅ | ✅ | ✅ | ✅ |
| Criar/editar Cliente, Veículo | ✅ | ✅ | ✅ | — | ✅ |
| Excluir Cliente, Veículo (soft) | ✅ | ✅ | ✅ | — | — |
| Criar/editar/excluir item de Catálogo | ✅ | ✅ | ✅ | — | — |
| Ajustar Estoque | ✅ | ✅ | ✅ | — | — |
| Agenda: criar, remarcar, cancelar, converter | ✅ | ✅ | ✅ | — | ✅ |
| **PDV** — vender | ✅ | ✅ | ✅ | — | ✅ |
| **Financeiro** — lançar pagamento (OS/venda)¹ | ✅ | ✅ | ✅ | — | ✅ |
| Estornar lançamento · registrar devolução | ✅ | ✅ | ✅ | — | — |
| Despesa em Carteira · transferir entre Carteiras | ✅ | ✅ | ✅ | — | — |
| Aporte / empréstimo de sócio | ✅ | ✅ | — | — | — |
| Editar `data` de lançamento | ✅ | ✅ | — | — | — |
| Caixa: consultar/abrir/movimentar/fechar (inclui Retirada Rápida) | todos | todos | todos | — | só associados |
| Cadastrar Caixa, associar usuários | ✅ | ✅ | — | — | — |
| Gerenciar Carteiras (criar, renomear, transferir, despesa, entrada) | ✅ | ✅ | ✅ | — | — |
| Excluir Carteira | ✅ | ✅ | — | — | — |
| **Relatórios** — ver e exportar CSV | ✅ | ✅ | ✅ | — | — |
| Lixeira — restaurar / excluir definitivo | ✅ | ✅ | ✅ | — | — |
| Configurações da unidade, backup (exportar) | ✅ | ✅ | — | — | — |
| Backup (importar) | ✅ | — | — | — | — |
| Usuários, unidades, billing | ✅ | — | — | — | — |

¹ Dinheiro só em Caixa ao qual o usuário tem acesso e com sessão aberta (trava, §4.10). Meios digitais vão para a Carteira banco.

---

## 4. Entidades (Schema)

> **Nota:** as interfaces abaixo definem o modelo de dados do produto. A forma de storage (coleções, seed, migração) e o schema D1 estão em `ARCHITECTURE.md`.

### 4.1 `Usuario`

```ts
interface Usuario {
  id: number
  nome: string
  email: string            // login (único)
  telefone?: string
  senhaHash: string        // MVP: "123456". Fase 2: argon2id
  ativo: boolean
  dataCriacao: string      // ISO
}
```

### 4.2 `Unidade`

```ts
interface Unidade {
  id: number
  usuarioId: number        // FK → Usuario (dono)
  nome: string
  ativo: boolean
  nextOsNumber: number     // contador de OS (per-unidade)
  nextVendaNumber: number  // contador de vendas
  dataCriacao: string
}
```

### 4.3 `UsuarioUnidade`

```ts
interface UsuarioUnidade {
  id: number
  usuarioId: number
  unidadeId: number
  role: 'owner' | 'admin' | 'gerente' | 'mecanico' | 'recepcionista'
  ativo: boolean
  dataCriacao: string
}
```

### 4.4 `Cliente` (tenant-level)

```ts
interface Cliente {
  id: number
  usuarioId: number        // FK → Usuario (tenant)
  nome: string
  nomeBusca?: string       // stripAccents(nome).toLowerCase()
  tipoPessoa: 'fisica' | 'juridica'
  cpf?: string
  razaoSocial?: string
  nomeFantasia?: string
  cnpj?: string
  telefone?: string
  email?: string
  endereco?: Endereco
  deletedAt?: string       // soft delete
  dataCriacao: string
  dataAtualizacao: string
}

interface Endereco {
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
}
```

### 4.5 `Veiculo`

```ts
interface Veiculo {
  id: number
  unidadeId: number
  clienteId: number        // FK → Cliente
  tipo: string             // 'carro' | 'moto' | 'caminhaonete' | ...
  marca: string
  modelo: string
  versao?: string
  placa: string            // SEMPRE UPPERCASE
  anoFabricacao: string | number
  anoModelo: string | number
  cor?: string
  combustivel?: string
  quilometragem?: number
  chassi?: string
  deletedAt?: string
  dataCriacao: string
  dataAtualizacao: string
}
```

### 4.6 `ItemCatalogo` (Catálogo — cadastro mestre)

```ts
interface ItemCatalogo {
  id: number
  unidadeId: number
  nome: string
  nomeBusca?: string       // stripAccents(nome).toLowerCase()
  tipo: 'servico' | 'produto'   // imutável após a criação
  sku?: string
  descricao?: string
  preco: number            // preço de venda sugerido (centavos)
  custo?: number           // custo de compra (centavos)
  unidade: string          // 'un' | 'jogo' | 'par' | 'h' | 'litro' | 'm' | 'kg' | 'pca'

  dataCriacao: string
  dataAtualizacao: string
}
```

**Regras:**
- Tabela mestre única de produtos e serviços da unidade. O autocomplete da OS e do PDV busca aqui.
- Duas visões: `/catalogo` (todos os itens; foco em preço, custo e cadastro) e `/estoque` (somente `tipo = 'produto'`; foco em saldo e reposição — lê de `ItemEstoque JOIN ItemCatalogo`). Ver §4.6.2.
- Catálogo continua sendo **conveniência de digitação** para o preço: o `ItemOS` copia nome, unidade e preço (snapshot). O vínculo `catalogoId` existe **apenas** para baixa/estorno de estoque e nunca é pré-requisito.
- **Estoque é entidade separada** (`ItemEstoque`, §4.6.3). Criado automaticamente ao cadastrar produto (com saldo inicial opcional, que gera `MovimentoEstoque`). Serviço não tem estoque.
- `quantidadeAtual` e `quantidadeMinima` vivem em `ItemEstoque`, não aqui. O formulário do catálogo não edita saldo.
- Excluir item do catálogo é hard delete; `ItemEstoque` é removido por cascade. OS e Vendas antigas continuam íntegras pelo snapshot; estornos posteriores usam o safe fallback (§5.10).

### 4.6.1 `MovimentoEstoque`

Extrato de estoque, equivalente ao `Lancamento` para o financeiro.

```ts
interface MovimentoEstoque {
  id: number
  unidadeId: number
  catalogoId?: number          // ausente se o item foi excluído do catálogo
  nome: string                 // snapshot do nome do produto
  tipo: 'entrada' | 'saida'
  quantidade: number           // sempre positiva; tipo define o sentido
  origem: 'manual' | 'os_baixa' | 'os_estorno' | 'venda_baixa'
  documentoId?: number         // OS.id ou Venda.id
  documentoTipo?: 'os' | 'venda'
  itemOsId?: number            // ItemOS que originou a baixa/estorno
  saldoApos: number            // saldo do produto depois do movimento
  observacao?: string
  usuarioId: number
  data: string                 // ISO
}
```

**Regras:**
- Append-only: nunca editar nem apagar. Correção = novo movimento.
- Movimento e atualização de `quantidadeAtual` são gravados **atomicamente**.
- `origem = 'manual'` vem do modal Ajuste de Estoque (entrada de compra, saída por perda/uso interno, saldo inicial) e exige observação nas saídas.
- Compra de peça é lançamento financeiro (categoria `peca`) **e** entrada de estoque; no MVP são duas operações independentes, sem vínculo automático (vínculo vem com Fornecedor, fase 2).

### 4.6.2 Telas: Catálogo e Estoque

| Tela | Fonte de dados | Conteúdo | Ações | Papel |
|---|---|---|---|---|
| **Catálogo** (`/catalogo`) | `ItemCatalogo` | Lista de serviços e produtos (busca por nome/SKU, filtro por tipo), preço, custo, unidade | Criar, editar, excluir (modal) | ver: todos · editar: `gerente`+ |
| **Estoque** (`/estoque`) | `ItemEstoque JOIN ItemCatalogo` | Lista de produtos com saldo, mínimo, custo e badges; filtro "Abaixo do mínimo" | Ajustar estoque (modal), ver histórico de movimentos do produto | ver: todos · ajustar: `gerente`+ |

Badges de estoque (sem bloquear nada):
- `Estoque Negativo` quando `ItemEstoque.quantidadeAtual < 0`.
- `Repor` quando `ItemEstoque.quantidadeMinima` está definida e `quantidadeAtual <= quantidadeMinima` (inclui zero).

### 4.6.3 `ItemEstoque`

Saldo físico dos produtos. 1:1 com `ItemCatalogo` (somente `tipo = 'produto'`).

```ts
interface ItemEstoque {
  id: number
  unidadeId: number
  catalogoId: number       // FK → ItemCatalogo (ON DELETE CASCADE)
  quantidadeAtual: number  // saldo físico; pode ficar negativo
  quantidadeMinima?: number // gatilho do alerta de reposição
  dataCriacao: string
  dataAtualizacao: string
}
```

**Regras:**
- Criado automaticamente ao cadastrar um produto no catálogo, **na mesma `db.transaction`** do `ItemCatalogo` (e do `MovimentoEstoque` de entrada, se houver saldo inicial). Serviço não tem `ItemEstoque`.
- Como só produto tem estoque, `ItemCatalogo.tipo` é imutável (nenhum produto vira serviço nem o contrário).
- O seed de onboarding também cria um `ItemEstoque` (saldo 0) para cada produto do catálogo inicial.
- `quantidadeAtual` **só muda** por função de estoque (`server/utils/estoque.ts`), sempre gerando um `MovimentoEstoque` na mesma operação.
- Saldo negativo é permitido (operação sem trava).
- Excluir item do catálogo remove o `ItemEstoque` por cascade. Movimentos históricos permanecem (`catalogoId` → `NULL` via `ON DELETE SET NULL` em `MovimentoEstoque`).

### 4.7 `OrdemServico`

```ts
interface OrdemServico {
  id: number
  unidadeId: number
  numero: string               // "0001" — padStart(4, '0'), per-unidade
  tipo: 'normal' | 'garantia'
  osOriginalId?: number        // FK → OS (só quando tipo = 'garantia')
  veiculoId: number            // FK → Veiculo
  clienteId: number            // denormalizado (FK → Cliente)
  funcionarioId: number        // FK → UsuarioUnidade (responsável obrigatório na criação)
  status: 'aberta' | 'em_diagnostico' | 'aguardando_aprovacao' | 'aprovada' | 'em_execucao' | 'concluida' | 'entregue' | 'cancelada'
  queixa: string
  diagnostico?: string
  avarias?: string             // free text
  combustivel?: string         // 'E' | '1/4' | '2/4' | '3/4' | 'Cheio'
  quilometragem?: number
  dataEntrada: string          // ISO
  previsaoEntrega?: string     // ISO
  itens: ItemOS[]
  desconto?: number            // centavos; global (só editável em em_diagnostico / aguardando_aprovacao)
  orcamentoEnviado: boolean     // estado atual do orçamento principal; histórico detalhado em EnvioOrcamento
  token: string                // 64 hex (link público futuro)
  notas: Nota[]
  deletedAt?: string
  dataCriacao: string
  dataAtualizacao: string
  dataAprovacao?: string
  dataConclusao?: string
  dataEntrega?: string
  motivoCancelamento?: string
}
```

### 4.8 `ItemOS`

```ts
interface ItemOS {
  id: number
  osId: number
  catalogoId?: number          // FK opcional → ItemCatalogo; usado só para baixa/estorno de estoque
  nome: string                 // snapshot
  tipo: 'servico' | 'produto'  // snapshot
  unidade?: string             // snapshot da unidade de medida
  quantidade: number           // decimal (1.5L de óleo)
  precoUnitario: number        // centavos; snapshot (congelado no add)
  status: 'pendente' | 'aprovado' | 'recusado'
  lote: number | null          // null = orçamento principal, 1/2/3... = complementos
  enviado: boolean             // item incluído em um envio ao cliente
  dataAprovacao?: string
  dataRecusa?: string
  motivoRecusa?: string
  estoqueBaixado?: boolean     // true quando a baixa física de estoque já foi feita (idempotência)
}
```

**Regras:**
- Preço = snapshot (catálogo muda, OS não muda)
- Total = `Math.round(quantidade × precoUnitario)` em centavos (calculado, nunca armazenado; ver `ARCHITECTURE.md` §Convenções de dados)
- O modal de adicionar item tem campo **Quantidade** (padrão `1`), preenchido antes de adicionar a linha.
- Mesmo item no mesmo lote e ainda `pendente` → soma a quantidade (não duplica linha). "Mesmo item" = mesmo `catalogoId`; sem `catalogoId`, mesmo nome e mesmo preço.
- `catalogoId` é opcional e **não é dependência**: item livre (digitado) funciona igual, apenas não movimenta estoque. Catálogo excluído não afeta a OS (snapshot).
- `status` representa exclusivamente a decisão do cliente: `pendente`, `aprovado` ou `recusado`.
- `lote` identifica a qual orçamento o item pertence: `null` = orçamento principal; `1, 2, 3...` = complementos.
- Complemento não é status. Seus itens começam como `pendente`, assim como os itens do orçamento principal.
- `aprovado` é terminal — não volta nem edita individualmente.
- `recusado` é terminal — não volta nem edita individualmente.
- Item `pendente` + `enviado = false` → editável/removível em **qualquer** status. Item `pendente` + `enviado = true` → editável/removível **exceto** em `aguardando_aprovacao` (exige Ajustar). Racional: em `aguardando_aprovacao` o cliente já viu o documento; em `em_execucao` o complemento é fluido.
- Item `pendente` + `enviado = true` exibe tag "● enviado" (indicador visual).
- Transições individuais: `pendente` → `aprovado` | `recusado`. A reversão administrativa da OS é exceção coletiva, descrita em §5.4.
- Efeito no estoque: a baixa acontece quando o item vira `aprovado`; estorno em remoção, reversão e cancelamento. Regras completas em **§5.10**.
- Baixa/estorno de estoque: item com `catalogoId` + `tipo = 'produto'` → busca `ItemEstoque` via `catalogoId` para aplicar a movimentação. Item livre (sem `catalogoId`) não movimenta estoque.

### 4.9 `Nota`

```ts
interface Nota {
  id: number
  osId: number
  texto: string
  tipo: 'item_add' | 'item_edit' | 'item_remove' | 'item_approve' | 'item_reject'
    | 'envio' | 'ajuste' | 'reversao' | 'cancelar' | 'pagamento' | 'transicao' | 'estoque'
  role: string  // snapshot do role do usuário logado
  data: string  // ISO
}
```

**Regras:**
- **Append-only** (não edita, não apaga)
- 100% sistema (sem nota manual)
- Em auto-transição (ex.: "Status → Aprovada"), `role` é o do usuário que gatilhou a última ação (aprovou/recusou o item que completou a condição). Nunca `null`.

**Ações que geram nota automática:**

| Ação | tipo | Texto |
|---|---|---|
| Criar OS | `transicao` | "OS criada" |
| Iniciar diagnóstico | `transicao` | "Iniciando diagnóstico" |
| Enviar orçamento | `envio` | "Orçamento enviado ({canal})" |
| Ajustar | `ajuste` | "Orçamento ajustado — {motivo}" |
| Recusar item | `item_reject` | "{nome} recusado — {motivo}" |
| Remover item | `item_remove` | "Item removido: {nome}" |
| Adicionar complemento (em_execucao) | `item_add` | "Complemento adicionado: {nomes}" |
| Aprovar (todos) | `item_approve` | "Orçamento aprovado" |
| Enviar complementar | `envio` | "Orçamento complementar enviado [lote N]" |
| Iniciar execução | `transicao` | "Início da execução" |
| Concluir | `transicao` | "OS concluída" |
| Entregar | `transicao` | "Veículo entregue" |
| Cancelar | `cancelar` | "OS cancelada — {motivo}" |
| Reverter aprovação | `reversao` | "Reversão de aprovação — {motivo}" |
| Pagamento | `pagamento` | "Pagamento R$ {valor} ({modalidade})" |
| Estorno | `pagamento` | "Estorno R$ {valor}" |
| Estorno de estoque não aplicado (produto excluído do catálogo) | `estoque` | "Estorno de estoque ignorado: {nome} não existe mais no catálogo" |

**Ações que NÃO geram nota:**
- Adicionar item em `em_diagnostico` (é construção)
- Editar item em `em_diagnostico` (é construção)
- Baixa e estorno normais de estoque (já cobertos pelas notas de aprovar/remover/reverter/cancelar; só o safe fallback gera nota própria)

### 4.9.1 `EnvioOrcamento`

Registra cada tentativa de envio/entrega do orçamento. Não substitui a decisão individual dos itens nem a nota de histórico da OS.

```ts
interface EnvioOrcamento {
  id: number
  osId: number
  unidadeId: number
  canal: 'impressao' | 'imagem' | 'email' | 'link'   // MVP: impressao e imagem. email/link: fase 2
  status: 'pendente' | 'enviado' | 'gerado' | 'falhou'
  itensIds: number[]             // snapshot dos itens incluídos naquele envio
  solicitadoEm: string
  concluidoEm?: string
  referencia?: string            // id da operação/provedor ou URL/token quando aplicável
  erro?: string
  usuarioId: number
}
```

**Regras:**
- Cada tentativa gera um registro próprio; reenvios não sobrescrevem tentativas anteriores.
- **MVP — `impressao` e `imagem`:** o documento é gerado no navegador. Ao confirmar no modal, o envio fica `gerado` e **vale como enviado para o fluxo**: `orcamentoEnviado = true`, itens `enviado = true`, OS vai para `aguardando_aprovacao`. A entrega ao cliente (papel ou WhatsApp manual) é responsabilidade do operador; a nota da OS registra o canal.
- `gerado` não comprova entrega ao cliente; só registra que o documento foi emitido.
- **Fase 2 — `email` e `link`:** só viram `enviado` após confirmação positiva da API/provedor. Só então a OS avança.
- `falhou` (inclusive falha ao gerar PDF/imagem) preserva a tentativa e o erro; não altera `orcamentoEnviado`, não marca itens como enviados e não muda o status da OS.
- `itensIds` registra exatamente quais itens foram incluídos no documento enviado/gerado.

### 4.10 `Lancamento`

```ts
type Modalidade = 'dinheiro' | 'pix' | 'credito' | 'debito' | 'boleto' | 'transferencia'

type CategoriaLancamento =
  | 'pagamento' | 'devolucao'                                   // cliente
  | 'peca' | 'material' | 'alimento' | 'fixo' | 'folha' | 'imposto'
  | 'taxa_adquirente' | 'retirada_rapida'                       // despesas
  | 'aporte' | 'emprestimo_socio'                               // entradas externas
  | 'transferencia' | 'sobra_caixa' | 'quebra_caixa' | 'outro'  // internos/ajustes

interface Lancamento {
  id: number
  unidadeId: number
  tipo: 'entrada' | 'saida'

  // Exatamente um destino: Carteira OU sessão de Caixa.
  carteiraId?: number           // FK → Carteira.id
  sessaoCaixaId?: number        // FK → SessaoCaixa.id

  valor: number                 // centavos; sempre positivo; tipo define o sentido
  data: string                  // ISO (data efetiva do movimento; editável com auditoria)

  // Referência de origem/compromisso:
  documentoId?: number          // FK → OS.id | Venda.id
  documentoTipo?: 'os' | 'venda'
  fornecedorId?: number         // FK → Fornecedor (fase 2)
  usuarioContraparteId?: number // proprietário/sócio quando tiver cadastro no sistema
  contraparteNome?: string      // nome da origem externa quando não houver usuário cadastrado

  modalidade: Modalidade
  categoria: CategoriaLancamento

  parId?: number                // par de lançamentos de uma transferência interna
  estornoDe?: number            // aponta para o lançamento original; nunca apaga
  observacao?: string
  criadoPorUsuarioId: number
  dataCriacao: string
  atualizadoEm?: string
  atualizadoPorUsuarioId?: number
}

interface LancamentoHistorico {   // trilha de alterações de campos (ex.: data)
  id: number
  lancamentoId: number
  usuarioId: number
  campo: string
  valorAnterior?: string
  valorNovo?: string
  alteradoEm: string
}
```

**Regras:**
- `lancamento` é o registro único de cada movimento financeiro; não duplicar o mesmo movimento em Caixa e Carteira.
- Exatamente um entre `carteiraId` e `sessaoCaixaId` deve estar preenchido **no momento da criação**. Após exclusão da Carteira, `carteiraId` vira `NULL` (a UI exibe "Carteira removida").
- `carteiraId` só pode apontar para Carteira da mesma unidade; `sessaoCaixaId` só pode apontar para sessão da mesma unidade.
- Saldo da Carteira = `saldoInicial + entradas - saídas` dos lançamentos vinculados. **Todo lançamento compõe o saldo imediatamente** (não existe estado pendente). Estornos permanecem no extrato e neutralizam o original.
- Saldo esperado da sessão = soma das entradas menos saídas de todos os lançamentos vinculados à sessão. A transferência de abertura já é uma entrada na sessão; `valorAbertura` é o registro descritivo dessa transferência e não pode ser somado novamente. Despesas, retiradas e sangrias não podem superar o saldo disponível; a sessão não pode ficar negativa.
- Saldo pago da OS considera pagamentos líquidos: entradas de pagamento menos saídas de devolução/estorno vinculadas à OS. Transferências, aportes e ajustes de Caixa não são pagamentos de OS.
- **Modalidade define o destino:** `dinheiro` → sessão de Caixa aberta; `pix`, `credito`, `debito`, `boleto` → Carteira `banco`. O usuário só escolhe destinos compatíveis com a modalidade e com suas permissões.
- **Trava de Caixa fechado:** recebimento em `dinheiro` (OS ou PDV) exige ao menos uma sessão aberta em Caixa que o usuário possa operar. Sem ela, a UI desabilita "Dinheiro" e mostra "Abra um Caixa para receber em dinheiro ou escolha Pix/cartão."; a API também recusa. Com mais de uma sessão acessível, o usuário escolhe em qual lançar.
- **Meios digitais (financeiro direto):** o valor integral entra na Carteira banco no ato, sem D+X, retenção por bandeira ou compensação. Taxa de adquirente/antecipação, se a oficina quiser controlar, é lançada manualmente como saída `taxa_adquirente` (pode ser mensal). *Limitação conhecida:* o saldo do Banco no sistema pode divergir do extrato real até existir conciliação de recebíveis (fase 2).
- **Retirada Rápida:** atalho de Despesa em espécie dentro da sessão (valor + justificativa), categoria `retirada_rapida`, responsável = usuário logado. É despesa operacional; não é transferência nem sangria.
- `data` é a data efetiva do movimento; alterações posteriores exigem auditoria de valor anterior, novo valor, usuário e momento (`LancamentoHistorico`). Essa trilha financeira é MVP, embora o audit log geral permaneça fase 2.
- Estorno é um novo lançamento oposto, com `estornoDe`; original e estorno permanecem no extrato e se neutralizam no saldo. Para cálculos por documento, o par estornado não compõe o pagamento líquido. Um lançamento não pode ser estornado mais de uma vez.
- Transferência interna é composta por exatamente 2 lançamentos de mesmo valor e `parId`: uma saída na origem e uma entrada no destino, criados atomicamente.
- Transferências internas não são receita nem despesa operacional.
- **Nunca** apagar lançamentos financeiros; corrigir por estorno ou ajuste rastreável.
- Aporte de proprietário e empréstimo de sócio são entradas externas distintas de receita operacional. Exigem categoria, contraparte identificada, valor, data e observação/motivo. Sem usuário no sistema, registrar `contraparteNome`.

**Tipos de lançamento na prática:**

| Cenário | tipo | Destino | modalidade | documentoId | categoria |
|---|---|---|---|---|---|
| Cliente paga OS via Pix | entrada | Carteira banco | pix | os.id | pagamento |
| Cliente paga OS em dinheiro | entrada | Sessão Caixa | dinheiro | os.id | pagamento |
| Cliente paga OS no crédito/débito/boleto | entrada | Carteira banco (saldo imediato) | credito / debito / boleto | os.id | pagamento |
| Venda PDV via Pix | entrada | Carteira banco | pix | venda.id | pagamento |
| Venda PDV em dinheiro | entrada | Sessão Caixa | dinheiro | venda.id | pagamento |
| Compra de peça para OS | saida | Carteira ou Sessão Caixa | conforme pagamento | os.id | peca |
| Retirada Rápida (insumo, lanche, pequena compra) | saida | Sessão Caixa | dinheiro | — (ou os.id) | retirada_rapida |
| Despesa paga diretamente pelo Cofre | saida | Carteira cofre | dinheiro | — | categoria da despesa |
| Despesa paga pelo Caixa | saida | Sessão Caixa | dinheiro | — | categoria da despesa |
| Aluguel pago pelo Banco | saida | Carteira banco | transferencia | — | fixo |
| Taxa de adquirente (manual) | saida | Carteira banco | transferencia | — | taxa_adquirente |
| Aporte do proprietário | entrada | Carteira cofre ou Sessão Caixa | dinheiro | — | aporte |
| Empréstimo do sócio | entrada | Carteira cofre ou Sessão Caixa | dinheiro | — | emprestimo_socio |
| Devolução de pagamento ao cliente | saida | Carteira ou Sessão Caixa | modalidade original | os.id | devolucao |
| Transferência Cofre → Banco | saida + entrada | duas Carteiras | transferencia | — | transferencia |
| Fechamento Caixa → Cofre | saida + entrada | Sessão + Carteira cofre | dinheiro | — | transferencia |
| Sobra / quebra de Caixa | entrada / saida | Sessão Caixa | dinheiro | — | sobra_caixa / quebra_caixa |
| Estorno | oposto do original | mesmo destino do original | mesma | mesmas referências | mesma |

### 4.11 `Carteira`

```ts
interface Carteira {
  id: number
  unidadeId: number
  tipo: 'banco' | 'cofre'
  nome: string
  saldoInicial: number         // centavos
  dataCriacao: string
  ativa: boolean
}
```

**Regras:**
- Carteira é o local financeiro onde o dinheiro fica armazenado; não representa o Caixa físico/operacional.
- Tipos permitidos: `cofre` (somente dinheiro em espécie) e `banco` (meios bancários).
- Uma unidade pode ter múltiplas Carteiras de cada tipo; nomes devem ser únicos dentro da unidade.
- Cofre recebe fechamentos, sangrias e aportes em espécie; pode pagar despesas diretamente, mesmo com todos os Caixas fechados.
- Banco recebe Pix, crédito, débito, boleto e transferências bancárias; não é origem direta de abertura/reforço do Caixa. Para colocar dinheiro físico no Caixa vindo do Banco, registrar primeiro a retirada/entrada física no Cofre e depois a transferência Cofre → Caixa.
- Saldo é calculado a partir do saldo inicial e dos lançamentos vinculados. Nenhuma movimentação pode deixar a Carteira com saldo negativo, salvo regra futura explícita de crédito/limite. Alterações de saldo inicial após a ativação exigem lançamento de ajuste auditável.
- Carteiras não possuem estado aberto/fechado; podem ser desativadas apenas quando saldo zero e sem sessões/movimentos pendentes.
- **Tela própria** (`/unidade/[unidadeId]/carteiras`): lista todas as Carteiras da unidade com saldo calculado, tipo e nome. Ações disponíveis: Nova Carteira, Transferir entre Carteiras, Despesa, Entrada externa, Renomear, Excluir.
- **Renomear:** G+. Sem guard (FK é por ID, não por nome). Lançamentos e sessões históricas não são afetados.
- **Excluir:** A+. Hard delete com guard:
  - Se há **sessão aberta** usando a Carteira → bloqueia ("Feche a sessão antes de excluir").
  - Se há **lançamentos históricos** → `window.confirm`: "N lançamentos perderão a referência (aparecerão como 'Carteira removida'). Continuar?" → exclui; `carteiraId` → `NULL` nos lançamentos.
  - Sem sessões, sem lançamentos → exclui direto.
- **Onboarding não seeda Carteiras.** A unidade começa sem Carteiras; o usuário cria na tela `/carteiras` (empty state com botões "Criar Banco" e "Criar Cofre").

### 4.11.1 `Caixa`

```ts
interface Caixa {
  id: number
  unidadeId: number
  nome: string                 // ex.: 'Recepção', 'Balcão 1', 'Oficina'
  ativo: boolean
  dataCriacao: string
}
```

**Regras:**
- Uma unidade pode ter vários Caixas físicos/operacionais.
- `nome` é obrigatório e único dentro da unidade para identificação clara em telas, relatórios e histórico.
- Caixa não é Carteira e não possui saldo permanente próprio; o saldo em operação pertence à sessão aberta.
- Cada Caixa pode ter somente uma sessão aberta por vez. Uma unidade pode ter várias sessões abertas simultaneamente, em Caixas diferentes.
- Caixa só movimenta dinheiro em espécie. Não recebe Pix, crédito, débito ou boleto diretamente.
- Caixa pode ser desativado somente sem sessão aberta; histórico não é apagado.

### 4.11.2 `CaixaUsuario`

```ts
interface CaixaUsuario {
  id: number
  unidadeId: number
  caixaId: number
  usuarioUnidadeId: number
  ativo: boolean
}
```

**Regras de acesso:**
- A associação identifica quais usuários podem operar cada Caixa; um usuário pode operar vários Caixas e um Caixa pode ter vários usuários autorizados.
- Para `recepcionista`, a autorização exige simultaneamente role com permissão para a ação e associação ativa ao Caixa. `owner`/`admin` e `gerente` seguem o escopo ampliado descrito acima.
- `owner` e `admin` podem administrar e operar todos os Caixas da unidade, sem exigir associação individual.
- `gerente` pode consultar e operar todos os Caixas, sem exigir associação individual; somente `owner`/`admin` gerenciam cadastro e associações.
- `recepcionista` pode consultar/abrir/movimentar/fechar somente Caixas aos quais esteja associado.
- `mecanico` não recebe permissão de operação financeira por padrão.
- A API valida role, associação, unidade e estado da sessão em toda operação; esconder botões na UI não é controle de segurança.

### 4.11.3 `SessaoCaixa`

```ts
interface SessaoCaixa {
  id: number
  unidadeId: number
  caixaId: number
  status: 'aberta' | 'fechada'
  abertaEm: string
  abertaPorUsuarioId: number
  valorAbertura: number
  carteiraOrigemId?: number    // Cofre, obrigatório se valorAbertura > 0
  fechadaEm?: string
  fechadaPorUsuarioId?: number
  saldoEsperadoFechamento?: number
  valorContado?: number
  diferenca?: number           // valorContado - saldoEsperadoFechamento
  motivoFechamento?: string
}
```

**Regras:**
- Cada abertura cria uma nova sessão imutável no histórico; nunca reutilizar uma sessão fechada.
- A sessão pertence a um único Caixa e registra os usuários e horários de abertura/fechamento.
- `valorAbertura` pode ser zero. Se maior que zero, deve existir transferência pareada Cofre → sessão; não existe origem genérica `bolso` nem origem direta Banco.
- Uma sessão fechada não aceita novos lançamentos. Correções posteriores exigem lançamento de ajuste/estorno autorizado e referência à sessão original.
- Fechamento registra saldo esperado antes do ajuste, valor contado, diferença e motivo quando houver diferença.
- O valor efetivamente transferido ao Cofre é o valor contado, não o saldo esperado.
- Sobra/quebra gera lançamento explícito de ajuste vinculado à sessão, em categoria própria; nunca alterar retroativamente recebimentos ou despesas originais.

### 4.12 `Venda` (PDV)

```ts
interface Venda {
  id: number
  unidadeId: number
  numero: string           // "V-0001" (sequência separada da OS)
  clienteId?: number       // opcional (pode ser "avulso")
  funcionarioId: number    // usuário logado no momento da venda (não editável)
  itens: VendaItem[]
  formaPagamento: string   // 'dinheiro' | 'pix' | 'credito' | 'debito'
  dataCriacao: string
}

interface VendaItem {
  id: number
  vendaId: number
  catalogoId?: number      // produto do catálogo; fica ausente se o produto for excluído depois
  nome: string
  quantidade: number
  precoUnitario: number
}
```

**Regras:**
- Sem workflow, sem status, sem notas
- Abriu → vendeu → fechou
- Total = calculado (soma dos itens)
- **Apenas itens `tipo = 'produto'`** são aceitos no PDV. Serviços (mão de obra) vão na OS. O autocomplete filtra por `tipo = 'produto'`.
- `funcionarioId` = usuário logado no momento da finalização (não é um campo editável na tela).
- Ao finalizar: cria `Lancamento` (entrada, modalidade, destino compatível — sessão de Caixa ou Carteira banco —, `documentoId = venda.id`, `documentoTipo = 'venda'`)
- Funciona com catálogo (autocomplete); campo Quantidade em cada item.
- Todo item do PDV é um produto do catálogo e dá **baixa imediata** no estoque ao finalizar (movimento `venda_baixa`). Saldo insuficiente não bloqueia a venda (`Estoque Negativo`).
- Venda em `dinheiro` exige sessão de Caixa aberta acessível ao usuário (trava, ver 4.10).
- Venda não é excluída no MVP (gera `Lancamento`, que nunca é apagado). Correção: estornar o lançamento e ajustar o estoque manualmente.
- Recibo = `PrintPreview.vue` modo "RECIBO"

### 4.13 `Agendamento`

```ts
interface Agendamento {
  id: number
  unidadeId: number
  clienteId: number
  veiculoId?: number       // opcional
  dataHora: string         // ISO (quando o carro chega)
  servico: string          // "Troca de óleo", "Revisão 10k", "Diagnóstico"
  status: 'agendado' | 'realizado' | 'cancelado'
  osId?: number            // quando o carro chega e vira OS
  observacao?: string
  criadoPor: number        // funcionarioId
  dataCriacao: string
}
```

**Regras:**
- `realizado` → quando o carro chega e a OS é criada
- `cancelado` → usuário cancela
- Conversão: `POST /api/agenda/:agendamentoId/converter` → cria OS (pré-preenche cliente + veículo + queixa)
- Calendário: Dia / Semana / Mês
- Cores: 🔵 agendado, 🟣 em diagnóstico, 🟡 aguardando, 🟢 em execução/concluída (previsão), ⚪ entregue/cancelado

### 4.14 `Config`

```ts
interface Config {
  unidadeId: number
  nome: string              // "Oficina do João"
  endereco?: string
  telefone?: string
  cnpj?: string
  email?: string
  logo?: string             // base64 ou URL (futuro)
  validadeDias: number      // 15 (validade do orçamento)
  fusoHorario: string       // IANA, padrão 'America/Sao_Paulo'
  textoGarantia?: string    // "90 dias sobre mão de obra. Peças com garantia do fabricante."
  textoObservacoes?: string // "Preços sujeitos a alteração sem aviso prévio."
  textoRodape?: string      // "Orçamento gerado por Oficina Core"
}
```

### 4.15 `Fornecedor` (Fase 2)

```ts
interface Fornecedor {
  id: number
  unidadeId: number
  nome: string
  nomeBusca?: string
  condicaoPagamento?: string  // 'a_vista' | 'd30' | 'd60'
}
```

**No MVP:** campo `lancamento.fornecedorId` existe (nullable), sem UI.

---

## 5. OS — Workflow

### 5.1 State Machine

```
aberta → em_diagnostico ⇄ aguardando_aprovacao → aprovada → em_execucao → concluida → entregue
   ↘         ↘                   ↘                   ↘           ↘
     ──────────────────────────────────────────────────────────────────────────────────────→ cancelada
```

**Transições válidas:**

| De | Para | Ação | Quem pode (3.5) |
|---|---|---|---|
| `aberta` | `em_diagnostico` | "Iniciar diagnóstico" | mecanico, G+ |
| `aberta` | `cancelada` | "Cancelar" | G+ |
| `em_diagnostico` | `aguardando_aprovacao` | "Enviar orçamento" (exige diagnóstico preenchido e ao menos um item no orçamento) | recepcionista, G+ |
| `em_diagnostico` | `cancelada` | "Cancelar" | G+ |
| `aguardando_aprovacao` | `em_diagnostico` | **"Ajustar"** | recepcionista, G+ |
| `aguardando_aprovacao` | `aprovada` | Não existe item `pendente` no orçamento principal e existe pelo menos um item `aprovado` (auto) | — |
| `aguardando_aprovacao` | `cancelada` | "Cancelar" | G+ |
| `aprovada` | `em_execucao` | "Iniciar execução" | mecanico, G+ |
| `aprovada` | `em_diagnostico` | **"Reverter aprovação"** (exige pago líquido = 0) | A+ |
| `aprovada` | `cancelada` | "Cancelar" (exige pago líquido = 0) | G+ |
| `em_execucao` | `concluida` | "Concluir" (exige nenhum item `pendente`, inclusive em complementos) | mecanico, G+ |
| `em_execucao` | `cancelada` | "Cancelar" (exige pago líquido = 0) | G+ |
| `concluida` | `entregue` | "Entregar" | recepcionista, G+ |

**Regras:**
- Não pula etapa (exceto `aguardando_aprovacao` → `em_diagnostico` via Ajustar)
- Cancelar: a qualquer momento antes de `concluida` (estorna o estoque dos itens já baixados — §5.10; exige pago líquido = 0 — §5.11)
- Excluir (soft delete): só `aberta`
- A OS passa automaticamente de `aguardando_aprovacao` para `aprovada` quando não existe item `pendente` no orçamento principal (`lote: null`) e existe pelo menos um item `aprovado`.
- Itens recusados não impedem a aprovação da OS.
- A aprovação automática não altera o status geral quando a OS já está `aprovada` ou `em_execucao`; decisões sobre complementos afetam somente os respectivos itens.
- **Concluir ≠ Pagar.** São independentes
- Pagamento: só status ≥ `aprovada`
- Estoque: a baixa ocorre quando o item vira `aprovado`; cancelar e reverter aprovação estornam (§5.10). Estoque nunca bloqueia nenhuma transição

### 5.2 Botões por Status

| Status | Botões visíveis |
|---|---|
| `aberta` | [Iniciar diagnóstico] · [Cancelar OS] |
| `em_diagnostico` | [Adicionar item] · [Enviar orçamento] · [Cancelar OS] |
| `aguardando_aprovacao` | [Ajustar] · [Aprovar item] · [Recusar item] · [Aprovar todos] · [Cancelar OS] · [🖨 Imprimir] |
| `aprovada` | [Iniciar execução] · [Reverter aprovação] · [Cancelar OS] · [🖨 Imprimir] |
| `em_execucao` | [Adicionar complemento] · [Aprovar item] · [Recusar item] · [Enviar complementos] · [Concluir] · [Cancelar OS] · [🖨 Imprimir] |
| `concluida` | [Entregar] · [🖨 Imprimir] |
| `entregue` | [🖨 Imprimir] |
| `cancelada` | [🖨 Imprimir] |

### 5.3 O Botão [Ajustar]

**Ação disponível em `aguardando_aprovacao`.** É a porta de entrada para editar o orçamento principal depois que ele foi enviado ao cliente.

| Contexto | O que faz |
|---|---|
| `aguardando_aprovacao` | OS volta para `em_diagnostico`. Itens do orçamento principal podem ser ajustados. Novos itens entram como `pendente`, `lote: null`. |
| `em_execucao` | Não exige Ajustar. A inclusão de novos itens é permitida diretamente como complemento, sem alterar o status da OS. |

**Modal:** campo de texto obrigatório para registrar o motivo do ajuste. Após confirmar:
- OS volta para `em_diagnostico`;
- itens pendentes do orçamento principal deixam de ser considerados enviados;
- itens já `aprovado` permanecem aprovados (e com a baixa de estoque mantida);
- o orçamento principal pode ser editado e enviado novamente;
- uma nota de ajuste é gerada no histórico.

**Durante `em_execucao`:**
- Novos itens são adicionados diretamente como complementos.
- Os itens recebem `status: 'pendente'` e `lote: próximoLote()`.
- A OS permanece em `em_execucao`.

### 5.4 Reverter Aprovação

**Operação administrativa excepcional sobre a OS inteira. Não permite reverter itens individualmente.**

| Aspecto | Regra |
|---|---|
| Papel | `admin` (ou `owner`) |
| Estado de origem | `aprovada` |
| Estado de destino | `em_diagnostico` |
| Escopo | Itens do orçamento principal (`lote: null`) |
| Efeito nos itens | `aprovado` e `recusado` → `pendente` |
| Envio | `enviado = false` para os itens reabertos |
| Orçamento | `orcamentoEnviado = false` |
| Estoque | Itens `aprovado` com `estoqueBaixado` têm a quantidade estornada (`estoqueBaixado = false`); itens `recusado` → `pendente` não movimentam estoque |
| Pré-condição | Pago líquido da OS = 0 (devolver ou estornar pagamentos antes — §5.11) |
| Motivo | Obrigatório, registrado como nota `reversao` |
| Confirmação | Confirmação explícita antes de executar |

**Regras adicionais:**
- Não existe ação para reverter individualmente um item aprovado ou recusado.
- A reversão só pode ocorrer quando a OS está `aprovada`.
- A operação reabre o orçamento principal para diagnóstico e ajustes.
- O histórico anterior de aprovação, recusa e envio não deve ser apagado; a reversão gera novo registro com o motivo informado.

### 5.5 Complementos (Lotes)

```
lote: null  → Orçamento principal (os itens originais)
lote: 1     → 1º complemento
lote: 2     → 2º complemento
...
```

**Regras:**
- Itens do orçamento principal: `lote = null`.
- Itens adicionados durante `em_execucao`: entram como complementos, com `lote = próximoLote()`.
- Itens de complementos começam com `status = pendente`.
- `próximoLote()`: maior lote existente + 1, ou 1 se ainda não houver complementos.
- Se o lote atual ainda tiver itens pendentes, novos itens entram no mesmo lote.
- Cada lote é apresentado como uma seção separada no documento de impressão.
- No faturamento, o total soma todos os itens `aprovado`, independentemente do lote.
- Aprovar ou recusar item de complemento não altera o status geral da OS.
- Complementos só existem a partir de `em_execucao`. Não há itens com `lote ≠ null` antes.

### 5.6 Garantia / Retorno em garantia

| Aspecto | Regra |
|---|---|
| Mecanismo | OS **nova** com `tipo: 'garantia'` + `osOriginalId` |
| OS original | Fica fechada, intocada |
| Workflow | Mesmo fluxo (aberta → ... → entregue) |
| Validação de prazo | Sistema avisa (badge "Garantia válida" / "Fora da garantia"). Não bloqueia |
| Itens | Podem ser R$ 0 (mão de obra coberta) ou com valor |
| Form de criação | Select "OS original" (busca por número/placa). Badge de prazo |
| Impressão | Mostra "Referência: OS #0042 (entregue em 01/11/2026)" no header |

### 5.7 Criação de OS (fluxo progressivo)

```
1. Cliente: [buscar/selecionar ▼]
   → Se não tem: "Cadastrar novo cliente" → /clientes/novo?redirect=/os/novo
   → Volta com redirect, cliente já selecionado

2. Veículo: [veículos do cliente ▼]  (só aparece depois de escolher o cliente)
   → Se não tem: "Cadastrar novo veículo" → /veiculos/novo?clienteId=X&redirect=/os/novo
   → Volta com redirect, veículo já selecionado

3. Campos da OS (queixa, km, data, previsão, mecânico, avarias, combustível...)
   → Só aparecem depois de veículo selecionado

4. Tipo: [Normal ▼] (opcional: "Garantia" → aparece select de OS original)
```

**Sem itens** — OS nasce `aberta`, vazia.

### 5.8 Estrutura da tela de OS

A tela de detalhe da OS usa `UTabs` **horizontais** (pill) com 3 abas: Resumo, Orçamento, Faturamento. Botões de transição (Iniciar diagnóstico / Iniciar execução / Concluir / Entregar) + Imprimir + Gerenciar ⚙ ficam no `UDashboardNavbar #right`. Ações da tab (Adicionar item, Enviar orçamento, Ajustar, etc.) ficam no SectionHeader dentro do body. As abas são visões da mesma OS; não criam entidades nem duplicam dados. Rota: `?tab=resumo|orcamento|faturamento`.

| Aba | Responsabilidade | Conteúdo e regras |
|---|---|---|
| **Resumo** | Contexto operacional e acompanhamento do serviço | 4 cards verticais (`space-y-4`): (1) Veículo: header (avatar + nome + placa + cliente + responsável) + badge Garantia + grid 2×2 (km, combustível, data entrada, previsão), (2) Queixa, (3) Diagnóstico, (4) Avarias. Edição inline (PUT). Sem rota separada de edição. |
| **Orçamento** | Construção, envio e aprovação dos itens | Itens em snapshot, agrupados entre orçamento principal (`lote = null`) e complementos (`lote >= 1`); quantidades, preços, desconto, totais derivados, estados dos itens, envio ao cliente e ações permitidas pelo status. Ajustar reabre o orçamento principal em `aguardando_aprovacao`; durante `em_execucao`, complementos podem ser adicionados diretamente. |
| **Faturamento** | Recebimentos e posição financeira da OS | Total aprovado, total pago líquido, saldo e badge de pagamento, todos derivados dos itens e dos lançamentos vinculados à OS. Pagamentos e estornos são registrados no Financeiro; não se armazena um segundo total financeiro na OS. |

**Histórico** (ex-"Notas"): card compacto abaixo das tabs, `max-height: 120px`, `overflow-y: auto`. 100% sistema. Linhas: dot + label tipo + data + **role** + texto. Ordenação: data desc.

**Regras de composição:**
- A OS é o registro principal que relaciona cliente, veículo, responsável, dados de entrada, workflow, itens e notas. As abas apenas separam responsabilidades de leitura e operação.
- A criação é progressiva: cliente → veículo → dados da OS. A OS nasce `aberta`, sem itens; o veículo é obrigatório.
- O responsável é obrigatório na criação, coerente com `funcionarioId` obrigatório no modelo.
- Ações disponíveis em cada aba dependem do status atual e do papel do usuário; a navegação entre abas não altera status.
- O faturamento é uma projeção dos lançamentos associados por `documentoId` e `documentoTipo`; não deve ser persistido como cópia dos valores da OS.

### 5.9 Número da OS

- Per-unidade (`unidade.nextOsNumber`)
- `padStart(4, '0')` → "0001", "0002", ... "9999", "10000"
- Nunca reutilizado (mesmo se apagar)
- Sem prefixo de ano

### 5.10 Estoque na OS (baixa, estorno e delta)

**Escopo:** só itens `tipo = 'produto'` com `catalogoId` existente. Serviço e item livre nunca movimentam estoque. O orçamento é só uma proposta; o estoque só sai quando o cliente aprova.

| Evento | Efeito no estoque |
|---|---|
| Item `pendente` → `aprovado` (individual, **Aprovar todos** ou aprovação automática; orçamento principal ou complemento) | Baixa de `quantidade`; `estoqueBaixado = true`; movimento `saida` (`os_baixa`). Vale também em OS `garantia` com preço R$ 0,00 |
| Adicionar, editar ou remover item `pendente` | Nenhum |
| Item `pendente` → `recusado` | Nenhum (nunca houve baixa) |
| Remover item com `estoqueBaixado = true` | Estorno integral; `estoqueBaixado = false`; movimento `entrada` (`os_estorno`) |
| **Reverter aprovação** (§5.4) | `aprovado` → `pendente`: estorno integral e `estoqueBaixado = false`. `recusado` → `pendente` não movimenta. Nova aprovação baixa de novo |
| **Cancelar OS** | Estorno atômico de todos os itens com `estoqueBaixado = true` (principal e complementos) |
| **Ajustar** (volta para `em_diagnostico`) | Nenhum: itens já aprovados continuam aprovados e baixados |
| Concluir / Entregar | Nenhum |

**Invariantes da função de estoque (`ajustarEstoqueItem` em `server/utils/estoque.ts`, operando sobre `ItemEstoque`):**

1. **Delta:** se a quantidade de um item com `estoqueBaixado` mudar (mesmo `catalogoId`): `Δ = novaQtd − qtdAnterior`. `Δ > 0` baixa o excedente; `Δ < 0` devolve a diferença.
2. **Troca de produto:** se o `catalogoId` de um item com `estoqueBaixado` mudar, devolve 100% da quantidade ao produto antigo e baixa a quantidade integral no novo (duas movimentações, uma operação).
3. **Idempotência:** `estoqueBaixado` impede baixa ou estorno em duplicidade.
4. **Atomicidade:** mudança de status/quantidade do item + `quantidadeAtual` + `MovimentoEstoque` + nota (quando houver) ocorrem juntas; falha em qualquer parte desfaz tudo.
5. **Sem trava:** saldo insuficiente nunca impede aprovar. A UI avisa com `Estoque Negativo` no modal de item e no toast da aprovação.
6. **Safe fallback:** se `catalogoId` estiver ausente, o produto não existir mais ou o `ItemEstoque` do produto não for encontrado, a baixa/estorno é ignorada, a operação principal (aprovar, remover, reverter, cancelar) **conclui normalmente** e a OS recebe nota `estoque`: "Estorno de estoque ignorado: {nome} não existe mais no catálogo".

> **Nota:** no MVP, item `aprovado` não é editável nem recusável individualmente (§4.8). Delta e troca de produto são garantias do utilitário para qualquer edição administrativa futura; não habilitam nenhuma tela nova.

### 5.11 Casos de borda do fluxo

Decisões para situações que o dia a dia da oficina vai provocar. Nenhuma altera os status nem as transições; só acrescentam pré-condições.

| Caso | Regra |
|---|---|
| **Todos os itens do orçamento principal recusados** | A OS permanece em `aguardando_aprovacao` (a auto-aprovação exige ≥ 1 item aprovado). O operador pode: (a) usar [Ajustar] para voltar a `em_diagnostico` e adicionar novos itens, ou (b) [Cancelar OS]. A UI mostra aviso: "Nenhum item aprovado no orçamento principal." |
| **Item aprovado com erro** (quantidade, preço ou produto errado) | Não há edição de item aprovado (§4.8). Em `aprovada`: **Reverter aprovação** (A+, e só sem pagamento). Em `em_execucao` ou depois: limitação do MVP. Registrar nota manual e tratar a diferença por devolução financeira. Correção administrativa de item aprovado (com estorno de estoque e nota) fica na Fase 2, reaproveitando as invariantes de §5.10 |
| **Cancelar OS com pagamento** | Bloqueado enquanto o pago líquido for > 0. Primeiro devolver (`devolucao`) ou estornar o pagamento. Para **reter** parte do valor (sinal, taxa de diagnóstico), não cancelar: manter um item de serviço aprovado (ex.: "Diagnóstico") e concluir a OS |
| **Reverter aprovação com pagamento** | Bloqueado enquanto o pago líquido for > 0 (evita total = 0 com valor pago). Devolver ou estornar antes |
| **Concluir com item `pendente`** | Bloqueado: aprovar ou recusar todos os itens pendentes, inclusive de complementos. Evita item que nunca é cobrado |
| **Entregar com saldo > 0** | Permitido (fiado). A OS segue em A Receber |
| **Pagamento maior que o saldo** | Recusado (`valor ≤ saldo`). Troco não é lançado: registra-se só o valor devido |
| **Desconto** | Centavos, `0 ≤ desconto ≤ soma dos itens não recusados` (no momento da edição); só G+; editável apenas em `em_diagnostico` / `aguardando_aprovacao`. Total final = `max(0, subtotal aprovado − desconto)`. **Se o cliente recusar itens após o desconto ser aplicado** (ex.: 3 itens de R$100, desconto R$200, cliente aprova 1 e recusa 2): o total é recalculado como `max(0, 100 − 200) = 0`. O desconto **não é recalculado automaticamente**; ele permanece como definido. Se a OS voltar a `em_diagnostico` via Ajustar, o operador pode reeditar o desconto. Se o total for 0, a OS não gera cobrança e o badge de pagamento não aparece |
| **Devolução ao cliente** | Permitida a qualquer momento por lançamento `devolucao` (G+), com nota na OS |

---

## 6. Financeiro

### 6.1 Princípio Central

> **`lancamento` é o registro único de cada movimento financeiro.** Cada linha pertence a uma Carteira ou a uma sessão de Caixa. Uma transferência interna gera duas linhas pareadas (origem e destino), sem duplicar o movimento econômico.

O financeiro do MVP oferece controle gerencial de entradas, saídas, saldos e rastreabilidade. Não deve ser apresentado como escrituração contábil completa, livro razão de partidas dobradas, conciliação bancária ou apuração fiscal. No MVP, Pix, crédito, débito e boleto creditam direto no saldo da Carteira banco, sem prazos de liquidação; por isso o saldo do Banco no sistema pode divergir do extrato real (prazos, taxas, antecipações) até existir conciliação de recebíveis (fase 2). Aporte, empréstimo, receita, despesa, transferência e ajuste de Caixa precisam permanecer identificáveis para permitir evolução futura sem reclassificar dados históricos.

### 6.2 Faturamento (sempre derivado)

```ts
const subtotal = os.itens
  .filter(i => i.status === 'aprovado')
  .reduce((s, i) => s + Math.round(i.quantidade * i.precoUnitario), 0)

const total = Math.max(0, subtotal - (os.desconto || 0))   // nunca negativo

const movimentosPagamento = lancamentos.filter(l =>
  l.documentoId === os.id &&
  l.documentoTipo === 'os' &&
  ['pagamento', 'devolucao'].includes(l.categoria || '') &&
  !l.estornoDe &&
  !lancamentos.some(e => e.estornoDe === l.id)
)

const pago = movimentosPagamento.reduce(
  (s, l) => s + (l.tipo === 'entrada' ? l.valor : -l.valor), 0
)

const saldo = total - pago

const badge = total === 0 ? null
  : saldo <= 0 ? 'pago'
  : pago > 0 ? 'parcial'
  : 'pendente'
```

| O que a UI mostra | De onde vem | Armazenado? |
|---|---|---|
| Total | `os.itens` (aprovados) | ❌ Calculado |
| Pago | Pagamentos líquidos vinculados à OS (entradas menos devoluções; pares estornados se anulam) | ❌ Calculado |
| Saldo | `total - pago` | ❌ Calculado |
| Badge | `saldo` vs `total` | ❌ Calculado |
| Lista de lançamentos | `lancamentos` (documentoId) | ✅ |

### 6.3 Caixa e Carteiras

| Estrutura | O que representa | Entradas | Saídas |
|---|---|---|---|
| **Caixa** (operacional) | Gaveta física identificada, com sessões de abertura/fechamento | Pagamentos em espécie, reforços, aportes registrados na sessão | Despesas em espécie (inclui Retirada Rápida), sangrias, fechamento |
| **Carteira Cofre** | Dinheiro em espécie guardado fora do balcão | Fechamento, sangria, aporte, transferência recebida | Abertura/reforço de Caixa, despesas em espécie, depósito no Banco |
| **Carteira Banco** | Valores em instituições/meios bancários | Pix, crédito, débito, boleto, transferências | Fornecedores, aluguel, folha, impostos, transferências |

**Regra de ouro:** Caixa é operacional; Cofre e Banco são Carteiras. Dinheiro físico retirado do Caixa vai para um Cofre. Pix nunca entra no Caixa.

### 6.4 Regras Automáticas

| Evento | O sistema faz |
|---|---|
| Modalidade = `dinheiro` | Sugere sessão de Caixa aberta autorizada; entrada direta no Cofre fica restrita a aportes/empréstimos identificados e operações específicas |
| Modalidade = `pix / credito / debito / boleto` | Sugere Carteira do tipo `banco` |
| Modalidade = `credito / debito / boleto` | Entrada imediata na Carteira banco, sem estado pendente nem compensação. Taxa da adquirente, se controlada, é saída manual `taxa_adquirente` |
| Modalidade = `dinheiro` sem sessão de Caixa aberta acessível | UI desabilita "Dinheiro" e orienta abrir um Caixa ou usar Pix/cartão; a API recusa o lançamento |
| OS 100% paga (saldo ≤ 0) | Badge → "Pago" |
| OS paga parcialmente (0 < saldo < total) | Badge → "Parcial" |
| OS aprovada com saldo = total | Badge → "Pendente" |
| Transferência | 2 lançamentos com mesmo `parId`; não altera receita/despesa operacional |
| Estorno | Novo lançamento com `estornoDe`; original deixa de compor saldo líquido |
| Aporte/empréstimo de sócio | Entrada identificada; nunca classificar como receita operacional |
| Sobra/quebra de Caixa | Ajuste explícito vinculado à sessão, separado de pagamento e despesa operacional |

### 6.5 A Receber / A Pagar (consultas, não entidades)

```ts
// A Receber:
const aReceber = os
  .filter(o => ['aprovada', 'em_execucao', 'concluida', 'entregue'].includes(o.status))
  .map(o => ({ os: o, saldo: calcularSaldo(o) }))
  .filter(x => x.saldo > 0)

// A Pagar (fase 2, com fornecedor):
const aPagar = lancamentos
  .filter(l => l.tipo === 'saida' && !l.estornoDe && !lancamentos.some(e => e.estornoDe === l.id) && l.categoria !== 'transferencia' && l.data > hoje)
```

### 6.6 Fiado

**Não é entidade.** É uma OS com `saldo > 0` e sem data de vencimento. Aparece em "A Receber" (consulta).

### 6.7 Categorias

| Tipo | Categorias |
|---|---|
| **Entrada** | `pagamento`, `aporte`, `emprestimo_socio`, `sobra_caixa`, `transferencia` (perna de entrada), `outro` |
| **Saída** | `devolucao`, `peca`, `material`, `alimento`, `fixo`, `folha`, `imposto`, `taxa_adquirente`, `retirada_rapida`, `transferencia` (perna de saída), `quebra_caixa`, `outro` |

`transferencia`, `aporte`, `emprestimo_socio`, `sobra_caixa` e `quebra_caixa` devem ser apresentados separadamente do resultado operacional. `retirada_rapida` e `taxa_adquirente` são despesas operacionais. `devolucao` é saída de dinheiro, mesmo quando vinculada a uma OS.

---

## 7. Caixa

### 7.1 Conceitos e regras

- Uma unidade pode ter vários Caixas identificados por nome (ex.: Recepção, Balcão 1, Oficina).
- Cada Caixa possui sessões próprias; só pode haver uma sessão aberta por Caixa, mas Caixas diferentes podem operar simultaneamente.
- Caixa é exclusivamente operacional e movimenta dinheiro em espécie. Não é Carteira e não mantém saldo permanente fora de uma sessão.
- Carteiras são apenas `cofre` ou `banco`. Cada Caixa pode operar com um ou mais Cofres da unidade, conforme permissão/configuração.
- Abertura, reforço e fechamento usam Cofre como origem/destino físico. Banco não transfere diretamente para Caixa; eventual retirada bancária precisa ser registrada como entrada física no Cofre antes.
- Caixa fechado não recebe pagamentos nem despesas vinculadas à sessão encerrada.
- Toda movimentação pertence a exatamente uma sessão de Caixa ou uma Carteira.
- O saldo esperado da sessão é a soma de entradas menos saídas de todos os lançamentos vinculados. A transferência de abertura já está incluída como entrada; `valorAbertura` é metadado da sessão e não pode ser somado novamente.
- Fechamento não apaga nem altera movimentos anteriores; cria a transferência final e encerra a sessão.

### 7.2 Cadastro e permissões

- Nome obrigatório e único por unidade; exemplos: `Recepção`, `Balcão 1`, `Balcão 2`.
- Cadastro, edição, ativação/desativação e associação de usuários: `owner`/`admin`.
- `gerente` consulta e opera todos os Caixas.
- `recepcionista` opera apenas os Caixas aos quais está associado e para os quais seu role permite a ação.
- A API valida unidade, role, associação ativa, Caixa ativo e estado da sessão em cada operação.
- Não é permitido desativar Caixa com sessão aberta; histórico permanece consultável.

### 7.3 Abrir Caixa

1. Usuário seleciona um Caixa ativo ao qual tem acesso.
2. Informa o valor de abertura e, se maior que zero, seleciona uma Carteira Cofre de origem. O Caixa não fica permanentemente vinculado a um único usuário; os usuários autorizados são configurados por associação. Se não existir nenhuma Carteira do tipo `cofre` ativa na unidade, a UI mostra: "Crie um Cofre antes de abrir o Caixa." com link para `/carteiras`. A API também recusa (`400`).
3. O sistema cria uma `SessaoCaixa` com responsável, data/hora, valor e Caixa.
4. Se valor > 0, cria transferência atômica: saída na Carteira Cofre + entrada na sessão, vinculadas por `parId`.
5. Se valor = 0, não cria transferência; a sessão começa com saldo zero.
6. Não existe origem `bolso` nem seleção de Banco como origem direta.

### 7.4 Movimentações durante a sessão

| Ação | Registro | Regra |
|---|---|---|
| Recebimento em espécie | Entrada na sessão | Exige sessão aberta acessível ao usuário (trava, §4.10). Deve estar associado a OS/Venda quando aplicável |
| Despesa em espécie | Saída na sessão | Categoria, motivo e responsável obrigatórios |
| **Retirada Rápida** | Saída na sessão | Atalho da despesa em espécie: só valor + justificativa. Categoria fixa `retirada_rapida`; responsável = usuário logado; vínculo com OS opcional. Respeita o saldo da sessão |
| Reforço | Transferência Cofre → sessão | Dois lançamentos com mesmo `parId` |
| Sangria | Transferência sessão → Cofre | Dois lançamentos com mesmo `parId` |
| Aporte do proprietário | Entrada na sessão | Categoria `aporte`, contraparte identificada; não é receita |
| Empréstimo de sócio | Entrada na sessão | Categoria `emprestimo_socio`, contraparte identificada; não é receita |

Despesas pagas diretamente pelo Cofre são lançamentos de saída vinculados à Carteira Cofre e podem ocorrer mesmo quando todos os Caixas estão fechados. Não exigem abertura artificial de sessão.

### 7.5 Fechar Caixa

1. Sistema calcula e apresenta o saldo esperado antes do fechamento.
2. Usuário informa o valor contado fisicamente e o motivo quando houver diferença.
3. Se valor contado < esperado, cria saída de ajuste `quebra_caixa` na sessão pelo valor da diferença.
4. Se valor contado > esperado, cria entrada de ajuste `sobra_caixa` na sessão pelo valor da diferença.
5. Os ajustes são vinculados à sessão e ao responsável, com justificativa; não são pagamentos de cliente nem despesas operacionais comuns.
6. Se o valor contado for maior que zero, o sistema transfere esse valor da sessão para uma Carteira Cofre selecionada, com dois lançamentos pareados por `parId`; se for zero, encerra sem criar transferência.
7. A sessão é encerrada com esperado, contado, diferença, motivo, responsável e data/hora.
8. A transferência, os ajustes e o encerramento devem ocorrer atomicamente; em caso de falha, nenhum deles pode ficar parcialmente gravado.

**Tratamento de diferenças:**
- `sobra_caixa` e `quebra_caixa` aparecem separadamente nos relatórios de Caixa e no histórico da sessão.
- Não entram como faturamento, pagamento de OS ou venda.
- Não podem ser editadas silenciosamente. Correção exige estorno/ajuste autorizado, justificativa e trilha de auditoria.

### 7.6 Transferências e movimentações fora do Caixa

- Transferência entre Carteiras gera saída na origem e entrada no destino, com mesmo `parId`.
- Transferência de espécie entre Cofre e Banco é uma operação própria, distinta do fechamento do Caixa.
- Despesas pagas diretamente pelo Cofre ou Banco são lançadas na respectiva Carteira.
- Aporte e empréstimo de sócio podem entrar diretamente no Cofre ou em sessão aberta, sempre identificando contraparte e natureza.

### 7.7 Tela de Caixa (`/unidade/[unidadeId]/caixa`)

A tela apresenta os Caixas disponíveis ao usuário, seus estados, sessões abertas, responsáveis e saldos esperados. A identificação do Caixa é feita pelo nome configurado; o acesso respeita o role e a associação do usuário. Ao entrar em um Caixa, mostra abertura, entradas, saídas, reforços, sangrias, ajustes e ação de fechamento. Histórico de sessões fechadas permanece disponível para consulta conforme permissões. A sessão aberta oferece atalhos de **Retirada Rápida**, reforço, sangria e fechamento.

---

## 8. PDV (Venda Rápida)

### 8.1 Tela (`/unidade/[unidadeId]/pdv`)

```
┌─────────────────────────────────────────────────────────────┐
│  PDV                                                         │
│                                                             │
│  Cliente: [João Silva ▼]  (opcional, "Avulso" se não tem)  │
│                                                             │
│  🔍 [buscar no catálogo...]                                 │
│  ○ Filtro de óleo 5W30    R$ 85  [produto]  [+ Adicionar]  │
│  ○ Pastilha de freio      R$ 120 [produto]  [+ Adicionar]  │
│                                                             │
│  ┌─ Itens ──────────────────────────────────────────────┐   │
│  │  Filtro de óleo 5W30        1 × R$ 85,00    R$ 85,00│   │
│  │  Pastilha de freio          1 × R$ 120,00   R$ 120,00│  │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Total: R$ 205,00                                          │
│  Forma: [Pix ▼]      Destino: [Banco Principal ▼]          │
│  (Dinheiro → Caixa aberto; sem Caixa aberto, "Dinheiro" fica bloqueado)│
│                                                             │
│  [Finalizar venda]                                         │
└─────────────────────────────────────────────────────────────┘
```

> **Nota:** o autocomplete filtra apenas `tipo = 'produto'` (ver §4.12). Serviços não aparecem.

### 8.2 Ao Finalizar

1. Se a forma for `dinheiro`, valida a sessão de Caixa aberta acessível ao usuário (trava, §4.10).
2. Cria `Venda` + `VendaItem[]`.
3. Cria `Lancamento` (entrada, modalidade, destino compatível, `documentoId = venda.id`, `documentoTipo = 'venda'`).
4. Dá baixa de estoque de cada item (movimento `venda_baixa`). Saldo insuficiente não bloqueia.
5. Abre modal de recibo (`PrintPreview.vue` modo "RECIBO").
6. Toast: "Venda V-0001 finalizada".

Os passos 2 a 4 são atômicos: se qualquer um falhar, nada é gravado.

### 8.3 Número da Venda

- Per-unidade (`unidade.nextVendaNumber`)
- Formato: "V-0001", "V-0002", ...

---

## 9. Agenda

### 9.1 Tela (`/unidade/[unidadeId]/agenda`)

```
┌─────────────────────────────────────────────────────────────┐
│  Agenda                                    [Dia][Semana][Mês]│
│  ‹  Novembro 2026  ›                    [Hoje]  [+ Agendar] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [DIA]   Grade horária (08:00-18:00)                        │
│          08:00 ──────────────────────────────────           │
│          09:00 ── 📅 João · Gol · Troca de óleo [agendado]  │
│          10:00 ──────────────────────────────────           │
│          14:00 ── 🚗 OS 0042 · Gol · Previsão de entrega    │
│          15:00 ──────────────────────────────────           │
│                                                             │
│  [SEMANA]  7 colunas (Seg-Dom) × horas                      │
│            Cada bloco colorido por status                    │
│            Drag pra mudar dia/hora (agendamento)            │
│                                                             │
│  [MÊS]   Grid 5×7                                           │
│            Cada dia: count + dots coloridos                  │
│            "3" no dia 5 → click → abre o dia                │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Cores

| Cor | Significado |
|---|---|
| 🔵 Azul | Agendado (pré-OS) |
| 🟣 Violeta | Em diagnóstico |
| 🟡 Âmbar | Aguardando aprovação |
| 🟢 Verde | Em execução / Concluída (previsão de entrega) |
| ⚪ Cinza | Entregue / Cancelado |

### 9.3 O que o calendário mostra

| Fonte | Campo de data | Quando aparece |
|---|---|---|
| `Agendamento` | `dataHora` | Status `agendado` |
| `OS` | `dataEntrada` | Status `aberta` (carro chegou) |
| `OS` | `previsaoEntrega` | Status `em_execucao` / `concluida` (quando sai) |

### 9.4 Ações

| Ação | Como |
|---|---|
| Criar agendamento | Botão "+ Agendar" → modal (cliente, veículo, data/hora, serviço, obs) |
| Converter em OS | Click no agendamento → "Criar OS" → `/os/novo?agendamentoId=X` |
| Remarcar | Drag-and-drop (semana/dia) ou editar data no modal |
| Cancelar | No modal do agendamento |
| Ver OS | Click no bloco de OS → navega pra `/os/[osId]` |

### 9.5 MVP vs. Futuro

| Item | MVP | Futuro |
|---|---|---|
| Dia / Semana / Mês | ✅ | — |
| Color-coded por status | ✅ | — |
| Criar agendamento (modal) | ✅ | — |
| Converter agendamento → OS | ✅ | — |
| Drag-and-drop (remarcar) | ✅ (semana/dia) | — |
| Capacidade (quantos carros cabem) | ❌ | Fase 2 |
| Slots de 30/60min | ❌ | Fase 2 |
| Link de agendamento pro cliente | ❌ | Fase 2 |
| Lembretes (WhatsApp/SMS) | ❌ | Fase 3 |
| Recorrência | ❌ | Fase 3 |

---

## 10. Impressão / Documentos

### 10.1 PrintPreview — Shell genérico de impressão

`PrintPreview.vue` é o shell reutilizável de visualização e impressão de documentos A4. Ele NÃO contém templates de documento — recebe o conteúdo via slot (default).

**Funcionalidades do shell:**
- Preview fullscreen (overlay, fundo escuro com blur)
- Deep Zoom localizado (Ctrl+Scroll desktop / Pinch mobile) — ponto sob o cursor permanece estático
- Zoom inicial reduzido em mobile (A4 cabe na tela)
- Barra de zoom flutuante (botões +/-, indicador %)
- Copiar imagem (PNG, scale 2x, via modern-screenshot → clipboard)
- Imprimir (window.print() com @media print isolado)
- Fechar (ESC ou botão X)
- Responsivo: toolbar compacta em mobile

**Uso (qualquer feature):**
```vue
<PrintPreview :title="'ORÇAMENTO'" :is-open="aberto" @close="aberto = false">
  <OrcamentoTemplate :os="os" :config="config" />
</PrintPreview>
```

**Templates A4 (componentes separados em `app/components/templates/`):**

| Template | Props | Quando usa |
|----------|-------|-----------|
| `OrcamentoTemplate.vue` | os, config | OS em aguardando_aprovacao (orçamento principal) |
| `OrcamentoComplementarTemplate.vue` | os, config, lote | OS em em_execucao (complemento) |
| `NotaServicoTemplate.vue` | os, config | OS em concluida/entregue |
| `ReciboTemplate.vue` | venda, config | PDV (venda finalizada) |

Novos templates: criar arquivo em `app/components/templates/` + usar no PrintPreview. Não modificar o shell.

### 10.2 Layout A4

```
[Empresa: nome, endereço, telefone, CNPJ]  ← do Config

ORÇAMENTO / ORÇAMENTO COMPLEMENTAR / NOTA DE SERVIÇO / RECIBO · OS-0042
Data: 14/11/2026 · Válido até: 28/11/2026  ← dataCriacao + config.validadeDias
[Se garantia:] Referência: OS #0042 (entregue em 01/11/2026)

Cliente: João da Silva
Veículo: VW Gol 1.6 2019 · Placa: ABC1D23

[Se complementar:]
Referência: orçamento principal aprovado em {dataAprovacao}

[Se complementar:]
ITENS JÁ APROVADOS (referência)
  ... (com strikethrough se recusado)

ITENS (ou ITENS DO COMPLEMENTO [lote N])
  #  DESCRIÇÃO          TIPO     QTD   UNIT.    TOTAL

Subtotal:  R$ X
Desconto: - R$ Y
TOTAL:     R$ Z

[Se NOTA DE SERVIÇO:]
Forma de pagamento: PIX
Data de entrega: 05/11/2026

[Se RECIBO:]
Forma de pagamento: PIX
Data: 04/11/2026

Observações: {config.textoObservacoes}
Garantia: {config.textoGarantia}

[Se há recusados:]
Itens recusados pelo cliente:
• {nome} (R$ {valor}) — {motivo}

_________________ Assinatura
```

### 10.3 Regras

- Total **só soma** itens `aprovado` (ou `pendente` no orçamento padrão)
- Recusados: strikethrough na tabela + seção "Itens recusados" no rodapé
- Se não há recusados → seção não aparece
- **Zero fetch** — lê do estado reativo da OS + config (já em memória)
- Botões (`.no-print`): [← Voltar] · [📷 Salvar imagem] · [🖨 Imprimir / PDF]
- `modern-screenshot` pro PNG (WhatsApp / clipboard)
- `window.print()` pro PDF (papel)
- PrintPreview é 100% front-end: zero fetch, zero persistência. Dados vêm do estado reativo (OS, Venda, Config já em memória).
- O registro de envio (EnvioOrcamento) é feito pela API, não pelo PrintPreview.
- Zoom: 30% a 300%, step 15%, Ctrl+Scroll / Pinch / botões.
- Imagem: PNG, scale 2x (Retina), copia pra clipboard.
- Mobile: zoom inicial 45%, toolbar compacta, botões com ícone.
- @media print: esconde shell, mostra só o A4 (transform: none).

### 10.4 Como abre

**Modal de seleção (quando há 2+ documentos disponíveis):**
- Se a OS tem orçamento principal E complementos → modal com lista:
  - "Orçamento Principal"
  - "Complemento [lote 1]"
  - "Complemento [lote 2]"
  - (se concluida/entregue) "Nota de Serviço"
- Usuário seleciona → abre PrintPreview com o template correspondente

**Abre direto (quando há 1 documento):**
- OS em aguardando_aprovacao (só principal) → abre direto
- PDV finalizada → abre direto (recibo)
- OS em concluida sem complementos → abre direto (nota de serviço)

### 10.5 Envio do orçamento

O comando **Enviar orçamento** só fica disponível quando o diagnóstico da oficina está preenchido e existe ao menos um item no orçamento. Não se envia orçamento vazio ou sem diagnóstico.

O modal pede o canal:

| Canal | MVP | O que faz |
|---|---|---|
| Impressão / PDF | ✅ | Abre o `PrintPreview` para imprimir ou salvar PDF |
| Imagem (PNG) | ✅ | Gera a imagem (`modern-screenshot`) para o operador mandar por WhatsApp |
| E-mail | ❌ Fase 2 | Aparece desabilitado ("Em breve") |
| Link para o cliente | ❌ Fase 2 | Aparece desabilitado ("Em breve") |

Regras:
- No MVP, confirmar o modal registra `EnvioOrcamento` (`gerado`) e avança a OS (§4.9.1). Falha ao gerar o documento não avança a OS.
- O registro do envio é separado da decisão do cliente: guarda canal, data, resultado e referência.
- A aprovação é registrada por item (decisão do cliente repassada pelo operador), com data.
- Reenvios geram novos registros; não sobrescrevem o histórico.
- `enviado: boolean` no item indica apenas se ele foi incluído em algum envio vigente; o histórico está em `EnvioOrcamento`.
- Fase 2: e-mail e link só concluem após confirmação da API; a aprovação recebida por link público é persistida pela API.

### 10.6 Futuro — Link público e aprovação online

Rota `/p/[token]` (SSR, layout blank) — mesma renderização do componente, mas pública. Cliente aprova via WhatsApp/link; a API persiste as decisões e a interface da unidade consulta o estado atualizado.

---

## 11. Busca

### 11.1 Princípio

> O sistema **não classifica** o que o usuário digitou. Normaliza a query e testa contra **todos os campos** em paralelo (OR). Se qualquer um bater → retorna. É `Ctrl+F` com N campos.

### 11.2 Normalização

```ts
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

const q = stripAccents(query.trim()).toLowerCase()
const qDigits = q.replace(/\D/g, '')  // pra CPF/CNPJ
```

### 11.3 Regras

| Regra | Por quê |
|---|---|
| **Mínimo 3 caracteres** | 1-2 chars retorna tudo (inútil) |
| **Debounce 300ms** | 1 busca por palavra (não por letra) |
| **Client-side first** | Se achou nos itens da página, não chama API |
| **OR em todos os campos** | Não precisa "saber" o que o usuário digitou |
| **Strip accents + lowercase** | "Joao" bate com "João" |
| **CPF: remove `\D`** | "123" bate com "123.456.789-00" |
| **Placa: UPPERCASE** | Armazenada canônica, busca `.toLowerCase().includes(q)` |

### 11.4 Campos buscados por tela

| Tela | Campos |
|---|---|
| **OS** | `numero`, `cliente.nome`, `veiculo.placa`, `cliente.cpf` |
| **Veículos** | `placa`, `marca`, `modelo`, `cliente.nome`, `cliente.cpf` |
| **Clientes** | `nome`, `cpf`, `cnpj`, `telefone` |
| **Catálogo / Estoque** | `nome`, `sku` |
| **Agenda** | `cliente.nome`, `veiculo.placa`, `servico` |

---

## 12. Soft Delete / Lixeira

### 12.1 Regras

| Entidade | Estratégia |
|---|---|
| `OS` | Soft delete (`deletedAt`) + Lixeira 30 dias |
| `Cliente` | Soft delete + Lixeira 30 dias |
| `Veiculo` | Soft delete + Lixeira 30 dias |
| `Lancamento` | **Hard delete proibido** — estorno no lugar |
| `MovimentoEstoque` | **Hard delete proibido** — novo movimento corrige |
| `Catalogo` | Hard delete (OS e Vendas antigas ficam íntegras pelo snapshot; estornos usam o safe fallback — §5.10) |
| `Funcionario` | `ativo: false` (desativar, não apagar) |
| `Venda` | Sem exclusão no MVP (gera `Lancamento`, que nunca é apagado). Correção: estornar o lançamento e ajustar o estoque |
| `Agendamento` | Sem hard delete: cancelar = `status: 'cancelado'` (some do calendário, permanece no histórico) |

### 12.2 Fluxo

1. Usuário clica "Excluir" → `window.confirm` → `deletedAt = now`
2. Item some das listagens normais
3. Aparece em `/unidade/[unidadeId]/lixeira` (com data + "Restaurar" + "Excluir definitivamente")
4. Após 30 dias → purge automático (hard delete) — **Fase 2** (job agendado)

### 12.3 Visibilidade

- Lixeira: visível só pra `gerente` e `admin` (ou `owner`)
- Per-unidade (cada unidade gerencia o que apagou)

---

## 13. Relatórios

### 13.1 Estrutura

```
/unidade/[unidadeId]/relatorios          → Index (cards com links + resumo rápido)
/unidade/[unidadeId]/relatorios/financeiro  → Resultado do período, saldos, a receber, a pagar, exportação CSV contábil
/unidade/[unidadeId]/relatorios/caixa       → Sessões, fechamentos, sobras/quebras por Caixa
```

**Futuro (arquivos separados):**
- `/relatorios/operacional` — OS por período, por mecânico, tempo médio, comeback
- `/relatorios/vendas` — Receita por serviço/peça, ticket médio, top clientes
- `/relatorios/contabil` — Export CSV pra contador, entradas/saídas por categoria

### 13.2 Cada página tem

- Filtro de período (hoje, semana, mês, personalizado)
- Tabela/resumo
- Botão "Exportar CSV"
- No futuro: "Exportar PDF" + "Enviar ao contador"
- O financeiro do MVP é controle gerencial e rastreabilidade de caixa/bancos; não substitui escrituração contábil de partidas dobradas, conciliação bancária ou obrigações fiscais.

### 13.3 Financeiro (MVP)

| Seção | Conteúdo |
|---|---|
| **Resultado do período** | Receitas e despesas operacionais; excluir transferências, aportes, empréstimos de sócio e ajustes de Caixa |
| **A Receber** | OS com saldo > 0 (status ≥ aprovada) |
| **A Pagar** | Lançamentos saída com data futura (fase 2, com fornecedor) |
| **Saldo por Carteira** | Cada Cofre/Banco com saldo calculado |
| **Saldo por Caixa** | Sessões abertas, valores esperados e responsáveis |
| **Últimos lançamentos** | Extrato de Carteiras e sessões, com origem/destino |

### 13.4 Caixa (MVP)

| Seção | Conteúdo |
|---|---|
| **Histórico de fechamentos** | Caixa, sessão, responsáveis, fundo, entradas, saídas, esperado, contado, diferença, destino Cofre |
| **Sobras/Quebras** | Filtro por unidade/Caixa/período; valores e motivos, separados de receita/despesa operacional |
| **Por período** | Total de sobras, total de quebras |
| **Retiradas rápidas** | Lista por Caixa/período com valor, justificativa e responsável |

### 13.5 Exportação contábil (CSV)

Botões "Exportar CSV" na página Financeiro, com o filtro de período da página. Disponível para o perfil Administração (`gerente`+).

| Arquivo | Colunas | Regras |
|---|---|---|
| **OS** | N° OS, Cliente, CPF/CNPJ, Data (entrada), Status da OS, Valor total, Desconto, Status de pagamento | OS com status ≥ `aprovada` e não canceladas, com `dataEntrada` no período. Valor total e status de pagamento são derivados (§6.2) |
| **Lançamentos** | Data, Tipo, Categoria, Modalidade, Valor, Descrição (observação), Local (Carteira ou Caixa/sessão), Documento (OS/Venda), Estorno de | Todos os lançamentos do período, inclusive transferências e estornos, que o contador identifica pela categoria `transferencia` e pela coluna Estorno de |

**Formato:** UTF-8 com BOM, separador `;`, decimal com vírgula, datas `dd/mm/aaaa` (abre direto no Excel pt-BR).

**Endpoint:** `GET /api/unidade/:unidadeId/relatorios/exportar-csv?tipo=os|lancamentos&dataInicio=&dataFim=`. Não confundir com `/backup/csv`, que é cópia de segurança por entidade, sem filtro de período.

---

## 14. Dashboard

### 14.1 Tela (`/unidade/[unidadeId]/`)

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard — [Oficina do João]                               │
│                                                             │
│  ┌─ Hoje ──────────────────────────────────────────────┐    │
│  │  OS em aberto: 5    ·    Caixa: Aberto (R$ 275)    │    │
│  │  Previsão de entrega: 2   ·    A receber: R$ 1.200│    │
│  │  Vendas de hoje: R$ 235 (2)                        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─ Últimas OS ───────────────────────────────────────┐    │
│  │  0045 · Pedro · JKL9M01 · Em diagnóstico          │    │
│  │  0044 · Ana · RST2U34 · Aguardando aprovação      │    │
│  │  0043 · Carlos · XYZ4E56 · Em execução            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─ Alertas ──────────────────────────────────────────┐    │
│  │  ⚠ OS 0040: previsão de entrega era hoje           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 14.2 Alertas (MVP)

| Alerta | Cálculo |
|---|---|
| "Previsão de entrega vencida/hoje" | `OS.previsaoEntrega <= hoje` (data local da unidade) AND status NOT IN (`entregue`, `cancelada`) |
| "Produtos para repor" | `ItemEstoque` com `quantidadeMinima` definida e `quantidadeAtual <= quantidadeMinima` (inclui `Estoque Negativo`) |

**Fase 2:**
- Caixa aberto há N dias
- OS com saldo > 30 dias
- OS sem movimento há 7 dias
- Cliente sem retorno

---

## 15. Onboarding

### 15.1 Fluxo (primeiro boot)

```
storage vazio → /onboarding

Step 1: Nome da oficina + CNPJ (opcional) + Telefone
Step 2: Caixa inicial ("Recepção") — só confirma
Step 3: Seu usuário (nome + email) → role: owner (senha: "123456" por default)

→ Seed automático: tenant + unidade 1 + caixa inicial + config + catálogo inicial (10–15 itens comuns; cada produto já com `ItemEstoque` de saldo 0). **Sem Carteiras** — o usuário cria na tela `/carteiras`
→ Loga automaticamente
→ Redirect: /unidade/1/ (dashboard)
```

Se o storage já tem dados → pula direto pro dashboard.

### 15.2 "Nova oficina" (futuro, multi-unidade)

Mesmo fluxo em Settings → "Nova unidade".

---

## 16. Backup / Export

### 16.1 Tela (`/unidade/[unidadeId]/configuracoes?tab=backup`)

```
┌─────────────────────────────────────────────────────────────┐
│  Backup                                                      │
│                                                             │
│  Exportar todos os dados (JSON)                             │
│  [📥 Exportar]                                              │
│                                                             │
│  Importar backup (JSON)                                     │
│  [📤 Selecionar arquivo] [Importar]                         │
│  ⚠ Importar substitui todos os dados atuais                 │
│                                                             │
│  Exportar CSV (por entidade)                                │
│  Clientes [CSV] · Veículos [CSV] · OS [CSV]                │
│  Lançamentos [CSV] · Catálogo [CSV] · Vendas [CSV]        │
│  Estoque [CSV]                                            │
└─────────────────────────────────────────────────────────────┘
```

### 16.2 Regras

- **JSON completo:** dump de todo o `StorageShape` da unidade (1 arquivo, restaura tudo)
- **CSV por entidade:** cópia de dados / Excel (o CSV de Estoque traz saldo e mínimo; o de Catálogo, preço e custo). Para o contador, usar a Exportação contábil (§13.5)
- O JSON completo inclui as coleções de estoque, envios de orçamento e histórico de lançamentos (todo o `StorageShape`)
- **Import:** substitui tudo (com `window.confirm` duplo)
- No futuro (D1): backup automático diário (Wrangler export)

---

## 17. Rotas

### 17.1 Painel Admin (`/`)

| Rota | Descrição | Papel |
|---|---|---|
| `/` | Dashboard admin | owner |
| `/unidades` | Listagem de unidades | owner |
| `/unidades/novo` | Criar unidade | owner |
| `/unidades/[unidadeId]` | Detalhe da unidade | owner |
| `/unidades/[unidadeId]/editar` | Editar unidade | owner |
| `/usuarios` | Listagem de usuários | owner |
| `/usuarios/novo` | Criar usuário | owner |
| `/usuarios/[usuarioId]` | Detalhe (roles por unidade) | owner |
| `/usuarios/[usuarioId]/editar` | Editar usuário | owner |
| `/configuracoes` | Config global do tenant | owner |

### 17.2 Painel da Unidade (`/unidade/[unidadeId]/`)

| Rota | Descrição | Papel (detalhe por ação na 3.5) |
|---|---|---|
| `/unidade/[unidadeId]/` | Dashboard | todos |
| `/unidade/[unidadeId]/agenda` | Calendário (?view=dia\|semana\|mes) | todos |
| `/unidade/[unidadeId]/os` | Listagem de OS | todos |
| `/unidade/[unidadeId]/os/novo` | Criar OS | recepcionista, G+ |
| `/unidade/[unidadeId]/os/[osId]` | Detalhe (?tab=resumo\|orcamento\|faturamento) | todos |
| `/unidade/[unidadeId]/pdv` | Tela PDV | recepcionista, G+ |
| `/unidade/[unidadeId]/pdv/[vendaId]` | Detalhe da venda (recibo) | todos |
| `/unidade/[unidadeId]/clientes` | Listagem (cross-unit) | todos |
| `/unidade/[unidadeId]/clientes/novo` | Criar cliente | recepcionista, G+ |
| `/unidade/[unidadeId]/clientes/[clienteId]` | Detalhe | todos |
| `/unidade/[unidadeId]/clientes/[clienteId]/editar` | Editar | recepcionista, G+ |
| `/unidade/[unidadeId]/veiculos` | Listagem (só da unidade) | todos |
| `/unidade/[unidadeId]/veiculos/novo` | Criar veículo | recepcionista, G+ |
| `/unidade/[unidadeId]/veiculos/[veiculoId]` | Detalhe | todos |
| `/unidade/[unidadeId]/veiculos/[veiculoId]/editar` | Editar | recepcionista, G+ |
| `/unidade/[unidadeId]/catalogo` | Catálogo de serviços e produtos | ver: todos · editar: G+ |
| `/unidade/[unidadeId]/estoque` | Estoque de produtos | ver: todos · ajustar: G+ |
| `/unidade/[unidadeId]/caixa` | Caixas e sessões autorizadas | recepcionista, G+ |
| `/unidade/[unidadeId]/carteiras` | Carteiras (lista, transferir, despesa, entrada, excluir) | G+ |
| `/unidade/[unidadeId]/relatorios` | Index de relatórios | G+ |
| `/unidade/[unidadeId]/relatorios/financeiro` | Financeiro + exportação CSV contábil | G+ |
| `/unidade/[unidadeId]/relatorios/caixa` | Caixa (fechamentos) | G+ |
| `/unidade/[unidadeId]/lixeira` | Soft delete | G+ |
| `/unidade/[unidadeId]/configuracoes` | Config (?tab=oficina\|caixas\|funcionarios\|backup) | A+ |

### 17.3 Rotas Públicas

| Rota | Descrição | Quando |
|---|---|---|
| `/login` | Login | MVP |
| `/onboarding` | Wizard | MVP |
| `/404` | Not found | MVP |
| `/p/[token]` | Link público de OS | Fase 2 |

### 17.4 Regras de Navegação

| Padrão | Regra |
|---|---|
| POST → Redirect | `navigateTo(redirect \|\| /entidade/:id)` |
| PUT → Voltar pro detalhe | `navigateTo('/entidade/:id')` |
| Cancelar (edição) | Volta pro detalhe (não pra lista) |
| Cancelar (criação) | Volta pra lista |
| 404 | Genérico, sem tratamento especial |

---

## 18. Sidebar (painel da unidade)

| Item | Rota | Visível para |
|---|---|---|
| Dashboard | `/unidade/[unidadeId]/` | todos |
| Agenda | `/agenda` | todos |
| OS | `/os` | todos |
| PDV | `/pdv` | `recepcionista`, G+ |
| Clientes | `/clientes` | todos |
| Veículos | `/veiculos` | todos |
| Catálogo | `/catalogo` | todos |
| Estoque | `/estoque` | todos |
| Caixa | `/caixa` | `recepcionista` (Caixas associados), G+ |
| Carteiras | `/carteiras` | G+ |
| Relatórios | `/relatorios` | G+ |
| Lixeira | `/lixeira` | G+ |
| Configurações | `/configuracoes` | A+ |

Item sem permissão não aparece no menu; acesso direto pela URL continua barrado por middleware e pela API.

---

## 19. Regras de Negócio (Resumo Completo)

> **Nota:** esta seção é o índice consolidado. Cada regra já está detalhada na seção canônica referenciada. Se houver conflito, vale a seção canônica.

### OS

| # | Regra | Canônica |
|---|---|---|
| 1 | OS é sempre de um veículo já cadastrado | §5.7 |
| 2 | Preço é snapshot (congelado no add) | §4.8 |
| 3 | Total sempre calculado, nunca armazenado | §6.2 |
| 4 | Mesmo item no mesmo lote e ainda `pendente` → soma a quantidade | §4.8 |
| 5 | `aprovado` é terminal para decisão individual | §4.8 |
| 6 | `recusado` é terminal para decisão individual | §4.8 |
| 7 | [Ajustar] reabre o orçamento principal em `aguardando_aprovacao`; complementos direto em `em_execucao` | §5.3 |
| 8 | Motivo do ajuste → nota genérica | §4.9 |
| 9 | Recusa/remoção → nota específica | §4.9 |
| 10 | Adicionar em `em_diagnostico` → sem nota | §4.9 |
| 11 | Adicionar em `em_execucao` → entra como `pendente`, `lote: N` | §5.5 |
| 12 | OS aprova quando não há itens pendentes no principal e existe ≥ 1 aprovado | §5.1 |
| 13 | Cancelar: antes de `concluida` | §5.1 |
| 14 | Excluir (soft): só `aberta` | §5.1 |
| 15 | `numero`: sequencial per-unidade, `padStart(4, '0')`, nunca reutilizado | §5.9 |
| 16 | `token`: Web Crypto, 64 hex, gerado no create | `ARCHITECTURE.md` |
| 17 | Concluir ≠ Pagar (independentes) | §5.1 |
| 18 | Pagamento: só status ≥ `aprovada` | §5.1 |
| 19 | Garantia = OS nova com `tipo: 'garantia'` + `osOriginalId` | §5.6 |
| 20 | Lote: null = principal, 1/2/3... = complementos | §5.5 |
| 21 | Reverter aprovação: A+; reabre itens do principal; exige motivo | §5.4 |
| 22 | Avarias: free text | §4.7 |
| 23 | Combustível: enum (E, 1/4, 2/4, 3/4, Cheio) | §4.7 |
| 24 | Garantia no Config (global), não per-OS | §4.14 |
| 25 | Funcionário responsável: obrigatório na criação | §5.7 |

### Estoque

| # | Regra | Canônica |
|---|---|---|
| 26 | Catálogo é referência; estoque é `ItemEstoque` (1:1, só produto) | §4.6, §4.6.3 |
| 27 | `catalogoId` opcional; item livre não movimenta estoque | §4.8 |
| 28 | Baixa no aceite do item aprovado (inclusive R$ 0 em garantia) | §5.10 |
| 29 | Estorno: remoção, reversão, cancelamento | §5.10 |
| 30 | Delta e troca de produto (invariantes) | §5.10 |
| 31 | `estoqueBaixado` = idempotência; operação atômica | §5.10 |
| 32 | Estoque nunca bloqueia: avisa `Estoque Negativo` | §1.2, §5.10 |
| 33 | Safe fallback: produto inexistente não derruba a operação | §5.10 |
| 34 | `ItemEstoque.quantidadeAtual` só muda via `estoque.ts` + `MovimentoEstoque` | §4.6.3 |
| 35 | PDV: baixa imediata na finalização | §8.2 |
| 36 | Compra de peça e entrada de estoque: operações independentes no MVP | §4.6.1 |

### Financeiro

| # | Regra | Canônica |
|---|---|---|
| 37 | `lancamento` é registro único; transferência = 2 pernas pareadas | §6.1 |
| 38 | Saldo da Carteira/sessão: sempre calculado | §4.10 |
| 39 | Saldo da OS: pagamentos líquidos vinculados | §6.2 |
| 40 | Faturamento: sempre derivado | §6.2 |
| 41 | Modalidade define destino | §4.10 |
| 42 | Trava de Caixa fechado: dinheiro exige sessão aberta | §4.10 |
| 43 | Meios digitais creditam direto; taxa é saída manual | §4.10 |
| 44 | Estorno: novo lançamento com `estornoDe` | §4.10 |
| 45 | Transferência: 2 lançamentos com `parId` | §4.10 |
| 46 | Caixa é operacional; só movimenta espécie | §7.1 |
| 47 | Lançamentos em espécie exigem sessão aberta + usuário autorizado | §7.2 |
| 48 | Fechamento transfere valor contado → Cofre (parId) | §7.5 |
| 49 | Abertura/reforço: somente Cofre como origem | §7.3 |
| 50 | Abertura com valor zero não gera transferência | §7.3 |
| 51 | Múltiplos Caixas; cada um com nome, permissões e sessões próprias | §7.1 |
| 52 | Sobra/quebra: ajuste explícito, auditável, separado | §7.5 |
| 53 | Cofre paga despesas mesmo sem sessão aberta | §7.4 |
| 54 | Aporte/empréstimo: entradas externas, não faturamento | §4.10 |
| 55 | Retirada Rápida: despesa operacional em espécie na sessão | §7.4 |
| 56 | `data` editável com auditoria (`LancamentoHistorico`) | §4.10 |
| 57 | `dataCriacao` não editável | §4.10 |
| 58 | Fiado: OS com saldo > 0 (consulta) | §6.6 |
| 59 | A Receber / A Pagar: consultas, não entidades | §6.5 |
| 60 | Transferências não contam no resultado | §6.7 |
| 61 | Compra a prazo: lançamento com data futura | §4.10 |
| 62 | `documentoId` e `fornecedorId` são ortogonais | §4.10 |
| 63 | `lancamento` nunca é deletado | §12.1 |
| 64 | MVP: controle gerencial, não escrituração contábil | §6.1 |
| 65 | Carteiras: tela própria (`/carteiras`), não Config | §4.11 |
| 66 | Onboarding não seeda Carteiras | §15.1 |
| 67 | Excluir Carteira: A+; guard (sessão aberta bloqueia; lançamentos → NULL) | §4.11 |
| 68 | Renomear Carteira: G+, sem guard (FK por ID) | §4.11 |
| 69 | Sem Cofre ativo → não abre Caixa (empty state + link) | §7.3 |

### Busca

| # | Regra | Canônica |
|---|---|---|
| 70–78 | Ver §11 (Busca) | §11 |

### Catálogo

| # | Regra | Canônica |
|---|---|---|
| 79 | Catálogo é autocomplete de preço; `catalogoId` serve só para estoque | §4.6 |
| 80 | Item copia nome, unidade e preço (snapshot) | §4.8 |
| 81 | Catálogo pode ser desligado (OS funciona sem) | §4.6 |
| 82 | Item livre funciona igual | §4.8 |
| 83 | `tipo` do item de catálogo é imutável | §4.6 |

### Notas

| # | Regra | Canônica |
|---|---|---|
| 84–88 | Ver §4.9 (Nota) | §4.9 |

### PDV

| # | Regra | Canônica |
|---|---|---|
| 89 | Venda não tem workflow/status | §4.12 |
| 90 | Ao finalizar: cria lançamento automaticamente | §8.2 |
| 91 | Número: "V-0001" (sequência separada da OS) | §8.3 |
| 92 | Cliente opcional (pode ser "avulso") | §4.12 |
| 93 | Venda não é excluída no MVP | §12.1 |

### Agenda

| # | Regra | Canônica |
|---|---|---|
| 94 | Agendamento → OS via conversão | §9.4 |
| 95 | `realizado` = OS criada | §4.13 |
| 96 | `cancelado` = status (sem hard delete) | §12.1 |
| 97 | Drag-and-drop só em dia/semana | §9.4 |

### Multi-tenant

| # | Regra | Canônica |
|---|---|---|
| 98 | `unidadeId` em toda entidade de unidade | §2.2 |
| 99 | Clientes são cross-unit (tenant) | §2.2 |
| 100 | API valida `unidade.usuarioId === sessao.userId` | §3.1 |
| 101 | MVP: single unidade (default 1) | §2.4 |

---

## 20. Métricas de Sucesso (MVP)

| Métrica | Alvo |
|---|---|
| Tempo para criar OS (cliente → veículo → queixa) | < 30 segundos |
| Tempo para lançar pagamento | < 10 segundos |
| Tempo para abrir/fechar caixa | < 15 segundos |
| Tempo para finalizar venda PDV | < 20 segundos |
| Busca (resultado na tela) | < 300ms (client-side) / < 100ms (server) |
| Troca de tab na OS (sem reload) | Instantâneo (0ms) |
| PrintPreview (abrir → A4 renderizado) | < 100ms |
| Onboarding (primeiro boot → dashboard) | < 2 minutos |
| Adicionar item (com quantidade) na OS | < 5 segundos |
| Baixa/estorno de estoque (operação local) | < 50ms |
| Exportação CSV contábil | 1 clique |

---

## 21. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Storage local (arquivos do dev) corrompido ou apagado | Perde todos os dados | Backup JSON diário (hábito) + export antes de mudanças grandes; uma chave por coleção limita o dano |
| Conflito de escrita (2 abas abertas) | Dados inconsistentes | MVP: lock de escrita + transação no adapter. Fase 2: D1 `batch()` |
| State machine complexa (lotes + reverter + garantia) | Bugs de transição | Testes unitários em `server/utils/os.ts` |
| Catálogo vazio no início | Usuário desiste | Seed com 10–15 itens comuns |
| Migração do storage do MVP → D1 | Perda de dados | Export JSON + script que insere preservando IDs, sem transformação; `schemaVersion` |
| Escopo creep (MVP) | Atraso | PRD é o contrato. "Futuro" é futuro. Se não está nas seções 1–22, não é MVP |
| Esquecer de dar entrada das peças compradas | Saldo vai a `Estoque Negativo` | Badge + alerta "Produtos para repor" no Dashboard; entrada rápida no modal de ajuste |
| Saldo do Banco diverge do extrato real (cartão/boleto creditam na hora) | Decisão errada sobre dinheiro disponível | Limitação documentada (§4.10, §6.1); lançar `taxa_adquirente`; recebíveis/conciliação na fase 2 |
| Item da OS e saldo de estoque fora de sincronia | Saldo incorreto | `estoqueBaixado` + `MovimentoEstoque` + operação atômica; testes unitários em `server/utils/estoque.ts` |

---

## 22. Glossário

| Termo | Definição |
|---|---|
| **OS** | Ordem de Serviço. Workflow completo: diagnóstico → orçamento → execução → entrega |
| **PDV** | Ponto de Venda. Venda rápida sem workflow. Abriu → vendeu → fechou |
| **Lote** | Agrupamento de itens de complemento. `null` = orçamento principal, `1/2/3...` = complementos |
| **Carteira** | Estrutura financeira que guarda valores; tipos `cofre` ou `banco` |
| **Cofre** | Carteira de dinheiro em espécie, fora do Caixa; pode pagar despesas diretamente |
| **Caixa** | Estrutura operacional identificada (ex.: Recepção), que recebe dinheiro em espécie durante uma sessão |
| **Sessão de Caixa** | Período entre abertura e fechamento de um Caixa; mantém responsável, movimentos e conferência |
| **Banco** | Carteira de valores bancários. Pix, crédito, débito, boleto e transferências |
| **Sobra de Caixa** | Valor contado maior que o saldo esperado; ajuste explícito, não faturamento |
| **Quebra de Caixa** | Valor contado menor que o saldo esperado; ajuste explícito, não despesa operacional comum |
| **Snapshot** | Item copia nome, unidade e preço do catálogo no momento do add. Catálogo muda, OS não muda |
| **Ajustar** | Reabre o orçamento principal em `aguardando_aprovacao`; não é necessário para incluir complementos durante a execução |
| **Reverter** | Na OS aprovada, reabre os itens aprovados e recusados do orçamento principal como pendentes; exige papel admin/owner, motivo e preserva histórico |
| **Envio do orçamento** | Registro por tentativa/canal; não equivale à aprovação do cliente. Impressão gerada não comprova entrega |
| **Garantia** | OS nova com `tipo: 'garantia'` + `osOriginalId`. OS original fica fechada |
| **Fiado** | OS com saldo > 0. Não é entidade, é consulta |
| **ParId** | Vínculo entre 2 lançamentos de transferência (1 saída + 1 entrada) |
| **Estorno** | Novo lançamento com `estornoDe` apontando pro original. Nunca apaga |
| **Lixeira** | Soft delete (30 dias). Restaurar ou excluir definitivo |
| **Catálogo** | Cadastro mestre de serviços e produtos da unidade (preço sugerido, custo, unidade). Fonte do autocomplete |
| **Estoque** | Saldo físico dos produtos do catálogo (`quantidadeAtual`), com baixa automática e ajuste manual |
| **Baixa de estoque** | Débito do saldo quando o item da OS é aprovado (ou a venda é finalizada). Estorno ao remover, reverter ou cancelar |
| **Estoque Negativo** | Saldo < 0, tolerado: avisa, mas não bloqueia a operação |
| **MovimentoEstoque** | Registro append-only de cada entrada/saída de estoque |
| **Safe fallback** | Produto inexistente na baixa/estorno não derruba a operação; grava nota na OS |
| **Retirada Rápida** | Atalho do Caixa para pequena despesa em dinheiro (`retirada_rapida`): só valor + justificativa |
| **Perfil de acesso** | Agrupamento de roles para menus: Administração (owner/admin/gerente) e Operacional (mecanico/recepcionista) |

---

> **Fim do PRD.md.**
