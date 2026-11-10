# ARCHITECTURE — Oficina Core

> **Versão:** 1.10.2 · 07/11/2026
> **Escopo:** Decisões técnicas de implementação. O "o quê" e "por quê" estão em `PRD.md`. Convenções de código e UI em `CONVENTIONS.md`.

---

## 1. Stack

| Camada | Escolha |
|---|---|
| Framework | Nuxt 4 (`ssr: false`) |
| UI | Nuxt UI v4 (Reka UI + Tailwind CSS) |
| Validação | Zod (frontend + server/utils) |
| Estado | `useFetch` (sem Pinia) |
| Types | `app/types/index.d.ts` (auto-import) |
| Ícones | Lucide (`i-lucide-*`) |
| Storage (MVP/dev) | `useStorage` (unstorage) atrás do adapter `server/utils/storage.ts`; driver de arquivo (`.data/`) |
| Storage (Fase 2) | Cloudflare Workers + D1 |
| IDs | Numéricos (auto-increment via `nextId`) |
| Datas | ISO string em UTC (`new Date().toISOString()`); fuso do negócio só na exibição e nos filtros |
| Dinheiro | Inteiro em centavos |
| Token (OS) | Web Crypto (`crypto.getRandomValues`), 64 hex |
| Imagem (print) | `html2canvas` (~45KB gzip) |
| Busca | `stripAccents()` + `toLowerCase()` |
| Auth (MVP) | Simulada (senha fixa) — arquitetura real |
| Auth (Fase 2) | argon2id + cookie + D1.sessions |

---

## 2. Arquitetura de Storage

```
┌────────────────────────────────────────────────────────────────┐
│  server/api/*.ts      valida (Zod), autoriza (PRD §3.5), chama utils │
│          │                                                      │
│  server/utils/*.ts    regras de negócio (sempre async)          │
│          │            usam SOMENTE o adapter                    │
│  server/utils/storage.ts   ÚNICA camada que toca o storage      │
├────────────────────────────────────────────────────────────────┤
│  MVP / dev / teste   unstorage, driver de arquivo (.data/<env>) │
│  Fase 2 / produção   D1 — mesmas funções, mesmas assinaturas    │
└────────────────────────────────────────────────────────────────┘
```

> **Por que arquivo e não localStorage:** as rotas `server/api` rodam no servidor (Nitro) e não enxergam o localStorage do navegador. O driver de arquivo mantém o que importa para o desenvolvimento (simples, inspecionável, resetável apagando a pasta) e preserva a arquitetura "API de verdade". O driver é configurável; um driver de localStorage só serve se a "API" rodar inteira no cliente, o que não é o caminho previsto.

### 2.1 Regras do adapter

1. `server/api` nunca acessa storage. `server/utils` nunca chama `useStorage` direto; usa o adapter: `db.list(colecao, filtro)`, `db.get`, `db.insert` (gera o ID), `db.update`, `db.transaction(async tx => { ... })`.
2. **Coleções = tabelas D1**, 1:1 (camelCase ↔ snake_case). Nada de array embutido: itens e notas da OS, itens da venda, envios e histórico são coleções próprias (§4). Relacionamento sempre por ID.
3. **Uma chave por coleção** (`os`, `lancamentos`...), não um blob único: limita o tamanho de cada escrita e o raio de dano de corrupção.
4. **Transação (MVP):** lock assíncrono global no processo + escrita em memória; só grava no commit. Erro no meio descarta tudo. Toda operação que muda mais de uma entidade (aprovar item + estoque + nota, transferência, fechamento de Caixa, venda + lançamento + estoque) roda dentro de `db.transaction`. **Fase 2:** a mesma assinatura vira `D1.batch()`.
5. **Versionamento:** o storage guarda `schemaVersion`. `server/utils/migrations.ts` tem a lista `{ version, up(db) }` executada no boot. O backup JSON leva a versão; import recusa versão maior e migra versão menor.
6. **Ambientes:** `dev`, `test` e `prod` usam pastas/bancos separados, escolhidos por variável de ambiente. `test` é resetável por script (seed limpo antes de cada suíte).
7. **Reset e seed:** apagar a pasta do ambiente + `seed.ts` (onboarding). Nenhuma lógica de seed fora de `seed.ts`.
8. **Migração para D1:** script lê o export JSON e faz `INSERT` na ordem das FKs, **preservando os IDs**. Como a forma dos dados já é a das tabelas e dinheiro/data já seguem §3, não há transformação.

**Regra:** funções em `server/utils/` são **sempre async**. No MVP, o `await` resolve o adapter de arquivo; na Fase 2, resolve a query D1. Zero mudança no `server/api/`.

---

## 3. Convenções de Dados

| Tema | Regra |
|---|---|
| **Dinheiro** | Inteiro em **centavos** em todo campo monetário (`preco`, `custo`, `precoUnitario`, `desconto`, `valor`, `saldoInicial`, `valorAbertura`, `saldoEsperadoFechamento`, `valorContado`, `diferenca`). `8500` = R$ 85,00. Nunca float. Formatação só na UI |
| **Quantidade** | Número decimal (até 3 casas). Total do item = `Math.round(quantidade × precoUnitario)`, sempre inteiro; total da OS = soma de inteiros − desconto |
| **Datas** | ISO em **UTC** no storage |
| **Fuso do negócio** | `Config.fusoHorario` (padrão `America/Sao_Paulo`). "Hoje", início/fim de período, "previsão vencida" e agrupamento por dia usam a data **local** da unidade. Parâmetros `dataInicio`/`dataFim` das APIs são datas locais `YYYY-MM-DD`, convertidas para UTC no servidor |
| **IDs** | Numéricos, gerados no servidor |
| **Helpers** | `server/utils/dinheiro.ts` (parse/format/arredondamento) e `server/utils/datas.ts` (conversões e limites de dia/período). Proibido recalcular isso inline |

---

## 4. Storage Shape (MVP) — espelho das tabelas D1

