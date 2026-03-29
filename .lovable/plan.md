

## Plano: Reordenar seções do dashboard

### Alteração

**Arquivo:** `src/pages/GuardDashboard.tsx`

1. **Mover "Ranking de Extras"** (linhas 873-1049) para logo após `GuardPersonalCalendar` (linha 553), antes do bloco atual de "Registros Detalhados".

2. **Alterar default de `rankingAllMonths`** de `false` para `true` (linha 63).

3. **Mover "Registros Detalhados de Extras"** (atualmente linhas 555-737) para depois do "Relatório Mensal" (após linha 871).

### Ordem final do layout:
1. Botões (Solicitar Troca + Ver Escala Completa)
2. Dialog da Escala Completa
3. Calendário Pessoal ("Minha Escala")
4. **Ranking de Extras** (acumulado por padrão)
5. Swap Requests
6. Meus Extras
7. Relatório Mensal
8. **Registros Detalhados de Extras**

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/pages/GuardDashboard.tsx` | Reordenar blocos JSX + mudar default `rankingAllMonths` para `true` |

