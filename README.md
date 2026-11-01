```md
# Oficina SaaS

Sistema de gestão para oficinas mecânicas — clientes, veículos, catálogo de itens e ordens de serviço.

---

## Stack

| Item | Tecnologia |
|---|---|
| Framework | Nuxt 4 (SSR: false) |
| UI | Nuxt UI v4 (Reka UI + Tailwind CSS) |
| Validação | Zod |
| Storage | `useStorage` (localStorage) |
| Ícones | Lucide |

---

## Como rodar

```bash
git clone <repo>
cd oficina-saas
pnpm install
pnpm dev
```

Acesse: `http://localhost:3000`

---

## Estrutura

```
app/
├── types/
│   └── index.d.ts              # Tipos compartilhados (Cliente, Veiculo, ItemCatalogo)
├── components/
│   └── dashboard/
│       ├── SectionHeader.vue   # Título de seção (naked)
│       ├── DataField.vue       # Campo de dados (label + valor)
│       └── ListItem.vue        # Linha clicável (avatar/icon + texto + chevron)
├── pages/
│   ├── clientes/
│   │   ├── index.vue           # Listagem
│   │   ├── novo.vue            # Cadastro
│   │   └── [id]/
│   │       ├── index.vue       # Detalhe
│   │       └── editar.vue      # Edição
│   ├── veiculos/
│   │   ├── index.vue
│   │   ├── novo.vue
│   │   └── [id]/
│   │       ├── index.vue
│   │       └── editar.vue
│   ├── catalogo/
│   │   └── index.vue           # Listagem + modal (novo/editar)
│   └── os/                     # (em desenvolvimento)
└── layouts/
    └── default.vue

server/
├── api/
│   ├── clientes/               # CRUD completo
│   ├── veiculos/               # CRUD completo
│   ├── catalogo/               # CRUD completo
│   └── os/                     # (em desenvolvimento)
└── utils/
    ├── clientes.ts             # Schema Zod + types
    ├── veiculos.ts             # Schema Zod + types
    └── catalogo.ts             # Schema Zod + types
```

---

## Rotas

| Rota | Página |
|---|---|
| `/clientes` | Listagem de clientes |
| `/clientes/novo` | Novo cliente |
| `/clientes/:id` | Detalhe do cliente |
| `/clientes/:id/editar` | Editar cliente |
| `/veiculos` | Listagem de veículos |
| `/veiculos/novo` | Novo veículo |
| `/veiculos/:id` | Detalhe do veículo |
| `/veiculos/:id/editar` | Editar veículo |
| `/catalogo` | Catálogo de itens (listagem + modal) |
| `/os` | Ordens de serviço (em desenvolvimento) |

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
- `unidade`: lista fixa (un, jogo, par, h, litro, m, kg, pca)
- Sem quantidade, sem estoque — é referência pra preencher orçamento

---

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/clientes` | Lista clientes |
| POST | `/api/clientes` | Cria cliente |
| GET | `/api/clientes/:id` | Detalhe |
| PUT | `/api/clientes/:id` | Atualiza |
| DELETE | `/api/clientes/:id` | Exclui (bloqueia se houver veículos) |
| GET | `/api/veiculos` | Lista veículos |
| POST | `/api/veiculos` | Cria veículo |
| GET | `/api/veiculos/:id` | Detalhe |
| PUT | `/api/veiculos/:id` | Atualiza |
| DELETE | `/api/veiculos/:id` | Exclui |
| GET | `/api/catalogo` | Lista itens |
| POST | `/api/catalogo` | Cria item |
| GET | `/api/catalogo/:id` | Detalhe |
| PUT | `/api/catalogo/:id` | Atualiza |
| DELETE | `/api/catalogo/:id` | Exclui |

---

## Roadmap

| Recurso | Status |
|---|---|
| Clientes (CRUD) | ✅ |
| Veículos (CRUD) | ✅ |
| Catálogo de itens (CRUD) | Em desenvolvimento |
| Ordens de Serviço | Em desenvolvimento |
| Orçamento de OS | Em desenvolvimento |
| Estoque | Futuro |
| Multi-unidade (oficinas) | Futuro |
| Painel administrativo | Futuro |

---

## Documentação

- **`AGENTS.md`** — Convenções de código, padrões de layout, regras NUNCA/SEMPRE, checklist pra nova página. **Leia antes de desenvolver.**

---

```