```ts
interface StorageShape {
  usuarios: Usuario[]
  unidades: Unidade[]
  usuarioUnidades: UsuarioUnidade[]
  clientes: Cliente[]
  veiculos: Veiculo[]
  catalogo: ItemCatalogo[]
  estoque: ItemEstoque[]
  movimentosEstoque: MovimentoEstoque[]
  os: Omit<OrdemServico, 'itens' | 'notas'>[]
  osItens: ItemOS[]
  osNotas: Nota[]
  enviosOrcamento: EnvioOrcamento[]
  lancamentos: Lancamento[]
  lancamentoHistorico: LancamentoHistorico[]
  carteiras: Carteira[]
  caixas: Caixa[]
  caixaUsuarios: CaixaUsuario[]
  sessoesCaixa: SessaoCaixa[]
  vendas: Omit<Venda, 'itens'>[]
  vendaItens: VendaItem[]
  agendamentos: Agendamento[]
  config: Config[]
  nextId: Record<string, number>
  schemaVersion: number
}
```

> **Entidade ≠ storage:** `OrdemServico.itens`/`notas` e `Venda.itens` (PRD §4) são a **visão devolvida pela API**; o `server/utils` monta o objeto juntando as coleções. No storage, cada coleção é uma tabela, como na D1.

### 4.1 Seed (onboarding)

```ts
{
  usuarios: [{ id: 1, nome: "João", email: "joao@oficina.com", senhaHash: "123456", ativo: true }],
  unidades: [{ id: 1, usuarioId: 1, nome: "Oficina do João", ativo: true, nextOsNumber: 1, nextVendaNumber: 1 }],
  usuarioUnidades: [{ id: 1, usuarioId: 1, unidadeId: 1, role: 'owner', ativo: true }],
  carteiras: [],
  caixas: [{ id: 1, unidadeId: 1, nome: 'Recepção', ativo: true }],
  caixaUsuarios: [],
  catalogo: [],   // seed opcional: 10–15 itens comuns
  estoque: [],    // 1 ItemEstoque (saldo 0) por produto do catálogo seed
  sessoesCaixa: [],
  config: [{ unidadeId: 1, nome: 'Oficina do João', validadeDias: 15, fusoHorario: 'America/Sao_Paulo' }],
  schemaVersion: 1,
  nextId: { usuario: 2, unidade: 2, usuarioUnidade: 2, cliente: 1, veiculo: 1, catalogo: 1, estoque: 1, os: 1, lancamento: 1, carteira: 1, caixa: 2, caixaUsuario: 1, sessaoCaixa: 1, venda: 1, agendamento: 1, movimentoEstoque: 1, envioOrcamento: 1, lancamentoHistorico: 1 }
}
```

---

## 5. Segurança

### 5.1 MVP (piso mínimo)

| Item | Decisão |
|---|---|
| TLS | 1.3 (Cloudflare por padrão, quando migrar) |
| Cookie | `__Host-session` (HttpOnly, Secure, SameSite=Lax) |
| Rate limit | Não (MVP local) |
| Logs | Nunca logar email, nome, placa, CPF |
| Backup | Manual (export JSON) |
| LGPD | Canal `privacidade@...` + política publicada (futuro) |
| Senha | Simulada (MVP). Coluna `senhaHash` pronta |
| Autorização | A API valida role, unidade, associação ao Caixa e sessão aberta em toda mutação financeira. UI (menus, botões, trava de dinheiro) é só conveniência |

### 5.2 Fase 2

| Item | Decisão |
|---|---|
| Senha | argon2id (`@node-rs/argon2`) |
| Turnstile | Cloudflare Turnstile no login |
| Rate limit | KV, 5/IP/15min (anon) + por unidade_id (auth) |
| Sessão | D1.sessions (revogação instantânea) |
| Ações sensíveis | Checam D1.sessions |
| Backup | D1 export diário (Wrangler) |
| Criptografia de campo | Só se guardar CPF/CNH |
| Audit log | Tabela `events` (90 dias retenção) |

### 5.3 Fora do MVP (Fase 3+)

| Item |
|---|
| MFA / SSO / Google login |
| KMS / criptografia de campo |
| Pentest |
| SOC 2 / ISO 27000 |

---

## 6. Árvore de Arquivos

