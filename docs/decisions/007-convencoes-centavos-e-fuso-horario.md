# 007. Convenções de Dados: Dinheiro em Centavos e Fuso UTC

- **Status:** 🟡 Proposta (endurecimento para construção)
- **Data:** 04/11/2026
- **Versão de Origem:** 1.8
- **Onde:** ARCH §3, PRD §4.10, AGENTS.md

## Contexto
O uso de números de ponto flutuante (`float`/`double`) para cálculos financeiros em JavaScript/TypeScript provoca erros acumulados de arredondamento de precisão (IEEE 754). Paralelamente, comparações ingênuas de data usando o fuso do servidor provocam fechamentos indevidos de caixa e divergências em relatórios diários de unidades em fusos distintos.

## Decisão
1. **Dinheiro em Centavos Inteiros:** Todos os campos monetários (`preco`, `valor`, `total`, `desconto`, `saldo`) são armazenados e trafegados estritamente como inteiros representando centavos (ex: R$ 85,00 é persistido como `8500`).
   - Formatação visual e máscaras de moeda são restritas à camada de UI (`app/utils/dinheiro.ts`).
2. **Datas em ISO 8601 UTC:** Todas as datas de criação, atualização, agendamento e lançamento são salvas em string ISO 8601 UTC no storage.
3. **Resolução de Fuso por Unidade:** O cálculo de "dia corrente", virada de períodos e vencimentos financeiros deve usar obrigatoriamente o fuso horário cadastrado na unidade através do helper `server/utils/datas.ts`. É proibido usar `new Date()` sem fuso para regras de período.

## Consequências
- **Positivas:** Precisão contábil e matemática absoluta; total blindagem contra erros de arredondamento em parcelamentos e somatórios; consistência temporal multi-unidade.
- **Restrições:** Validações de entrada de formulários precisam converter strings formatadas em centavos inteiros antes de enviar para a API.
