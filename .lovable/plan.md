

## Plano: Mover "Registros Detalhados de Extras" para logo abaixo de "Minha Escala" com ranking acumulado por padrão

### Alteração

**Arquivo:** `src/pages/GuardDashboard.tsx`

1. **Mover o bloco "Registros Detalhados de Extras"** (linhas 867-1049) para logo após o `GuardPersonalCalendar` (linha 553), antes do bloco de Swap Requests (linha 555).

2. **Alterar valor padrão de `detailedAllMonths`** de `false` para `true` (linha 68), para que já abra mostrando o acumulado de todos os meses.

### Ordem final do layout:
1. Botões (Solicitar Troca + Ver Escala Completa)
2. Dialog da Escala Completa
3. Calendário Pessoal ("Minha Escala")
4. **Registros Detalhados de Extras** (acumulado por padrão)
5. Swap Requests
6. Meus Extras
7. Relatório Mensal
8. Ranking de Extras

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/pages/GuardDashboard.tsx` | Mover bloco JSX + mudar default de `detailedAllMonths` para `true` |

