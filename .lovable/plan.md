

## Plano: Deixar campo "Já tiradas (retroativo)" em branco por padrão

### Alteração

| Arquivo | Detalhe |
|---------|---------|
| `src/pages/AdminLeaves.tsx` | Quando selecionar um segurança que tem `pre_used_days = 0`, mostrar o campo vazio em vez de "0". Manter o placeholder "0" para indicar o valor padrão. |

### Detalhe técnico

Linha 835: mudar de `String(existing.pre_used_days || 0)` para `existing.pre_used_days ? String(existing.pre_used_days) : ''`

Isso faz com que o campo fique em branco quando o valor é 0, mostrando apenas o placeholder.