```
oficina-core/
├── app/
│   ├── types/
│   │   └── index.d.ts
│   ├── layouts/
│   │   ├── default.vue             # Admin (simples)
│   │   ├── unidade.vue             # Unidade (dashboard template)
│   │   └── blank.vue               # Login, onboarding, 404
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── SectionHeader.vue
│   │   │   ├── DataField.vue
│   │   │   └── ListItem.vue
│   │   ├── catalogo/
│   │   │   └── ItemModal.vue
│   │   ├── estoque/
│   │   │   └── AjusteEstoqueModal.vue
│   │   ├── os/
│   │   │   ├── StatusBadge.vue
│   │   │   ├── PaymentBadge.vue
│   │   │   ├── ItemRow.vue
│   │   │   ├── ItemModal.vue
│   │   │   ├── AjustarModal.vue
│   │   │   ├── RecusarModal.vue
│   │   │   ├── GerenciarModal.vue
│   │   │   ├── EnvioOrcamentoModal.vue
│   │   │   ├── AprovarTodosModal.vue
│   │   │   ├── PagamentoModal.vue
│   │   │   └── PrintPreview.vue
│   │   ├── pdv/
│   │   │   ├── ItemRow.vue
│   │   │   └── ReciboModal.vue
│   │   ├── agenda/
│   │   │   ├── CalendarDay.vue
│   │   │   ├── CalendarWeek.vue
│   │   │   ├── CalendarMonth.vue
│   │   │   └── AgendamentoModal.vue
│   │   ├── caixa/
│   │   │   ├── AbrirCaixaModal.vue
│   │   │   ├── FecharCaixaModal.vue
│   │   │   ├── ReforcoModal.vue
│   │   │   ├── SangriaModal.vue
│   │   │   ├── DespesaModal.vue
│   │   │   └── RetiradaRapidaModal.vue
│   │   ├── carteiras/
│   │   │   ├── NovaCarteiraModal.vue
│   │   │   ├── TransferirModal.vue
│   │   │   ├── DespesaModal.vue
│   │   │   └── EntradaExternaModal.vue
│   │   ├── financeiro/
│   │   │   ├── LancamentoModal.vue
│   │   │   ├── TransferirModal.vue
│   │   │   └── EstornoModal.vue
│   │   ├── relatorios/
│   │   │   └── ExportCsvButton.vue
│   │   ├── onboarding/
│   │   │   ├── StepOficina.vue
│   │   │   ├── StepCaixas.vue
│   │   │   └── StepUsuario.vue
│   │   └── shared/
│   │       ├── SearchInput.vue
│   │       └── PeriodoFilter.vue
│   │
│   ├── composables/
│   │   ├── useAuth.ts
│   │   ├── useUnidade.ts
│   │   ├── useConfig.ts
│   │   ├── useCarteiras.ts
│   │   ├── useCaixas.ts
│   │   ├── useOS.ts
│   │   ├── useSearch.ts
│   │   └── useToast.ts
│   │
│   ├── middleware/
│   │   ├── auth.global.ts
│   │   ├── unidade.ts
│   │   └── role.ts
│   │
│   ├── pages/
│   │   ├── index.vue
│   │   ├── login.vue
│   │   ├── onboarding.vue
│   │   ├── 404.vue
│   │   ├── unidades/
│   │   │   ├── index.vue
│   │   │   ├── novo.vue
│   │   │   └── [unidadeId]/
│   │   │       ├── index.vue
│   │   │       └── editar.vue
│   │   ├── usuarios/
│   │   │   ├── index.vue
│   │   │   ├── novo.vue
│   │   │   └── [usuarioId]/
│   │   │       ├── index.vue
│   │   │       └── editar.vue
│   │   ├── configuracoes/
│   │   │   └── index.vue
│   │   └── unidade/
│   │       └── [unidadeId]/
│   │           ├── index.vue
│   │           ├── agenda/
│   │           │   └── index.vue
│   │           ├── os/
│   │           │   ├── index.vue
│   │           │   ├── novo.vue
│   │           │   └── [osId]/
│   │           │       ├── index.vue
│   │           │       └── editar.vue
│   │           ├── pdv/
│   │           │   ├── index.vue
│   │           │   └── [vendaId].vue
│   │           ├── clientes/
│   │           │   ├── index.vue
│   │           │   ├── novo.vue
│   │           │   └── [clienteId]/
│   │           │       ├── index.vue
│   │           │       └── editar.vue
│   │           ├── veiculos/
│   │           │   ├── index.vue
│   │           │   ├── novo.vue
│   │           │   └── [veiculoId]/
│   │           │       ├── index.vue
│   │           │       └── editar.vue
│   │           ├── catalogo/
│   │           │   └── index.vue
│   │           ├── estoque/
│   │           │   └── index.vue
│   │           ├── caixa/
│   │           │   └── index.vue
│   │           ├── carteiras/
│   │           │   └── index.vue
│   │           ├── relatorios/
│   │           │   ├── index.vue
│   │           │   ├── financeiro.vue
│   │           │   └── caixa.vue
│   │           ├── lixeira/
│   │           │   └── index.vue
│   │           └── configuracoes/
│   │               └── index.vue
│   │
│   └── assets/
│       └── css/
│           └── main.css
│
├── server/
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── unidade.ts
│   │
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login.post.ts
│   │   │   ├── logout.post.ts
│   │   │   ├── refresh.post.ts
│   │   │   └── switch-unidade.post.ts
│   │   ├── onboarding.post.ts
│   │   ├── admin/
│   │   │   ├── unidades/
│   │   │   │   ├── index.get.ts
│   │   │   │   ├── index.post.ts
│   │   │   │   ├── [unidadeId].get.ts
│   │   │   │   ├── [unidadeId].put.ts
│   │   │   │   └── [unidadeId].delete.ts
│   │   │   ├── usuarios/
│   │   │   │   ├── index.get.ts
│   │   │   │   ├── index.post.ts
│   │   │   │   ├── [usuarioId].get.ts
│   │   │   │   ├── [usuarioId].put.ts
│   │   │   │   └── [usuarioId].delete.ts
│   │   │   └── config/
│   │   │       ├── index.get.ts
│   │   │       └── index.put.ts
│   │   └── unidade/
│   │       └── [unidadeId]/
│   │           ├── dashboard.get.ts
│   │           ├── os/
│   │           │   ├── index.get.ts
│   │           │   ├── index.post.ts
│   │           │   ├── [osId].get.ts
│   │           │   ├── [osId].put.ts
│   │           │   ├── [osId].delete.ts
│   │           │   └── [osId]/
│   │           │       ├── status.post.ts
│   │           │       ├── ajustar.post.ts
│   │           │       ├── aprovar.post.ts
│   │           │       ├── reverter.post.ts
│   │           │       ├── cancelar.post.ts
│   │           │       ├── itens.post.ts
│   │           │       ├── itens/[itemId].put.ts
│   │           │       ├── itens/[itemId].delete.ts
│   │           │       ├── itens/[itemId]/
│   │           │       │   ├── aprovar.post.ts
│   │           │       │   └── recusar.post.ts
│   │           │       ├── envios.get.ts
│   │           │       ├── envios.post.ts
│   │           │       └── notas.post.ts
│   │           ├── lixeira/
│   │           │   ├── index.get.ts
│   │           │   ├── [entidadeId].put.ts
│   │           │   └── [entidadeId].delete.ts
│   │           ├── pdv/
│   │           │   ├── index.get.ts
│   │           │   ├── index.post.ts
│   │           │   └── [vendaId].get.ts
│   │           ├── agenda/
│   │           │   ├── index.get.ts
│   │           │   ├── index.post.ts
│   │           │   ├── [agId].put.ts
│   │           │   ├── [agId].delete.ts
│   │           │   └── [agId]/
│   │           │       └── converter.post.ts
│   │           ├── clientes/
│   │           │   ├── index.get.ts
│   │           │   ├── index.post.ts
│   │           │   ├── [clienteId].get.ts
│   │           │   ├── [clienteId].put.ts
│   │           │   └── [clienteId].delete.ts
│   │           ├── veiculos/
│   │           │   ├── index.get.ts
│   │           │   ├── index.post.ts
│   │           │   ├── [veiculoId].get.ts
│   │           │   ├── [veiculoId].put.ts
│   │           │   └── [veiculoId].delete.ts
│   │           ├── catalogo/
│   │           │   ├── index.get.ts
│   │           │   ├── index.post.ts
│   │           │   ├── [itemId].put.ts
│   │           │   └── [itemId].delete.ts
│   │           ├── estoque/
│   │           │   ├── index.get.ts
│   │           │   ├── ajustar.post.ts
│   │           │   └── [catalogoId]/movimentos.get.ts
│   │           ├── caixas/
│   │           │   ├── index.get.ts
│   │           │   ├── index.post.ts
│   │           │   ├── [caixaId].put.ts
│   │           │   ├── [caixaId]/usuarios.put.ts
│   │           │   ├── [caixaId]/sessoes.get.ts
│   │           │   ├── [caixaId]/sessao-aberta.get.ts
│   │           │   ├── [caixaId]/abrir.post.ts
│   │           │   ├── [caixaId]/fechar.post.ts
│   │           │   ├── [caixaId]/reforco.post.ts
│   │           │   ├── [caixaId]/sangria.post.ts
│   │           │   └── [caixaId]/despesa.post.ts
│   │           ├── lancamentos/
│   │           │   ├── index.get.ts
│   │           │   ├── index.post.ts
│   │           │   ├── resumo.get.ts
│   │           │   └── [lancamentoId]/
│   │           │       └── estornar.post.ts
│   │           ├── carteiras/
│   │           │   ├── index.get.ts
│   │           │   ├── index.post.ts
│   │           │   ├── [carteiraId].put.ts
│   │           │   ├── [carteiraId].delete.ts
│   │           │   ├── transferir.post.ts
│   │           │   ├── [carteiraId]/despesa.post.ts
│   │           │   └── [carteiraId]/entrada-externa.post.ts
│   │           ├── relatorios/
│   │           │   ├── financeiro.get.ts
│   │           │   ├── caixa.get.ts
│   │           │   └── exportar-csv.get.ts
│   │           ├── config/
│   │           │   ├── index.get.ts
│   │           │   └── index.put.ts
│   │           ├── funcionarios/
│   │           │   └── index.get.ts
│   │           └── backup/
│   │               ├── export.get.ts
│   │               ├── import.post.ts
│   │               └── csv.get.ts
│   │
│   ├── utils/
│   │   ├── auth.ts
│   │   ├── storage.ts
│   │   ├── migrations.ts
│   │   ├── os.ts
│   │   ├── financeiro.ts
│   │   ├── lancamentos.ts
│   │   ├── carteiras.ts
│   │   ├── caixas.ts
│   │   ├── sessoes-caixa.ts
│   │   ├── clientes.ts
│   │   ├── veiculos.ts
│   │   ├── catalogo.ts
│   │   ├── estoque.ts
│   │   ├── agenda.ts
│   │   ├── pdv.ts
│   │   ├── busca.ts
│   │   ├── dinheiro.ts
│   │   ├── datas.ts
│   │   └── seed.ts
│   │
│   └── plugins/
│       └── storage.ts
│
├── nuxt.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 7. Endpoints (Resumo Completo)

### Auth

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Login (email + senha) → set cookie |
| POST | `/api/auth/logout` | Apaga cookie |
| POST | `/api/auth/refresh` | Re-emite cookie (silencioso) |
| POST | `/api/auth/switch-unidade` | Troca unidadeId no cookie |

### Onboarding

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/onboarding` | Seed: tenant + unidade + Caixa inicial + config + usuário |

