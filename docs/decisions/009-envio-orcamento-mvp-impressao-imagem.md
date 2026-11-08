# 009. Envio de Orçamento no MVP Restrito a Impressão e Imagem

- **Status:** 🟡 Proposta (endurecimento para construção)
- **Data:** 04/11/2026
- **Versão de Origem:** 1.8
- **Onde:** PRD §10.5

## Contexto
O fluxo de envio de orçamentos para aprovação pelo cliente pode envolver canais complexos como SMTP transacional dedicado, integração de WhatsApp Business API ou links públicos autenticados com telas interativas de aprovação. Desenvolver todos esses canais antes de validar o produto atrasaria substancialmente o MVP.

## Decisão
1. **Escopo MVP:** No MVP, o envio do orçamento ao cliente será realizado via:
   - Impressão física direta (componente `PrintPreview`).
   - Exportação em imagem/PDF gerada no navegador para compartilhamento manual pelo operador (via WhatsApp Web pessoal ou outro canal da oficina).
2. **Pós-MVP:** Integrações automáticas de envio por e-mail e geração de links web públicos interativos ficam expressamente postergadas para a Fase 2.

## Consequências
- **Positivas:** Elimina dependências externas pagas (serviços de e-mail, APIs pagas do WhatsApp); entrega imediata do valor funcional ao operador da oficina.
- **Restrições:** O atendente deve realizar o ato de envio para o cliente fora do sistema e marcar manualmente o envio na aplicação.
