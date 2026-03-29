

## Plano: Mover botões "Solicitar Troca" e "Ver Escala Completa" para acima de "Minha Escala"

### Alteração

**Arquivo:** `src/pages/GuardDashboard.tsx`

Mover o bloco de Quick Actions (linhas 509-540) e o Full Schedule Dialog (linhas 542-553) para **antes** do `GuardPersonalCalendar` (linha 500).

Ordem final:
1. Botões (Solicitar Troca + Ver Escala Completa)
2. Dialog da Escala Completa
3. Calendário Pessoal ("Minha Escala")
4. Resto (SwapList, Extras, etc.)

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/pages/GuardDashboard.tsx` | Reordenar blocos JSX (linhas 500-553) |