### Admin

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/admin/unidades` | Lista unidades do tenant |
| POST | `/api/admin/unidades` | Cria unidade |
| GET | `/api/admin/unidades/:unidadeId` | Detalhe |
| PUT | `/api/admin/unidades/:unidadeId` | Atualiza |
| DELETE | `/api/admin/unidades/:unidadeId` | Desativa |
| GET | `/api/admin/usuarios` | Lista usuários |
| POST | `/api/admin/usuarios` | Cria usuário |
| GET | `/api/admin/usuarios/:usuarioId` | Detalhe (roles por unidade) |
| PUT | `/api/admin/usuarios/:usuarioId` | Atualiza |
| DELETE | `/api/admin/usuarios/:usuarioId` | Desativa |
| GET | `/api/admin/config` | Config global |
| PUT | `/api/admin/config` | Atualiza |

### OS

| Método | Rota | Descrição | Restrição |
|---|---|---|---|
| GET | `/api/unidade/:unidadeId/os` | Lista (denormalizado + badge) | `?q=&status=&page=&dataInicio=&dataFim=` |
| POST | `/api/unidade/:unidadeId/os` | Cria OS | — |
| GET | `/api/unidade/:unidadeId/os/:osId` | Detalhe (1 call: OS + itens + lançamentos + notas + envios) | — |
| PUT | `/api/unidade/:unidadeId/os/:osId` | Atualiza campos | `aberta` ou `em_diagnostico` |
| DELETE | `/api/unidade/:unidadeId/os/:osId` | Soft delete | `aberta` |
| POST | `/api/unidade/:unidadeId/os/:osId/status` | Transição | Transições válidas (PRD §5.1) |
| POST | `/api/unidade/:unidadeId/os/:osId/ajustar` | Ajustar `{ motivo }` | `aguardando_aprovacao` |
| POST | `/api/unidade/:unidadeId/os/:osId/aprovar` | Aprova todos (baixa o estoque dos produtos aprovados) | `aguardando_aprovacao` |
| POST | `/api/unidade/:unidadeId/os/:osId/reverter` | Reverter `{ motivo }` (estorna o estoque dos itens baixados) | `aprovada`, A+, pago líquido = 0 |
| GET | `/api/unidade/:unidadeId/os/:osId/envios` | Histórico de envios | — |
| POST | `/api/unidade/:unidadeId/os/:osId/envios` | Registra envio `{ canal, itensIds }` | OS em estado que permita envio |
| POST | `/api/unidade/:unidadeId/os/:osId/cancelar` | Cancelar `{ motivo }` (estorna o estoque dos itens baixados) | Antes de `concluida`, pago líquido = 0 |
| POST | `/api/unidade/:unidadeId/os/:osId/itens` | Adiciona item(s) `{ catalogoId?, nome, tipo, quantidade, precoUnitario }` | `em_diagnostico` ou `em_execucao` |
| PUT | `/api/unidade/:unidadeId/os/:osId/itens/:itemId` | Edita item | item `pendente`; bloqueado se `enviado = true` **E** OS em `aguardando_aprovacao` |
| DELETE | `/api/unidade/:unidadeId/os/:osId/itens/:itemId` | Remove item (estorna o estoque se já baixado) | item `pendente`; bloqueado se `enviado = true` **E** OS em `aguardando_aprovacao` |
| POST | `/api/unidade/:unidadeId/os/:osId/itens/:itemId/aprovar` | Aprova item (baixa o estoque de produto com `catalogoId`) | Item `pendente` |
| POST | `/api/unidade/:unidadeId/os/:osId/itens/:itemId/recusar` | Recusa `{ motivo }` | Item `pendente` |
| POST | `/api/unidade/:unidadeId/os/:osId/notas` | Adiciona nota `{ texto }` | — |

### PDV

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/unidade/:unidadeId/pdv` | Lista vendas |
| POST | `/api/unidade/:unidadeId/pdv` | Cria venda + lançamento + baixa estoque |
| GET | `/api/unidade/:unidadeId/pdv/:vendaId` | Detalhe da venda |

