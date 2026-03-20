

## Plano: Aplicar trocas aprovadas retroativamente na escala

### Problema encontrado
1. **admin_id é NULL** em todos os registros de `team_schedules`, mas o código `swapScheduleUpdate.ts` filtra por `admin_id` — isso faz com que os updates nunca encontrem registros para atualizar
2. Existem **~30 trocas aprovadas** historicamente (de nov/2025 a mar/2026) que nunca foram refletidas no calendário
3. Algumas trocas afetam a mesma data, então a ordem de aplicação importa

### Solução em 3 partes

**1. Corrigir `swapScheduleUpdate.ts`**
- Remover o filtro `.eq('admin_id', adminId)` ou torná-lo opcional (aceitar NULL)
- Filtrar apenas por `shift_date` + `team_id` (que já é suficiente para identificar o registro)
- Isso garante que futuras aprovações funcionem corretamente

**2. Criar edge function temporária `apply-approved-swaps`**
- Busca todas as `swap_requests` com status APPROVED, ordenadas por `admin_approved_at`
- Para cada swap, em ordem cronológica:
  - Lê o `team_id` atual das duas datas em `team_schedules`
  - Troca os `team_id` entre as duas datas
- Usa service_role para ter acesso total de escrita
- Retorna relatório de quantas trocas foram aplicadas

**3. Executar a edge function e verificar**
- Deploy + chamada via curl
- Verificar no calendário se as cores estão corretas para março/2026

### Detalhe técnico

```text
Fluxo da edge function:
  1. SELECT swap_requests WHERE status = 'APPROVED' ORDER BY admin_approved_at
  2. Para cada swap:
     a. SELECT team_id FROM team_schedules WHERE shift_date = requester_date
     b. SELECT team_id FROM team_schedules WHERE shift_date = target_date
     c. UPDATE team_schedules SET team_id = (team do target) WHERE shift_date = requester_date
     d. UPDATE team_schedules SET team_id = (team do requester) WHERE shift_date = target_date
  3. Retorna { applied: N, errors: [...] }
```

### Escopo de arquivos
- `src/utils/swapScheduleUpdate.ts` — remover filtro admin_id
- `supabase/functions/apply-approved-swaps/index.ts` — criar (temporária)
- Após execução, deletar a edge function

