> 📋 Para agentes de IA: leia `AGENTS.md` antes de desenvolver.   

# Oficina Core

Sistema de gestão para oficinas mecânicas — clientes, veículos, catálogo de itens e ordens de serviço.

---

## Stack

| Item | Tecnologia |
|---|---|
| Framework | Nuxt 4 (SSR: false) |
| UI | Nuxt UI v4 (Reka UI + Tailwind CSS) |
| Validação | Zod |
| Storage | `useStorage('data')` (localStorage) |
| Ícones | Lucide |

---

## Como rodar

```bash
git clone <repo>
cd oficina-core
pnpm install
pnpm dev
```

Acesse: `http://localhost:3000`

---

## Estrutura atual

```text
app/
├── pages/
│   └── unidade/
│       └── [unidadeId]/
│           ├── clientes/[clienteId]/
│           ├── veiculos/[veiculoId]/
│           ├── os/[osId]/
│           └── pdv/[vendaId]/
├── components/
├── composables/
├── layouts/
└── utils/

server/
├── api/
│   └── unidade/
│       └── [unidadeId]/
│           ├── clientes/[clienteId].{get,put,delete}.ts
│           ├── veiculos/[veiculoId].{get,put,delete}.ts
│           ├── catalogo/[itemId].{put,delete}.ts
│           ├── estoque/[catalogoId].{get,put}.ts
│           ├── carteiras/[carteiraId].{get,put,delete}.ts
│           ├── os/[osId]/
│           └── pdv/[vendaId].get.ts
└── utils/

docs/
└── decisions/
```

Os diretórios dinâmicos refletem os nomes semânticos dos parâmetros. Os segmentos da URL continuam iguais; apenas o nome interno usado por Nuxt/Nitro é específico.

---

## Rotas

| Rota | Página |
|---|---|
| `/unidade/:unidadeId` | Dashboard da unidade |
| `/unidade/:unidadeId/clientes` | Listagem de clientes |
| `/unidade/:unidadeId/clientes/novo` | Novo cliente |
| `/unidade/:unidadeId/clientes/:clienteId` | Perfil do cliente |
| `/unidade/:unidadeId/clientes/:clienteId/editar` | Editar cliente |
| `/unidade/:unidadeId/veiculos` | Listagem de veículos |
| `/unidade/:unidadeId/veiculos/novo` | Novo veículo |
| `/unidade/:unidadeId/veiculos/:veiculoId` | Perfil do veículo |
| `/unidade/:unidadeId/veiculos/:veiculoId/editar` | Editar veículo |
| `/unidade/:unidadeId/os/:osId` | Detalhe da OS |
| `/unidade/:unidadeId/pdv/:vendaId` | Detalhe da venda |

**Regra:** frontend usa `useRoute().params.<nomeSemantico>` e backend usa `getRouterParam(event, '<nomeSemantico>')`. Não usar regex ou análise manual de URL para recuperar parâmetros. Consulte `docs/CONVENTIONS.md` e `docs/decisions/015-parametros-semanticos-de-rotas.md`.

---

## Entidades

### Cliente
- `tipoPessoa`: `fisica` | `juridica`
- Campos obrigatórios: nome (PF) / razão social + CNPJ (PJ), CPF (PF), telefone
- Endereço opcional (CEP, logradouro, número, complemento, bairro, cidade, estado)

### Veículo
- `tipo`: carro, motocicleta, caminhonete, caminhão, van, onibus, outro
- `placa`: formato Mercosul (ABC1D23)
- Vinculado a um cliente (`clienteId`)
- Campos: marca, modelo, versão, ano fab/modelo, cor, combustível, quilometragem, chassi

### Item de Catálogo
- `tipo`: `servico` | `produto`
- `preco`: obrigatório (o que cobra)
- `custo`: opcional (o que paga)
- `unidade`: lista fixa (`un`, `jogo`, `par`, `h`, `litro`, `m`, `kg`, `pca`)
- Sem quantidade, sem estoque — é referência pra preencher orçamento
- Tipo **imutável** na edição
- Sem página de detalhe (6 campos → modal na listagem)

---

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/clientes` | Lista clientes |
| POST | `/api/clientes` | Cria cliente |
| GET | `/api/clientes/:clienteId` | Detalhe |
| PUT | `/api/clientes/:clienteId` | Atualiza |
| DELETE | `/api/clientes/:clienteId` | Exclui (bloqueia se houver veículos) |
| GET | `/api/veiculos` | Lista veículos |
| POST | `/api/veiculos` | Cria veículo |
| GET | `/api/veiculos/:veiculoId` | Detalhe |
| PUT | `/api/veiculos/:veiculoId` | Atualiza |
| DELETE | `/api/veiculos/:veiculoId` | Exclui |
| GET | `/api/catalogo` | Lista itens |
| POST | `/api/catalogo` | Cria item |
| PUT | `/api/catalogo/:itemId` | Atualiza (preserva `tipo`) |
| DELETE | `/api/catalogo/:itemId` | Exclui |

> Catálogo **não** tem `GET /api/catalogo/:itemId` — o item já vem da listagem para o modal.

---

## Roadmap

| Recurso | Status |
|---|---|
| Clientes (CRUD) | ✅ |
| Veículos (CRUD) | ✅ |
| Catálogo de itens (CRUD) | ✅ |
| Ordens de Serviço | Em desenvolvimento |
| Orçamento de OS | Em desenvolvimento |
| Estoque | Futuro |
| Multi-unidade (oficinas) | Futuro |
| Painel administrativo | Futuro |

---

## Documentação

- **`AGENTS.md`** — Convenções de código, padrões de layout, regras NUNCA/SEMPRE, checklist pra nova página. **Leia antes de desenvolver.**

---