### Agenda

| Método | Rota | Descrição | Parâmetros |
|---|---|---|---|
| GET | `/api/unidade/:unidadeId/agenda` | Lista (com OS para o calendário) | `?dataInicio=&dataFim=&view=` |
| POST | `/api/unidade/:unidadeId/agenda` | Cria agendamento | — |
| PUT | `/api/unidade/:unidadeId/agenda/:agId` | Atualiza (remarcar) | — |
| DELETE | `/api/unidade/:unidadeId/agenda/:agId` | Cancela | — |
| POST | `/api/unidade/:unidadeId/agenda/:agId/converter` | Converte em OS | — |

### Clientes / Veículos

CRUD padrão. Clientes são **cross-unit** (filtro por `usuarioId`, não `unidadeId`).

### Catálogo e Estoque

| Método | Rota | Descrição | Restrição |
|---|---|---|---|
| GET | `/api/unidade/:unidadeId/catalogo` | Lista itens | `?q=&tipo=` |
| POST | `/api/unidade/:unidadeId/catalogo` | Cria item; se `produto`, cria também o `ItemEstoque` (aceita `quantidadeMinima` e saldo inicial → `MovimentoEstoque`) na mesma transação | G+ |
| PUT | `/api/unidade/:unidadeId/catalogo/:itemId` | Edita dados/preços. Não altera saldo nem `tipo` | G+ |
| DELETE | `/api/unidade/:unidadeId/catalogo/:itemId` | Exclui item (hard delete) | G+ |
| GET | `/api/unidade/:unidadeId/estoque` | Lista `ItemEstoque JOIN ItemCatalogo` (saldo, badges) | `?q=&abaixoMinimo=` |
| POST | `/api/unidade/:unidadeId/estoque/ajustar` | Entrada/saída manual `{ catalogoId, tipo, quantidade, observacao }`; gera `MovimentoEstoque` | G+ |
| GET | `/api/unidade/:unidadeId/estoque/:catalogoId/movimentos` | Histórico de movimentos | — |

### Caixa

| Método | Rota | Descrição | Parâmetros |
|---|---|---|---|
| GET | `/api/unidade/:unidadeId/caixas` | Lista Caixas acessíveis + estado das sessões | - |
| GET | `/api/unidade/:unidadeId/sessoes-caixa` | Lista todas as sessões da unidade | `?status=aberta\|fechada` |
| POST | `/api/unidade/:unidadeId/caixas` | Cria Caixa `{ nome }` | - |
| PUT | `/api/unidade/:unidadeId/caixas/:caixaId` | Atualiza nome/ativo | - |
| PUT | `/api/unidade/:unidadeId/caixas/:caixaId/usuarios` | Define associações | - |
| GET | `/api/unidade/:unidadeId/caixas/:caixaId/sessoes` | Histórico de sessões | - |
| GET | `/api/unidade/:unidadeId/caixas/:caixaId/sessao-aberta` | Sessão aberta + resumo + lançamentos | - |
| POST | `/api/unidade/:unidadeId/caixas/:caixaId/abrir` | `{ valorAbertura, carteiraCofreId? }` |
| POST | `/api/unidade/:unidadeId/caixas/:caixaId/fechar` | `{ valorContado, carteiraCofreId, motivo? }` | - |
| POST | `/api/unidade/:unidadeId/caixas/:caixaId/reforco` | `{ valor, carteiraCofreId, motivo }` | - |
| POST | `/api/unidade/:unidadeId/caixas/:caixaId/sangria` | `{ valor, carteiraCofreId, motivo }` | - |
| POST | `/api/unidade/:unidadeId/caixas/:caixaId/despesa` | Despesa em espécie `{ valor, categoria, motivo }`. **Retirada Rápida** = mesma rota com `categoria: 'retirada_rapida'` (só `valor` + `motivo`) | - |

### Lançamentos

