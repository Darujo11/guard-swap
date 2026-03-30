

## Plano: Renomear "Folgas" → "Afastamentos" em todo o sistema

### Arquivos e alterações

| Arquivo | Alterações principais |
|---------|----------------------|
| `src/components/layout/AppLayout.tsx` | Menu lateral: "Folgas" → "Afastamentos" |
| `src/pages/AdminLeaves.tsx` | Título da página, labels "Tipo de Folga" → "Tipo de Afastamento", toasts, cards "Folgas Registradas" → "Afastamentos Registrados", "Relatório de Folgas" → "Relatório de Afastamentos", "Total de Folgas" → "Total de Afastamentos", "Folgas TRE" → "Afastamentos TRE", nomes de arquivos PDF |
| `src/pages/AdminGuardProfile.tsx` | Tab "Folgas" → "Afastamentos", card "Histórico de Folgas e Atestados" → "Histórico de Afastamentos", contadores |
| `src/pages/AdminDashboard.tsx` | "Solicitações de Folga TRE" → "Solicitações de Afastamento TRE", toasts, labels de PDF |
| `src/pages/GuardDashboard.tsx` | "Solicitar Folga TRE" → "Solicitar Afastamento TRE", "Folgas TRE Solicitadas" → "Afastamentos TRE Solicitados", toasts, PDFs |

### Regra geral
- "Folga" → "Afastamento"
- "Folgas" → "Afastamentos"
- "Tipo de Folga" → "Tipo de Afastamento"
- Manter "FOLGA TRE" no PDF de escala (coluna da tabela) inalterado pois é um identificador técnico no `pdfGenerator.ts`

### Escopo
Renomeação de textos visíveis ao usuário (labels, títulos, toasts, nomes de PDF). Sem alteração de lógica ou banco de dados.

