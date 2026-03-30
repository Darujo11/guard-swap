

## Plano: Mover "Folgas TRE" para abaixo de "Registrar Nova Folga"

### O que será feito

Reordenar as seções da página de Folgas. Atualmente a ordem é:
1. Registrar Nova Folga
2. Folgas Registradas
3. Folgas TRE
4. Relatório de Folgas

Nova ordem:
1. Registrar Nova Folga
2. **Folgas TRE**
3. Folgas Registradas
4. Relatório de Folgas

### Alteração

#### `src/pages/AdminLeaves.tsx`

- Mover o bloco do Card "Folgas TRE" (linhas 813-909) para logo após o Card "Registrar Nova Folga" (após linha 706), antes do Card "Folgas Registradas"

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/pages/AdminLeaves.tsx` | Reordenar seção "Folgas TRE" para após "Registrar Nova Folga" |