| Método | Rota | Descrição | Parâmetros |
|---|---|---|---|
| GET | `/api/unidade/:unidadeId/lancamentos` | Lista | `?carteiraId=&sessaoCaixaId=&tipo=&dataInicio=&dataFim=&documentoId=&fornecedorId=` |
| POST | `/api/unidade/:unidadeId/lancamentos` | Lança | — |
| PUT | `/api/unidade/:unidadeId/lancamentos/:lancamentoId` | Edita `data` (grava `LancamentoHistorico`) | A+ |
| GET | `/api/unidade/:unidadeId/lancamentos/resumo` | Total entradas/saídas por período | — |
| POST | `/api/unidade/:unidadeId/lancamentos/:lancamentoId/estornar` | Estorna | — |

### Carteiras

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/unidade/:unidadeId/carteiras` | Lista + saldos calculados |
| POST | `/api/unidade/:unidadeId/carteiras` | Cria Carteira |
| PUT | `/api/unidade/:unidadeId/carteiras/:carteiraId` | Atualiza nome/ativo |
| DELETE | `/api/unidade/:unidadeId/carteiras/:carteiraId` | Exclui (A+; guard: sessão aberta bloqueia; lançamentos → `carteiraId` NULL) |
| POST | `/api/unidade/:unidadeId/carteiras/transferir` | `{ origemCarteiraId, destinoCarteiraId, valor, motivo }` |
| POST | `/api/unidade/:unidadeId/carteiras/:carteiraId/despesa` | Despesa paga pela Carteira |
| POST | `/api/unidade/:unidadeId/carteiras/:carteiraId/entrada-externa` | Aporte/empréstimo |

### Relatórios

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/unidade/:unidadeId/relatorios/financeiro` | `?dataInicio=&dataFim=` |
| GET | `/api/unidade/:unidadeId/relatorios/caixa` | `?dataInicio=&dataFim=` |
| GET | `/api/unidade/:unidadeId/relatorios/exportar-csv` | `?tipo=os\|lancamentos&dataInicio=&dataFim=` |

### Config / Funcionários / Backup

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/unidade/:unidadeId/config` | Retorna config |
| PUT | `/api/unidade/:unidadeId/config` | Atualiza |
| GET | `/api/unidade/:unidadeId/funcionarios` | Lista (read-only) |
| GET | `/api/unidade/:unidadeId/backup/export` | JSON completo |
| POST | `/api/unidade/:unidadeId/backup/import` | Substitui tudo |
| GET | `/api/unidade/:unidadeId/backup/csv` | `?entidade=clientes\|veiculos\|os\|lancamentos\|catalogo\|estoque\|vendas` |

### Lixeira

| Método | Rota | Descrição | Parâmetros |
|---|---|---|---|
| GET | `/api/unidade/:unidadeId/lixeira` | Lista soft-deleted | `?entidade=os\|cliente\|veiculo` |
| PUT | `/api/unidade/:unidadeId/lixeira/:entidadeId` | Restaurar | — |
| DELETE | `/api/unidade/:unidadeId/lixeira/:entidadeId` | Excluir definitivo | — |

---

## 8. Schema D1 (Fase 2)

```sql
-- Valores monetários: INTEGER em centavos. Quantidades: REAL.

-- USUÁRIOS E UNIDADES
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  telefone TEXT,
  senha_hash TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL
);

CREATE TABLE unidades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  nome TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  next_os_number INTEGER NOT NULL DEFAULT 1,
  next_venda_number INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL
);

CREATE TABLE usuario_unidades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  unidade_id INTEGER NOT NULL REFERENCES unidades(id),
  role TEXT NOT NULL CHECK (role IN ('owner','admin','gerente','mecanico','recepcionista')),
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL,
  UNIQUE(usuario_id, unidade_id)
);

-- CLIENTES (tenant-level)
CREATE TABLE clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  nome TEXT NOT NULL,
  nome_busca TEXT NOT NULL,
  tipo_pessoa TEXT NOT NULL CHECK (tipo_pessoa IN ('fisica','juridica')),
  cpf TEXT,
  razao_social TEXT,
  nome_fantasia TEXT,
  cnpj TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  deleted_at TEXT,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

-- VEÍCULOS
CREATE TABLE veiculos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unidade_id INTEGER NOT NULL REFERENCES unidades(id),
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  tipo TEXT NOT NULL,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  versao TEXT,
  placa TEXT NOT NULL,
  ano_fabricacao TEXT,
  ano_modelo TEXT,
  cor TEXT,
  combustivel TEXT,
  quilometragem REAL,
  chassi TEXT,
  deleted_at TEXT,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

-- CATÁLOGO
CREATE TABLE catalogo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unidade_id INTEGER NOT NULL REFERENCES unidades(id),
  nome TEXT NOT NULL,
  nome_busca TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('servico','produto')),
  sku TEXT,
  descricao TEXT,
  preco INTEGER NOT NULL DEFAULT 0,
  custo INTEGER,
  unidade TEXT NOT NULL,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

-- ESTOQUE
CREATE TABLE estoque (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unidade_id INTEGER NOT NULL REFERENCES unidades(id),
  catalogo_id INTEGER NOT NULL UNIQUE REFERENCES catalogo(id) ON DELETE CASCADE,
  quantidade_atual REAL NOT NULL DEFAULT 0,
  quantidade_minima REAL,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

-- OS
CREATE TABLE os (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unidade_id INTEGER NOT NULL REFERENCES unidades(id),
  numero TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'normal' CHECK (tipo IN ('normal','garantia')),
  os_original_id INTEGER REFERENCES os(id),
  veiculo_id INTEGER NOT NULL REFERENCES veiculos(id),
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  funcionario_id INTEGER NOT NULL REFERENCES usuario_unidades(id),
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_diagnostico','aguardando_aprovacao','aprovada','em_execucao','concluida','entregue','cancelada')),
  queixa TEXT NOT NULL,
  diagnostico TEXT,
  avarias TEXT,
  combustivel TEXT,
  quilometragem REAL,
  data_entrada TEXT NOT NULL,
  previsao_entrega TEXT,
  desconto INTEGER,
  orcamento_enviado INTEGER NOT NULL DEFAULT 0,
  token TEXT NOT NULL UNIQUE,
  deleted_at TEXT,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  data_aprovacao TEXT,
  data_conclusao TEXT,
  data_entrega TEXT,
  motivo_cancelamento TEXT
);

CREATE TABLE os_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  os_id INTEGER NOT NULL REFERENCES os(id) ON DELETE CASCADE,
  catalogo_id INTEGER REFERENCES catalogo(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('servico','produto')),
  unidade TEXT,
  quantidade REAL NOT NULL,
  preco_unitario INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado')),
  lote INTEGER,
  enviado INTEGER NOT NULL DEFAULT 0,
  data_aprovacao TEXT,
  data_recusa TEXT,
  motivo_recusa TEXT,
  estoque_baixado INTEGER NOT NULL DEFAULT 0 CHECK (estoque_baixado IN (0,1))
);

