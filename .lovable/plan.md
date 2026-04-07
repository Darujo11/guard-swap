

## Plano: Remover reflexo de trocas no Calendário de Escalas

### Problema
Quando uma troca é aprovada, o sistema chama `swapTeamSchedules()` que altera os `team_id` na tabela `team_schedules`, quebrando a rotação A→B→C→D no calendário de escalas. O usuário quer que trocas apareçam apenas no calendário pessoal ("Minha Escala"), que já usa a lógica de escala efetiva (`computeEffectiveSchedule`).

### Solução

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/AdminDashboard.tsx` | Remover a chamada a `swapTeamSchedules()` após aprovar troca (linhas ~248-254) |
| `src/pages/AdminSwaps.tsx` | Remover a chamada a `swapTeamSchedules()` após aprovar troca (linhas ~257-263) |
| `src/utils/swapScheduleUpdate.ts` | Pode ser mantido ou removido (ficará sem uso) |

### Correção dos dados de abril

Os dados de abril na tabela `team_schedules` podem já estar corrompidos por trocas anteriores. Será necessário:

1. Consultar os dados atuais de abril para verificar se a rotação A→B→C→D está quebrada
2. Se estiver, regenerar abril seguindo o padrão de março (continuando a rotação do último dia de março)

Isso pode ser feito via migração SQL que:
- Identifica o `team_id` do dia 31/03 (ou último dia de março)
- Recalcula abril inteiro seguindo a rotação correta

### Impacto
- O calendário de escalas (admin) volta a mostrar a rotação pura A→B→C→D
- O calendário pessoal do segurança ("Minha Escala") continua mostrando os dias reais com trocas, via `computeEffectiveSchedule`
- Trocas futuras não afetarão mais a tabela `team_schedules`

