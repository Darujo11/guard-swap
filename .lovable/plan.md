

## Plano: Permitir re-troca de plantões recebidos por troca

### Diagnóstico

O fluxo atual **deveria funcionar** assim:
1. Admin aprova troca → `swapTeamSchedules()` troca os `team_id` em `team_schedules`
2. O dia recebido passa a ter o `team_id` do segurança
3. No `GuardSwapForm`, `isDateInteractable()` verifica `schedule.team_id === currentUser.team_id` → dia aparece como selecionável

**Problema potencial:** A função `swapTeamSchedules` filtra por `.eq('admin_id', adminId)`, mas registros em `team_schedules` frequentemente têm `admin_id = NULL`. Isso faz com que o UPDATE não encontre nenhuma linha, e a troca no calendário nunca aconteça de fato.

### Solução

**Arquivo:** `src/utils/swapScheduleUpdate.ts`

Remover o filtro `.eq('admin_id', adminId)` e usar apenas `shift_date` + `team_id` para identificar os registros, já que essa combinação é suficiente para encontrar o registro correto. Também remover o parâmetro `adminId` da função.

**Arquivos afetados:**
| Arquivo | Alteração |
|---------|-----------|
| `src/utils/swapScheduleUpdate.ts` | Remover filtro `admin_id` dos UPDATEs |
| `src/pages/AdminSwaps.tsx` | Remover parâmetro `adminProfile.id` da chamada |
| `src/pages/AdminDashboard.tsx` | Remover parâmetro `adminId` da chamada |

### Resultado
Após a correção, quando o admin aprovar uma troca:
1. Os `team_id` serão efetivamente trocados em `team_schedules`
2. O dia recebido aparecerá no calendário pessoal do segurança
3. No formulário de troca, o dia recebido aparecerá como selecionável para uma nova troca

