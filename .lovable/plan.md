

## Plano: Seletor de mês no botão de PDF completo

### O que será feito

Adicionar um seletor de mês (input `month`) ao lado do botão "Gerar PDF de Todos", com o mês atual pré-selecionado. O PDF será gerado para o mês escolhido.

### Alterações

#### `src/pages/AdminGuards.tsx`

- Adicionar estado `pdfMonth` inicializado com o mês atual no formato `YYYY-MM`
- Adicionar um `<input type="month">` ao lado do botão "Gerar PDF de Todos"
- Alterar `handleGenerateAllPDF` para usar `pdfMonth` em vez de `new Date()` para calcular `startOfMonth`, `endStr` e `monthLabel`

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/pages/AdminGuards.tsx` | Estado `pdfMonth` + input month + usar mês selecionado na geração do PDF |

