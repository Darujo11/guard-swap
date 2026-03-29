

## Plano: Reduzir tamanho do texto na coluna Observação do PDF

### Problema
O texto da observação (ex: "Troca com Philipe (Equipe B) — dias 15/02 ↔ 06/02") está muito grande e cortando na página.

### Alteração

**Arquivo:** `src/utils/pdfGenerator.ts`

1. Reduzir `fontSize` da coluna Observação para `8` (ao invés de `10` global)
2. Usar `jsPDF` em modo paisagem (`'l'`) para dar mais espaço horizontal
3. Abreviar o texto: trocar "Troca com" por "↔", e "(Equipe X)" por apenas a letra — ex: `"↔ Philipe (B) — 15/02 ↔ 06/02"`

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/utils/pdfGenerator.ts` | Reduzir fontSize da observação, abreviar texto, usar landscape |

