

## Plano: Corrigir atualização de escala após aprovação de troca

### Diagnóstico

O problema é que a função `swapTeamSchedules` roda no client-side como o admin logado, mas a política RLS de UPDATE na tabela `team_schedules` exige que `admin_id` do registro corresponda ao perfil do admin. Como os registros frequentemente têm `admin_id = NULL`, o UPDATE silenciosamente não encontra nenhuma linha e a troca nunca é efetivada na escala.

Por isso, mesmo após a aprovação, o dia 30 continua com o `team_id` original e não aparece como disponível para o Fabio no formulário de troca.

### Solução

Criar uma função `SECURITY DEFINER` no banco que faz o swap dos `team_id` em `team_schedules`, contornando as limitações de RLS.

**1. Migration SQL** — criar função `swap_team_schedules`:

```sql
CREATE OR REPLACE FUNCTION public.swap_team_schedules(
  _requester_id uuid,
  _target_id uuid,
  _requester_shift_date date,
  _target_shift_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _requester_team_id uuid;
  _target_team_id uuid;
BEGIN
  SELECT team_id INTO _requester_team_id FROM profiles WHERE id = _requester_id;
  SELECT team_id INTO _target_team_id FROM profiles WHERE id = _target_id;

  IF _requester_team_id IS NULL OR _target_team_id IS NULL THEN
    RAISE EXCEPTION 'team_id not found for one or both guards';
  END IF;

  UPDATE team_schedules
    SET team_id = _target_team_id
    WHERE shift_date = _requester_shift_date AND team_id = _requester_team_id;

  UPDATE team_schedules
    SET team_id = _requester_team_id
    WHERE shift_date = _target_shift_date AND team_id = _target_team_id;
END;
$$;
```

**2. `src/utils/swapScheduleUpdate.ts`** — substituir queries diretas por chamada RPC:

```typescript
export async function swapTeamSchedules(
  requesterId: string,
  targetId: string,
  requesterShiftDate: string,
  targetShiftDate: string
) {
  const { error } = await supabase.rpc('swap_team_schedules', {
    _requester_id: requesterId,
    _target_id: targetId,
    _requester_shift_date: requesterShiftDate,
    _target_shift_date: targetShiftDate,
  });

  if (error) {
    console.error('[swapTeamSchedules] RPC error:', error);
    throw new Error('Erro ao atualizar a escala de plantões');
  }
}
```

### Resultado

- O swap efetivamente atualiza os `team_id` na tabela `team_schedules` (sem depender de `admin_id`)
- Após aprovação, o dia trocado aparece com o `team_id` correto
- O segurança vê o dia no calendário pessoal e pode selecioná-lo para uma nova troca no formulário
- Nenhuma alteração necessária no `GuardSwapForm` — a lógica de `isDateInteractable` já verifica `schedule.team_id === currentUser.team_id`

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | Criar função `swap_team_schedules` |
| `src/utils/swapScheduleUpdate.ts` | Usar `supabase.rpc()` em vez de queries diretas |