CREATE TABLE os_notas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  os_id INTEGER NOT NULL REFERENCES os(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  tipo TEXT NOT NULL,
  role TEXT NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE os_envios_orcamento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  os_id INTEGER NOT NULL REFERENCES os(id) ON DELETE CASCADE,
  unidade_id INTEGER NOT NULL REFERENCES unidades(id),
  canal TEXT NOT NULL CHECK (canal IN ('impressao','imagem','email','link')),
  status TEXT NOT NULL CHECK (status IN ('pendente','enviado','gerado','falhou')),
  itens_ids TEXT NOT NULL,
  solicitado_em TEXT NOT NULL,
  concluido_em TEXT,
  referencia TEXT,
  erro TEXT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id)
);

-- FINANCEIRO
CREATE TABLE carteiras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unidade_id INTEGER NOT NULL REFERENCES unidades(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('banco','cofre')),
  nome TEXT NOT NULL,
  saldo_inicial INTEGER NOT NULL DEFAULT 0,
  ativa INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0,1)),
  criado_em TEXT NOT NULL,
  UNIQUE(unidade_id, nome)
);

CREATE TABLE caixas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unidade_id INTEGER NOT NULL REFERENCES unidades(id),
  nome TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
  criado_em TEXT NOT NULL,
  UNIQUE(unidade_id, nome)
);

CREATE TABLE caixa_usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unidade_id INTEGER NOT NULL REFERENCES unidades(id),
  caixa_id INTEGER NOT NULL REFERENCES caixas(id),
  usuario_unidade_id INTEGER NOT NULL REFERENCES usuario_unidades(id),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
  UNIQUE(caixa_id, usuario_unidade_id)
);

CREATE TABLE sessoes_caixa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unidade_id INTEGER NOT NULL REFERENCES unidades(id),
  caixa_id INTEGER NOT NULL REFERENCES caixas(id),
  status TEXT NOT NULL CHECK (status IN ('aberta','fechada')),
  aberta_em TEXT NOT NULL,
  aberta_por_usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  valor_abertura INTEGER NOT NULL DEFAULT 0 CHECK (valor_abertura >= 0),
  carteira_origem_id INTEGER REFERENCES carteiras(id) ON DELETE SET NULL,
  fechada_em TEXT,
  fechada_por_usuario_id INTEGER REFERENCES usuarios(id),
  saldo_esperado_fechamento INTEGER,
  valor_contado INTEGER,
  diferenca INTEGER,
  motivo_fechamento TEXT,
  CHECK ((valor_abertura = 0 AND carteira_origem_id IS NULL) OR (valor_abertura > 0 AND carteira_origem_id IS NOT NULL))
);

CREATE TABLE lancamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unidade_id INTEGER NOT NULL REFERENCES unidades(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  carteira_id INTEGER REFERENCES carteiras(id) ON DELETE SET NULL,
  sessao_caixa_id INTEGER REFERENCES sessoes_caixa(id),
  valor INTEGER NOT NULL CHECK (valor > 0),
  data TEXT NOT NULL,
  documento_id INTEGER,
  documento_tipo TEXT CHECK (documento_tipo IN ('os','venda')),
  fornecedor_id INTEGER,
  usuario_contraparte_id INTEGER REFERENCES usuarios(id),
  contraparte_nome TEXT,
  modalidade TEXT NOT NULL CHECK (modalidade IN ('dinheiro','pix','credito','debito','boleto','transferencia')),
  categoria TEXT NOT NULL,
  par_id INTEGER,
  estorno_de INTEGER REFERENCES lancamentos(id),
  observacao TEXT,
  criado_por_usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  criado_em TEXT NOT NULL,
  atualizado_em TEXT,
  atualizado_por_usuario_id INTEGER REFERENCES usuarios(id),
  CHECK ((carteira_id IS NOT NULL AND sessao_caixa_id IS NULL) OR (carteira_id IS NULL AND sessao_caixa_id IS NOT NULL))
);

CREATE TABLE lancamento_historico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lancamento_id INTEGER NOT NULL REFERENCES lancamentos(id),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  campo TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  alterado_em TEXT NOT NULL
);

-- VENDAS (PDV)
CREATE TABLE vendas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unidade_id INTEGER NOT NULL REFERENCES unidades(id),
  numero TEXT NOT NULL,
  cliente_id INTEGER REFERENCES clientes(id),
  funcionario_id INTEGER NOT NULL REFERENCES usuario_unidades(id),
  forma_pagamento TEXT NOT NULL,
  criado_em TEXT NOT NULL,
  UNIQUE(unidade_id, numero)
);

CREATE TABLE venda_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venda_id INTEGER NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  catalogo_id INTEGER REFERENCES catalogo(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  quantidade REAL NOT NULL,
  preco_unitario INTEGER NOT NULL
);

-- AGENDAMENTOS
CREATE TABLE agendamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unidade_id INTEGER NOT NULL REFERENCES unidades(id),
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  veiculo_id INTEGER REFERENCES veiculos(id),
  data_hora TEXT NOT NULL,
  servico TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado','realizado','cancelado')),
  os_id INTEGER REFERENCES os(id),
  observacao TEXT,
  criado_por INTEGER NOT NULL REFERENCES usuario_unidades(id),
  criado_em TEXT NOT NULL
);

