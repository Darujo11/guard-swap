

## Relatório de Alterações — 29 e 30 de Março de 2026

Este não é um plano de implementação — é uma solicitação de geração de documento. Vou criar um PDF com o resumo de todas as alterações realizadas.

### Conteúdo do relatório

Com base no histórico da conversa, as seguintes alterações foram realizadas:

1. **Dropdown mantém aberto ao clicar nos toggles** — `e.preventDefault()` em "Bloquear Trocas" e "Troca só dentro do mês"
2. **Renomeação "Registrar Nova Folga" → "Registro de Afastamento"**
3. **Títulos dinâmicos no PDF** — Comprovante de Licença, Férias, Atestado, etc. conforme o tipo
4. **Renomeação global "Folgas" → "Afastamentos"** — Menu, páginas, toasts, PDFs, labels
5. **Afastamentos no calendário do segurança** — Todos os tipos aparecem em vermelho com nome do tipo
6. **Correção de solicitações de troca pendentes** — Aparecem corretamente para o admin
7. **Destaque de dias de trabalho nos calendários de data** — Ao registrar afastamento, dias de plantão são marcados com cor da equipe
8. **Correção de status dos afastamentos** — Admin insere com status `APPROVED` automaticamente
9. **Migração de dados** — Registros antigos com `PENDING` e `admin_id` atualizados para `APPROVED`
10. **Upload de documento comprobatório** — Novo campo para anexar atestados/comprovantes, com download na lista
11. **Forçar atualização v4.1.4** — Versão incrementada com `forceUpdate: true`

### Formato
PDF profissional com cabeçalho, data, e lista detalhada de alterações organizadas por categoria.

