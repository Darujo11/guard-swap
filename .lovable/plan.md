

## Plano: Renomear para "Registro de Afastamento" e ajustar tipo no PDF

### Alterações em `src/pages/AdminLeaves.tsx`

1. **Linha 576**: Renomear "Registrar Nova Folga" → "Registro de Afastamento"

2. **Linha 414**: Renomear "Comprovante de Folga" → usar título dinâmico baseado no tipo:
   - Se `leave_type` contém "LICENCA", título = "Comprovante de Licença"
   - Se `leave_type` = "FERIAS", título = "Comprovante de Férias"
   - Se `leave_type` = "ATESTADO", título = "Comprovante de Atestado"
   - Demais = "Comprovante de Afastamento"

3. **Linha 435**: Renomear campo "Tipo de Folga" → "Tipo de Afastamento"

4. **Linha 480**: Renomear "Relatório de Folgas" (título do PDF) → "Relatório de Afastamentos"

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/pages/AdminLeaves.tsx` | Renomear título do card, títulos dos PDFs e campo de tipo |