-- CONFIG
CREATE TABLE config (
  unidade_id INTEGER PRIMARY KEY REFERENCES unidades(id),
  nome TEXT NOT NULL,
  endereco TEXT,
  telefone TEXT,
  cnpj TEXT,
  email TEXT,
  logo TEXT,
  validade_dias INTEGER NOT NULL DEFAULT 15,
  fuso_horario TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  texto_garantia TEXT,
  texto_observacoes TEXT,
  texto_rodape TEXT
);

-- FORNECEDORES (Fase 2)
CREATE TABLE fornecedores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unidade_id INTEGER NOT NULL REFERENCES unidades(id),
  nome TEXT NOT NULL,
  nome_busca TEXT NOT NULL,
  condicao_pagamento TEXT
);

-- MOVIMENTOS DE ESTOQUE (append-only)
CREATE TABLE movimentos_estoque (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unidade_id INTEGER NOT NULL REFERENCES unidades(id),
  catalogo_id INTEGER REFERENCES catalogo(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  quantidade REAL NOT NULL CHECK (quantidade > 0),
  origem TEXT NOT NULL CHECK (origem IN ('manual','os_baixa','os_estorno','venda_baixa')),
  documento_id INTEGER,
  documento_tipo TEXT CHECK (documento_tipo IN ('os','venda')),
  item_os_id INTEGER REFERENCES os_itens(id) ON DELETE SET NULL,
  saldo_apos REAL NOT NULL,
  observacao TEXT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  data TEXT NOT NULL
);

-- ÍNDICES
CREATE INDEX idx_os_unidade ON os(unidade_id);
CREATE INDEX idx_os_status ON os(status);
CREATE UNIQUE INDEX idx_os_numero ON os(unidade_id, numero);
CREATE INDEX idx_os_veiculo ON os(veiculo_id);
CREATE INDEX idx_os_itens_os ON os_itens(os_id);
CREATE INDEX idx_os_envios_orcamento_os ON os_envios_orcamento(os_id, solicitado_em);
CREATE INDEX idx_os_notas_os ON os_notas(os_id);
CREATE INDEX idx_lancamentos_carteira ON lancamentos(carteira_id);
CREATE INDEX idx_lancamentos_sessao ON lancamentos(sessao_caixa_id);
CREATE INDEX idx_lancamentos_doc ON lancamentos(documento_id, documento_tipo);
CREATE INDEX idx_lancamentos_unidade ON lancamentos(unidade_id);
CREATE INDEX idx_lancamentos_data ON lancamentos(data);
CREATE INDEX idx_lancamentos_par ON lancamentos(par_id);
CREATE INDEX idx_lancamentos_estorno ON lancamentos(estorno_de);
CREATE INDEX idx_lancamento_historico_lancamento ON lancamento_historico(lancamento_id);
CREATE INDEX idx_clientes_busca ON clientes(nome_busca);
CREATE INDEX idx_clientes_cpf ON clientes(cpf);
CREATE INDEX idx_veiculos_placa ON veiculos(placa);
CREATE INDEX idx_veiculos_unidade ON veiculos(unidade_id);
CREATE INDEX idx_catalogo_busca ON catalogo(nome_busca);
CREATE INDEX idx_catalogo_unidade ON catalogo(unidade_id, tipo);
CREATE INDEX idx_catalogo_sku ON catalogo(sku);
CREATE INDEX idx_estoque_unidade ON estoque(unidade_id);
CREATE INDEX idx_os_itens_catalogo ON os_itens(catalogo_id);
CREATE INDEX idx_movimentos_estoque_catalogo ON movimentos_estoque(catalogo_id, data);
CREATE INDEX idx_movimentos_estoque_doc ON movimentos_estoque(documento_id, documento_tipo);
CREATE INDEX idx_agendamentos_data ON agendamentos(data_hora);
CREATE INDEX idx_agendamentos_unidade ON agendamentos(unidade_id);
CREATE INDEX idx_vendas_unidade ON vendas(unidade_id);
CREATE INDEX idx_usuario_unidades ON usuario_unidades(unidade_id);
CREATE INDEX idx_carteiras_unidade ON carteiras(unidade_id);
CREATE INDEX idx_caixas_unidade ON caixas(unidade_id);
CREATE INDEX idx_caixa_usuarios_caixa ON caixa_usuarios(caixa_id);
CREATE INDEX idx_caixa_usuarios_usuario ON caixa_usuarios(usuario_unidade_id);
CREATE INDEX idx_sessoes_caixa_caixa ON sessoes_caixa(caixa_id, aberta_em);
CREATE INDEX idx_sessoes_caixa_status ON sessoes_caixa(unidade_id, status);
CREATE UNIQUE INDEX idx_sessoes_caixa_uma_aberta ON sessoes_caixa(caixa_id) WHERE status = 'aberta';
CREATE UNIQUE INDEX idx_lancamentos_estorno_unico ON lancamentos(estorno_de) WHERE estorno_de IS NOT NULL;
```

> **Nota:** D1 cobra por **linhas lidas**. Index B-tree evita full scan.

---

> **Fim do ARCHITECTURE.md.**

---


## Convenção de parâmetros dinâmicos

As árvores de rotas devem utilizar identificadores semânticos, nunca `[id]` genérico. O contexto operacional usa `[unidadeId]`; recursos usam seus nomes específicos (`[clienteId]`, `[veiculoId]`, `[osId]`, `[vendaId]`, `[carteiraId]`, `[itemId]`, `[catalogoId]`, `[caixaId]`, `[agendamentoId]`, `[lancamentoId]`). No frontend, ler por `useRoute().params`; no Nitro/H3, por `getRouterParam(event, '<nome>')`. Regex e inspeção manual de URL para obter parâmetros são proibidas. A URL pública permanece inalterada.

Decisão: [ADR-015 — Parâmetros semânticos nas rotas](decisions/015-parametros-semanticos-de-rotas.md).
